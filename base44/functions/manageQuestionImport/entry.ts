import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { normalizeRole, isPlatformOwner } from "../../shared/accessUtils.ts";
import { resolveActor } from "../../shared/devActor.ts";
import { guardRateLimit } from "../../shared/rateLimit.ts";
import {
  MAX_COMPARE_QUESTIONS,
  QUESTION_FIELDS,
  REVIEW_STATES,
  buildImportItems,
  controlPayload,
  frameworkPayload,
  normalizeBundle,
  questionPayload,
  summarizeItems,
} from "../../shared/questionImport.ts";

/**
 * manageQuestionImport — importação de bases de perguntas (rascunho → revisão → publicação).
 *
 * O banco de perguntas só tinha entrada manual, geração por IA, tradução e
 * deduplicação: carregar uma base externa obrigava a recriar tudo pergunta a
 * pergunta. Esta função é a única porta da importação — a entidade de catálogo
 * (`Question`, `FrameworkControl`, `Framework`) continua sem caminho de escrita
 * no browser, e os lotes vivem em `QuestionImportBatch`/`QuestionImportItem`
 * (RLS master_admin, escritos aqui com o service role):
 *
 *   - `validate`      — classifica o pacote (válido / aviso / duplicado / erro)
 *                       SEM escrever nada; alimenta a pré-visualização.
 *   - `create_draft`  — valida outra vez (fonte de verdade) e persiste o lote em
 *                       rascunho; o catálogo fica intacto.
 *   - `list` / `get`  — histórico e detalhe do lote (proveniência + itens).
 *   - `review`        — aprova/exclui linhas e edita um item (reeditado = revalidado).
 *   - `publish`       — ÚNICO momento de escrita no catálogo, atómico (pré-verifica
 *                       tudo antes de escrever), idempotente e auditado.
 *   - `discard`       — descarta um rascunho sem tocar no catálogo.
 *   - `revert`        — desfaz um lote publicado a partir do snapshot `before`
 *                       (criações são eliminadas, alterações restauradas).
 *
 * Regra de qualidade herdada do gerador por IA: a classificação usa a mesma
 * normalização + Jaccard (`base44/shared/questionImport.ts`, espelho de
 * `src/lib/questionSimilarity.js`) e a chave lógica framework+controlo+texto.
 * Nada é apagado do catálogo por uma importação: uma pergunta que o ficheiro
 * marca como `is_active: false` é desactivada.
 */

const MAX_BATCHES = 100;
const MAX_ITEMS = 2000;

function forbidden() {
  return Response.json({ error: "Forbidden" }, { status: 403 });
}

/** Contexto de comparação: o catálogo atual (framework, controlos e perguntas). */
async function loadContext(base44: any) {
  const [frameworks, controls, questions] = await Promise.all([
    base44.asServiceRole.entities.Framework.list("code", 500),
    base44.asServiceRole.entities.FrameworkControl.list("control_id", 1000),
    base44.asServiceRole.entities.Question.list("order_index", MAX_COMPARE_QUESTIONS),
  ]);
  return {
    frameworks: frameworks || [],
    controls: controls || [],
    questions: questions || [],
  };
}

/** Itens classificados a partir do pacote recebido (sem persistir). */
async function classify(base44: any, bundle: any) {
  const context = await loadContext(base44);
  const normalized = normalizeBundle(bundle);
  return buildImportItems(normalized, context);
}

async function loadBatchItems(base44: any, batchId: string) {
  return (await base44.asServiceRole.entities.QuestionImportItem.filter({ batch_id: batchId }, "row_number", MAX_ITEMS)) || [];
}

