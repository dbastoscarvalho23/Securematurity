/**
 * License Guard — resolves effective license and enforces module/standard access.
 *
 * Combines TenantSubscription + LicenseTier defaults + TenantModule activations +
 * TenantEntitlementOverride + trial dates into a single effective license object.
 */

import { periodOf, quotaState, validityState, type QuotaState, type ValidityInfo } from "./quotaState.ts";

/**
 * Cumulative tier → module mapping (single source of truth for the backend).
 * Exactly three commercial client tiers (Core ⊂ Profissional ⊂ Avançado).
 * `privacy` is preserved in the codebase but belongs to no tier (outside the launch offering).
 */
export const TIER_MODULES: Record<string, string[]> = {
  core: ["nis2_journey", "assessments_action_plan", "documents_evidence", "reporting_audit_prep"],
  professional: ["nis2_journey", "assessments_action_plan", "documents_evidence", "reporting_audit_prep", "risk_management", "incident_management"],
  advanced: ["nis2_journey", "assessments_action_plan", "documents_evidence", "reporting_audit_prep", "risk_management", "incident_management", "supplier_management", "knowledge_guidance"],
};

/**
 * Legacy tier codes kept only so pre-existing records still resolve to a module set.
 * NOT commercial tiers: "partner" is an organization type and service channel.
 */
export const LEGACY_TIER_ALIASES: Record<string, string> = { partner: "advanced" };

/** Tiers commercially available at launch: Core only. */
export const COMMERCIALLY_AVAILABLE_TIERS: string[] = ["core"];

/** Resolve a tier code (including legacy aliases) to its cumulative module list. */
export function modulesForTier(tierCode: string): string[] {
  const resolved = LEGACY_TIER_ALIASES[tierCode] || tierCode;
  return TIER_MODULES[resolved] || TIER_MODULES.core;
}

/**
 * Packs / acréscimos (FM1): a composição **técnica** dos pacotes que se podem
 * contratar como acréscimo a qualquer tier. Curada em código, como os tiers —
 * é esta lista que a excepção por módulo de `provisionTenantLicense` (`set_addon`)
 * abre. `privacy` vive aqui: não pertence a nenhum tier e vende-se como acréscimo.
 */
export const ADDON_PACKS: Record<string, { name: string; modules: string[] }> = {
  privacy: { name: "Pack de Privacidade", modules: ["privacy"] },
  risk: { name: "Pack de Risco e Incidentes", modules: ["risk_management", "incident_management"] },
  suppliers: { name: "Pack de Fornecedores e Conhecimento", modules: ["supplier_management", "knowledge_guidance"] },
};

/** Códigos de pack do catálogo, pela ordem em que a oferta os apresenta. */
export const ALL_ADDON_CODES = ["privacy", "risk", "suppliers"];

/** Módulos que um pack abre. Um código desconhecido não abre nada. */
export function modulesForAddon(code: string): string[] {
  return ADDON_PACKS[code]?.modules || [];
}

/** Nome de um pack no catálogo de código. */
export function addonName(code: string): string {
  return ADDON_PACKS[code]?.name || code;
}

export const ALL_MODULE_CODES = [
  "nis2_journey", "assessments_action_plan", "documents_evidence", "reporting_audit_prep",
  "risk_management", "incident_management", "supplier_management", "knowledge_guidance", "privacy",
];

export interface EffectiveLicense {
  licensed: boolean;
  status: string;
  modules: { code: string; name: string }[];
  standards: string[];
  tier_code: string;
  seat_limit: number;
  seats_used: number;
  monthly_usage_count: number;
  monthly_usage_reset_date: string | null;
  /** Aviso a mostrar na interface antes de a licença fechar (ex.: suspensão em curso). */
  warning?: string | null;
  /** Fim do período de tolerância de uma suspensão (ISO), quando aplicável. */
  grace_until?: string | null;
  /**
   * Vigência da subscrição (FM3) — estado, validade e dias restantes. É o que a
   * renovação e o fecho alteram e o que a consola comercial mostra.
   */
  validity: ValidityInfo;
  /**
   * Quotas contratuais do período corrente (FM4): lugares e consumo de IA face ao
   * contratado. Leitura de negócio — SINALIZA, nunca bloqueia: o acesso continua
   * a depender apenas de `licensed` e da lista de módulos acima.
   */
  quota: { period: string; seats: QuotaState; ai: QuotaState };
}

