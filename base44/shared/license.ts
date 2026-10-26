/**
 * Licenciamento: cálculo dos módulos efetivos de um cliente e verificação no servidor.
 * Modelo igual ao da produção (LicenseTier, LicenseModule, TenantSubscription, TenantModule, TenantStandard).
 *
 * Sem TenantSubscription o cliente fica em modo «legacy» (todos os módulos ativos), para não cortar o acesso
 * a clientes criados antes do licenciamento; a consola de licenças assinala estes clientes.
 */

import { SEED_MODULES } from './licenseCatalog.ts';

export class LicenseError extends Error {
  status: number;
  constructor(message, status = 402) { super(message); this.status = status; }
}

const today = () => new Date().toISOString().slice(0, 10);

export function subscriptionState(sub, now = today()) {
  if (!sub) return 'legacy';
  if (sub.status === 'closed') return 'closed';
  if (sub.status === 'suspended') return 'suspended';
  if (sub.status === 'trial') return sub.trial_ends_at && now > sub.trial_ends_at ? 'expired' : 'trial';
  if (sub.expires_date && now > sub.expires_date) return sub.grace_until && now <= sub.grace_until ? 'grace' : 'expired';
  return 'active';
}

export const EFFECTIVE_STATES = ['legacy', 'trial', 'active', 'grace'];

/**
 * Módulos efetivos de um cliente: bundle ∪ extras, com as ativações/desativações manuais e os módulos desativados globalmente.
 * Também devolve as funcionalidades (LicenseEntitlement) efetivas — as dos módulos efetivos, menos as que o bundle exclui
 * (`excluded_entitlements`) — e as quotas mensais (`quotas` do bundle; a quota da subscrição, quando definida, prevalece).
 * Um bundle sem estes campos comporta-se como antes: todas as funcionalidades dos módulos e sem quota de bundle.
 */
export async function getEntitlements(base44, customerId) {
  const db = base44.asServiceRole.entities;
  const [subs, catalog, ents] = await Promise.all([
    db.TenantSubscription.filter({ customer_id: customerId }, '-created_date', 5),
    db.LicenseModule.list('display_order', 200),
    db.LicenseEntitlement.list('module_code', 1000).catch(() => []),
  ]);
  const active = new Set(catalog.filter((m) => m.is_active !== false).map((m) => m.code));
  const sub = subs.find((s) => s.status !== 'closed') || subs[0] || null;
  const state = subscriptionState(sub);
  const out = {
    customer_id: customerId, state, effective: EFFECTIVE_STATES.includes(state), subscription: sub,
    tier_code: sub?.tier_code || null, modules: [], standards: [], seat_limit: sub?.seat_limit ?? null,
    ai_quota_monthly: sub?.ai_quota_monthly ?? null, entitlements: [], quotas: {},
  };
  const activeEnts = (ents || []).filter((e) => e.is_active !== false);
  // Legacy: todos os módulos (os do catálogo e, enquanto não houver catálogo, os do catálogo inicial).
  if (!sub) {
    out.modules = [...new Set([...catalog.map((m) => m.code), ...SEED_MODULES.map((m) => m.code)])];
    out.entitlements = activeEnts.map((e) => e.code);
    return out;
  }
  if (!out.effective) return out;
  const tier = (await db.LicenseTier.filter({ code: sub.tier_code }))[0];
  out.quotas = tierQuotas(tier);
  if (sub.ai_quota_monthly != null && sub.ai_quota_monthly !== '') out.quotas.ai = Number(sub.ai_quota_monthly);
  out.ai_quota_monthly = out.quotas.ai ?? null;
  const set = new Set([...(tier?.modules || []), ...(sub.addon_codes || [])]);
  const now = today();
  for (const tm of await db.TenantModule.filter({ customer_id: customerId, source: 'manual' }, '-created_date', 200)) {
    if (tm.expires_at && tm.expires_at < now) continue;
    if (tm.status === 'active') set.add(tm.module_code); else set.delete(tm.module_code);
  }
  out.modules = [...set].filter((c) => active.has(c));
  const excluded = new Set(Array.isArray(tier?.excluded_entitlements) ? tier.excluded_entitlements : []);
  const mods = new Set(out.modules);
  out.entitlements = activeEnts.filter((e) => mods.has(e.module_code) && !excluded.has(e.code)).map((e) => e.code);
  out.standards = (await db.TenantStandard.filter({ customer_id: customerId, status: 'active' }, 'standard_code', 100)).map((s) => s.standard_code);
  return out;
}

/** Quotas publicadas de um bundle ({ feature: número }), só valores inteiros ≥ 0. */
export function tierQuotas(tier) {
  const out = {};
  const q = tier?.quotas;
  if (q && typeof q === 'object' && !Array.isArray(q)) {
    for (const [k, v] of Object.entries(q)) if (v !== null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0) out[k] = Math.floor(Number(v));
  }
  return out;
}

/** Recusa (402) se o cliente não tiver a funcionalidade (código de LicenseEntitlement). O admin da plataforma passa sempre. */
export async function requireEntitlement(base44, user, customerId, entitlementCode) {
  if (user?.role === 'admin') return null;
  const ent = await getEntitlements(base44, customerId);
  if (!ent.effective) throw new LicenseError(`A licença deste cliente não está ativa (${ent.state})`);
  if (!ent.entitlements.includes(entitlementCode)) throw new LicenseError(`Funcionalidade não incluída na licença (${entitlementCode})`);
  return ent;
}

/** Recusa (402) se o cliente não tiver o módulo. O administrador da plataforma passa sempre (configuração). */
export async function requireModule(base44, user, customerId, moduleCode) {
  if (user?.role === 'admin') return null;
  const ent = await getEntitlements(base44, customerId);
  if (!ent.effective) throw new LicenseError(`A licença deste cliente não está ativa (${ent.state})`);
  if (!ent.modules.includes(moduleCode)) throw new LicenseError(`Funcionalidade não incluída na licença (módulo ${moduleCode})`);
  return ent;
}

/**
 * Recusa (429) se a quota mensal já estiver esgotada, sem a consumir.
 * `quota` explícito (número, ou null/'' = sem limite) mantém o comportamento anterior; omitido (undefined), usa a quota
 * efetiva do cliente (subscrição → bundle).
 */
export async function checkQuota(base44, customerId, feature, quota?) {
  if (quota === undefined) quota = (await getEntitlements(base44, customerId)).quotas?.[feature] ?? null;
  if (quota == null || quota === '') return;
  const month = today().slice(0, 7);
  const rec = (await base44.asServiceRole.entities.LicenseUsageRecord.filter({ customer_id: customerId, month, feature }))[0];
  if ((rec?.usage_count || 0) >= Number(quota)) throw new LicenseError(`Quota mensal esgotada (${rec?.usage_count || 0}/${quota})`, 429);
}

/** Consome uma unidade da quota mensal (ex.: pedidos de IA). Recusa quando a quota está esgotada. */
export async function consumeQuota(base44, customerId, feature, quota) {
  const db = base44.asServiceRole.entities;
  const month = today().slice(0, 7);
  const rec = (await db.LicenseUsageRecord.filter({ customer_id: customerId, month, feature }))[0];
  const used = rec?.usage_count || 0;
  if (quota != null && quota !== '' && used >= Number(quota)) throw new LicenseError(`Quota mensal esgotada (${used}/${quota})`, 429);
  if (rec) await db.LicenseUsageRecord.update(rec.id, { usage_count: used + 1 });
  else await db.LicenseUsageRecord.create({ customer_id: customerId, month, feature, usage_count: 1 });
  return used + 1;
}


