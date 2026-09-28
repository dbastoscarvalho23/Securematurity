import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import {
  normalizeRole,
  isPlatformOwner,
  isPartnerAdmin,
  resolveScopeCustomerIds,
  writeAccessAuditLog,
} from "../../shared/accessUtils.ts";
import { resolveActor } from "../../shared/devActor.ts";
import { TIER_MODULES, LEGACY_TIER_ALIASES, getEffectiveLicense } from "../../shared/licenseGuard.ts";
import { offerVersionInForce, priceTableInForce } from "../../shared/commercialOffer.ts";

/**
 * provisionTenantLicense — operação comercial da plataforma (FB1).
 *
 * Antes desta função, criar, alterar ou suspender a licença de um cliente
 * exigia executar funções internas de seed ou escrever directamente na base de
 * dados: com o gating fail-closed, um cliente novo ficava com todos os módulos
 * fechados e a plataforma não se mantinha sozinha.
 *
 * A unidade de atribuição é o TENANT (`customer_id`): o tier define os módulos,
 * os assentos são consumidos pelos utilizadores desse cliente e as excepções
 * por módulo (com motivo e validade) sobrepõem-se ao tier enquanto valerem.
 *
 * Escrita sempre com o papel de serviço, com verificação de âmbito explícita —
 * as RLS das entidades de licenciamento só conhecem `master_admin` e não sabem
 * expressar a carteira de um administrador de parceiro. Papéis aceites:
 * master_admin (qualquer cliente) e workspace_admin (só a sua carteira).
 *
 * Acções: create | update | suspend | resume | set_module | set_standard
 *
 * Cada acção deixa dois rastos: a entrada de `AuditLog` (trilha técnica) e uma
 * linha em `LicenseChangeLog` com o autor, o motivo e o antes/depois do estado
 * relevante (subscrição, módulos e standards) — é o que o cartão «Histórico de
 * licenciamento» mostra em /licensing (FB1.12). Esta função é o único escritor
 * dessa entidade.
 */
const ACTIONS = ["create", "update", "suspend", "resume", "set_module", "set_standard"];

