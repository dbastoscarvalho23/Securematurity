import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { normalizeRole, isPlatformOwner } from "../../shared/accessUtils.ts";
import { resolveActor } from "../../shared/devActor.ts";
import { monthlyCentsFor, tierRank } from "../../shared/commercialOffer.ts";
import { periodOf, quotaState } from "../../shared/quotaState.ts";

/**
 * getCommercialMetrics — indicadores comerciais (FM5).
 *
 * A plataforma já tinha os números da operação (licenças, lugares, consumo) mas
 * não tinha leitura de negócio: quanto vale o que está contratado, o que mexeu no
 * período, quantos saíram, para onde se move a carteira e como se distribui a
 * utilização. Estes indicadores são calculados **no servidor** a partir das
 * entidades, para que exista uma só fonte por número — o mesmo valor no cartão,
 * no detalhe e na exportação.
 *
 * A fronteira de âmbito (FM6) mantém-se: **não há faturação nem pagamentos**.
 * A receita aqui é RECEITA CONTRATADA — o preço registado nas tabelas de preços
 * em vigor aplicado às subscrições vivas e convertido a mês — e nunca um valor
 * faturado ou recebido. Por isso o payload devolve `contracted_not_invoiced: true`
 * e a interface di-lo.
 *
 * O período anterior não é recalculado por outra regra: parte-se do estado
 * actual e desfazem-se, em ordem inversa, as alterações registadas no
 * `LicenseChangeLog` posteriores ao início do período — é o mesmo histórico que
 * sustenta o movimento e o churn, e por isso os totais fecham entre cartão e
 * detalhe. Um tenant sem preço registado é contado à parte
 * (`unpriced_subscriptions`) para que o número não pareça completo quando não é.
 *
 * Só o dono da plataforma lê isto (403 aos restantes): é indicador de negócio da
 * plataforma, não da carteira de um parceiro.
 */
const MAX_SCAN = 1000;

