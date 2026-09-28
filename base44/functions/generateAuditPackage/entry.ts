import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { AUDIT_PACKAGE_MODULE, authorizeAssessmentOperational } from "../../shared/assessmentAccess.ts";
import { AssessmentError } from "../../shared/assessmentScoring.ts";
import { getEffectiveLicense } from "../../shared/licenseGuard.ts";

/**
 * generateAuditPackage — assembles the audit package for an external reviewer.
 *
 * The package freezes, in a single persisted record, the six things an auditor
 * asks for: the scope (âmbito), the index (índice), the document versions
 * (versões), the controls with their assessed maturity (controlos), the evidence
 * with its hashes (evidências) and the decisions taken (decisões).
 *
 * Authorization mirrors the assessment pipeline: the actor is taken from the
 * session, must belong to the tenant with an operational role or hold an
 * approved, non-expired edit delegation, and the reports/audit module must be
 * licensed for that customer. Everything is read with the service role and
 * audited with the real actor.
 *
 * Actions:
 * - generate: build and persist a new package
 * - finalize: freeze an existing package (draft → final)
 */
const PACKAGE_VERSION = "1.0";
const MODULE = "reporting_audit_prep";
const MAX_ENTRIES = 200;

class AuditPackageError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

import { resolveActor } from "../../shared/devActor.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await resolveActor(base44, req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === "generate") return await handleGenerate(base44, user, body);
    if (action === "finalize") return await handleFinalize(base44, user, body);

    return Response.json({ error: "Unknown action", code: "unknown_action" }, { status: 400 });
  } catch (error) {
    if (error instanceof AuditPackageError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    // Reuse the assessment authorization errors (forbidden / customer_required).
    if (error instanceof AssessmentError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function assertOperational(base44: any, user: any, customerId: string) {
  if (!customerId) {
    throw new AuditPackageError("customer_required", "O pacote de auditoria exige um cliente.", 422);
  }
  const authorization = await authorizeAssessmentOperational(base44, user, customerId, AUDIT_PACKAGE_MODULE);
  const license = await getEffectiveLicense(base44, customerId);
  const codes = (license?.modules || []).map((m: any) => m.code);
  if (!license?.licensed || !codes.includes(MODULE)) {
    throw new AuditPackageError(
      "module_not_licensed",
      "O cliente não tem o módulo de Relatórios e Preparação de Auditoria licenciado.",
      403,
    );
  }
  return authorization;
}

async function handleGenerate(base44: any, user: any, body: any) {
  const customerId = body.customer_id;
  const authorization = await assertOperational(base44, user, customerId);

  const svc = base44.asServiceRole;
  const customer = await svc.entities.Customer.get(customerId);
  if (!customer) throw new AuditPackageError("customer_not_found", "Cliente não encontrado.", 404);

  const license = await getEffectiveLicense(base44, customerId);

  // ─── Controls + evidence anchor: latest completed assessment ───
  const assessments = await svc.entities.Assessment.filter({ customer_id: customerId });
  const completed = assessments
    .filter((a: any) => a.status === "completed")
    .sort((a: any, b: any) => String(b.completed_date || "").localeCompare(String(a.completed_date || "")));
  const anchor = completed[0] || null;

  const frameworkCodes = body.framework_codes?.length
    ? body.framework_codes
    : (anchor?.frameworks || []).filter(Boolean);

  const questions = await svc.entities.Question.list("order_index", 500);
  const questionById = new Map<string, any>(questions.map((q: any) => [q.id, q]));

  const responses = anchor
    ? (await svc.entities.AssessmentResponse.filter({ assessment_id: anchor.id }))
        .filter((r: any) => !r.customer_id || r.customer_id === customerId)
    : [];
  const responseByQuestion = new Map<string, any>(responses.map((r: any) => [r.question_id, r]));

  // ─── Versions ───
  const documents = await svc.entities.SecurityDocument.filter({ customer_id: customerId });
  const versions = documents.slice(0, MAX_ENTRIES).map((doc: any) => ({
    ref: doc.id,
    label: `${doc.title} — v${doc.version || "—"}`,
    detail: `${doc.level || ""}${doc.customer_name ? "" : ""} · ${doc.status || ""}${
      doc.approved_by ? ` · aprovado por ${doc.approved_by}` : ""
    }`,
    status: doc.status || "",
    hash: doc.content_hash || "",
    date: doc.approved_date || doc.updated_date || doc.created_date || null,
    url: doc.file_url || "",
  }));

  // ─── Controls (from the anchor assessment) ───
  const controls: any[] = [];
  if (anchor) {
    for (const declared of anchor.methodology?.questions || []) {
      const question = questionById.get(declared.question_id);
      const response = responseByQuestion.get(declared.question_id);
      controls.push({
        ref: declared.control_id || question?.control_id || "",
        label: question?.question_text || declared.control_id || declared.question_id,
        detail: describeControl(declared, response),
        status: controlStatus(declared, response),
        hash: "",
        date: anchor.completed_date || null,
        url: "",
      });
    }
  }

  // ─── Evidence (assessment attachments + registered files) ───
  const evidence: any[] = [];
  for (const response of responses) {
    for (const attachment of response.attachments || []) {
      evidence.push({
        ref: response.control_id || response.question_id || "",
        label: attachment.name || "evidência",
        detail: response.domain || "",
        status: "attached",
        hash: attachment.hash || "",
        date: response.updated_date || response.created_date || null,
        url: attachment.url || "",
      });
    }
  }
  for (const doc of documents) {
    if (!doc.file_url) continue;
    evidence.push({
      ref: doc.id,
      label: doc.file_name || doc.title,
      detail: `${doc.level || ""} · v${doc.version || "—"}`,
      status: doc.status || "",
      hash: doc.content_hash || "",
      date: doc.approved_date || doc.updated_date || doc.created_date || null,
      url: doc.file_url,
    });
  }

  // ─── Decisions (attestations + audited decisions) ───
  const attestations = await svc.entities.PolicyAttestation.filter({ customer_id: customerId });
  const decisions: any[] = attestations.slice(0, MAX_ENTRIES).map((a: any) => ({
    ref: a.id,
    label: `${a.policy_title || "Política"}${a.policy_version ? ` v${a.policy_version}` : ""}`,
    detail: `${a.user_email || ""} — ${a.status || "pending"}`,
    status: a.status || "pending",
    hash: "",
    date: a.attested_date || a.due_date || null,
    url: "",
  }));

  const logs = await svc.entities.AuditLog.list("-created_date", 1000);
  const decisionActions = new Set([
    "assessment_completed",
    "assessment_reopened",
    "document_approved",
    "document_reviewed",
    "content_status_changed",
  ]);
  for (const log of logs) {
    if (log.customer_id !== customerId) continue;
    if (!decisionActions.has(log.action)) continue;
    decisions.push({
      ref: log.entity_id || log.id,
      label: log.action,
      detail: log.details || "",
      status: "recorded",
      hash: "",
      date: log.created_date || null,
      url: log.user_email || "",
    });
    if (decisions.length >= MAX_ENTRIES) break;
  }

  // ─── Actions still open ───
  const tasks = await svc.entities.Task.filter({ customer_id: customerId });
  const openActions = tasks.filter((task: any) => task.status !== "done" && task.status !== "completed").length;

  const versionsSection = { key: "versions", label: "Versões", entries: versions };
  const controlsSection = { key: "controls", label: "Controlos", entries: controls };
  const evidenceSection = { key: "evidence", label: "Evidências", entries: evidence };
  const decisionsSection = { key: "decisions", label: "Decisões", entries: decisions };
  const sections = [versionsSection, controlsSection, evidenceSection, decisionsSection];

  const scope = {
    customer_id: customerId,
    customer_name: customer.name || "",
    frameworks: frameworkCodes,
    standards: license.standards || [],
    period_start: body.period_start || anchor?.completed_date || null,
    period_end: body.period_end || anchor?.completed_date || null,
    assessments_considered: completed.length,
    methodology_versions: (anchor?.methodology?.framework_versions || []).map((f: any) => ({
      code: f.code || "",
      version: f.version ?? null,
    })),
  };

  const summary = {
    versions: versions.length,
    controls: controls.length,
    controls_not_implemented: controls.filter((c) => c.status === "gap" || c.status === "uncovered").length,
    evidence: evidence.length,
    decisions: decisions.length,
    open_actions: openActions,
  };

  const index = sections.map((section) => ({
    key: section.key,
    label: section.label,
    description: SECTION_DESCRIPTIONS[section.key] || "",
    count: section.entries.length,
  }));

  const title = `Pacote de auditoria — ${(frameworkCodes[0] || "NIS2")}${
    anchor?.period ? ` ${anchor.period}` : ""
  }`;

  const created = await svc.entities.AuditPackage.create({
    customer_id: customerId,
    customer_name: customer.name || "",
    title,
    status: "draft",
    package_version: PACKAGE_VERSION,
    period_start: scope.period_start,
    period_end: scope.period_end,
    frameworks: frameworkCodes,
    scope,
    index,
    sections,
    summary,
    generated_by: user.email || "",
    generated_at: new Date().toISOString(),
    notes: body.notes || "",
  });

  await svc.entities.AuditLog.create({
    customer_id: customerId,
    action: "audit_package_generated",
    user_email: user.email || "",
    entity_type: "AuditPackage",
    entity_id: created.id,
    details: JSON.stringify({ via: authorization.via, version: PACKAGE_VERSION, summary }),
  });

  return Response.json({ package: created, summary });
}

async function handleFinalize(base44: any, user: any, body: any) {
  const packageId = body.package_id;
  if (!packageId) throw new AuditPackageError("package_required", "package_id is required.", 400);

  const svc = base44.asServiceRole;
  const current = await svc.entities.AuditPackage.get(packageId);
  if (!current) throw new AuditPackageError("package_not_found", "Pacote não encontrado.", 404);

  await assertOperational(base44, user, current.customer_id);

  if (current.status === "final") {
    throw new AuditPackageError("already_final", "O pacote já está fechado.", 409);
  }

  const updated = await svc.entities.AuditPackage.update(packageId, {
    status: "final",
    notes: body.notes || current.notes || "",
  });

  await svc.entities.AuditLog.create({
    customer_id: current.customer_id,
    action: "audit_package_generated",
    user_email: user.email || "",
    entity_type: "AuditPackage",
    entity_id: packageId,
    details: JSON.stringify({ finalize: true, version: current.package_version }),
  });

  return Response.json({ package: updated });
}

const SECTION_DESCRIPTIONS: Record<string, string> = {
  versions: "Versões dos documentos de segurança com o respetivo estado e aprovação.",
  controls: "Controlos avaliados, com a maturidade observada face ao alvo.",
  evidence: "Evidências recolhidas (ficheiros anexados e documentos registados) com o respetivo hash.",
  decisions: "Decisões registadas: atestações, conclusões de avaliação e aprovações.",
};

function describeControl(declared: any, response: any): string {
  if (!response) return "Sem resposta — requisito não coberto.";
  if (response.answer_state === "not_applicable") return "Não aplicável (decisão de âmbito).";
  const target = response.target_level ?? 4;
  return `Maturidade ${response.maturity_level ?? "—"} de alvo ${target}${
    response.evidence_notes ? ` · ${response.evidence_notes}` : ""
  }`;
}

function controlStatus(declared: any, response: any): string {
  if (!response) return "uncovered";
  if (response.answer_state === "not_applicable") return "not_applicable";
  const target = response.target_level ?? 4;
  return (response.maturity_level ?? 0) >= target ? "ok" : "gap";
}
