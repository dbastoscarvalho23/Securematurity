/**
 * Estado das quotas contratuais (FM4) — uma só fonte para o número que o
 * provisionamento (`provisionTenantLicense`), o gating (`licenseGuard.ts`) e os
 * indicadores comerciais (`getCommercialMetrics`) mostram.
 *
 * A quota é **contratual e de negócio**: compara o que o cliente contratou
 * (lugares e consumo de IA por mês, definidos na subscrição a partir dos valores
 * por omissão da tabela de preços vigente) com o que consome. Quando passa o
 * limiar, a plataforma **sinaliza**; nunca bloqueia o acesso nem cobra nada —
 * a fronteira de âmbito (FM6: sem faturação nem pagamentos) continua de pé, e é
 * por isso que `enforceUsageLimit` não é tocado por este módulo.
 *
 * O consumo de IA do período corrente lê-se da entidade `LicenseUsageRecord`
 * (`month` = AAAA-MM), que é o contador mensal escrito por `enforceUsageLimit` e
 * o mesmo número que a subscrição denormaliza — uma só fonte por número.
 */

/** Limiar por omissão: a partir de 80 % da quota o consumo é assinalado. */
export const DEFAULT_WARN_PCT = 80;

/** Período (AAAA-MM) de uma data — por omissão, hoje. */
export function periodOf(at?: string): string {
  const date = at ? new Date(at) : new Date();
  const valid = Number.isNaN(date.getTime()) ? new Date() : date;
  return `${valid.getUTCFullYear()}-${String(valid.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Dia anterior a uma data ISO `date`. */
export function dayBefore(isoDate: string): string {
  const at = new Date(`${isoDate}T00:00:00.000Z`);
  at.setUTCDate(at.getUTCDate() - 1);
  return at.toISOString().split("T")[0];
}

/** Data ISO (AAAA-MM-DD) de hoje, em UTC. */
export function today(): string {
  return new Date().toISOString().split("T")[0];
}

/** Soma meses a uma data ISO `date`, sem sair do formato. */
export function addMonths(isoDate: string, months: number): string {
  const at = new Date(`${isoDate}T00:00:00.000Z`);
  at.setUTCMonth(at.getUTCMonth() + months);
  return at.toISOString().split("T")[0];
}

/** Dias entre duas datas ISO (positivo se `to` for depois de `from`). */
export function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00.000Z`).getTime();
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  return Math.round((end - start) / 86400000);
}

export type QuotaLevel = "ok" | "warning" | "excess";

export interface QuotaState {
  /** Há quota contratada para esta grandeza? */
  defined: boolean;
  quota: number | null;
  consumed: number;
  /** Percentagem da quota consumida (arredondada); null sem quota definida. */
  used_pct: number | null;
  level: QuotaLevel;
  /** Quanto passou da quota (0 quando só houve aviso). */
  excess: number;
  threshold_pct: number;
}

/**
 * Estado de uma grandeza face à quota contratada.
 *
 * `excess` é um aviso de negócio, não um bloqueio: o acesso do cliente nunca
 * depende deste resultado (quem decide acessos é o gating de licença).
 */
export function quotaState(
  consumed: number,
  quota: number | null | undefined,
  warnPct?: number | null,
): QuotaState {
  const used = Number(consumed) || 0;
  const threshold =
    Number.isFinite(Number(warnPct)) && Number(warnPct) > 0 ? Number(warnPct) : DEFAULT_WARN_PCT;
  const hasQuota = quota !== null && quota !== undefined && quota !== "" && Number(quota) >= 0;

  if (!hasQuota) {
    return {
      defined: false,
      quota: null,
      consumed: used,
      used_pct: null,
      level: "ok",
      excess: 0,
      threshold_pct: threshold,
    };
  }

  const quotaValue = Number(quota);
  const pct = quotaValue > 0 ? Math.round((used / quotaValue) * 100) : used > 0 ? 100 : 0;
  const excess = Math.max(0, used - quotaValue);
  const level: QuotaLevel = used > quotaValue ? "excess" : pct >= threshold ? "warning" : "ok";

  return {
    defined: true,
    quota: quotaValue,
    consumed: used,
    used_pct: pct,
    level,
    excess,
    threshold_pct: threshold,
  };
}

export type ValidityState = "none" | "closed" | "suspended" | "expired" | "expiring" | "trial" | "open";

export interface ValidityInfo {
  state: ValidityState;
  expires_date: string | null;
  /** Dias até à validade (negativo se já passou); null sem validade definida. */
  days_left: number | null;
  grace_until?: string | null;
}

/**
 * Vigência de uma subscrição: o que a renovação e o fecho alteram e o que a
 * consola mostra. `expiring` é a janela de aviso de 30 dias.
 */
export function validityState(subscription: any, at?: string): ValidityInfo {
  if (!subscription) return { state: "none", expires_date: null, days_left: null };

  const reference = at || today();
  const expires = subscription.expires_date || null;
  const daysLeft = expires ? daysBetween(reference, expires) : null;
  const base = { expires_date: expires, days_left: daysLeft };

  if (subscription.status === "cancelled") return { state: "closed", ...base };
  if (subscription.status === "suspended") {
    return { state: "suspended", grace_until: subscription.grace_until || null, ...base };
  }
  if (daysLeft !== null && daysLeft < 0) return { state: "expired", ...base };
  if (daysLeft !== null && daysLeft <= 30) return { state: "expiring", ...base };
  if (subscription.status === "trial") return { state: "trial", ...base };
  return { state: "open", ...base };
}
