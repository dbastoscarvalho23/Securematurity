import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import {
  normalizeRole,
  isPlatformOwner,
  isPartnerAdmin,
  resolveScopeCustomerIds,
  writeAccessAuditLog,
} from "../../shared/accessUtils.ts";
import { resolveActor } from "../../shared/devActor.ts";
import {
  TIER_MODULES,
  LEGACY_TIER_ALIASES,
  addonName,
  modulesForAddon,
  modulesForTier,
  getEffectiveLicense,
} from "../../shared/licenseGuard.ts";
import {
  addonCatalogueCodes,
  addonForSale,
  addonIncludedAiCalls,
  addonPriceEntryFor,
  offerVersionInForce,
  priceEntryFor,
  priceTableInForce,
  standardsForTier,
  tierRank,
} from "../../shared/commercialOffer.ts";
import {
  DEFAULT_WARN_PCT,
  addMonths,
  periodOf,
  quotaState,
  today,
  validityState,
} from "../../shared/quotaState.ts";

/**
 * provisionTenantLicense — operação comercial da plataforma (FB1) e ciclo de
 * vida da subscrição (FM3) com as quotas contratuais (FM4).
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
 * Acções de escrita por cliente: create | update | suspend | resume | set_module |
 * set_addon | set_standard | renew | change_tier | close | set_quotas.
 * Acções de leitura/registo de âmbito: lifecycle | quota_overview |
 * record_quota_signals (leem a carteira inteira e não levam `customer_id`).
 *
 * **Nenhum filtro pode usar o nome do selector (`action`)**: numa função
 * multiplexada é o comando, e um filtro com o mesmo nome sobrepõe-se-lhe (foi o
 * defeito do histórico comercial). Os filtros desta função chamam-se
 * `change_action` (histórico) e `period` (sinalizações de quota).
 *
 * Cada acção deixa dois rastos: a entrada de `AuditLog` (trilha técnica) e uma
 * linha em `LicenseChangeLog` com o autor, o motivo e o antes/depois do estado
 * relevante (subscrição, módulos e standards) — é o que o cartão «Histórico de
 * licenciamento» mostra em /licensing (FB1.12). Esta função é o único escritor
 * dessa entidade, e também o único escritor de `QuotaSignal`.
 */
const ACTIONS = [
  "create",
  "update",
  "suspend",
  "resume",
  "set_module",
  "set_addon",
  "set_standard",
  "renew",
  "change_tier",
  "close",
  "set_quotas",
  "lifecycle",
  "quota_overview",
  "record_quota_signals",
];

/** Acções de âmbito: leem (ou registam) a carteira inteira, sem cliente no corpo. */
const SCOPE_ACTIONS = ["lifecycle", "quota_overview", "record_quota_signals"];

