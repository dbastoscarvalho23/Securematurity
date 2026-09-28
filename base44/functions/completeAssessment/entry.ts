import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { normalizeRole } from "../../shared/accessUtils.ts";
import { getEffectiveLicense } from "../../shared/licenseGuard.ts";
import {
  AssessmentError,
  appendStatusHistory,
  buildMethodology,
  computeCoverage,
  computeScores,
  completionType,
  assertCompletionAllowed,
} from "../../shared/assessmentScoring.ts";

/**
 * completeAssessment — server-side completion (and reopening) of Core NIS2
 * assessments. Closes defect 5 of the migration matrix: completion was a purely
 * client-side operation protected only by authentication.
 *
 * Guarantees:
 * - The actor always comes from the authenticated session, never from the body.
 * - Tenant authorization is verified here (own tenant + edit role, or an
 *   approved non-expired delegation with edit access) and the assessment module
 *   must be licensed for that customer.
 * - Coverage, scores and the methodology snapshot are computed from persisted
 *   responses; any score sent by the client is ignored.
 * - Completion and reopening are appended to the status history and audited with
 *   the real actor.
 *
 * Actions:
 * - complete: close the assessment with server-computed results
 * - reopen:   reopen a completed assessment, preserving the previous result
 */
const ASSESSMENT_MODULE = "assessments_action_plan";
/** Tenant roles that may complete an assessment of their own customer. */
const EDIT_ROLES = ["customer_admin", "grc_analyst"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === "complete") return await handleComplete(base44, user, body);
    if (action === "reopen") return await handleReopen(base44, user, body);

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof AssessmentError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Authorize an operational action on a customer.
 * Mirrors the delegation model: platform/partner roles never get automatic
 * access to tenant data, they need an approved, non-expired delegation.
 */
async function authorizeOperational(base44: any, user: any, customerId: string) {
  if (!customerId) {
    throw new AssessmentError("customer_required", "A avaliação não tem cliente associado.", 422);
  }

  const role = normalizeRole(user.role);
  const ownTenant = !!user.customer_id && user.customer_id === customerId;
  if (ownTenant && EDIT_ROLES.includes(role)) {
    return { via: "tenant_role", role };
  }

  const assignments = await base44.asServiceRole.entities.UserCustomerAssignment.filter({
    customer_id: customerId,
  });
  const now = Date.now();
  const active = assignments.filter((a: any) => {
    const isSameUser = a.user_id === user.id || (!!user.email && a.user_email === user.email);
    const live = !a.expires_at || new Date(a.expires_at).getTime() > now;
    return isSameUser && a.assignment_type === "delegation" && a.status === "approved" && live;
  });

  const canEdit = active.some((a: any) => a.access_level === "admin" || a.access_level === "contributor");
  if (canEdit) return { via: "delegation", role };

  throw new AssessmentError(
    "forbidden",
    "Não tem autorização para concluir avaliações deste cliente.",
    403,
  );
}

/** The assessments module must be licensed for the customer. */
async function assertModuleLicensed(base44: any, customerId: string) {
  const license = await getEffectiveLicense(base44, customerId);
  const codes = (license?.modules || []).map((m: any) => m.code);
  if (!license?.licensed || !codes.includes(ASSESSMENT_MODULE)) {
    throw new AssessmentError(
      "module_not_licensed",
      "O cliente não tem o módulo de Avaliações e Plano de Ação licenciado.",
      403,
    );
  }
}

/** Questions of an assessment: assessment-specific ones, else the selected global ones. */
async function loadQuestions(base44: any, assessment: any) {
  const specific = await base44.asServiceRole.entities.Question.filter({ assessment_id: assessment.id });
  if (specific.length > 0) return specific;

  const questionIds = assessment.question_ids || [];
  if (questionIds.length === 0) return [];

  const all = await base44.asServiceRole.entities.Question.list("order_index", 500);
  const wanted = new Set(questionIds);
  return all.filter((q: any) => wanted.has(q.id));
}

/** Responses are read from persistence and re-checked against the assessment tenant. */
async function loadResponses(base44: any, assessment: any) {
  const responses = await base44.asServiceRole.entities.AssessmentResponse.filter({
    assessment_id: assessment.id,
  });
  return responses.filter((r: any) => !r.customer_id || r.customer_id === assessment.customer_id);
}

async function loadFrameworkVersions(base44: any, codes: string[]) {
  const all = await base44.asServiceRole.entities.Framework.list();
  const byCode = new Map<string, any>(all.map((f: any) => [f.code, f]));
  return (codes || []).map((code) => ({ code, version: byCode.get(code)?.version || null }));
}

