/**
 * Assessment access — shared authorization, licensing and data loading for the
 * Core NIS2 assessment pipeline.
 *
 * Extracted from `completeAssessment` so that every server-side operation on an
 * assessment (completion, reopening, gap analysis and action generation)
 * enforces exactly the same tenant boundary, the same delegation rules and the
 * same module licence. Keeping one copy avoids the two paths drifting apart.
 */

import { normalizeRole } from "./accessUtils.ts";
import { getEffectiveLicense } from "./licenseGuard.ts";
import { AssessmentError } from "./assessmentScoring.ts";

/** Module that gates the assessment journey (diagnóstico + plano de ação). */
export const ASSESSMENT_MODULE = "assessments_action_plan";

/** Tenant roles that may operate an assessment of their own customer. */
export const ASSESSMENT_EDIT_ROLES = ["customer_admin", "grc_analyst"];

/**
 * Authorize an operational action on a customer.
 * Mirrors the delegation model: platform/partner roles never get automatic
 * access to tenant data, they need an approved, non-expired delegation.
 */
export async function authorizeAssessmentOperational(base44: any, user: any, customerId: string) {
  if (!customerId) {
    throw new AssessmentError("customer_required", "A avaliação não tem cliente associado.", 422);
  }

  const role = normalizeRole(user.role);
  const ownTenant = !!user.customer_id && user.customer_id === customerId;
  if (ownTenant && ASSESSMENT_EDIT_ROLES.includes(role)) {
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
    "Não tem autorização para operar avaliações deste cliente.",
    403,
  );
}

/** The assessments module must be licensed for the customer. */
export async function assertAssessmentModuleLicensed(base44: any, customerId: string) {
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
export async function loadAssessmentQuestions(base44: any, assessment: any) {
  const specific = await base44.asServiceRole.entities.Question.filter({ assessment_id: assessment.id });
  if (specific.length > 0) return specific;

  const questionIds = assessment.question_ids || [];
  if (questionIds.length === 0) return [];

  const all = await base44.asServiceRole.entities.Question.list("order_index", 500);
  const wanted = new Set(questionIds);
  return all.filter((q: any) => wanted.has(q.id));
}

/** Responses are read from persistence and re-checked against the assessment tenant. */
export async function loadAssessmentResponses(base44: any, assessment: any) {
  const responses = await base44.asServiceRole.entities.AssessmentResponse.filter({
    assessment_id: assessment.id,
  });
  return responses.filter((r: any) => !r.customer_id || r.customer_id === assessment.customer_id);
}