/** Início do período anterior a um período AAAA-MM. */
function previousPeriod(period: string): string {
  const [year, month] = period.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Primeiro instante de um período AAAA-MM (ISO), para recortar o histórico. */
function periodStart(period: string): string {
  return `${period}-01T00:00:00.000Z`;
}

/** Data da alteração, em ISO, seja qual for o campo que a traz. */
function changedAt(row: any): string {
  return row?.created_date || row?.updated_date || "";
}

/** Período (AAAA-MM) de um instante ISO. */
function periodOfDate(iso: string): string {
  return iso ? iso.slice(0, 7) : "";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await resolveActor(base44, req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!isPlatformOwner(normalizeRole(user.role))) {
      return Response.json(
        { error: "Forbidden — os indicadores comerciais são do dono da plataforma." },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const period = /^\d{4}-\d{2}$/.test(String(body.period || "")) ? String(body.period) : periodOf();
    const before = previousPeriod(period);

    const [subscriptions, customers, changes, tables, usage, signals] = await Promise.all([
      base44.asServiceRole.entities.TenantSubscription.list("-created_date", MAX_SCAN),
      base44.asServiceRole.entities.Customer.list("name", MAX_SCAN),
      base44.asServiceRole.entities.LicenseChangeLog.list("-created_date", MAX_SCAN),
      base44.asServiceRole.entities.PriceTable.list("-created_date", MAX_SCAN),
      base44.asServiceRole.entities.LicenseUsageRecord.list("-created_date", MAX_SCAN),
      base44.asServiceRole.entities.QuotaSignal.list("-created_date", MAX_SCAN),
    ]);

    const subs = subscriptions || [];
    const log = changes || [];
    const tableById = new Map((tables || []).map((table: any) => [table.id, table]));

    /** Valor mensal contratado de uma subscrição, pela tabela que ela registou. */
    const monthlyOf = (subscription: any) => {
      const table = tableById.get(subscription.price_table_id);
      if (!table) return { cents: 0, priced: false, table: null };
      const cents = monthlyCentsFor(table, subscription.tier_code, subscription.seat_limit);
      return { cents, priced: cents > 0, table };
    };

    // ─── Receita contratada (período corrente) ───────────────────────
    const live = subs.filter(
      (sub: any) => sub.status === "active" || sub.status === "trial",
    );

    let mrrCents = 0;
    let unpriced = 0;
    const byTier = new Map<string, { tier_code: string; mrr_cents: number; subscriptions: number }>();
    const byBilling = new Map<string, { billing_period: string; mrr_cents: number; subscriptions: number }>();
    let currency = "EUR";

    for (const sub of live) {
      const { cents, priced, table } = monthlyOf(sub);
      if (table?.currency) currency = table.currency;
      mrrCents += cents;
      if (!priced) unpriced += 1;

      const tierKey = sub.tier_code || "—";
      const tierRow = byTier.get(tierKey) || { tier_code: tierKey, mrr_cents: 0, subscriptions: 0 };
      tierRow.mrr_cents += cents;
      tierRow.subscriptions += 1;
      byTier.set(tierKey, tierRow);

      const billingKey = table?.billing_period || "—";
      const billingRow = byBilling.get(billingKey) || { billing_period: billingKey, mrr_cents: 0, subscriptions: 0 };
      billingRow.mrr_cents += cents;
      billingRow.subscriptions += 1;
      byBilling.set(billingKey, billingRow);
    }

    // ─── Estado no início do período (para comparar) ─────────────────
    const startState = stateAt(log, periodStart(period), subs);
    let previousMrrCents = 0;
    for (const sub of startState.values()) {
      if (sub.status !== "active" && sub.status !== "trial") continue;
      const { cents } = monthlyOf(sub);
      previousMrrCents += cents;
    }

    // ─── Movimento do período e do anterior ─────────────────────────
    const movement = movementsIn(log, period);
    const previousMovement = movementsIn(log, before);

    // ─── Churn ───────────────────────────────────────────────────────
    const activeAtStart = Array.from(startState.values()).filter(
      (sub: any) => sub.status === "active" || sub.status === "trial",
    ).length;
    const churnPct = activeAtStart > 0 ? Math.round((movement.closed / activeAtStart) * 1000) / 10 : 0;

    // ─── Conversão entre níveis ──────────────────────────────────────
    const tierCounts = (rows: any[]) => {
      const counts = new Map<string, number>();
      for (const row of rows) {
        const key = row.tier_code || "—";
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      return counts;
    };
    const nowCounts = tierCounts(live);
    const thenCounts = tierCounts(
      Array.from(startState.values()).filter((sub: any) => sub.status === "active" || sub.status === "trial"),
    );
    const nowTotal = live.length || 1;
    const thenTotal = Array.from(thenCounts.values()).reduce((sum, n) => sum + n, 0) || 1;
    const conversion = ["core", "professional", "advanced"].map((tierCode) => {
      const nowCount = nowCounts.get(tierCode) || 0;
      const thenCount = thenCounts.get(tierCode) || 0;
      const share = Math.round((nowCount / nowTotal) * 1000) / 10;
      const previousShare = Math.round((thenCount / thenTotal) * 1000) / 10;
      return {
        tier_code: tierCode,
        subscriptions: nowCount,
        previous_subscriptions: thenCount,
        share_pct: share,
        previous_share_pct: previousShare,
        delta_pp: Math.round((share - previousShare) * 10) / 10,
      };
    });

    // ─── Coortes de utilização (consumo de IA do período face à quota) ──
    const usageByCustomer = new Map(
      (usage || [])
        .filter((row: any) => row.month === period)
        .map((row: any) => [row.customer_id, row.usage_count || 0]),
    );
    const bands: Record<string, { band: string; tenants: number; consumed: number }> = {
      no_quota: { band: "no_quota", tenants: 0, consumed: 0 },
      no_usage: { band: "no_usage", tenants: 0, consumed: 0 },
      below_half: { band: "below_half", tenants: 0, consumed: 0 },
      half_to_quota: { band: "half_to_quota", tenants: 0, consumed: 0 },
      above_quota: { band: "above_quota", tenants: 0, consumed: 0 },
    };

    for (const sub of live) {
      const consumed = usageByCustomer.get(sub.customer_id) || 0;
      const state = quotaState(consumed, sub.ai_quota_monthly ?? null, sub.quota_warn_pct);
      const key = !state.defined
        ? "no_quota"
        : consumed === 0
        ? "no_usage"
        : state.level === "excess"
        ? "above_quota"
        : (state.used_pct ?? 0) < 50
        ? "below_half"
        : "half_to_quota";
      bands[key].tenants += 1;
      bands[key].consumed += consumed;
    }

    const periodSignals = (signals || []).filter((row: any) => row.period === period);
    const counted = (level: string) => periodSignals.filter((row: any) => row.level === level).length;

    const byStatus = (status: string) => subs.filter((sub: any) => sub.status === status).length;

    return Response.json({
      period,
      previous_period: before,
      contracted_not_invoiced: true,
      currency,
      revenue: {
        mrr_cents: mrrCents,
        arr_cents: mrrCents * 12,
        previous_mrr_cents: previousMrrCents,
        delta_pct: previousMrrCents > 0
          ? Math.round(((mrrCents - previousMrrCents) / previousMrrCents) * 1000) / 10
          : null,
        unpriced_subscriptions: unpriced,
        by_tier: Array.from(byTier.values()).sort(
          (a, b) => tierRank(a.tier_code) - tierRank(b.tier_code),
        ),
        by_billing_period: Array.from(byBilling.values()),
      },
      movement: {
        period,
        new: movement.created,
        renewals: movement.renewed,
        upgrades: movement.upgrades,
        downgrades: movement.downgrades,
        closed: movement.closed,
        changes: log.filter((row: any) => periodOfDate(changedAt(row)) === period).length,
        previous: {
          period: before,
          new: previousMovement.created,
          renewals: previousMovement.renewed,
          upgrades: previousMovement.upgrades,
          downgrades: previousMovement.downgrades,
          closed: previousMovement.closed,
        },
      },
      churn: {
        period,
        closed_in_period: movement.closed,
        active_at_start: activeAtStart,
        rate_pct: churnPct,
        previous_closed: previousMovement.closed,
      },
      conversion: { tiers: conversion, moves: movement.upgrades + movement.downgrades },
      cohorts: Object.values(bands),
      signals: {
        period,
        warning: counted("warning"),
        excess: counted("excess"),
        resolved: counted("ok"),
        tenants_flagged: periodSignals.filter((row: any) => row.level !== "ok").length,
      },
      totals: {
        customers: (customers || []).length,
        subscriptions: subs.length,
        active: byStatus("active"),
        trial: byStatus("trial"),
        suspended: byStatus("suspended"),
        expired: byStatus("expired"),
        closed: byStatus("cancelled"),
        without_subscription: Math.max(0, (customers || []).length - subs.length),
      },
      truncated: subs.length >= MAX_SCAN || log.length >= MAX_SCAN,
    });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});

/**
 * Estado das subscrições no início de um período: parte-se do presente e
 * desfazem-se, em ordem inversa, as alterações registadas depois do corte.
 * Os snapshots `before` do `LicenseChangeLog` trazem exactamente os campos que
 * cada operação mudou, pelo que a reversão é campo a campo.
 */
function stateAt(changes: any[], cutoffIso: string, subscriptions: any[]) {
  const state = new Map<string, any>(
    (subscriptions || []).map((sub: any) => [sub.customer_id, { ...sub }]),
  );

  const after = (changes || [])
    .filter((row: any) => changedAt(row) && changedAt(row) >= cutoffIso)
    .sort((a: any, b: any) => changedAt(b).localeCompare(changedAt(a)));

  for (const change of after) {
    if (change.action === "create") {
      state.delete(change.customer_id);
      continue;
    }
    const row = state.get(change.customer_id);
    if (!row) continue;
    const before = change.before?.subscription || null;
    if (!before) continue;
    state.set(change.customer_id, { ...row, ...before });
  }

  return state;
}

/** Movimento registado num período: novas, renovações, subidas, descidas e fechos. */
function movementsIn(changes: any[], period: string) {
  const counts = { created: 0, renewed: 0, upgrades: 0, downgrades: 0, closed: 0 };

  for (const row of changes || []) {
    if (periodOfDate(changedAt(row)) !== period) continue;

    if (row.action === "create") counts.created += 1;
    else if (row.action === "renew") counts.renewed += 1;
    else if (row.action === "close") counts.closed += 1;
    else if (row.action === "change_tier") {
      const from = row.before?.subscription?.tier_code;
      const to = row.after?.subscription?.tier_code;
      if (from && to && tierRank(to) > tierRank(from)) counts.upgrades += 1;
      else if (from && to) counts.downgrades += 1;
    }
  }

  return counts;
}
