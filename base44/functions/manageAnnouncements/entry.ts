import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import {
  normalizeRole,
  isPlatformOwner,
  resolveReadableCustomerIds,
} from "../../shared/accessUtils.ts";
import { resolveActor } from "../../shared/devActor.ts";
import { guardRateLimit } from "../../shared/rateLimit.ts";

/**
 * manageAnnouncements — anúncios da plataforma (FB8).
 *
 * Não existia canal de comunicação dentro do produto: o master_admin só podia
 * avisar os clientes por email externo. Esta função é a única porta para os
 * anúncios — a entidade `PlatformAnnouncement` só é legível por master_admin e
 * é escrita exclusivamente com o service role a partir daqui:
 *
 *   - `active`   — anúncios visíveis PARA QUEM CHAMA: activos, dentro da janela
 *                  de exibição e dentro do âmbito (global / tier / cliente). É o
 *                  que alimenta a faixa no layout; o âmbito é resolvido no
 *                  servidor, nunca no browser.
 *   - `overview` — histórico completo (activos e arquivados), só master_admin.
 *   - `publish`  — cria o anúncio e audita a publicação.
 *   - `update`   — edita o anúncio (mesma validação) e audita a alteração.
 *   - `archive`  — despublica (is_active false, archived_at) e audita.
 */

const SEVERITIES = ["info", "warning", "maintenance"];
const SCOPES = ["global", "tier", "customer"];
const COMMERCIAL_TIERS = ["core", "professional", "advanced"];
const MAX_ANNOUNCEMENTS = 200;

/** Janela de exibição: sem datas o anúncio é sempre visível. */
function inWindow(announcement: any, now: number): boolean {
  if (announcement?.starts_at && new Date(announcement.starts_at).getTime() > now) return false;
  if (announcement?.ends_at && new Date(announcement.ends_at).getTime() < now) return false;
  return true;
}

/**
 * Valida e normaliza o corpo de uma publicação.
 *
 * Os campos que não pertencem ao âmbito escolhido são limpos com `null` (a
 * entidade declara-os com tipo união, como as restantes), para que editar um
 * anúncio de cliente para um de tier não deixe o cliente antigo preso.
 */