const DEFAULT_GRACE_DAYS = 7;
const MAX_GRACE_DAYS = 90;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await resolveActor(base44, req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = normalizeRole(user.role);
    if (!isPlatformOwner(role) && !isPartnerAdmin(role)) {
      return Response.json(
        { error: "Forbidden — apenas o administrador da plataforma ou de parceiro pode provisionar licenças." },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    if (!ACTIONS.includes(action)) {
      return Response.json(
        { error: `Acção inválida. Esperado uma de: ${ACTIONS.join(", ")}.` },
        { status: 400 },
      );
    }

    const customerId = body.customer_id;
    if (!customerId) return Response.json({ error: "customer_id is required" }, { status: 400 });

    // Âmbito de ESCRITA: o dono da plataforma actua em qualquer cliente; um
    // administrador de parceiro só dentro da sua carteira.
    const scope = await resolveScopeCustomerIds(base44, user);
    if (!scope.all && !scope.customerIds.includes(customerId)) {
      return Response.json({ error: "Forbidden — cliente fora do seu âmbito." }, { status: 403 });
    }

    const customer = await base44.asServiceRole.entities.Customer.get(customerId);
    if (!customer) return Response.json({ error: "Cliente não encontrado." }, { status: 404 });

    switch (action) {
      case "create":
        return await createSubscription(base44, user, customer, body);
      case "update":
        return await updateSubscription(base44, user, customer, body);
      case "suspend":
        return await suspendSubscription(base44, user, customer, body);
      case "resume":
        return await resumeSubscription(base44, user, customer, body);
      case "set_module":
        return await setModule(base44, user, customer, body);
      case "set_standard":
        return await setStandard(base44, user, customer, body);
      default:
        return Response.json({ error: "Acção inválida." }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/** Reject tier codes that are not part of the catalogue. */
function resolveTier(tierCode: string): string | null {
  if (!tierCode) return null;
  const resolved = LEGACY_TIER_ALIASES[tierCode] || tierCode;
  return TIER_MODULES[resolved] ? resolved : null;
}

async function findByCustomer(base44: any, customerId: string) {
  const subs = await base44.asServiceRole.entities.TenantSubscription.filter({ customer_id: customerId });
  return subs[0] || null;
}

/** Result payload: the subscription plus the licence it now resolves to. */
async function respond(base44: any, customerId: string, subscription: any, extra: any = {}) {
  const license = await getEffectiveLicense(base44, customerId);
  return Response.json({ ...extra, subscription, license });
}

/**
 * Registo comercial do provisionamento (FM1/FM2): a versão da oferta e a tabela
 * de preços vigentes à data, para que o que ficou contratado seja reconstruível
 * mais tarde. Não altera o gating — quem decide os módulos continua a ser o
 * catálogo de código — e não é condição para provisionar: sem oferta publicada,
 * a subscrição fica como antes (sem versão nem preço registados).
 */
async function commercialContext(base44: any, tierCode: string, at: string) {
  try {
    const versions = await base44.asServiceRole.entities.OfferVersion.list("-created_date", 200);
    const offerVersion = offerVersionInForce(versions || [], at);
    if (!offerVersion) return {};

    const tables = await base44.asServiceRole.entities.PriceTable.list("-created_date", 200);
    const table = priceTableInForce(tables || [], offerVersion.id, at);
    const entry = (table?.entries || []).find((row: any) => row.tier_code === tierCode) || null;

    return {
      offer_version_id: offerVersion.id,
      offer_version_code: offerVersion.code,
      price_table_id: table?.id || null,
      price_amount_cents: entry?.amount_cents ?? null,
    };
  } catch (_error) {
    return {};
  }
}

async function createSubscription(base44: any, user: any, customer: any, body: any) {
  const existing = await findByCustomer(base44, customer.id);
  if (existing) {
    return Response.json(
      { error: "Este cliente já tem uma subscrição.", code: "already_exists", subscription: existing },
      { status: 409 },
    );
  }

  const tier = resolveTier(body.tier_code);
  if (!tier) return Response.json({ error: "tier_code inválido." }, { status: 400 });

  const seatLimit = Number(body.seat_limit ?? 5);
  if (!Number.isFinite(seatLimit) || seatLimit < 1) {
    return Response.json({ error: "seat_limit tem de ser um número positivo." }, { status: 400 });
  }

  const beforeState = await licenseState(base44, customer.id);
  const startedDate = body.started_date || new Date().toISOString().split("T")[0];

  const subscription = await base44.asServiceRole.entities.TenantSubscription.create({
    customer_id: customer.id,
    customer_name: customer.name || "",
    tier_code: tier,
    status: body.trial_ends_at ? "trial" : "active",
    started_date: startedDate,
    ...(await commercialContext(base44, tier, startedDate)),
    ...(body.expires_date ? { expires_date: body.expires_date } : {}),
    ...(body.trial_ends_at ? { trial_ends_at: body.trial_ends_at } : {}),
    seat_limit: seatLimit,
    seats_used: 0,
    notes: body.notes || "",
  });

  await audit(base44, user, "license_subscription_created", customer, subscription.id, {
    tier_code: tier,
    seat_limit: seatLimit,
  });
  await recordChange(base44, user, {
    action: "create",
    customer,
    entityType: "TenantSubscription",
    entityId: subscription.id,
    reason: body.reason,
    beforeState,
    afterState: await licenseState(base44, customer.id),
  });

  return await respond(base44, customer.id, subscription);
}

async function updateSubscription(base44: any, user: any, customer: any, body: any) {
  const subscription = await findByCustomer(base44, customer.id);
  if (!subscription) return Response.json({ error: "Cliente sem subscrição." }, { status: 404 });

  const patch: any = {};

  if (body.tier_code !== undefined) {
    const tier = resolveTier(body.tier_code);
    if (!tier) return Response.json({ error: "tier_code inválido." }, { status: 400 });
    patch.tier_code = tier;
  }
  if (body.seat_limit !== undefined) {
    const seatLimit = Number(body.seat_limit);
    if (!Number.isFinite(seatLimit) || seatLimit < (subscription.seats_used || 0)) {
      return Response.json(
        { error: "seat_limit não pode ser inferior aos assentos já em uso.", seats_used: subscription.seats_used || 0 },
        { status: 400 },
      );
    }
    patch.seat_limit = seatLimit;
  }
  // Data vazia limpa a validade: `TenantSubscription.expires_date` declara o
  // tipo união para o validador aceitar o null (limitação conhecida do emulador).
  if (body.expires_date !== undefined) patch.expires_date = body.expires_date || null;
  if (body.started_date !== undefined) patch.started_date = body.started_date;
  if (body.notes !== undefined) patch.notes = body.notes;

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nada para alterar." }, { status: 400 });
  }

  // Mudar de tier é contratar outra oferta: o registo comercial acompanha a
  // decisão, para que a versão e o preço vigentes fiquem com a subscrição.
  if (patch.tier_code) {
    Object.assign(
      patch,
      await commercialContext(
        base44,
        patch.tier_code,
        patch.started_date || subscription.started_date || new Date().toISOString().split("T")[0],
      ),
    );
  }

  const beforeState = await licenseState(base44, customer.id);
  const updated = await base44.asServiceRole.entities.TenantSubscription.update(subscription.id, patch);
  await audit(base44, user, "license_subscription_updated", customer, subscription.id, patch);
  await recordChange(base44, user, {
    action: "update",
    customer,
    entityType: "TenantSubscription",
    entityId: subscription.id,
    reason: body.reason,
    beforeState,
    afterState: await licenseState(base44, customer.id),
  });
  return await respond(base44, customer.id, updated);
}

/**
 * Suspender sem fechar imediatamente: o tenant fica em tolerância (aviso dentro
 * do produto) e só no fim do período é que os módulos fecham — o fecho é
 * então consequência do gating fail-closed, sem nenhuma acção adicional.
 */
async function suspendSubscription(base44: any, user: any, customer: any, body: any) {
  const subscription = await findByCustomer(base44, customer.id);
  if (!subscription) return Response.json({ error: "Cliente sem subscrição." }, { status: 404 });

  const days = Number(body.grace_days ?? DEFAULT_GRACE_DAYS);
  if (!Number.isFinite(days) || days < 0 || days > MAX_GRACE_DAYS) {
    return Response.json({ error: `grace_days tem de estar entre 0 e ${MAX_GRACE_DAYS}.` }, { status: 400 });
  }

  const beforeState = await licenseState(base44, customer.id);
  const graceUntil = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
  const updated = await base44.asServiceRole.entities.TenantSubscription.update(subscription.id, {
    status: "suspended",
    grace_until: graceUntil,
    notes: body.reason ? `${subscription.notes || ""}\n[Suspensão] ${body.reason}`.trim() : subscription.notes || "",
  });

  await audit(base44, user, "license_subscription_suspended", customer, subscription.id, {
    grace_until: graceUntil,
    grace_days: days,
    reason: body.reason || "",
  });
  await recordChange(base44, user, {
    action: "suspend",
    customer,
    entityType: "TenantSubscription",
    entityId: subscription.id,
    reason: body.reason,
    beforeState,
    afterState: await licenseState(base44, customer.id),
  });

  return await respond(base44, customer.id, updated);
}

async function resumeSubscription(base44: any, user: any, customer: any, body: any = {}) {
  const subscription = await findByCustomer(base44, customer.id);
  if (!subscription) return Response.json({ error: "Cliente sem subscrição." }, { status: 404 });

  const beforeState = await licenseState(base44, customer.id);
  const updated = await base44.asServiceRole.entities.TenantSubscription.update(subscription.id, {
    status: "active",
    grace_until: null,
  });

  await audit(base44, user, "license_subscription_resumed", customer, subscription.id, {});
  await recordChange(base44, user, {
    action: "resume",
    customer,
    entityType: "TenantSubscription",
    entityId: subscription.id,
    reason: body.reason,
    beforeState,
    afterState: await licenseState(base44, customer.id),
  });
  return await respond(base44, customer.id, updated);
}

/** Excepção por módulo, com motivo e validade. */
async function setModule(base44: any, user: any, customer: any, body: any) {
  const moduleCode = body.module_code;
  if (!moduleCode) return Response.json({ error: "module_code is required" }, { status: 400 });

  const modules = await base44.asServiceRole.entities.LicenseModule.list("display_order", 100);
  if (!modules.some((m: any) => m.code === moduleCode)) {
    return Response.json({ error: "module_code desconhecido." }, { status: 400 });
  }

  const status = body.active === false ? "inactive" : "active";
  const reason = body.reason || "";
  const expiresAt = body.expires_at || null;
  const nowIso = new Date().toISOString();

  const beforeState = await licenseState(base44, customer.id);
  const existing = await base44.asServiceRole.entities.TenantModule.filter({
    customer_id: customer.id,
    module_code: moduleCode,
  });

  const data: any = {
    customer_id: customer.id,
    module_code: moduleCode,
    status,
    reason,
    expires_at: expiresAt,
    ...(status === "active" ? { activated_at: nowIso } : { deactivated_at: nowIso }),
  };

  const saved = existing.length > 0
    ? await base44.asServiceRole.entities.TenantModule.update(existing[0].id, data)
    : await base44.asServiceRole.entities.TenantModule.create(data);

  await audit(base44, user, "license_module_overridden", customer, saved.id, {
    module_code: moduleCode,
    status,
    reason,
    expires_at: expiresAt,
  });
  await recordChange(base44, user, {
    action: "set_module",
    customer,
    entityType: "TenantModule",
    entityId: saved.id,
    reason,
    beforeState,
    afterState: await licenseState(base44, customer.id),
  });

  return await respond(base44, customer.id, await findByCustomer(base44, customer.id), { module: saved });
}

async function setStandard(base44: any, user: any, customer: any, body: any) {
  const standardCode = body.standard_code;
  if (!standardCode) return Response.json({ error: "standard_code is required" }, { status: 400 });

  const status = body.active === false ? "inactive" : "active";
  const beforeState = await licenseState(base44, customer.id);
  const existing = await base44.asServiceRole.entities.TenantStandard.filter({
    customer_id: customer.id,
    standard_code: standardCode,
  });

  const data: any = {
    customer_id: customer.id,
    standard_code: standardCode,
    status,
    ...(status === "active" ? { activated_at: new Date().toISOString() } : {}),
  };

  const saved = existing.length > 0
    ? await base44.asServiceRole.entities.TenantStandard.update(existing[0].id, data)
    : await base44.asServiceRole.entities.TenantStandard.create(data);

  await audit(base44, user, "license_standard_set", customer, saved.id, {
    standard_code: standardCode,
    status,
  });
  await recordChange(base44, user, {
    action: "set_standard",
    customer,
    entityType: "TenantStandard",
    entityId: saved.id,
    reason: body.reason,
    beforeState,
    afterState: await licenseState(base44, customer.id),
  });

  return await respond(base44, customer.id, await findByCustomer(base44, customer.id));
}

/**
 * Estado relevante da licença de um tenant: subscrição, excepções por módulo e
 * standards. É a matéria-prima do antes/depois que o histórico mostra.
 */
const SUBSCRIPTION_FIELDS = [
  "tier_code",
  "status",
  "seat_limit",
  "seats_used",
  "started_date",
  "expires_date",
  "notes",
  "grace_until",
];

async function licenseState(base44: any, customerId: string) {
  const subs = await base44.asServiceRole.entities.TenantSubscription.filter({ customer_id: customerId });
  const modules = await base44.asServiceRole.entities.TenantModule.filter({ customer_id: customerId });
  const standards = await base44.asServiceRole.entities.TenantStandard.filter({ customer_id: customerId });

  return {
    subscription: subs[0] || null,
    modules: modules.map((m: any) => ({
      module_code: m.module_code,
      status: m.status ?? null,
      expires_at: m.expires_at ?? null,
    })),
    standards: standards.map((s: any) => ({
      standard_code: s.standard_code,
      status: s.status ?? null,
    })),
  };
}

/** Diff dos dois estados: códigos de campo alterados e os valores antes/depois. */
function diffStates(before: any, after: any) {
  const changedFields: string[] = [];
  const beforeDiff: any = { subscription: null, modules: [], standards: [] };
  const afterDiff: any = { subscription: null, modules: [], standards: [] };

  for (const field of SUBSCRIPTION_FIELDS) {
    const previous = before.subscription ? before.subscription[field] ?? null : null;
    const next = after.subscription ? after.subscription[field] ?? null : null;
    if (JSON.stringify(previous) === JSON.stringify(next)) continue;
    changedFields.push(field);
    beforeDiff.subscription = { ...(beforeDiff.subscription || {}), [field]: previous };
    afterDiff.subscription = { ...(afterDiff.subscription || {}), [field]: next };
  }

  const keyed = (rows: any[], key: string) => new Map(rows.map((row: any) => [row[key], row]));
  const collect = (beforeRows: any[], afterRows: any[], key: string, prefix: string) => {
    const previous = keyed(beforeRows || [], key);
    const next = keyed(afterRows || [], key);
    for (const code of new Set([...previous.keys(), ...next.keys()])) {
      const from = previous.get(code) || null;
      const to = next.get(code) || null;
      if (JSON.stringify(from) === JSON.stringify(to)) continue;
      changedFields.push(`${prefix}${code}`);
      if (from) beforeDiff[key === "module_code" ? "modules" : "standards"].push(from);
      if (to) afterDiff[key === "module_code" ? "modules" : "standards"].push(to);
    }
  };
  collect(before.modules, after.modules, "module_code", "module:");
  collect(before.standards, after.standards, "standard_code", "standard:");

  return { changedFields: changedFields.sort(), before: beforeDiff, after: afterDiff };
}

/**
 * A linha de histórico da alteração. Sem campos alterados não se escreve nada:
 * uma repetição da mesma operação não inventa histórico.
 */
async function recordChange(base44: any, user: any, change: any) {
  const diff = diffStates(change.beforeState, change.afterState);
  if (diff.changedFields.length === 0) return;

  await base44.asServiceRole.entities.LicenseChangeLog.create({
    customer_id: change.customer.id,
    customer_name: change.customer.name || "",
    action: change.action,
    actor_email: user.email || "",
    actor_role: normalizeRole(user.role),
    entity_type: change.entityType,
    entity_id: change.entityId || "",
    reason: change.reason || "",
    changed_fields: diff.changedFields,
    before: change.action === "create" ? null : diff.before,
    after: diff.after,
  });
}

/** Todo o licenciamento fica registado: quem, o quê, em que cliente, quando. */
async function audit(base44: any, user: any, action: string, customer: any, entityId: string, details: any) {
  await writeAccessAuditLog(
    base44,
    action,
    customer.id,
    user.email || "",
    JSON.stringify(details),
    "TenantSubscription",
    entityId,
  );
}
