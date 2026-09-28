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
        return await resumeSubscription(base44, user, customer);
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

  const subscription = await base44.asServiceRole.entities.TenantSubscription.create({
    customer_id: customer.id,
    customer_name: customer.name || "",
    tier_code: tier,
    status: body.trial_ends_at ? "trial" : "active",
    started_date: body.started_date || new Date().toISOString().split("T")[0],
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
  if (body.expires_date !== undefined) patch.expires_date = body.expires_date;
  if (body.started_date !== undefined) patch.started_date = body.started_date;
  if (body.notes !== undefined) patch.notes = body.notes;

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nada para alterar." }, { status: 400 });
  }

  const updated = await base44.asServiceRole.entities.TenantSubscription.update(subscription.id, patch);
  await audit(base44, user, "license_subscription_updated", customer, subscription.id, patch);
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

  return await respond(base44, customer.id, updated);
}

async function resumeSubscription(base44: any, user: any, customer: any) {
  const subscription = await findByCustomer(base44, customer.id);
  if (!subscription) return Response.json({ error: "Cliente sem subscrição." }, { status: 404 });

  const updated = await base44.asServiceRole.entities.TenantSubscription.update(subscription.id, {
    status: "active",
    grace_until: null,
  });

  await audit(base44, user, "license_subscription_resumed", customer, subscription.id, {});
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

  return await respond(base44, customer.id, await findByCustomer(base44, customer.id), { module: saved });
}

async function setStandard(base44: any, user: any, customer: any, body: any) {
  const standardCode = body.standard_code;
  if (!standardCode) return Response.json({ error: "standard_code is required" }, { status: 400 });

  const status = body.active === false ? "inactive" : "active";
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

  return await respond(base44, customer.id, await findByCustomer(base44, customer.id));
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
