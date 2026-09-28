import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import {
  normalizeRole,
  isPlatformOwner,
  isPartnerAdmin,
  resolveScopeCustomerIds,
} from "../../shared/accessUtils.ts";
import { resolveActor } from "../../shared/devActor.ts";

/**
 * listLicenseChanges — leitura do histórico de licenciamento (FB1.12).
 *
 * A entidade `LicenseChangeLog` tem RLS de leitura para `master_admin` apenas,
 * e a carteira de um administrador de parceiro não é expressável em RLS. A
 * decisão de âmbito é por isso do servidor, como em `listTenantLicenses` e
 * `listAuditLog`:
 *  - o dono da plataforma vê todos os clientes; o administrador de parceiro vê
 *    os clientes da sua carteira (`resolveScopeCustomerIds`) — qualquer outro
 *    papel é recusado com 403;
 *  - os filtros (cliente, tipo de alteração, intervalo de datas) aplicam-se
 *    ANTES da paginação, pelo que uma página nunca esconde uma alteração;
 *  - as facetas (clientes e acções) descrevem o âmbito todo, não a página;
 *  - a paginação é por cursor opaco (a posição já devolvida).
 *
 * Nenhum cálculo de âmbito é feito no browser.
 */
const MAX_SCAN = 5000;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

const ACTIONS = ["create", "update", "suspend", "resume", "set_module", "set_standard"];

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
    if (!isPlatformOwner(role) && !isPartnerAdmin(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      customer_id = "",
      action = "",
      from = "",
      to = "",
      cursor = 0,
      limit = DEFAULT_LIMIT,
    } = body || {};

    const pageSize = Math.min(Math.max(Number.parseInt(String(limit), 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = decodeCursor(cursor);

    const scope = await resolveScopeCustomerIds(base44, user);
    const all = (await base44.asServiceRole.entities.LicenseChangeLog.list("-created_date", MAX_SCAN)) || [];

    // Âmbito primeiro: as facetas descrevem o que este utilizador pode ver.
    const scoped = all.filter((entry: any) => inScope(entry, scope));

    const matches = scoped.filter((entry: any) =>
      (!customer_id || entry.customer_id === customer_id) &&
      (!action || entry.action === action) &&
      withinRange(entry, from, to)
    );

    const entries = matches.slice(offset, offset + pageSize);
    const nextOffset = offset + entries.length;

    const customers = new Map<string, string>();
    for (const entry of scoped) {
      if (entry.customer_id && !customers.has(entry.customer_id)) {
        customers.set(entry.customer_id, entry.customer_name || entry.customer_id);
      }
    }

    return Response.json({
      entries,
      total: matches.length,
      scanned: scoped.length,
      truncated: all.length >= MAX_SCAN,
      next_cursor: nextOffset < matches.length ? String(nextOffset) : null,
      scope: { all: scope.all, customer_ids: scope.all ? [] : scope.customerIds },
      filters: {
        customers: [...customers.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
        actions: ACTIONS.filter((code) => scoped.some((entry: any) => entry.action === code)),
      },
    });
  } catch (error) {
    console.error("listLicenseChanges failed:", error);
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