/**
 * Resolve the effective license for a customer by combining subscription,
 * tier defaults, tenant module activations, overrides, and trial dates.
 */
export async function getEffectiveLicense(base44: any, customerId: string): Promise<EffectiveLicense> {
  // Fetch subscription for this tenant
  const subs = await base44.asServiceRole.entities.TenantSubscription.filter({ customer_id: customerId });
  const sub =
    subs.find((s: any) => s.status === "active" || s.status === "trial") ||
    subs.find((s: any) => s.status === "suspended") ||
    subs[0];

  if (!sub) {
    return {
      licensed: false,
      status: "none",
      modules: [],
      standards: [],
      tier_code: "",
      seat_limit: 0,
      seats_used: 0,
      monthly_usage_count: 0,
      monthly_usage_reset_date: null,
      validity: { state: "none", expires_date: null, days_left: null },
      quota: { period: periodOf(), seats: quotaState(0, null, null), ai: quotaState(0, null, null) },
    };
  }

  // Check trial expiry
  let effectiveStatus = sub.status;
  if (sub.status === "trial" && sub.trial_ends_at) {
    if (new Date(sub.trial_ends_at) < new Date()) {
      effectiveStatus = "expired";
    }
  }
  // Check subscription expiry
  if (sub.expires_date && new Date(sub.expires_date) < new Date()) {
    effectiveStatus = "expired";
  }

  // Suspensão com tolerância: o tenant é avisado e os módulos só fecham no fim
  // do período. Antes disso a licença continua válida (licensed) mas com aviso;
  // depois disso fecha (fail-closed, sem aviso).
  let warning: string | null = null;
  let graceUntil: string | null = null;
  if (sub.status === "suspended") {
    const graceEnds = sub.grace_until ? new Date(sub.grace_until).getTime() : 0;
    effectiveStatus = "suspended";
    if (graceEnds > Date.now()) {
      warning = "suspension_grace";
      graceUntil = sub.grace_until;
    }
  }

  const tierCode = sub.tier_code || "core";
  const tierModules = modulesForTier(tierCode);

  // Fetch tenant module activations (exceptions)
  const tenantModules = await base44.asServiceRole.entities.TenantModule.filter({ customer_id: customerId });
  const activatedModuleCodes = new Set(tierModules);

  // Apply tenant module overrides. An override carries its own validity: once
  // `expires_at` has passed it stops applying and the tier rules take over
  // again, so a time-boxed exception cannot become permanent by accident.
  const now = Date.now();
  for (const tm of tenantModules) {
    if (tm.expires_at && new Date(tm.expires_at).getTime() <= now) continue;
    if (tm.status === "active") {
      activatedModuleCodes.add(tm.module_code);
    } else if (tm.status === "inactive") {
      activatedModuleCodes.delete(tm.module_code);
    }
  }

  // Fetch module metadata for names
  const allModules = await base44.asServiceRole.entities.LicenseModule.list("display_order", 100);
  const moduleMap = new Map(allModules.map((m: any) => [m.code, m.name]));

  const modules = Array.from(activatedModuleCodes).map((code) => ({
    code,
    name: moduleMap.get(code) || code,
  }));

  // Fetch tenant standards
  const tenantStandards = await base44.asServiceRole.entities.TenantStandard.filter({ customer_id: customerId, status: "active" });
  const standards = tenantStandards.map((ts: any) => ts.standard_code);

  const licensed =
    effectiveStatus === "active" ||
    effectiveStatus === "trial" ||
    warning === "suspension_grace";

  // Quotas contratuais do período corrente (FM4). O consumo de IA lê-se do
  // contador mensal (`LicenseUsageRecord`, o mesmo número que a subscrição
  // denormaliza e que `enforceUsageLimit` escreve) — uma só fonte por número.
  // Este bloco é puramente informativo: nada aqui abre ou fecha um módulo.
  const period = periodOf();
  const usageRecords = await base44.asServiceRole.entities.LicenseUsageRecord.filter({
    customer_id: customerId,
    month: period,
  });
  const aiConsumed = usageRecords[0]?.usage_count || 0;
  const quota = {
    period,
    seats: quotaState(sub.seats_used || 0, sub.seat_limit ?? null, sub.quota_warn_pct),
    ai: quotaState(aiConsumed, sub.ai_quota_monthly ?? null, sub.quota_warn_pct),
  };

  // Fail-closed: a licence that is not active opens NO module. The module list
  // is what the gating (`assertModule` / `isModuleLicensed`) and the interface
  // read, so without this a suspended tenant kept receiving its tier's module
  // list and the access stayed open after the grace period ended.
  return {
    licensed,
    status: effectiveStatus,
    modules: licensed ? modules : [],
    standards: licensed ? standards : [],
    tier_code: tierCode,
    seat_limit: sub.seat_limit || 0,
    seats_used: sub.seats_used || 0,
    monthly_usage_count: sub.monthly_usage_count || 0,
    monthly_usage_reset_date: sub.monthly_usage_reset_date || null,
    warning,
    grace_until: graceUntil,
    validity: validityState(sub),
    quota,
  };
}

