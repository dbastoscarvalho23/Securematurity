import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { AssessmentError } from "../../shared/assessmentScoring.ts";
import {
  ASSESSMENT_MODULE,
  authorizeAssessmentOperational,
  assertAssessmentModuleLicensed,
  loadAssessmentQuestions,
  loadAssessmentResponses,
} from "../../shared/assessmentAccess.ts";
import {
  gapToAction,
  gapToRecommendation,
  identifyGaps,
  summarizeGaps,
} from "../../shared/gapAnalysis.ts";

/**
 * manageActionPlan — second half of the Core NIS2 journey (Phase 6): turns a
 * completed assessment into traceable gaps, and each gap into an action with a
 * responsible, a due date, a priority, a status and required evidence.
 *
 * Actions:
 * - identify_gaps:    derive the gaps from the persisted responses and record
 *                     them as Recommendations linked to the requirement
 *                     (question + control + framework)
 * - generate_actions: create the Task (the action) for each recorded gap
 *
 * Both are idempotent — a gap is never recorded twice for the same question and
 * an action is never duplicated for the same gap — and both share the exact
 * tenant/delegation authorization and module licence as completeAssessment.
 */
import { resolveActor } from "../../shared/devActor.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await resolveActor(base44, req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    if (body.action === "identify_gaps") return await handleIdentifyGaps(base44, user, body);
    if (body.action === "generate_actions") return await handleGenerateActions(base44, user, body);

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof AssessmentError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/** Load the assessment and prove the actor may operate on it (tenant + licence). */
async function loadContext(base44: any, user: any, body: any) {
  const { assessment_id } = body;
  if (!assessment_id) {
    throw new AssessmentError("assessment_required", "assessment_id is required", 400);
  }

  const assessment = await base44.asServiceRole.entities.Assessment.get(assessment_id);
  if (!assessment) throw new AssessmentError("not_found", "Assessment not found", 404);

  const authorization = await authorizeAssessmentOperational(base44, user, assessment.customer_id, ASSESSMENT_MODULE);
  await assertAssessmentModuleLicensed(base44, assessment.customer_id);

  return { assessment, authorization };
}

async function handleIdentifyGaps(base44: any, user: any, body: any) {
  const { assessment, authorization } = await loadContext(base44, user, body);

  if (assessment.status !== "completed") {
    throw new AssessmentError(
      "not_completed",
      "Só uma avaliação concluída pode ser analisada quanto a lacunas.",
      409,
    );
  }

  const questions = await loadAssessmentQuestions(base44, assessment);
  const responses = await loadAssessmentResponses(base44, assessment);

  const gaps = identifyGaps(questions, responses, { target_default: body.target_level });
  const summary = summarizeGaps(gaps);

  const questionById = new Map(questions.map((q: any) => [q.id, q]));
  const existing = await base44.asServiceRole.entities.Recommendation.filter({
    assessment_id: assessment.id,
  });
  const recorded = new Set(existing.map((r: any) => r.question_id).filter(Boolean));

  const recommendations = [];
  for (const gap of gaps) {
    if (recorded.has(gap.question_id)) continue;
    recommendations.push(
      await base44.asServiceRole.entities.Recommendation.create(
        gapToRecommendation(gap, questionById.get(gap.question_id), assessment),
      ),
    );
  }

  await base44.asServiceRole.entities.AuditLog.create({
    customer_id: assessment.customer_id,
    action: "assessment_gaps_identified",
    user_email: user.email || "",
    entity_type: "Assessment",
    entity_id: assessment.id,
    details: JSON.stringify({
      via: authorization.via,
      gaps: summary.total,
      created: recommendations.length,
      by_priority: summary.by_priority,
      by_type: summary.by_type,
    }),
  });

  return Response.json({
    assessment_id: assessment.id,
    summary,
    gaps,
    created: recommendations.length,
    recommendations,
  });
}

async function handleGenerateActions(base44: any, user: any, body: any) {
  const { assessment, authorization } = await loadContext(base44, user, body);

  const recommendations = await base44.asServiceRole.entities.Recommendation.filter({
    assessment_id: assessment.id,
  });
  if (recommendations.length === 0) {
    throw new AssessmentError(
      "no_gaps",
      "Identifique primeiro as lacunas da avaliação antes de gerar ações.",
      422,
    );
  }

  const tasks = await base44.asServiceRole.entities.Task.filter({ assessment_id: assessment.id });
  const alreadyLinked = new Set(tasks.map((t: any) => t.recommendation_id).filter(Boolean));

  const assignedTo = (body.assigned_to || "").trim() || assessment.assessor_email || user.email || "";

  const created = [];
  for (const recommendation of recommendations) {
    if (recommendation.status === "dismissed") continue;
    if (alreadyLinked.has(recommendation.id)) continue;
    created.push(
      await base44.asServiceRole.entities.Task.create(
        gapToAction(recommendation, assessment, { assigned_to: assignedTo }),
      ),
    );
  }

  await base44.asServiceRole.entities.AuditLog.create({
    customer_id: assessment.customer_id,
    action: "action_plan_generated",
    user_email: user.email || "",
    entity_type: "Assessment",
    entity_id: assessment.id,
    details: JSON.stringify({
      via: authorization.via,
      actions_created: created.length,
      assigned_to: assignedTo,
    }),
  });

  return Response.json({
    assessment_id: assessment.id,
    created: created.length,
    assigned_to: assignedTo,
    tasks: created,
  });
}
