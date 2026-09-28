import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { normalizeRole, resolveReadableCustomerIds } from "../../shared/accessUtils.ts";
import { resolveActor } from "../../shared/devActor.ts";

/**
 * listAuditLog — leitura da trilha de auditoria para /audit-log (FB5).
 *
 * A página filtrava em memória sobre a janela já carregada: o filtro dava
 * respostas incompletas sem o dizer, a lista de valores possíveis era derivada
 * desses mesmos registos e não havia recorte temporal nem exportação.
 *
 * Aqui a decisão passa para o servidor:
 *  - o âmbito é resolvido no servidor (master_admin vê tudo; o auditor vê o
 *    seu tenant e as delegações vivas) — a leitura usa o papel de serviço
 *    porque a RLS da entidade só conhece o contexto da sessão;
 *  - os filtros (ação, entidade, utilizador, intervalo de datas) aplicam-se
 *    antes da paginação, pelo que uma página nunca esconde um registo antigo;
 *  - as facetas devolvidas são as da trilha toda do âmbito, não as da página;
 *  - a paginação é por cursor opaco (a posição já devolvida), e a exportação
 *    pede o conjunto filtrado completo.
 *
 * Os registos sem `customer_id` (plataforma) só são visíveis ao master_admin.
 */
const MAX_SCAN = 5000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 1000;

function inScope(entry: any, scope: { all: boolean; customerIds: string[] }): boolean {
  if (scope.all) return true;
  if (!entry?.customer_id) return false;
  return scope.customerIds.includes(entry.customer_id);
}

function withinRange(entry: any, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  const at = entry?.created_date ? new Date(entry.created_date).getTime() : null;
  if (at === null || Number.isNaN(at)) return false;
  if (from && at < new Date(`${from}T00:00:00.000Z`).getTime()) return false;
  if (to && at > new Date(`${to}T23:59:59.999Z`).getTime()) return false;
  return true;
}

function decodeCursor(cursor: unknown): number {
  const value = Number.parseInt(String(cursor ?? "0"), 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await resolveActor(base44, req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = normalizeRole(user.role);
    if (role !== "master_admin" && role !== "auditor") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      action = "",
      entity_type = "",
      user_email = "",
      from = "",
      to = "",
      cursor = 0,
      limit = DEFAULT_LIMIT,
    } = body || {};

    const pageSize = Math.min(Math.max(Number.parseInt(String(limit), 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = decodeCursor(cursor);

    const scope = await resolveReadableCustomerIds(base44, user);
    const all = (await base44.asServiceRole.entities.AuditLog.list("-created_date", MAX_SCAN)) || [];

    // Âmbito primeiro: as facetas descrevem o que este utilizador pode ver.
    const scoped = all.filter((entry: any) => inScope(entry, scope));

    const matches = scoped.filter((entry: any) =>
      (!action || entry.action === action) &&
      (!entity_type || entry.entity_type === entity_type) &&
      (!user_email || entry.user_email === user_email) &&
      withinRange(entry, from, to)
    );

    const entries = matches.slice(offset, offset + pageSize);
    const nextOffset = offset + entries.length;

    return Response.json({
      entries,
      total: matches.length,
      scanned: scoped.length,
      truncated: all.length >= MAX_SCAN,
      next_cursor: nextOffset < matches.length ? String(nextOffset) : null,
      scope: { all: scope.all, customer_ids: scope.all ? [] : scope.customerIds },
      filters: {
        actions: [...new Set(scoped.map((e: any) => e.action).filter(Boolean))].sort(),
        users: [...new Set(scoped.map((e: any) => e.user_email).filter(Boolean))].sort(),
        entities: [...new Set(scoped.map((e: any) => e.entity_type).filter(Boolean))].sort(),
      },
    });
  } catch (error) {
    console.error("listAuditLog failed:", error);
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
