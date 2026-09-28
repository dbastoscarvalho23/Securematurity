import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { normalizeRole } from "../../shared/accessUtils.ts";
import { getEffectiveLicense } from "../../shared/licenseGuard.ts";

/**
 * reviewDocument — server-side review and approval of a security document.
 *
 * Closes the Phase 7 gap "revisão/aprovação por evidência": the decision is
 * taken on the server, with the actor coming from the session, gated by the
 * tenant (own role or an approved, non-expired edit delegation) and by the
 * documents/evidence module licence. Approving snapshots the document into a
 * DocumentVersion, preserving the file hash so the evidence stays verifiable.
 *
 * Actions:
 * - submit_review:   draft/approved → under_review
 * - approve:         under_review/draft → approved (snapshots the version)
 * - request_changes: under_review → draft (requires a note)
 * - deprecate:       approved/under_review → deprecated
 */
const MODULE = "documents_evidence";

/** Roles that may operate a document of their own tenant. */
const OPERATE_ROLES = ["customer_admin", "grc_analyst", "control_owner"];
/** Roles (or delegation levels) that may approve. */
const APPROVE_ROLES = ["customer_admin"];

const TRANSITIONS: Record<string, { from: string[]; to: string; approve?: boolean }> = {
  submit_review: { from: ["draft", "approved"], to: "under_review" },
  approve: { from: ["under_review", "draft"], to: "approved", approve: true },
  request_changes: { from: ["under_review"], to: "draft" },
  deprecate: { from: ["approved", "under_review"], to: "deprecated", approve: true },
};

class ReviewError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const documentId = body.document_id;

    if (!documentId) throw new ReviewError("document_required", "document_id is required.", 400);
    const rule = TRANSITIONS[action];
    if (!rule) throw new ReviewError("unknown_action", "Ação de revisão desconhecida.", 400);

    const svc = base44.asServiceRole;
    const doc = await svc.entities.SecurityDocument.get(documentId);
    if (!doc) throw new ReviewError("document_not_found", "Documento não encontrado.", 404);

    const authority = await resolveAuthority(base44, user, doc.customer_id, !!rule.approve);

    if (!rule.from.includes(doc.status || "draft")) {
      throw new ReviewError(
        "invalid_transition",
        `Não é possível ${action} um documento com o estado "${doc.status}".`,
        409,
      );
    }

    const note = String(body.note || "").trim();
    if (action === "request_changes" && !note) {
      throw new ReviewError("note_required", "O pedido de alterações exige um motivo.", 400);
    }

    const actor = user.display_name || user.full_name || user.email || "";
    const patch: Record<string, unknown> = { status: rule.to, review_note: note };

    if (action === "approve") {
      patch.approved_by = note ? `${actor} — ${note}` : actor;
      patch.approved_date = new Date().toISOString().split("T")[0];
      await snapshotVersion(svc, doc, actor, note, authority.via);
    }

    const updated = await svc.entities.SecurityDocument.update(documentId, patch);

    await svc.entities.AuditLog.create({
      customer_id: doc.customer_id,
      action: "document_reviewed",
      user_email: user.email || "",
      entity_type: "SecurityDocument",
      entity_id: documentId,
      details: JSON.stringify({
        action,
        from: doc.status,
        status: rule.to,
        via: authority.via,
        hash: doc.content_hash || "",
        note,
      }),
    });

    return Response.json({ document: updated, status: rule.to });
  } catch (error) {
    if (error instanceof ReviewError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/** Own tenant with an operating role, or an approved non-expired edit delegation. */
async function resolveAuthority(base44: any, user: any, customerId: string, requiresApprover: boolean) {
  if (!customerId) throw new ReviewError("customer_required", "O documento não tem cliente associado.", 422);

  const license = await getEffectiveLicense(base44, customerId);
  const codes = (license?.modules || []).map((m: any) => m.code);
  if (!license?.licensed || !codes.includes(MODULE)) {
    throw new ReviewError(
      "module_not_licensed",
      "O cliente não tem o módulo de Documentos e Evidências licenciado.",
      403,
    );
  }

  const role = normalizeRole(user.role);
  if (user.customer_id === customerId && OPERATE_ROLES.includes(role)) {
    if (requiresApprover && !APPROVE_ROLES.includes(role)) {
      throw new ReviewError("forbidden", "Só o administrador do cliente pode aprovar documentos.", 403);
    }
    return { via: "tenant_role", role };
  }

  const assignments = await base44.asServiceRole.entities.UserCustomerAssignment.filter({
    customer_id: customerId,
  });
  const now = Date.now();
  const active = assignments.find((a: any) => {
    const sameUser = a.user_id === user.id || (!!user.email && a.user_email === user.email);
    const live = !a.expires_at || new Date(a.expires_at).getTime() > now;
    return sameUser && a.assignment_type === "delegation" && a.status === "approved" && live;
  });

  if (active && (active.access_level === "admin" || active.access_level === "contributor")) {
    if (requiresApprover && active.access_level !== "admin") {
      throw new ReviewError("forbidden", "A aprovação exige delegação de administração.", 403);
    }
    return { via: "delegation", role };
  }

  throw new ReviewError("forbidden", "Não tem autorização para rever documentos deste cliente.", 403);
}

/** Freeze the approved state as a version, preserving the file hash. */
async function snapshotVersion(base44: any, doc: any, actor: string, note: string, via: string) {
  await base44.asServiceRole.entities.DocumentVersion.create({
    document_id: doc.id,
    version_label: doc.version,
    title: doc.title,
    description: doc.description,
    level: doc.level,
    status: "approved",
    file_url: doc.file_url,
    file_name: doc.file_name,
    content_hash: doc.content_hash || "",
    approved_by: doc.approved_by,
    approved_date: doc.approved_date,
    review_date: doc.review_date,
    tags: doc.tags,
    framework_codes: doc.framework_codes,
    changed_by: actor,
    change_note: `Aprovação (${via})${note ? ` — ${note}` : ""}`,
  });
}
