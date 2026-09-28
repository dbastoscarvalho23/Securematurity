import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import {
  ARTICLE_TRANSITIONS,
  ContentError,
  assertContentManager,
  assertTransition,
  writeContentAuditLog,
} from "../../shared/contentUtils.ts";
import type { ArticleAction } from "../../shared/contentUtils.ts";

/**
 * transitionArticleStatus — the editorial workflow of the platform content
 * catalogue (Knowledge Base).
 *
 * The catalogue is platform-wide and has no tenant, so it has no entity RLS
 * write path: every mutation goes through this function, which verifies the
 * curation role from the session, applies only legal transitions and audits the
 * decision with the real actor.
 *
 * Actions:
 * - save:           create/update the content of an article (authoring)
 * - submit_review:  draft/archived → in_review
 * - publish:        in_review/draft → published (bumps the revision, sets the date)
 * - reject:         in_review → draft (requires a note)
 * - archive:        published/in_review/draft → archived
 * - restore:        archived → draft
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    assertContentManager(user);

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === "save") return await handleSave(base44, user, body);

    return await handleTransition(base44, user, body);
  } catch (error) {
    if (error instanceof ContentError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/** Authoring path — the status is never taken from the body. */
async function handleSave(base44: any, user: any, body: any) {
  const slug = String(body.slug || "").trim();
  if (!slug) {
    return Response.json({ error: "O identificador do artigo é obrigatório.", code: "slug_required" }, { status: 400 });
  }
  const title = String(body.title || "").trim();
  if (!title) {
    return Response.json({ error: "O título é obrigatório.", code: "title_required" }, { status: 400 });
  }
  const section = body.section === "compliance" ? "compliance" : "platform";

  const content = {
    slug,
    title,
    summary: body.summary || "",
    body: body.body || "",
    category: body.category || "article",
    framework: body.framework || "",
    tags: Array.isArray(body.tags) ? body.tags.filter(Boolean) : [],
    section,
    order_index: Number.isFinite(body.order_index) ? body.order_index : 0,
    is_active: body.is_active !== false,
    author_email: user.email || "",
  };

  const articleId = body.article_id || body.id;
  if (!articleId) {
    const created = await base44.asServiceRole.entities.KnowledgeArticle.create({
      ...content,
      status: "draft",
      version: 1,
      review_note: "",
      reviewer_email: "",
      published_at: "",
    });
    await writeContentAuditLog(
      base44,
      "content_saved",
      JSON.stringify({ action: "create", slug, status: "draft" }),
      created.id,
      user.email || "",
    );
    return Response.json({ article: created, status: created.status });
  }

  const current = await base44.asServiceRole.entities.KnowledgeArticle.get(articleId);
  if (!current) return Response.json({ error: "Artigo não encontrado." }, { status: 404 });

  // Editing published content sends it back to review; a live article is never
  // silently replaced.
  const nextStatus = current.status === "published" ? "in_review" : current.status;
  const updated = await base44.asServiceRole.entities.KnowledgeArticle.update(articleId, {
    ...content,
    status: nextStatus,
  });

  await writeContentAuditLog(
    base44,
    "content_saved",
    JSON.stringify({ action: "update", slug, from: current.status, status: nextStatus }),
    articleId,
    user.email || "",
  );

  return Response.json({ article: updated, status: nextStatus });
}

/** Editorial transition — only legal moves, always audited. */
async function handleTransition(base44: any, user: any, body: any) {
  const articleId = body.article_id || body.id;
  const action = body.action as ArticleAction;

  if (!articleId) {
    return Response.json({ error: "article_id is required", code: "article_required" }, { status: 400 });
  }
  if (!body.action || !(body.action in ARTICLE_TRANSITIONS)) {
    return Response.json({ error: "Ação editorial desconhecida.", code: "unknown_action" }, { status: 400 });
  }

  const article = await base44.asServiceRole.entities.KnowledgeArticle.get(articleId);
  if (!article) return Response.json({ error: "Artigo não encontrado." }, { status: 404 });

  const note = String(body.note || "").trim();
  if (action === "reject" && !note) {
    return Response.json({ error: "A rejeição exige um motivo.", code: "note_required" }, { status: 400 });
  }

  const nextStatus = assertTransition(action, article.status);

  const patch: Record<string, unknown> = {
    status: nextStatus,
    reviewer_email: user.email || "",
    review_note: note,
  };

  if (nextStatus === "published") {
    patch.published_at = new Date().toISOString();
    patch.version = (article.version || 1) + 1;
  }

  const updated = await base44.asServiceRole.entities.KnowledgeArticle.update(articleId, patch);

  await writeContentAuditLog(
    base44,
    "content_status_changed",
    JSON.stringify({ slug: article.slug, action, from: article.status, status: nextStatus, note }),
    articleId,
    user.email || "",
  );

  return Response.json({ article: updated, status: nextStatus });
}