function buildPayload(raw: any): { error?: string; payload?: Record<string, any> } {
  const title = String(raw?.title || "").trim();
  const message = String(raw?.message || "").trim();
  if (!title || !message) return { error: "missing_fields" };

  const severity = SEVERITIES.includes(raw?.severity) ? raw.severity : null;
  if (!severity) return { error: "unsupported_severity" };

  const scope = SCOPES.includes(raw?.scope) ? raw.scope : null;
  if (!scope) return { error: "unsupported_scope" };

  let tier_code: string | null = null;
  let customer_id: string | null = null;
  if (scope === "tier") {
    tier_code = COMMERCIAL_TIERS.includes(raw?.tier_code) ? raw.tier_code : null;
    if (!tier_code) return { error: "tier_required" };
  }
  if (scope === "customer") {
    customer_id = raw?.customer_id || null;
    if (!customer_id) return { error: "customer_required" };
  }

  const startsAt = raw?.starts_at ? new Date(raw.starts_at) : null;
  const endsAt = raw?.ends_at ? new Date(raw.ends_at) : null;
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) {
    return { error: "invalid_window" };
  }
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    return { error: "invalid_window" };
  }

  return {
    payload: {
      title,
      message,
      severity,
      scope,
      tier_code,
      customer_id,
      customer_name: scope === "customer" ? String(raw?.customer_name || "") : null,
      starts_at: startsAt ? startsAt.toISOString() : null,
      ends_at: endsAt ? endsAt.toISOString() : null,
      is_active: raw?.is_active !== false,
    },
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await resolveActor(base44, req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // OP-S2 — ritmo por ator: publicar, alterar e arquivar anúncios.
    const limited = guardRateLimit(user, "write", req);
    if (limited) return limited;

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action || "active";

    // ── active (qualquer utilizador autenticado, âmbito resolvido no servidor) ──
    if (action === "active") {
      const scope = await resolveReadableCustomerIds(base44, user);

      // `null` = vê todos os tenants (dono da plataforma): qualquer tier lhe diz
      // respeito. Caso contrário, o âmbito por tier sai das subscrições dos
      // tenants que o utilizador pode ler.
      let tiers: Set<string> | null = null;
      if (!scope.all) {
        const subscriptions = await base44.asServiceRole.entities.TenantSubscription.list("-created_date", 500);
        tiers = new Set(
          subscriptions
            .filter((s: any) => scope.customerIds.includes(s.customer_id))
            .map((s: any) => s.tier_code),
        );
      }

      const announcements = await base44.asServiceRole.entities.PlatformAnnouncement.list(
        "-published_at",
        MAX_ANNOUNCEMENTS,
      );
      const now = Date.now();

      const visible = announcements.filter((announcement: any) => {
        if (announcement.is_active === false) return false;
        if (!inWindow(announcement, now)) return false;
        if (announcement.scope === "tier") return tiers === null ? true : tiers.has(announcement.tier_code);
        if (announcement.scope === "customer") {
          return scope.all ? true : scope.customerIds.includes(announcement.customer_id);
        }
        return true;
      });

      return Response.json({ announcements: visible });
    }

    // ── daqui para baixo, só o dono da plataforma ──────────────────────
    const role = normalizeRole(user.role);
    if (!isPlatformOwner(role)) return Response.json({ error: "Forbidden" }, { status: 403 });

    // ── overview (histórico: activos e arquivados) ─────────────────────
    if (action === "overview") {
      const announcements = await base44.asServiceRole.entities.PlatformAnnouncement.list(
        "-published_at",
        MAX_ANNOUNCEMENTS,
      );
      return Response.json({ announcements });
    }

    // ── publish ────────────────────────────────────────────────────────
    if (action === "publish") {
      const { error, payload } = buildPayload(body.announcement);
      if (error) return Response.json({ error }, { status: 422 });

      const saved = await base44.asServiceRole.entities.PlatformAnnouncement.create({
        ...payload,
        published_by: user.email || "unknown",
        published_at: new Date().toISOString(),
        archived_at: null,
      });

      const auditEntry: Record<string, any> = {
        action: "announcement_published",
        user_email: user.email || "unknown",
        entity_type: "PlatformAnnouncement",
        entity_id: saved?.id,
        details: `Announcement "${payload.title}" published (${payload.severity}, scope ${payload.scope}${
          payload.tier_code ? ` ${payload.tier_code}` : ""
        }${payload.customer_id ? ` ${payload.customer_id}` : ""})`,
      };
      if (payload.customer_id) auditEntry.customer_id = payload.customer_id;
      await base44.asServiceRole.entities.AuditLog.create(auditEntry);

      return Response.json({ announcement: saved });
    }

    // ── update ─────────────────────────────────────────────────────────
    if (action === "update") {
      const id = body.id;
      if (!id) return Response.json({ error: "missing_id" }, { status: 422 });
      const { error, payload } = buildPayload(body.announcement);
      if (error) return Response.json({ error }, { status: 422 });

      if (payload.is_active === false) payload.archived_at = new Date().toISOString();
      else payload.archived_at = null;

      const saved = await base44.asServiceRole.entities.PlatformAnnouncement.update(id, payload);

      const auditEntry: Record<string, any> = {
        action: "announcement_updated",
        user_email: user.email || "unknown",
        entity_type: "PlatformAnnouncement",
        entity_id: id,
        details: `Announcement "${payload.title}" updated (${payload.severity}, scope ${payload.scope})${
          payload.is_active === false ? " — archived" : " — active"
        }`,
      };
      if (payload.customer_id) auditEntry.customer_id = payload.customer_id;
      await base44.asServiceRole.entities.AuditLog.create(auditEntry);

      return Response.json({ announcement: saved });
    }

    // ── archive ────────────────────────────────────────────────────────
    if (action === "archive") {
      const id = body.id;
      if (!id) return Response.json({ error: "missing_id" }, { status: 422 });

      const saved = await base44.asServiceRole.entities.PlatformAnnouncement.update(id, {
        is_active: false,
        archived_at: new Date().toISOString(),
      });

      const auditEntry: Record<string, any> = {
        action: "announcement_archived",
        user_email: user.email || "unknown",
        entity_type: "PlatformAnnouncement",
        entity_id: id,
        details: `Announcement "${saved?.title || id}" archived`,
      };
      if (saved?.customer_id) auditEntry.customer_id = saved.customer_id;
      await base44.asServiceRole.entities.AuditLog.create(auditEntry);

      return Response.json({ announcement: saved });
    }

    return Response.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
