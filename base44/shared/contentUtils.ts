/**
 * Shared knowledge-content rules — the editorial workflow for the platform
 * catalogue (Knowledge Base).
 *
 * The catalogue is platform-wide (it has no tenant), so the write path lives in
 * a server function and not in an entity RLS: this file is the single source of
 * truth for who may move an article and which moves are legal.
 */

import { normalizeRole } from "./accessUtils.ts";

/** Roles that curate the shared content catalogue (mirrors rbac.js CONTENT_MGR). */
export const CONTENT_ROLES = ["master_admin", "workspace_admin", "grc_analyst"];

/** Editorial states of an article. Only `published` is visible in the catalogue. */
export const ARTICLE_STATUSES = ["draft", "in_review", "published", "archived"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export type ArticleAction = "submit_review" | "publish" | "reject" | "archive" | "restore";

/**
 * Legal transitions of the editorial workflow.
 * draft → in_review → published (or back to draft on reject); published → archived
 * (or back to in_review for a re-review); archived → draft (restore).
 */
export const ARTICLE_TRANSITIONS: Record<ArticleAction, { from: ArticleStatus[]; to: ArticleStatus }> = {
  submit_review: { from: ["draft", "archived"], to: "in_review" },
  publish: { from: ["in_review", "draft"], to: "published" },
  reject: { from: ["in_review"], to: "draft" },
  archive: { from: ["published", "in_review", "draft"], to: "archived" },
  restore: { from: ["archived"], to: "draft" },
};

export class ContentError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Assert the caller may curate the shared catalogue. */
export function assertContentManager(user: any): string {
  const role = normalizeRole(user?.role);
  if (!CONTENT_ROLES.includes(role)) {
    throw new ContentError("forbidden", "Apenas a equipa de conteúdo pode gerir o catálogo.", 403);
  }
  return role;
}

/** Validate an editorial move for the article's current status. */
export function assertTransition(action: ArticleAction, currentStatus: string) {
  const rule = ARTICLE_TRANSITIONS[action];
  if (!rule) throw new ContentError("unknown_action", "Ação editorial desconhecida.", 400);
  if (!rule.from.includes(currentStatus as ArticleStatus)) {
    throw new ContentError(
      "invalid_transition",
      `Não é possível ${action} um artigo com estado "${currentStatus}".`,
      409,
    );
  }
  return rule.to;
}

/** Server-side audit record of an editorial decision. */
export async function writeContentAuditLog(
  base44: any,
  action: string,
  details: string,
  entityId: string,
  userEmail: string,
): Promise<void> {
  await base44.asServiceRole.entities.AuditLog.create({
    customer_id: "",
    action,
    user_email: userEmail,
    entity_type: "KnowledgeArticle",
    entity_id: entityId,
    details,
  });
}