async function handleComplete(base44: any, user: any, body: any) {
  const { assessment_id, confirm_partial } = body;
  if (!assessment_id) {
    return Response.json({ error: "assessment_id is required" }, { status: 400 });
  }

  const assessment = await base44.asServiceRole.entities.Assessment.get(assessment_id);
  if (!assessment) return Response.json({ error: "Assessment not found" }, { status: 404 });

  const authorization = await authorizeOperational(base44, user, assessment.customer_id);
  await assertModuleLicensed(base44, assessment.customer_id);

  if (assessment.status === "completed") {
    return Response.json(
      { error: "A avaliação já está concluída. Reabra-a para a alterar.", code: "already_completed" },
      { status: 409 },
    );
  }

  const questions = await loadQuestions(base44, assessment);
  const responses = await loadResponses(base44, assessment);

  // Completion rules (coverage) are validated server-side.
  const coverage = assertCompletionAllowed(questions, responses, { confirm_partial: !!confirm_partial });

  // Scoring is always recomputed here — client-supplied scores are ignored.
  const scores = computeScores(questions, responses, assessment.frameworks || []);
  const methodology = buildMethodology(
    assessment,
    questions,
    await loadFrameworkVersions(base44, assessment.frameworks || []),
  );

  const completedAt = new Date().toISOString();
  const updated = await base44.asServiceRole.entities.Assessment.update(assessment.id, {
    status: "completed",
    overall_score: scores.overall_score,
    framework_scores: scores.framework_scores,
    coverage,
    methodology,
    completion_type: completionType(coverage),
    completed_date: completedAt.split("T")[0],
    completed_by: user.email || "",
    assessor_email: assessment.assessor_email || user.email || "",
    status_history: appendStatusHistory(assessment, {
      status: "completed",
      by: user.email || "",
      via: authorization.via,
      coverage_pct: coverage.coverage_pct,
      scoring_model: methodology.scoring_model,
    }),
  });

  await base44.asServiceRole.entities.AuditLog.create({
    customer_id: assessment.customer_id,
    action: "assessment_completed",
    user_email: user.email || "",
    entity_type: "Assessment",
    entity_id: assessment.id,
    details: JSON.stringify({
      via: authorization.via,
      completion_type: completionType(coverage),
      coverage,
      overall_score: scores.overall_score,
      scoring_model: methodology.scoring_model,
    }),
  });

  return Response.json({
    assessment: updated,
    coverage,
    overall_score: scores.overall_score,
    framework_scores: scores.framework_scores,
    scoring_model: methodology.scoring_model,
  });
}

async function handleReopen(base44: any, user: any, body: any) {
  const { assessment_id, reason } = body;
  if (!assessment_id) {
    return Response.json({ error: "assessment_id is required" }, { status: 400 });
  }
  if (!reason || !String(reason).trim()) {
    return Response.json({ error: "O motivo da reabertura é obrigatório.", code: "reason_required" }, { status: 400 });
  }

  const assessment = await base44.asServiceRole.entities.Assessment.get(assessment_id);
  if (!assessment) return Response.json({ error: "Assessment not found" }, { status: 404 });

  const authorization = await authorizeOperational(base44, user, assessment.customer_id);

  if (assessment.status !== "completed") {
    return Response.json(
      { error: "Só é possível reabrir uma avaliação concluída.", code: "not_completed" },
      { status: 409 },
    );
  }

  // The previous result is preserved, never deleted.
  const previousResult = {
    completed_at: assessment.completed_date || null,
    completed_by: assessment.completed_by || null,
    overall_score: assessment.overall_score ?? null,
    framework_scores: assessment.framework_scores || [],
    coverage: assessment.coverage || null,
    methodology: assessment.methodology || null,
    reopened_at: new Date().toISOString(),
    reopened_by: user.email || "",
    reason: String(reason).trim(),
  };

  const coverage = assessment.coverage || computeCoverage([], []);

  const updated = await base44.asServiceRole.entities.Assessment.update(assessment.id, {
    status: "in_progress",
    overall_score: null,
    framework_scores: [],
    coverage: null,
    methodology: null,
    completion_type: null,
    completed_date: null,
    completed_by: null,
    result_history: [...(assessment.result_history || []), previousResult],
    status_history: appendStatusHistory(assessment, {
      status: "in_progress",
      by: user.email || "",
      via: authorization.via,
      reason: previousResult.reason,
      previous_coverage_pct: coverage?.coverage_pct ?? null,
    }),
  });

  await base44.asServiceRole.entities.AuditLog.create({
    customer_id: assessment.customer_id,
    action: "assessment_reopened",
    user_email: user.email || "",
    entity_type: "Assessment",
    entity_id: assessment.id,
    details: JSON.stringify({
      via: authorization.via,
      reason: previousResult.reason,
      previous_overall_score: previousResult.overall_score,
    }),
  });

  return Response.json({ assessment: updated, previous_result: previousResult });
}