/** Reclassifica um item já persistido (após edição na revisão). */
async function reclassifyItem(base44: any, item: any) {
  const bundle =
    item.item_type === "framework"
      ? { framework: item, controls: [], questions: [] }
      : item.item_type === "control"
        ? { framework: null, controls: [item], questions: [] }
        : { framework: null, controls: [], questions: [item] };
  const [classified] = await classify(base44, bundle);
  if (!classified) return null;
  return {
    state: classified.state,
    action: classified.action,
    target_id: classified.target_id,
    issues: classified.issues,
    similarity: classified.similarity,
    similar_to: classified.similar_to,
    before: classified.before,
    framework_code: classified.framework_code,
  };
}

/** Campos editáveis de um item na revisão (por tipo). */
function allowedPatchFields(itemType: string): string[] {
  if (itemType === "question") {
    return [...QUESTION_FIELDS, "is_active", "title", "description"];
  }
  if (itemType === "control") {
    return ["framework_code", "control_id", "domain", "title", "description"];
  }
  return ["framework_code", "framework_name", "framework_version", "framework_status", "reference_url"];
}

function buildPatch(item: any, patch: any): Record<string, any> {
  const allowed = allowedPatchFields(item.item_type);
  const next: Record<string, any> = {};
  for (const field of allowed) {
    if (patch?.[field] === undefined) continue;
    next[field] = patch[field];
  }
  if (next.weight !== undefined) next.weight = Number(next.weight);
  if (next.order_index !== undefined) next.order_index = Number(next.order_index);
  return next;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await resolveActor(base44, req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // OP-S2 — ritmo por ator: rascunhos, revisão e publicação de lotes.
    const limited = guardRateLimit(user, "write", req);
    if (limited) return limited;

    const role = normalizeRole(user.role);
    if (!isPlatformOwner(role)) return forbidden();

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action || "list";

    // ── validate — pré-visualização, sem escrever nada ──────────────────
    if (action === "validate") {
      const items = await classify(base44, body.bundle);
      return Response.json({ items, summary: summarizeItems(items) });
    }

    // ── create_draft — persiste o lote em rascunho ──────────────────────
    if (action === "create_draft") {
      const items = await classify(base44, body.bundle);
      if (items.length === 0) {
        return Response.json({ error: "empty_bundle" }, { status: 422 });
      }
      const summary = summarizeItems(items);
      const file = body.file || {};

      const batch = await base44.asServiceRole.entities.QuestionImportBatch.create({
        status: "draft",
        source_file_name: String(file.name || "import.json").slice(0, 200),
        source_file_type: ["json", "csv", "xlsx", "pdf", "docx"].includes(file.type) ? file.type : "manual",
        source_file_hash: String(file.hash || ""),
        imported_by: user.email || "unknown",
        imported_by_role: role,
        framework_codes: summary.framework_codes,
        item_count: summary.item_count,
        question_count: summary.question_count,
        control_count: summary.control_count,
        framework_count: summary.framework_count,
        valid_count: summary.valid_count,
        warning_count: summary.warning_count,
        duplicate_count: summary.duplicate_count,
        error_count: summary.error_count,
        published_at: null,
        published_by: "",
        discarded_at: null,
        reverted_at: null,
      });

      const stored = await Promise.all(
        items.map((item: any) =>
          base44.asServiceRole.entities.QuestionImportItem.create({
            ...item,
            batch_id: batch.id,
            reviewed_by: "",
            reviewed_at: "",
            applied_id: "",
          }),
        ),
      );

      await base44.asServiceRole.entities.AuditLog.create({
        action: "question_import_draft_created",
        user_email: user.email || "unknown",
        entity_type: "QuestionImportBatch",
        entity_id: batch.id,
        details: `Import draft from "${batch.source_file_name}" (${summary.item_count} items: ${summary.valid_count} valid, ${summary.warning_count} warnings, ${summary.duplicate_count} duplicates, ${summary.error_count} errors)`,
      });

      return Response.json({ batch: { ...batch, ...summary }, items: stored, summary });
    }

    // ── list — histórico de lotes ───────────────────────────────────────
    if (action === "list") {
      const batches = (await base44.asServiceRole.entities.QuestionImportBatch.list("-created_date", MAX_BATCHES)) || [];
      const filtered = body.status ? batches.filter((b: any) => b.status === body.status) : batches;
      return Response.json({ batches: filtered });
    }

    // ── get — detalhe do lote ───────────────────────────────────────────
    if (action === "get") {
      if (!body.batch_id) return Response.json({ error: "missing_id" }, { status: 422 });
      const batch = await base44.asServiceRole.entities.QuestionImportBatch.get(body.batch_id);
      const items = await loadBatchItems(base44, body.batch_id);
      return Response.json({ batch, items });
    }

    // ── review — aprovar/excluir (em lote ou por linha) e editar ────────
    if (action === "review") {
      if (!body.batch_id) return Response.json({ error: "missing_id" }, { status: 422 });
      const batch = await base44.asServiceRole.entities.QuestionImportBatch.get(body.batch_id);
      if (!batch) return Response.json({ error: "not_found" }, { status: 404 });
      if (batch.status !== "draft") return Response.json({ error: "batch_not_draft" }, { status: 409 });

      if (body.review_state && !REVIEW_STATES.includes(body.review_state)) {
        return Response.json({ error: "unsupported_review_state" }, { status: 422 });
      }

      const items = await loadBatchItems(base44, body.batch_id);
      const targets = body.item_id
        ? items.filter((i: any) => i.id === body.item_id)
        : body.item_ids?.length
          ? items.filter((i: any) => body.item_ids.includes(i.id))
          : body.review_state
            ? items.filter((i: any) => (body.only_state ? i.state === body.only_state : true))
            : [];

      if (targets.length === 0) return Response.json({ error: "no_items" }, { status: 422 });

      const updated: any[] = [];
      for (const item of targets) {
        const patch = body.patch ? buildPatch(item, body.patch) : null;
        const nextItem = patch ? { ...item, ...patch } : item;

        // Um item com erro não pode ser aprovado: tem de ser corrigido ou excluído.
        let reviewState = body.review_state || item.review_state;
        if (reviewState === "approved" && nextItem.state === "error" && !patch) {
          return Response.json({ error: "cannot_approve_error" }, { status: 422 });
        }

        const reclassified = patch ? await reclassifyItem(base44, nextItem) : null;
        if (reclassified && reviewState === "approved" && reclassified.state === "error") {
          return Response.json({ error: "cannot_approve_error" }, { status: 422 });
        }

        const payload: Record<string, any> = {
          review_state: reviewState,
          reviewed_by: user.email || "unknown",
          reviewed_at: new Date().toISOString(),
        };
        if (patch) {
          for (const [field, value] of Object.entries(patch)) payload[field] = value;
          if (reclassified) {
            payload.state = reclassified.state;
            payload.action = reclassified.action;
            payload.issues = reclassified.issues;
            payload.similarity = reclassified.similarity;
            payload.similar_to = reclassified.similar_to;
            payload.before = reclassified.before;
            if (reclassified.framework_code !== undefined) payload.framework_code = reclassified.framework_code;
          }
        }
        updated.push(await base44.asServiceRole.entities.QuestionImportItem.update(item.id, payload));
      }

      await base44.asServiceRole.entities.AuditLog.create({
        action: "question_import_item_reviewed",
        user_email: user.email || "unknown",
        entity_type: "QuestionImportBatch",
        entity_id: batch.id,
        details: `Import batch "${batch.source_file_name}": ${updated.length} item(s) ${
          body.review_state || (body.patch ? "edited" : "reviewed")
        }`,
      });

      return Response.json({ items: updated });
    }

    // ── publish — aplica os itens aprovados ao catálogo ────────────────
    if (action === "publish") {
      if (!body.batch_id) return Response.json({ error: "missing_id" }, { status: 422 });
      const batch = await base44.asServiceRole.entities.QuestionImportBatch.get(body.batch_id);
      if (!batch) return Response.json({ error: "not_found" }, { status: 404 });
      if (batch.status !== "draft") return Response.json({ error: "batch_already_processed" }, { status: 409 });

      const items = await loadBatchItems(base44, body.batch_id);
      const approved = items.filter((i: any) => i.review_state === "approved");
      if (approved.length === 0) return Response.json({ error: "no_approved_items" }, { status: 422 });

      const blocked = approved.filter((i: any) => i.state === "error");
      if (blocked.length > 0) {
        return Response.json(
          { error: "errors_approved", items: blocked.map((i: any) => i.row_number) },
          { status: 422 },
        );
      }

      // Pré-verificação: controlos exigem um framework_id resolvido. Nada é
      // escrito antes de esta verificação passar (publicação atómica).
      const frameworksByCode = new Map<string, any>();
      for (const framework of await base44.asServiceRole.entities.Framework.list("code", 500)) {
        frameworksByCode.set(String(framework.code || "").toUpperCase(), framework);
      }
      const ordered = [...approved].sort((a: any, b: any) => {
        const rank: Record<string, number> = { framework: 0, control: 1, question: 2 };
        return (rank[a.item_type] ?? 3) - (rank[b.item_type] ?? 3);
      });

      for (const item of ordered) {
        if (item.item_type === "framework") continue;
        const code = String(item.framework_code || "").toUpperCase();
        const declared = frameworksByCode.get(code);
        const declaredInBatch = ordered.some(
          (i: any) => i.item_type === "framework" && String(i.framework_code || "").toUpperCase() === code && i.action !== "skip",
        );
        if (!declared && !declaredInBatch) {
          return Response.json({ error: "unresolved_framework", framework_code: item.framework_code }, { status: 409 });
        }
      }

      let created = 0;
      let updatedCount = 0;
      let skipped = 0;

      for (const item of ordered) {
        let appliedId: string | null = item.target_id || null;
        try {
          if (item.action === "skip") {
            skipped += 1;
          } else if (item.item_type === "framework") {
            const payload = frameworkPayload(item);
            if (item.action === "create") {
              const saved = await base44.asServiceRole.entities.Framework.create(payload);
              appliedId = saved?.id || null;
              created += 1;
            } else {
              await base44.asServiceRole.entities.Framework.update(item.target_id, payload);
              updatedCount += 1;
            }
            if (payload.code) frameworksByCode.set(payload.code.toUpperCase(), { id: appliedId, ...payload });
          } else if (item.item_type === "control") {
            const framework = frameworksByCode.get(String(item.framework_code || "").toUpperCase());
            const payload = controlPayload(item, framework?.id || item.target_id);
            if (item.action === "create") {
              const saved = await base44.asServiceRole.entities.FrameworkControl.create(payload);
              appliedId = saved?.id || null;
              created += 1;
            } else {
              await base44.asServiceRole.entities.FrameworkControl.update(item.target_id, payload);
              updatedCount += 1;
            }
          } else {
            const payload = questionPayload(item);
            if (item.action === "create") {
              const saved = await base44.asServiceRole.entities.Question.create(payload);
              appliedId = saved?.id || null;
              created += 1;
            } else {
              await base44.asServiceRole.entities.Question.update(item.target_id, payload);
              updatedCount += 1;
            }
          }

          await base44.asServiceRole.entities.QuestionImportItem.update(item.id, {
            state: "applied",
            applied_id: appliedId || "",
          });
        } catch (error) {
          return Response.json(
            {
              error: "apply_failed",
              row_number: item.row_number,
              message: error?.message || String(error),
              created,
              updated: updatedCount,
              skipped,
            },
            { status: 500 },
          );
        }
      }

      const publishedAt = new Date().toISOString();
      const saved = await base44.asServiceRole.entities.QuestionImportBatch.update(batch.id, {
        status: "published",
        published_at: publishedAt,
        published_by: user.email || "unknown",
      });

      await base44.asServiceRole.entities.AuditLog.create({
        action: "question_import_published",
        user_email: user.email || "unknown",
        entity_type: "QuestionImportBatch",
        entity_id: batch.id,
        details: `Import batch "${batch.source_file_name}" published: ${created} created, ${updatedCount} updated, ${skipped} unchanged (${approved.length} approved of ${items.length})`,
      });

      return Response.json({ batch: saved, created, updated: updatedCount, skipped, approved: approved.length });
    }

    // ── discard — descarta um rascunho ─────────────────────────────────
    if (action === "discard") {
      if (!body.batch_id) return Response.json({ error: "missing_id" }, { status: 422 });
      const batch = await base44.asServiceRole.entities.QuestionImportBatch.get(body.batch_id);
      if (!batch) return Response.json({ error: "not_found" }, { status: 404 });
      if (batch.status !== "draft") return Response.json({ error: "batch_already_processed" }, { status: 409 });

      const saved = await base44.asServiceRole.entities.QuestionImportBatch.update(batch.id, {
        status: "discarded",
        discarded_at: new Date().toISOString(),
      });

      await base44.asServiceRole.entities.AuditLog.create({
        action: "question_import_discarded",
        user_email: user.email || "unknown",
        entity_type: "QuestionImportBatch",
        entity_id: batch.id,
        details: `Import draft "${batch.source_file_name}" discarded — the catalogue was not changed`,
      });

      return Response.json({ batch: saved });
    }

    // ── revert — desfaz um lote publicado ──────────────────────────────
    if (action === "revert") {
      if (!body.batch_id) return Response.json({ error: "missing_id" }, { status: 422 });
      const batch = await base44.asServiceRole.entities.QuestionImportBatch.get(body.batch_id);
      if (!batch) return Response.json({ error: "not_found" }, { status: 404 });
      if (batch.status !== "published") return Response.json({ error: "batch_not_published" }, { status: 409 });

      const items = await loadBatchItems(base44, body.batch_id);
      const applied = items.filter((i: any) => i.state === "applied" && i.applied_id);
      const rank: Record<string, number> = { question: 0, control: 1, framework: 2 };
      const ordered = [...applied].sort((a: any, b: any) => (rank[a.item_type] ?? 3) - (rank[b.item_type] ?? 3));

      const entityFor = (itemType: string) =>
        itemType === "question"
          ? base44.asServiceRole.entities.Question
          : itemType === "control"
            ? base44.asServiceRole.entities.FrameworkControl
            : base44.asServiceRole.entities.Framework;

      let removed = 0;
      let restored = 0;

      for (const item of ordered) {
        const entity = entityFor(item.item_type);
        try {
          if (item.action === "create") {
            await entity.delete(item.applied_id);
            removed += 1;
          } else if (item.action === "update") {
            const before = item.before || {};
            if (Object.keys(before).length > 0) {
              await entity.update(item.applied_id, before);
              restored += 1;
            }
          }
          await base44.asServiceRole.entities.QuestionImportItem.update(item.id, { state: "valid", applied_id: "" });
        } catch (error) {
          return Response.json(
            { error: "revert_failed", row_number: item.row_number, message: error?.message || String(error), removed, restored },
            { status: 500 },
          );
        }
      }

      const saved = await base44.asServiceRole.entities.QuestionImportBatch.update(batch.id, {
        status: "reverted",
        reverted_at: new Date().toISOString(),
      });

      await base44.asServiceRole.entities.AuditLog.create({
        action: "question_import_reverted",
        user_email: user.email || "unknown",
        entity_type: "QuestionImportBatch",
        entity_id: batch.id,
        details: `Import batch "${batch.source_file_name}" reverted: ${removed} record(s) removed, ${restored} restored`,
      });

      return Response.json({ batch: saved, removed, restored });
    }

    return Response.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error?.message || "unexpected_error" }, { status: 500 });
  }
});