/**
 * Assert that a module is licensed for a customer.
 * Returns { allowed, reason }.
 */
export async function assertModule(
  base44: any,
  customerId: string,
  moduleCode: string | null,
): Promise<{ allowed: boolean; reason: string | null }> {
  const license = await getEffectiveLicense(base44, customerId);

  if (!license.licensed) {
    return { allowed: false, reason: "license_not_active" };
  }

  // null moduleCode = admin-only route, no module gating
  if (!moduleCode) {
    return { allowed: true, reason: null };
  }

  const hasModule = license.modules.some((m) => m.code === moduleCode);
  if (!hasModule) {
    return { allowed: false, reason: "license_module_not_licensed" };
  }

  // Check monthly usage limit (if applicable)
  if (license.monthly_usage_count >= 1000) {
    return { allowed: false, reason: "license_usage_limit_exceeded" };
  }

  return { allowed: true, reason: null };
}

/**
 * Assert that a standard is licensed for a customer.
 */
export async function assertStandard(
  base44: any,
  customerId: string,
  standardCode: string,
): Promise<{ allowed: boolean; reason: string | null }> {
  const license = await getEffectiveLicense(base44, customerId);

  if (!license.licensed) {
    return { allowed: false, reason: "license_not_active" };
  }

  if (!license.standards.includes(standardCode)) {
    return { allowed: false, reason: "license_standard_not_licensed" };
  }

  return { allowed: true, reason: null };
}

/**
 * Increment and check the monthly usage counter for a customer.
 */
export async function enforceUsageLimit(
  base44: any,
  customerId: string,
): Promise<{ allowed: boolean; count: number }> {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const records = await base44.asServiceRole.entities.LicenseUsageRecord.filter({
    customer_id: customerId,
    month,
  });

  let record = records[0];
  if (!record) {
    record = await base44.asServiceRole.entities.LicenseUsageRecord.create({
      customer_id: customerId,
      month,
      usage_count: 1,
      reset_date: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split("T")[0],
    });
    return { allowed: true, count: 1 };
  }

  const newCount = (record.usage_count || 0) + 1;
  await base44.asServiceRole.entities.LicenseUsageRecord.update(record.id, {
    usage_count: newCount,
  });

  // Also update the subscription's monthly counter
  const subs = await base44.asServiceRole.entities.TenantSubscription.filter({ customer_id: customerId });
  const sub = subs[0];
  if (sub) {
    await base44.asServiceRole.entities.TenantSubscription.update(sub.id, {
      monthly_usage_count: newCount,
      monthly_usage_reset_date: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split("T")[0],
    });
  }

  return { allowed: newCount <= 1000, count: newCount };
}

/**
 * Write a license-related audit log entry.
 */
export async function writeLicenseAuditLog(
  base44: any,
  action: string,
  customerId: string,
  details: string,
): Promise<void> {
  await base44.asServiceRole.entities.AuditLog.create({
    customer_id: customerId,
    action,
    user_email: "system",
    entity_type: "License",
    entity_id: customerId,
    details,
  });
}

/**
 * Map license error reasons to HTTP responses.
 */
export function licenseErrorResponse(reason: string): Response {
  const statusMap: Record<string, number> = {
    license_not_active: 402,
    license_module_not_licensed: 402,
    license_standard_not_licensed: 402,
    license_usage_limit_exceeded: 402,
  };

  const status = statusMap[reason] || 403;
  return Response.json({ error: reason }, { status });
}