const DEFAULT_GRACE_DAYS = 7;
const MAX_GRACE_DAYS = 90;
const MAX_TENANTS = 100;
const MAX_SIGNAL_SCAN = 500;
const MAX_RENEWAL_MONTHS = 60;
const MAX_SEATS = 10000;

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

    // Âmbito de ESCRITA: o dono da plataforma actua em qualquer cliente; um
    // administrador de parceiro só dentro da sua carteira.
    const scope = await resolveScopeCustomerIds(base44, user);

    // Leituras e registos de âmbito não têm um cliente no corpo.
    if (SCOPE_ACTIONS.includes(action)) {
      switch (action) {
        case "lifecycle":
          return await lifecycle(base44, scope);
        case "quota_overview":
          return await quotaOverview(base44, scope);
        case "record_quota_signals":
          return await recordQuotaSignals(base44, user, scope, body);
        default:
          break;
      }
    }

    const customerId = body.customer_id;
    if (!customerId) return Response.json({ error: "customer_id is required" }, { status: 400 });

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
      case "set_addon":
        return await setAddon(base44, user, customer, body);
      case "set_standard":
        return await setStandard(base44, user, customer, body);
      case "renew":
        return await renewSubscription(base44, user, customer, body);
      case "change_tier":
        return await changeTier(base44, user, customer, body);
      case "close":
        return await closeSubscription(base44, user, customer, body);
      case "set_quotas":
        return await setQuotas(base44, user, customer, body);
      default:
        return Response.json({ error: "Acção inválida." }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/** Motivo obrigatório: renovações, mudanças de nível, fechos e quotas exigem-no. */
function validateReason(value: any, required = true) {
  const reason = String(value || "").trim();
  if (required && reason.length < 3) return { error: "reason (motivo) é obrigatório.", reason: null };
  return { error: null, reason };
}

/** Reject tier codes that are not part of the catalogue. */
function resolveTier(tierCode: string): string | null {
  if (!tierCode) return null;
  const resolved = LEGACY_TIER_ALIASES[tierCode] || tierCode;
  return TIER_MODULES[resolved] ? resolved : null;
}

/**
 * A subscrição de um cliente. Um tenant pode ter mais do que um registo quando
 * um contrato foi fechado e outro foi criado depois: vale sempre o contrato
 * vivo, e só na falta dele se devolve o fechado (para o histórico e o trabalho a
 * tratar continuarem legíveis).
 */
async function findByCustomer(base44: any, customerId: string) {
  const subs = await base44.asServiceRole.entities.TenantSubscription.filter({ customer_id: customerId });
  return (subs || []).find((sub: any) => sub.status !== "cancelled") || subs[0] || null;
}

/** Clientes no âmbito (todos, para o dono da plataforma; a carteira, para o parceiro). */
async function scopedCustomers(base44: any, scope: any) {
  const customers = await base44.asServiceRole.entities.Customer.list("name", 500);
  const scoped = scope.all ? customers : customers.filter((c: any) => scope.customerIds.includes(c.id));
  return scoped.slice(0, MAX_TENANTS);
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
  // Um contrato fechado não impede um contrato novo: o registo antigo fica como
  // está (histórico e trabalho a tratar) e o novo passa a ser o vigente.
  const existing = await findByCustomer(base44, customer.id);
  if (existing && existing.status !== "cancelled") {
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
  const startedDate = body.started_date || today();

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
    quota_warn_pct: DEFAULT_WARN_PCT,
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

  // Mudar de nível tem uma só regra, seja qual for a porta (`update` ou
  // `change_tier`): o que o novo nível não cobre tem de ser retirado com
  // confirmação explícita, senão fica concedido em silêncio o que saiu do contrato.
  let changingTier = false;

  if (body.tier_code !== undefined) {
    const tier = resolveTier(body.tier_code);
    if (!tier) return Response.json({ error: "tier_code inválido." }, { status: 400 });
    patch.tier_code = tier;
    changingTier = tier !== (resolveTier(subscription.tier_code) || subscription.tier_code);
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

  // O estado anterior é lido antes de qualquer retirada, para que o histórico
  // mostre também as excepções e as normas que saíram com a mudança de nível.
  const beforeState = await licenseState(base44, customer.id);

  if (changingTier) {
    const guard = await guardTierChange(base44, customer, patch.tier_code, body);
    if (guard.error) return guard.error;
  }

  // Mudar de tier é contratar outra oferta: o registo comercial acompanha a
  // decisão, para que a versão e o preço vigentes fiquem com a subscrição.
  if (patch.tier_code) {
    Object.assign(
      patch,
      await commercialContext(base44, patch.tier_code, patch.started_date || subscription.started_date || today()),
    );
  }

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
 * Renovação (FM3): um período novo para a mesma oferta contratada. Renovar
 * **não** muda o que está contratado — nível, excepções por módulo e normas
 * ficam como estão, e o registo comercial passa a apontar a versão e o preço
 * vigentes à data da renovação. Contratar outro nível é `change_tier`.
 */
async function renewSubscription(base44: any, user: any, customer: any, body: any) {
  const subscription = await findByCustomer(base44, customer.id);
  if (!subscription) return Response.json({ error: "Cliente sem subscrição." }, { status: 404 });
  if (subscription.status === "cancelled") {
    return Response.json(
      { error: "Esta subscrição está fechada — crie uma nova antes de renovar.", code: "subscription_closed" },
      { status: 422 },
    );
  }

  const reason = validateReason(body.reason);
  if (reason.error) return Response.json({ error: reason.error }, { status: 422 });

  const currentTier = resolveTier(subscription.tier_code);
  if (body.tier_code !== undefined && resolveTier(body.tier_code) !== currentTier) {
    return Response.json(
      {
        error: "Uma renovação mantém o nível contratado — use change_tier para contratar outro nível.",
        code: "use_change_tier",
      },
      { status: 422 },
    );
  }
  if (body.modules !== undefined || body.standards !== undefined) {
    return Response.json(
      {
        error: "Uma renovação não concede módulos nem normas — use set_module ou set_standard.",
        code: "renewal_only",
      },
      { status: 422 },
    );
  }

  const months = Number(body.months ?? 12);
  if (!Number.isFinite(months) || months < 1 || months > MAX_RENEWAL_MONTHS) {
    return Response.json(
      { error: `months tem de estar entre 1 e ${MAX_RENEWAL_MONTHS}.` },
      { status: 422 },
    );
  }

  const from = today();
  // A renovação conta a partir da validade actual quando ela ainda está no
  // futuro: renovar antes do fim não encurta o que o cliente já pagou.
  const base = subscription.expires_date && subscription.expires_date > from ? subscription.expires_date : from;
  const expires = addMonths(base, months);

  const patch: any = {
    expires_date: expires,
    renewal_count: (subscription.renewal_count || 0) + 1,
    last_renewed_at: from,
    ...(await commercialContext(base44, currentTier || subscription.tier_code, from)),
  };
  // Uma subscrição que o gating já lia como expirada volta a estar ativa.
  if (subscription.status === "expired") patch.status = "active";

  const beforeState = await licenseState(base44, customer.id);
  const updated = await base44.asServiceRole.entities.TenantSubscription.update(subscription.id, patch);

  await audit(base44, user, "license_subscription_renewed", customer, subscription.id, {
    months,
    expires_date: expires,
    renewal_count: patch.renewal_count,
  });
  await recordChange(base44, user, {
    action: "renew",
    customer,
    entityType: "TenantSubscription",
    entityId: subscription.id,
    reason: reason.reason,
    beforeState,
    afterState: await licenseState(base44, customer.id),
  });

  return await respond(base44, customer.id, updated, { months, expires_date: expires });
}

/**
 * Subida ou descida de nível (FM3): o servidor calcula o que entra e o que sai e
 * aplica tudo na mesma operação — subscrição, excepções e normas — com o
 * antes/depois no histórico.
 *
 * Uma descida que deixaria concedido, em silêncio, o que o cliente deixou de
 * contratar é recusada com a lista do que sobra (422 `removals_required`); quem
 * confirma recebe a retirada explícita (nada é apagado: fica inactivo com data).
 */
async function changeTier(base44: any, user: any, customer: any, body: any) {
  const subscription = await findByCustomer(base44, customer.id);
  if (!subscription) return Response.json({ error: "Cliente sem subscrição." }, { status: 404 });
  if (subscription.status === "cancelled") {
    return Response.json(
      { error: "Esta subscrição está fechada.", code: "subscription_closed" },
      { status: 422 },
    );
  }

  const tier = resolveTier(body.tier_code);
  if (!tier) return Response.json({ error: "tier_code inválido." }, { status: 400 });

  const reason = validateReason(body.reason);
  if (reason.error) return Response.json({ error: reason.error }, { status: 422 });

  const fromTier = resolveTier(subscription.tier_code) || subscription.tier_code;
  if (fromTier === tier) {
    return Response.json({ error: "O cliente já está neste nível.", code: "same_tier" }, { status: 409 });
  }

  const beforeState = await licenseState(base44, customer.id);
  const guard = await guardTierChange(base44, customer, tier, body);
  if (guard.error) return guard.error;
  const leaving = guard.leaving;

  const updated = await base44.asServiceRole.entities.TenantSubscription.update(subscription.id, {
    tier_code: tier,
    ...(await commercialContext(base44, tier, today())),
  });

  await audit(base44, user, "license_subscription_tier_changed", customer, subscription.id, {
    from_tier: fromTier,
    tier_code: tier,
    direction: guard.direction,
    removed_modules: leaving.modules,
    removed_standards: leaving.standards,
  });
  await recordChange(base44, user, {
    action: "change_tier",
    customer,
    entityType: "TenantSubscription",
    entityId: subscription.id,
    reason: reason.reason,
    beforeState,
    afterState: await licenseState(base44, customer.id),
  });

  return await respond(base44, customer.id, updated, {
    direction: guard.direction,
    from_tier: fromTier,
    tier_code: tier,
    removed: leaving,
  });
}

/**
 * Coerência de uma mudança de nível — uma só regra, usada por `change_tier` e por
 * `update`. Numa descida, o que o novo nível não cobre (excepções por módulo
 * activas e normas que a oferta em vigor não faz acompanhar desse nível) só é
 * retirado com confirmação explícita; sem ela a operação é recusada com a lista
 * do que sobra. Nada é apagado: as concessões ficam inactivas com data.
 */
async function guardTierChange(base44: any, customer: any, tierCode: string, body: any) {
  const subscription = await findByCustomer(base44, customer.id);
  if (!subscription) return { error: Response.json({ error: "Cliente sem subscrição." }, { status: 404 }) };

  const fromTier = resolveTier(subscription.tier_code) || subscription.tier_code;
  const direction = tierRank(tierCode) > tierRank(fromTier) ? "upgrade" : "downgrade";
  const leaving = direction === "downgrade"
    ? await leavingGrants(base44, customer.id, tierCode)
    : { modules: [], standards: [], offer_version_code: null };

  if ((leaving.modules.length > 0 || leaving.standards.length > 0) && body.confirm_removals !== true) {
    return {
      error: Response.json(
        {
          error: "A descida de nível deixa excepções por módulo ou normas fora do novo nível — confirme o que é retirado.",
          code: "removals_required",
          leaving,
        },
        { status: 422 },
      ),
      direction,
      leaving,
    };
  }

  await withdrawLeaving(base44, customer.id, leaving);
  return { error: null, direction, leaving };
}

/** Retira o que o novo nível não cobre: inactivo com data, nunca apagado. */
async function withdrawLeaving(base44: any, customerId: string, leaving: any) {
  const nowIso = new Date().toISOString();

  for (const moduleCode of leaving.modules || []) {
    const rows = await base44.asServiceRole.entities.TenantModule.filter({
      customer_id: customerId,
      module_code: moduleCode,
    });
    if (rows.length > 0) {
      await base44.asServiceRole.entities.TenantModule.update(rows[0].id, {
        status: "inactive",
        deactivated_at: nowIso,
      });
    }
  }
  for (const standardCode of leaving.standards || []) {
    const rows = await base44.asServiceRole.entities.TenantStandard.filter({
      customer_id: customerId,
      standard_code: standardCode,
    });
    if (rows.length > 0) {
      await base44.asServiceRole.entities.TenantStandard.update(rows[0].id, { status: "inactive" });
    }
  }
}

/**
 * O que sai quando o nível desce: as excepções por módulo ativas cujo módulo o
 * novo nível não abre e as normas ativas que a oferta em vigor não faz
 * acompanhar do novo nível. Quem decide acessos continua a ser o catálogo de
 * código — isto só evita deixar concedido, em silêncio, o que saiu do contrato.
 */
async function leavingGrants(base44: any, customerId: string, tierCode: string) {
  const newModules = new Set(modulesForTier(tierCode));
  const overrides = await base44.asServiceRole.entities.TenantModule.filter({ customer_id: customerId });
  const now = Date.now();
  const active = (overrides || []).filter(
    (o: any) => o.status === "active" && (!o.expires_at || new Date(o.expires_at).getTime() > now),
  );
  const modules = active.map((o: any) => o.module_code).filter((code: string) => !newModules.has(code));

  let standards: string[] = [];
  let offerVersionCode: string | null = null;
  const versions = await base44.asServiceRole.entities.OfferVersion.list("-created_date", 200);
  const offerVersion = offerVersionInForce(versions || [], today());
  if (offerVersion) {
    offerVersionCode = offerVersion.code || null;
    const allowed = standardsForTier(offerVersion, tierCode);
    if (allowed) {
      const rows = await base44.asServiceRole.entities.TenantStandard.filter({
        customer_id: customerId,
        status: "active",
      });
      standards = (rows || [])
        .map((row: any) => row.standard_code)
        .filter((code: string) => !allowed.includes(code));
    }
  }

  return { modules, standards, offer_version_code: offerVersionCode };
}

/**
 * Fecho do tenant (FM3): a subscrição passa a `cancelled`, as excepções por
 * módulo e os standards ficam retirados com data e o gating fica fail-closed —
 * nenhum módulo abre. Nada é apagado e nada é cobrado; o que fica por fechar do
 * lado do cliente (delegações vivas, pacotes de auditoria em rascunho) é
 * devolvido como trabalho a tratar e continua visível na consola comercial.
 */
async function closeSubscription(base44: any, user: any, customer: any, body: any) {
  const subscription = await findByCustomer(base44, customer.id);
  if (!subscription) return Response.json({ error: "Cliente sem subscrição." }, { status: 404 });
  if (subscription.status === "cancelled") {
    return Response.json({ error: "Esta subscrição já está fechada.", code: "already_closed" }, { status: 409 });
  }

  const reason = validateReason(body.reason);
  if (reason.error) return Response.json({ error: reason.error }, { status: 422 });

  const closedAt = body.effective_date || today();
  const beforeState = await licenseState(base44, customer.id);
  const nowIso = new Date().toISOString();

  const overrides = await base44.asServiceRole.entities.TenantModule.filter({ customer_id: customer.id });
  for (const row of overrides || []) {
    if (row.status !== "active") continue;
    await base44.asServiceRole.entities.TenantModule.update(row.id, {
      status: "inactive",
      deactivated_at: nowIso,
    });
  }
  const standards = await base44.asServiceRole.entities.TenantStandard.filter({
    customer_id: customer.id,
    status: "active",
  });
  for (const row of standards || []) {
    await base44.asServiceRole.entities.TenantStandard.update(row.id, { status: "inactive" });
  }

  // Os packs contratados ficam retirados com data: fechar um tenant não deixa
  // nenhum acréscimo vivo, e nada é apagado (a linha fica como histórico).
  const closedAddons = (subscription.addons || []).map((row: any) =>
    row?.status === "active" ? { ...row, status: "inactive", ended_date: closedAt } : row
  );

  const updated = await base44.asServiceRole.entities.TenantSubscription.update(subscription.id, {
    status: "cancelled",
    closed_at: closedAt,
    closed_reason: reason.reason,
    grace_until: null,
    addons: closedAddons,
    addon_amount_cents: addonTotalCents(closedAddons),
  });

  await audit(base44, user, "license_subscription_closed", customer, subscription.id, {
    closed_at: closedAt,
    reason: reason.reason,
  });
  await recordChange(base44, user, {
    action: "close",
    customer,
    entityType: "TenantSubscription",
    entityId: subscription.id,
    reason: reason.reason,
    beforeState,
    afterState: await licenseState(base44, customer.id),
  });

  return await respond(base44, customer.id, updated, {
    closed_at: closedAt,
    handover: await handoverFor(base44, customer.id),
  });
}

/**
 * Trabalho a tratar de um tenant fechado: o que fica por fechar do lado do
 * cliente. Nada é apagado — a plataforma só o regista e mostra, para que a
 * operação saiba o que ainda depende de alguém.
 */
async function handoverFor(base44: any, customerId: string) {
  const [assignments, packages] = await Promise.all([
    base44.asServiceRole.entities.UserCustomerAssignment.filter({ customer_id: customerId }),
    base44.asServiceRole.entities.AuditPackage.filter({ customer_id: customerId }),
  ]);
  const now = Date.now();
  const live = (assignments || []).filter(
    (a: any) => a.status === "active" && (!a.expires_at || new Date(a.expires_at).getTime() > now),
  );
  const drafts = (packages || []).filter((p: any) => p.status !== "final");

  return {
    live_delegations: live.length,
    pending_audit_packages: drafts.length,
    audit_packages_total: (packages || []).length,
    checked_at: new Date().toISOString(),
  };
}

/**
 * Quotas contratuais (FM4): lugares incluídos e consumo de IA por mês, com o
 * limiar de aviso. Os valores por omissão vêm da tabela de preços associada à
 * subscrição (a que vigorava quando foi provisionada) e, na sua falta, da tabela
 * vigente para a oferta publicada — e é essa a proveniência registada. Nada
 * aqui altera o gating: a quota sinaliza, não bloqueia.
 */
async function setQuotas(base44: any, user: any, customer: any, body: any) {
  const subscription = await findByCustomer(base44, customer.id);
  if (!subscription) return Response.json({ error: "Cliente sem subscrição." }, { status: 404 });
  if (subscription.status === "cancelled") {
    return Response.json(
      { error: "Esta subscrição está fechada.", code: "subscription_closed" },
      { status: 422 },
    );
  }

  const reason = validateReason(body.reason);
  if (reason.error) return Response.json({ error: reason.error }, { status: 422 });

  const defaults = await quotaDefaults(base44, subscription);
  const seatsUsed = subscription.seats_used || 0;

  let seatLimit = body.seat_limit === undefined
    ? (defaults.included_seats ?? subscription.seat_limit ?? 0)
    : Number(body.seat_limit);
  if (!Number.isFinite(seatLimit) || seatLimit < 0 || seatLimit > MAX_SEATS) {
    return Response.json({ error: `seat_limit tem de estar entre 0 e ${MAX_SEATS}.` }, { status: 422 });
  }

  // Quota por omissão inaplicável (OP-M1): o incluído da tabela em vigor pode
  // ficar abaixo do que o cliente já usa — antes isso recusava a operação e
  // deixava-a sem caminho. Quando o valor é o **por omissão** (o utilizador não
  // pediu um número), a quota é elevada ao valor em uso e a operação conclui com
  // aviso, que a consola mostra; pedir **explicitamente** abaixo do usado mantém
  // a recusa, agora com o que fazer.
  let seatQuotaRaised: { from: number; to: number } | null = null;
  if (seatLimit < seatsUsed) {
    if (body.seat_limit !== undefined) {
      return Response.json(
        {
          error: `A quota de lugares não pode ser inferior aos assentos já em uso (${seatsUsed}). Retire lugares primeiro — o cliente tem de libertar assentos até ${seatLimit} — ou deixe o valor por omissão, que é elevado ao incluído em uso.`,
          code: "seat_limit_below_usage",
          seats_used: seatsUsed,
        },
        { status: 422 },
      );
    }
    seatQuotaRaised = { from: seatLimit, to: seatsUsed };
    seatLimit = seatsUsed;
  }

  const aiQuota = body.ai_quota_monthly === undefined
    ? (defaults.included_ai_calls ?? null)
    : body.ai_quota_monthly;
  if (aiQuota !== null && aiQuota !== undefined) {
    const parsed = Number(aiQuota);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return Response.json({ error: "ai_quota_monthly tem de ser um número igual ou superior a zero." }, { status: 422 });
    }
  }

  const warnPct = body.quota_warn_pct === undefined
    ? (subscription.quota_warn_pct ?? DEFAULT_WARN_PCT)
    : Number(body.quota_warn_pct);
  if (!Number.isFinite(warnPct) || warnPct < 1 || warnPct > 100) {
    return Response.json({ error: "quota_warn_pct tem de estar entre 1 e 100." }, { status: 422 });
  }

  const patch: any = {
    seat_limit: seatLimit,
    ai_quota_monthly: aiQuota === null || aiQuota === undefined ? null : Number(aiQuota),
    quota_warn_pct: warnPct,
    quota_source_price_table_id: defaults.price_table_id || null,
  };

  // O aviso acompanha a operação que o provocou, com o antes/depois numérico —
  // não é um alerta genérico de página. O histórico de licenciamento regista a
  // alteração do `seat_limit` a partir dos dois estados (antes/depois).
  const warning = seatQuotaRaised
    ? {
        code: "seat_quota_raised_to_usage",
        field: "seat_limit",
        from: seatQuotaRaised.from,
        to: seatQuotaRaised.to,
        message: `O incluído da tabela em vigor (${seatQuotaRaised.from} lugares) é inferior aos ${seatQuotaRaised.to} em uso: a quota foi elevada ao valor em uso.`,
      }
    : null;

  const beforeState = await licenseState(base44, customer.id);
  const updated = await base44.asServiceRole.entities.TenantSubscription.update(subscription.id, patch);

  await audit(base44, user, "license_quotas_set", customer, subscription.id, {
    seat_limit: patch.seat_limit,
    ai_quota_monthly: patch.ai_quota_monthly,
    quota_warn_pct: patch.quota_warn_pct,
    source_price_table_id: patch.quota_source_price_table_id,
    ...(warning ? { adjusted: { from: warning.from, to: warning.to } } : {}),
  });
  await recordChange(base44, user, {
    action: "set_quotas",
    customer,
    entityType: "TenantSubscription",
    entityId: subscription.id,
    reason: warning ? `${reason.reason} — quota elevada ao valor em uso (${warning.from} → ${warning.to})` : reason.reason,
    beforeState,
    afterState: await licenseState(base44, customer.id),
  });

  return await respond(base44, customer.id, updated, { defaults, warning });
}

/**
 * Valores por omissão das quotas: os da tabela de preços da subscrição ou, na
 * falta dela, os da tabela vigente para a oferta publicada hoje.
 */
async function quotaDefaults(base44: any, subscription: any) {
  const empty = {
    price_table_id: null,
    price_table_label: null,
    billing_period: null,
    currency: "EUR",
    included_seats: null,
    included_ai_calls: null,
    extra_seat_amount_cents: null,
  };

  try {
    let table: any = null;
    if (subscription.price_table_id) {
      table = await base44.asServiceRole.entities.PriceTable.get(subscription.price_table_id).catch(() => null);
    }
    if (!table) {
      const versions = await base44.asServiceRole.entities.OfferVersion.list("-created_date", 200);
      const version = offerVersionInForce(versions || [], today());
      if (!version) return empty;
      const tables = await base44.asServiceRole.entities.PriceTable.list("-created_date", 200);
      table = priceTableInForce(tables || [], version.id, today());
      if (!table) return empty;
    }

    const entry = priceEntryFor(table, subscription.tier_code);
    // A quota de IA contratada é a do tier mais a dos packs activos: um pack que
    // inclui consumo não pode deixar a quota prometida por medir (FM4).
    const addonAiCalls = addonIncludedAiCalls(table, subscription.addons || []);
    const tierAiCalls = entry?.included_ai_calls ?? null;
    return {
      price_table_id: table.id || null,
      price_table_label: table.label || null,
      billing_period: table.billing_period || null,
      currency: table.currency || "EUR",
      included_seats: entry?.included_seats ?? null,
      included_ai_calls: tierAiCalls === null && addonAiCalls === 0 ? null : (Number(tierAiCalls) || 0) + addonAiCalls,
      extra_seat_amount_cents: entry?.extra_seat_amount_cents ?? null,
    };
  } catch (_error) {
    return empty;
  }
}

/**
 * Ciclo de vida (FM3) por cliente no âmbito: o estado de vigência da subscrição
 * (a expirar, expirada, suspensa, fechada), as renovações já registadas e, nos
 * tenants fechados, o trabalho a tratar. Leitura apenas.
 */
async function lifecycle(base44: any, scope: any) {
  const customers = await scopedCustomers(base44, scope);
  const tenants = [];

  for (const customer of customers) {
    const subscription = await findByCustomer(base44, customer.id);
    const license = await getEffectiveLicense(base44, customer.id);
    const closed = subscription?.status === "cancelled";
    tenants.push({
      id: customer.id,
      name: customer.name || "",
      subscription: subscription
        ? {
            id: subscription.id,
            tier_code: subscription.tier_code,
            status: subscription.status,
            started_date: subscription.started_date || null,
            expires_date: subscription.expires_date || null,
            grace_until: subscription.grace_until || null,
            renewal_count: subscription.renewal_count || 0,
            last_renewed_at: subscription.last_renewed_at || null,
            closed_at: subscription.closed_at || null,
            closed_reason: subscription.closed_reason || null,
            seat_limit: subscription.seat_limit || 0,
            seats_used: subscription.seats_used || 0,
          }
        : null,
      lifecycle: validityState(subscription),
      licensed: license.licensed,
      modules_open: (license.modules || []).length,
      handover: closed ? await handoverFor(base44, customer.id) : null,
    });
  }

  return Response.json({ today: today(), tenants });
}

/**
 * Quotas contratuais (FM4) por cliente no âmbito: quota contratada, consumo do
 * período, nível (ok / aviso / excedente) e a fonte das quotas. É um indicador de
 * negócio — o acesso do cliente não depende disto — e as sinalizações já
 * registadas vêm à parte, no mesmo payload.
 */
async function quotaOverview(base44: any, scope: any) {
  const customers = await scopedCustomers(base44, scope);
  const period = periodOf();
  const usage = await base44.asServiceRole.entities.LicenseUsageRecord.filter({ month: period });
  const usageBy = new Map((usage || []).map((row: any) => [row.customer_id, row.usage_count || 0]));

  const tenants = [];
  for (const customer of customers) {
    const subscription = await findByCustomer(base44, customer.id);
    const seats = quotaState(
      subscription?.seats_used || 0,
      subscription?.seat_limit ?? null,
      subscription?.quota_warn_pct,
    );
    const ai = quotaState(
      usageBy.get(customer.id) || 0,
      subscription?.ai_quota_monthly ?? null,
      subscription?.quota_warn_pct,
    );

    tenants.push({
      id: customer.id,
      name: customer.name || "",
      subscription_id: subscription?.id || null,
      tier_code: subscription?.tier_code || null,
      status: subscription?.status || "none",
      seats,
      ai,
      quota_source_price_table_id: subscription?.quota_source_price_table_id || null,
      price_amount_cents: subscription?.price_amount_cents ?? null,
    });
  }

  const scopedIds = new Set(customers.map((c: any) => c.id));
  const signals = (await base44.asServiceRole.entities.QuotaSignal.list("-created_date", MAX_SIGNAL_SCAN)) || [];

  return Response.json({
    period,
    quota_source_pricing: await pricingDefaults(base44),
    tenants,
    signals: signals
      .filter((row: any) => scopedIds.has(row.customer_id) && row.period === period)
      .slice(0, 100),
    totals: {
      warning: tenants.filter((t: any) => t.seats.level === "warning" || t.ai.level === "warning").length,
      excess: tenants.filter((t: any) => t.seats.level === "excess" || t.ai.level === "excess").length,
    },
  });
}

/** Valores por omissão da tabela de preços vigente, para o diálogo das quotas. */
async function pricingDefaults(base44: any) {
  try {
    const versions = await base44.asServiceRole.entities.OfferVersion.list("-created_date", 200);
    const version = offerVersionInForce(versions || [], today());
    if (!version) return { offer_version_code: null, price_table_id: null, billing_period: null, currency: "EUR", entries: [] };

    const tables = await base44.asServiceRole.entities.PriceTable.list("-created_date", 200);
    const table = priceTableInForce(tables || [], version.id, today());
    return {
      offer_version_code: version.code || null,
      price_table_id: table?.id || null,
      billing_period: table?.billing_period || null,
      currency: table?.currency || "EUR",
      entries: (table?.entries || []).map((entry: any) => ({
        tier_code: entry.tier_code,
        amount_cents: entry.amount_cents ?? null,
        included_seats: entry.included_seats ?? null,
        extra_seat_amount_cents: entry.extra_seat_amount_cents ?? null,
        included_ai_calls: entry.included_ai_calls ?? null,
      })),
    };
  } catch (_error) {
    return { offer_version_code: null, price_table_id: null, billing_period: null, currency: "EUR", entries: [] };
  }
}

/**
 * Registo das sinalizações do período (FM4). Idempotente: uma linha por cliente,
 * período e grandeza — repetir actualiza o valor em vez de duplicar, e um
 * cliente que baixa o consumo volta a «ok», pelo que a marcação é reversível.
 * Sinalizar não bloqueia nem cobra: é só o registo do que foi assinalado.
 */
async function recordQuotaSignals(base44: any, user: any, scope: any, body: any) {
  const customers = await scopedCustomers(base44, scope);
  const period = body.period || periodOf();
  const usage = await base44.asServiceRole.entities.LicenseUsageRecord.filter({ month: period });
  const usageBy = new Map((usage || []).map((row: any) => [row.customer_id, row.usage_count || 0]));

  const existing = (await base44.asServiceRole.entities.QuotaSignal.list("-created_date", MAX_SIGNAL_SCAN)) || [];
  const byKey = new Map(
    existing
      .filter((row: any) => row.period === period)
      .map((row: any) => [`${row.customer_id}:${row.metric}`, row]),
  );

  const recorded: any[] = [];
  const resolved: any[] = [];
  const nowIso = new Date().toISOString();

  for (const customer of customers) {
    const subscription = await findByCustomer(base44, customer.id);
    const states = [
      {
        metric: "seats",
        state: quotaState(subscription?.seats_used || 0, subscription?.seat_limit ?? null, subscription?.quota_warn_pct),
      },
      {
        metric: "ai_usage",
        state: quotaState(
          usageBy.get(customer.id) || 0,
          subscription?.ai_quota_monthly ?? null,
          subscription?.quota_warn_pct,
        ),
      },
    ];

    for (const { metric, state } of states) {
      if (!state.defined) continue;
      const key = `${customer.id}:${metric}`;
      const row = byKey.get(key);
      const data: any = {
        customer_id: customer.id,
        customer_name: customer.name || "",
        period,
        metric,
        level: state.level,
        quota: state.quota ?? 0,
        consumed: state.consumed,
        excess: state.excess,
        used_pct: state.used_pct,
        threshold_pct: state.threshold_pct,
        detected_at: nowIso,
        recorded_by: user.email || "",
        recorded_by_role: normalizeRole(user.role),
        note: state.level === "ok"
          ? "Consumo dentro da quota contratada — sem cobrança nesta fase."
          : "Excedente sinalizado — sem cobrança nem bloqueio nesta fase (FM6).",
      };

      // O registo é do período inteiro — uma linha por cliente, período e
      // grandeza, com o nível do momento (incluindo «dentro da quota», que é o
      // que torna a marcação reversível e auditável).
      if (row) {
        if (row.level === state.level && row.consumed === state.consumed) continue;
        await base44.asServiceRole.entities.QuotaSignal.update(row.id, data);
        (state.level === "ok" ? resolved : recorded).push({ ...data, id: row.id });
      } else {
        const created = await base44.asServiceRole.entities.QuotaSignal.create(data);
        recorded.push({ ...data, id: created.id });
      }
    }
  }

  await audit(base44, user, "license_quota_signals_recorded", { id: customers[0]?.id || "" }, period, {
    period,
    recorded: recorded.length,
    resolved: resolved.length,
  });

  const flagged = recorded.filter((row: any) => row.level !== "ok").length;

  return Response.json({
    period,
    recorded,
    resolved,
    totals: {
      recorded: recorded.length,
      resolved: resolved.length,
      flagged,
      measured: recorded.length + resolved.length,
    },
  });
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

/** Soma dos packs activos de uma subscrição, em cêntimos. */
function addonTotalCents(addons: any[]) {
  return (addons || [])
    .filter((row: any) => row?.status === "active")
    .reduce((total: number, row: any) => total + (Number(row?.amount_cents ?? 0) || 0), 0);
}

/**
 * Oferta e tabela de preços através das quais se preça o que se contrata: a que
 * a subscrição registou (o que ficou contratado) e, na falta dela, a vigente à
 * data. Sem oferta nem preço, o pack contrata-se na mesma — fica sem valor, como
 * o provisionamento sem oferta publicada.
 */
async function offerAndPrice(base44: any, subscription: any, at: string) {
  const versions = await base44.asServiceRole.entities.OfferVersion.list("-created_date", 200);
  let version = subscription?.offer_version_id
    ? (versions || []).find((row: any) => row.id === subscription.offer_version_id) || null
    : null;
  if (!version) version = offerVersionInForce(versions || [], at);

  let table: any = null;
  if (subscription?.price_table_id) {
    table = await base44.asServiceRole.entities.PriceTable.get(subscription.price_table_id).catch(() => null);
  }
  if (!table && version) {
    const tables = await base44.asServiceRole.entities.PriceTable.list("-created_date", 200);
    table = priceTableInForce(tables || [], version.id, at);
  }
  return { version, table };
}

/**
 * Pack/acréscimo (FM1): contrata ou retira um pacote a um cliente.
 *
 * A unidade é o pack, não o módulo: o que abre são os módulos do catálogo de
 * código (`ADDON_PACKS`), gravados como excepção por módulo — a mesma porta de
 * `set_module`, pelo que o gating não ganha uma segunda regra. Revogar um pack
 * fecha **apenas** o que o pack abriu: um módulo que o tier já inclui não é
 * tocado. O preço vigente fica registado na subscrição (sem faturação nesta
 * fase) e a soma dos packs activos entra na receita contratada.
 */
async function setAddon(base44: any, user: any, customer: any, body: any) {
  const addonCode = String(body.addon_code || "");
  if (!addonCatalogueCodes().includes(addonCode)) {
    return Response.json({ error: "addon_code desconhecido." }, { status: 422 });
  }
  const reason = validateReason(body.reason);
  if (reason.error) return Response.json({ error: reason.error }, { status: 422 });

  const subscription = await findByCustomer(base44, customer.id);
  if (!subscription) return Response.json({ error: "Cliente sem subscrição." }, { status: 404 });
  if (subscription.status === "cancelled") {
    return Response.json({ error: "Esta subscrição está fechada.", code: "subscription_closed" }, { status: 422 });
  }

  const active = body.active !== false;
  const at = today();
  const nowIso = new Date().toISOString();
  const { version, table } = await offerAndPrice(base44, subscription, at);
  const entry = addonPriceEntryFor(table, addonCode);

  // A decisão comercial da oferta manda na contratação: um pack que a versão em
  // vigor não põe à venda não se contrata (a retirada é sempre possível, para
  // nenhum cliente ficar preso ao que deixou de estar à venda). Sem oferta
  // publicada não há decisão para consultar e o pack contrata-se na mesma — o
  // registo comercial não é condição para provisionar (FM2.7).
  if (active && version && !addonForSale(version, addonCode)) {
    return Response.json(
      {
        error: `O pack ${addonName(addonCode)} não está à venda na oferta vigente.`,
        code: "addon_not_for_sale",
        offer_version_code: version.code || "",
      },
      { status: 422 },
    );
  }

  const beforeState = await licenseState(base44, customer.id);
  const modules = modulesForAddon(addonCode);
  const tierModules = new Set(modulesForTier(resolveTier(subscription.tier_code) || subscription.tier_code));

  for (const moduleCode of modules) {
    if (tierModules.has(moduleCode)) continue;
    const rows = await base44.asServiceRole.entities.TenantModule.filter({
      customer_id: customer.id,
      module_code: moduleCode,
    });
    const data: any = {
      customer_id: customer.id,
      module_code: moduleCode,
      status: active ? "active" : "inactive",
      reason: `${active ? "Pack" : "Fim do pack"} ${addonName(addonCode)}`,
      ...(active ? { activated_at: nowIso, expires_at: null } : { deactivated_at: nowIso }),
    };
    if (rows.length > 0) {
      await base44.asServiceRole.entities.TenantModule.update(rows[0].id, data);
    } else if (active) {
      await base44.asServiceRole.entities.TenantModule.create(data);
    }
  }

  const existing = (subscription.addons || []).find((row: any) => row.addon_code === addonCode) || null;
  const row = {
    addon_code: addonCode,
    name: addonName(addonCode),
    status: active ? "active" : "inactive",
    amount_cents: active ? entry?.amount_cents ?? existing?.amount_cents ?? null : existing?.amount_cents ?? null,
    started_date: existing?.started_date || (active ? at : null),
    ended_date: active ? null : at,
  };
  const addons = [...(subscription.addons || []).filter((r: any) => r.addon_code !== addonCode), row]
    .sort((a: any, b: any) => String(a.addon_code).localeCompare(String(b.addon_code)));

  const updated = await base44.asServiceRole.entities.TenantSubscription.update(subscription.id, {
    addons,
    addon_amount_cents: addonTotalCents(addons),
  });

  await audit(base44, user, "license_addon_set", customer, subscription.id, {
    addon_code: addonCode,
    status: row.status,
    amount_cents: row.amount_cents,
    modules,
    offer_version_code: version?.code || null,
    reason: reason.reason,
  });
  await recordChange(base44, user, {
    action: "set_addon",
    customer,
    entityType: "TenantSubscription",
    entityId: subscription.id,
    reason: reason.reason,
    beforeState,
    afterState: await licenseState(base44, customer.id),
  });

  return await respond(base44, customer.id, updated, { addon: row, modules });
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
  "renewal_count",
  "last_renewed_at",
  "closed_at",
  "closed_reason",
  "ai_quota_monthly",
  "quota_warn_pct",
  "addon_amount_cents",
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
    // Os packs contratados fazem parte do estado relevante: contratação e
    // revogação aparecem no histórico com o valor de cada um.
    addons: ((subs[0]?.addons) || []).map((a: any) => ({
      addon_code: a.addon_code,
      status: a.status ?? null,
      amount_cents: a.amount_cents ?? null,
      started_date: a.started_date ?? null,
      ended_date: a.ended_date ?? null,
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
  const beforeDiff: any = { subscription: null, modules: [], addons: [], standards: [] };
  const afterDiff: any = { subscription: null, modules: [], addons: [], standards: [] };

  for (const field of SUBSCRIPTION_FIELDS) {
    const previous = before.subscription ? before.subscription[field] ?? null : null;
    const next = after.subscription ? after.subscription[field] ?? null : null;
    if (JSON.stringify(previous) === JSON.stringify(next)) continue;
    changedFields.push(field);
    beforeDiff.subscription = { ...(beforeDiff.subscription || {}), [field]: previous };
    afterDiff.subscription = { ...(afterDiff.subscription || {}), [field]: next };
  }

  const keyed = (rows: any[], key: string) => new Map((rows || []).map((row: any) => [row[key], row]));
  const collect = (beforeRows: any[], afterRows: any[], key: string, prefix: string, bucket: string) => {
    const previous = keyed(beforeRows, key);
    const next = keyed(afterRows, key);
    for (const code of new Set([...previous.keys(), ...next.keys()])) {
      const from = previous.get(code) || null;
      const to = next.get(code) || null;
      if (JSON.stringify(from) === JSON.stringify(to)) continue;
      changedFields.push(`${prefix}${code}`);
      if (from) beforeDiff[bucket].push(from);
      if (to) afterDiff[bucket].push(to);
    }
  };
  collect(before.modules, after.modules, "module_code", "module:", "modules");
  collect(before.addons, after.addons, "addon_code", "addon:", "addons");
  collect(before.standards, after.standards, "standard_code", "standard:", "standards");

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
    customer?.id || "",
    user.email || "",
    JSON.stringify(details),
    "TenantSubscription",
    entityId,
  );
}
