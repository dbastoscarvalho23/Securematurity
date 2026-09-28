import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { normalizeRole, isPlatformOwner, writeAccessAuditLog } from "../../shared/accessUtils.ts";
import { resolveActor } from "../../shared/devActor.ts";
import {
  BILLING_PERIODS,
  OFFER_TIER_CODES,
  catalogueSignature,
  composeTiers,
  diffSnapshots,
  normalizeCurrency,
  normalizeEntries,
  normalizeTiers,
  snapshotOf,
} from "../../shared/commercialOffer.ts";

/**
 * manageCommercialOffer — a oferta comercial e o preço (FM1/FM2).
 *
 * Até aqui a oferta comercial só existia em código: o que um tier incluía era
 * legível na branch em execução e nada registava o que estava à venda numa data,
 * com que normas, nem por que preço. Esta função é a única porta de escrita da
 * `OfferVersion` (composição comercial versionada com vigência), da `PriceTable`
 * (preço por tier e periodicidade) e do respetivo histórico
 * (`CommercialChangeLog`).
 *
 * A fronteira é deliberada e está documentada (FB7): a composição **técnica**
 * continua curada em código (`licenseGuard.ts`) e continua a ser a única fonte do
 * gating. Uma versão da oferta é o registo comercial — e a sua assinatura do
 * catálogo (`catalogue_signature`) faz a consola assinalar quando o código em
 * execução deixou de coincidir com o que foi publicado. Nenhum acesso é decidido
 * a partir daqui: o que o gating concede continua a ser o catálogo de código mais
 * as excepções por tenant (`provisionTenantLicense`).
 *
 * Escrita com o papel de serviço (as RLS destas entidades só conhecem
 * `master_admin` e a escrita é exclusivamente por função) e só para o dono da
 * plataforma: compor a oferta e marcar preço é decisão de plataforma, não de
 * carteira — o administrador de parceiro continua a provisionar clientes em
 * `provisionTenantLicense`.
 *
 * Acções: overview | create_offer_version | update_offer_version |
 * publish_offer_version | retire_offer_version | create_price_table |
 * update_price_table | publish_price_table | retire_price_table | history
 *
 * Cada escrita deixa dois rastos: a entrada de `AuditLog` (trilha técnica, com
 * `customer_id` vazio porque a alteração é de plataforma) e uma linha em
 * `CommercialChangeLog` com autor, papel, motivo e o antes/depois dos campos
 * alterados — é o que o cartão «Histórico comercial» mostra em /licensing.
 */
const ACTIONS = [
  "overview",
  "create_offer_version",
  "update_offer_version",
  "publish_offer_version",
  "retire_offer_version",
  "create_price_table",
  "update_price_table",
  "publish_price_table",
  "retire_price_table",
  "history",
];

const MAX_SCAN = 500;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;
const CHANGES: Record<string, string> = { create: "create", update: "update", publish: "publish", retire: "retire" };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await resolveActor(base44, req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = normalizeRole(user.role);
    if (!isPlatformOwner(role)) {
      return Response.json(
        { error: "Forbidden — apenas o administrador da plataforma compõe a oferta e o preço." },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (!ACTIONS.includes(action)) {
      return Response.json(
        { error: `Acção inválida. Esperado uma de: ${ACTIONS.join(", ")}.` },
        { status: 400 },
      );
    }

    switch (action) {
      case "overview":
        return await overview(base44);
      case "create_offer_version":
        return await createOfferVersion(base44, user, body);
      case "update_offer_version":
        return await updateOfferVersion(base44, user, body);
      case "publish_offer_version":
        return await publishOfferVersion(base44, user, body);
      case "retire_offer_version":
        return await retireOfferVersion(base44, user, body);
      case "create_price_table":
        return await createPriceTable(base44, user, body);
      case "update_price_table":
        return await updatePriceTable(base44, user, body);
      case "publish_price_table":
        return await publishPriceTable(base44, user, body);
      case "retire_price_table":
        return await retirePriceTable(base44, user, body);
      case "history":
        return await readHistory(base44, body);
      default:
        return Response.json({ error: "Acção inválida." }, { status: 400 });
    }
  } catch (error) {
    console.error("manageCommercialOffer failed:", error);
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});

/** Hoje, em ISO `date` (a vigência é contada por dia). */
function today() {
  return new Date().toISOString().split("T")[0];
}

/** Dia anterior a uma data ISO `date` — o fim (inclusivo) de quem é substituído. */
function dayBefore(isoDate: string) {
  const at = new Date(`${isoDate}T00:00:00.000Z`);
  at.setUTCDate(at.getUTCDate() - 1);
  return at.toISOString().split("T")[0];
}

/** Catálogo de código + espelho semeado: nomes de tiers, módulos e normas. */
async function catalogue(base44: any) {
  const [tiers, modules, standards] = await Promise.all([
    base44.asServiceRole.entities.LicenseTier.list("display_order", 50),
    base44.asServiceRole.entities.LicenseModule.list("display_order", 100),
    base44.asServiceRole.entities.LicenseStandard.list("code", 50),
  ]);

  const moduleNames = new Map((modules || []).map((m: any) => [m.code, m.name]));
  const tierNames: Record<string, string> = {};
  for (const tier of tiers || []) {
    if (OFFER_TIER_CODES.includes(tier.code)) tierNames[tier.code] = tier.name;
  }
  const activeStandards = (standards || []).filter((s: any) => s.is_active !== false);

  return {
    signature: catalogueSignature(),
    tier_names: tierNames,
    tiers: OFFER_TIER_CODES.map((code) => ({
      tier_code: code,
      name: tierNames[code] || code,
      modules: moduleCodes(code).map((moduleCode: string) => ({
        code: moduleCode,
        name: moduleNames.get(moduleCode) || moduleCode,
      })),
    })),
    standards: activeStandards.map((s: any) => ({ code: s.code, name: s.name || s.code })),
    standard_codes: activeStandards.map((s: any) => s.code),
    modules: (modules || []).map((m: any) => ({ code: m.code, name: m.name })),
  };
}

/** Módulos de um tier, pela composição semeada inicial (fonte: código). */
function moduleCodes(tierCode: string): string[] {
  return composeTiers().find((tier) => tier.tier_code === tierCode)?.modules || [];
}

/**
 * Leitura da consola: as versões, as tabelas, o catálogo em execução e a marca
 * de divergência de cada versão face ao código (comparação de assinaturas).
 */
async function overview(base44: any) {
  const [versions, tables] = await Promise.all([
    base44.asServiceRole.entities.OfferVersion.list("-created_date", MAX_SCAN),
    base44.asServiceRole.entities.PriceTable.list("-created_date", MAX_SCAN),
  ]);
  const catalogueSnapshot = await catalogue(base44);

  const offerVersions = (versions || []).map((version: any) => ({
    ...version,
    diverges_from_catalogue: version.catalogue_signature !== catalogueSnapshot.signature,
    price_table_count: (tables || []).filter((t: any) => t.offer_version_id === version.id).length,
  }));

  const priceTables = (tables || []).map((table: any) => ({
    ...table,
    offer_version_code:
      table.offer_version_code ||
      (versions || []).find((v: any) => v.id === table.offer_version_id)?.code ||
      "",
  }));

  return Response.json({ offer_versions: offerVersions, price_tables: priceTables, catalogue: catalogueSnapshot });
}

function validateLabel(value: any) {
  const label = String(value || "").trim();
  if (label.length < 3) return { error: "label tem de ter pelo menos 3 caracteres.", label: null };
  return { error: null, label };
}

function validateReason(value: any, required = true) {
  const reason = String(value || "").trim();
  if (required && reason.length < 3) return { error: "reason (motivo) é obrigatório.", reason: null };
  return { error: null, reason };
}

async function nextOfferCode(base44: any) {
  const versions = await base44.asServiceRole.entities.OfferVersion.list("-created_date", MAX_SCAN);
  const numbers = (versions || [])
    .map((version: any) => Number.parseInt(String(version.code || "").replace(/^v/i, ""), 10))
    .filter((n: number) => Number.isFinite(n));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return { code: `v${next}`, count: (versions || []).length };
}

async function createOfferVersion(base44: any, user: any, body: any) {
  const label = validateLabel(body.label);
  if (label.error) return Response.json({ error: label.error }, { status: 422 });

  const catalogueSnapshot = await catalogue(base44);
  const { code } = await nextOfferCode(base44);

  const version = await base44.asServiceRole.entities.OfferVersion.create({
    code,
    label: label.label,
    status: "draft",
    effective_from: body.effective_from || null,
    catalogue_signature: catalogueSnapshot.signature,
    tiers: composeTiers({
      tierNames: catalogueSnapshot.tier_names,
      standardCodes: catalogueSnapshot.standard_codes,
    }),
    notes: body.notes || "",
    author_email: user.email || "",
  });

  await recordChange(base44, user, {
    entityType: "OfferVersion",
    entityId: version.id,
    label: label.label,
    action: CHANGES.create,
    reason: body.reason,
    before: null,
    after: snapshotOf({ ...version, entity_type: "OfferVersion" }),
  });
  await audit(base44, user, "commercial_offer_version_created", "OfferVersion", version.id, {
    code,
    label: label.label,
  });

  return Response.json({ offer_version: { ...version, diverges_from_catalogue: false } });
}

const OFFER_EDITABLE = ["label", "effective_from", "effective_to", "notes"];

async function updateOfferVersion(base44: any, user: any, body: any) {
  const version = await getOfferVersion(base44, body.id);
  if (!version) return Response.json({ error: "Versão da oferta não encontrada." }, { status: 404 });
  if (version.status !== "draft") {
    return Response.json(
      { error: "Uma versão publicada ou retirada não se edita — crie uma versão nova.", code: "not_draft" },
      { status: 409 },
    );
  }

  const catalogueSnapshot = await catalogue(base44);

  if (body.label !== undefined) {
    const label = validateLabel(body.label);
    if (label.error) return Response.json({ error: label.error }, { status: 422 });
    body.label = label.label;
  }

  const tiers = normalizeTiers(body.tiers, { standardCodes: catalogueSnapshot.standard_codes });
  if (tiers.error) return Response.json({ error: tiers.error }, { status: 422 });

  const patch: any = {};
  for (const field of OFFER_EDITABLE) {
    if (body[field] !== undefined) patch[field] = body[field] === "" ? null : body[field];
  }
  if (tiers.tiers) patch.tiers = tiers.tiers;

  if (Object.keys(patch).length === 0) return Response.json({ error: "Nada para alterar." }, { status: 400 });

  const before = snapshotOf({ ...version, entity_type: "OfferVersion" });
  const updated = await base44.asServiceRole.entities.OfferVersion.update(version.id, patch);
  await recordChange(base44, user, {
    entityType: "OfferVersion",
    entityId: version.id,
    label: updated.label,
    action: CHANGES.update,
    reason: body.reason,
    before,
    after: snapshotOf({ ...updated, entity_type: "OfferVersion" }),
  });
  await audit(base44, user, "commercial_offer_version_updated", "OfferVersion", version.id, patch);

  return Response.json({
    offer_version: { ...updated, diverges_from_catalogue: updated.catalogue_signature !== catalogueSnapshot.signature },
  });
}

/**
 * Publicar é o momento em que a versão passa a ser a vigente: a versão publicada
 * anterior é retirada com fim de vigência no dia anterior ao início desta, para
 * que a qualquer data exista uma só oferta em vigor.
 */
async function publishOfferVersion(base44: any, user: any, body: any) {
  const version = await getOfferVersion(base44, body.id);
  if (!version) return Response.json({ error: "Versão da oferta não encontrada." }, { status: 404 });
  if (version.status === "published") {
    return Response.json({ error: "Esta versão já está publicada.", code: "already_published" }, { status: 409 });
  }
  if (version.status === "retired") {
    return Response.json({ error: "Esta versão já foi retirada.", code: "already_retired" }, { status: 409 });
  }

  const reason = validateReason(body.reason);
  if (reason.error) return Response.json({ error: reason.error }, { status: 422 });

  const effectiveFrom = body.effective_from || version.effective_from || today();
  const before = snapshotOf({ ...version, entity_type: "OfferVersion" });

  const updated = await base44.asServiceRole.entities.OfferVersion.update(version.id, {
    status: "published",
    effective_from: effectiveFrom,
    effective_to: null,
    published_by: user.email || "",
    published_at: new Date().toISOString(),
  });

  await recordChange(base44, user, {
    entityType: "OfferVersion",
    entityId: version.id,
    label: updated.label,
    action: CHANGES.publish,
    reason: reason.reason,
    before,
    after: snapshotOf({ ...updated, entity_type: "OfferVersion" }),
  });
  await audit(base44, user, "commercial_offer_version_published", "OfferVersion", version.id, {
    code: version.code,
    effective_from: effectiveFrom,
    reason: reason.reason,
  });

  const superseded = await supersedeOfferVersions(base44, user, version.id, effectiveFrom, reason.reason);

  return Response.json({ offer_version: updated, superseded_versions: superseded.map((row: any) => row.code) });
}

/** Retira as versões publicadas anteriores, com fim de vigência no dia anterior. */
async function supersedeOfferVersions(
  base44: any,
  user: any,
  keepId: string,
  effectiveFrom: string,
  reason: string,
) {
  const versions = await base44.asServiceRole.entities.OfferVersion.list("-created_date", MAX_SCAN);
  const superseded: any[] = [];
  for (const version of versions || []) {
    if (version.id === keepId || version.status !== "published") continue;
    const before = snapshotOf({ ...version, entity_type: "OfferVersion" });
    const updated = await base44.asServiceRole.entities.OfferVersion.update(version.id, {
      status: "retired",
      effective_to: dayBefore(effectiveFrom),
    });
    superseded.push(updated);
    await recordChange(base44, user, {
      entityType: "OfferVersion",
      entityId: version.id,
      label: updated.label,
      action: CHANGES.retire,
      reason: `Substituída pela versão vigente a partir de ${effectiveFrom}. ${reason}`.trim(),
      before,
      after: snapshotOf({ ...updated, entity_type: "OfferVersion" }),
    });
    await audit(base44, user, "commercial_offer_version_retired", "OfferVersion", version.id, {
      code: version.code,
      superseded_by_effective_from: effectiveFrom,
    });
  }
  return superseded;
}

async function retireOfferVersion(base44: any, user: any, body: any) {
  const version = await getOfferVersion(base44, body.id);
  if (!version) return Response.json({ error: "Versão da oferta não encontrada." }, { status: 404 });
  if (version.status === "retired") {
    return Response.json({ error: "Esta versão já foi retirada.", code: "already_retired" }, { status: 409 });
  }

  const reason = validateReason(body.reason);
  if (reason.error) return Response.json({ error: reason.error }, { status: 422 });

  const before = snapshotOf({ ...version, entity_type: "OfferVersion" });
  const updated = await base44.asServiceRole.entities.OfferVersion.update(version.id, {
    status: "retired",
    effective_to: body.effective_to || today(),
  });

  await recordChange(base44, user, {
    entityType: "OfferVersion",
    entityId: version.id,
    label: updated.label,
    action: CHANGES.retire,
    reason: reason.reason,
    before,
    after: snapshotOf({ ...updated, entity_type: "OfferVersion" }),
  });
  await audit(base44, user, "commercial_offer_version_retired", "OfferVersion", version.id, {
    code: version.code,
    reason: reason.reason,
  });

  return Response.json({ offer_version: updated });
}

async function getOfferVersion(base44: any, id: string) {
  if (!id) return null;
  try {
    return await base44.asServiceRole.entities.OfferVersion.get(id);
  } catch {
    return null;
  }
}

async function getPriceTable(base44: any, id: string) {
  if (!id) return null;
  try {
    return await base44.asServiceRole.entities.PriceTable.get(id);
  } catch {
    return null;
  }
}

async function buildPricePatch(base44: any, body: any, { requireOffer }: { requireOffer: boolean }) {
  const patch: any = {};

  if (body.offer_version_id !== undefined || requireOffer) {
    const offerVersion = await getOfferVersion(base44, body.offer_version_id);
    if (!offerVersion) return { error: "offer_version_id desconhecido.", patch: null };
    patch.offer_version_id = offerVersion.id;
    patch.offer_version_code = offerVersion.code;
  }

  if (body.label !== undefined || requireOffer) {
    const label = validateLabel(body.label);
    if (label.error) return { error: label.error, patch: null };
    patch.label = label.label;
  }

  if (body.currency !== undefined || requireOffer) {
    const currency = normalizeCurrency(body.currency);
    if (!currency) return { error: "currency tem de ser um código ISO de três letras.", patch: null };
    patch.currency = currency;
  }

  if (body.billing_period !== undefined || requireOffer) {
    const period = String(body.billing_period || "");
    if (!BILLING_PERIODS.includes(period)) {
      return { error: `billing_period tem de ser ${BILLING_PERIODS.join(" ou ")}.`, patch: null };
    }
    patch.billing_period = period;
  }

  if (body.entries !== undefined || requireOffer) {
    const entries = normalizeEntries(body.entries);
    if (entries.error) return { error: entries.error, patch: null };
    patch.entries = entries.entries;
  }

  if (body.effective_from !== undefined) patch.effective_from = body.effective_from || null;
  if (body.effective_to !== undefined) patch.effective_to = body.effective_to || null;
  if (body.notes !== undefined) patch.notes = body.notes || "";

  return { error: null, patch };
}

async function createPriceTable(base44: any, user: any, body: any) {
  const built = await buildPricePatch(base44, body, { requireOffer: true });
  if (built.error) return Response.json({ error: built.error }, { status: 422 });

  const table = await base44.asServiceRole.entities.PriceTable.create({
    ...built.patch,
    status: "draft",
    author_email: user.email || "",
  });

  await recordChange(base44, user, {
    entityType: "PriceTable",
    entityId: table.id,
    label: table.label,
    action: CHANGES.create,
    reason: body.reason,
    before: null,
    after: snapshotOf({ ...table, entity_type: "PriceTable" }),
  });
  await audit(base44, user, "commercial_price_table_created", "PriceTable", table.id, {
    offer_version_id: table.offer_version_id,
    currency: table.currency,
    billing_period: table.billing_period,
  });

  return Response.json({ price_table: table });
}

async function updatePriceTable(base44: any, user: any, body: any) {
  const table = await getPriceTable(base44, body.id);
  if (!table) return Response.json({ error: "Tabela de preços não encontrada." }, { status: 404 });
  if (table.status !== "draft") {
    return Response.json(
      { error: "Uma tabela publicada ou retirada não se edita — crie uma versão nova com data de início.", code: "not_draft" },
      { status: 409 },
    );
  }

  const built = await buildPricePatch(base44, body, { requireOffer: false });
  if (built.error) return Response.json({ error: built.error }, { status: 422 });
  if (Object.keys(built.patch).length === 0) {
    return Response.json({ error: "Nada para alterar." }, { status: 400 });
  }

  const before = snapshotOf({ ...table, entity_type: "PriceTable" });
  const updated = await base44.asServiceRole.entities.PriceTable.update(table.id, built.patch);

  await recordChange(base44, user, {
    entityType: "PriceTable",
    entityId: table.id,
    label: updated.label,
    action: CHANGES.update,
    reason: body.reason,
    before,
    after: snapshotOf({ ...updated, entity_type: "PriceTable" }),
  });
  await audit(base44, user, "commercial_price_table_updated", "PriceTable", table.id, built.patch);

  return Response.json({ price_table: updated });
}

/**
 * Publicar um preço exige que a oferta a que se aplica esteja publicada: um preço
 * de uma oferta que ainda não está à venda não é vigente para nada.
 */
async function publishPriceTable(base44: any, user: any, body: any) {
  const table = await getPriceTable(base44, body.id);
  if (!table) return Response.json({ error: "Tabela de preços não encontrada." }, { status: 404 });
  if (table.status === "published") {
    return Response.json({ error: "Esta tabela já está publicada.", code: "already_published" }, { status: 409 });
  }
  if (table.status === "retired") {
    return Response.json({ error: "Esta tabela já foi retirada.", code: "already_retired" }, { status: 409 });
  }

  const offerVersion = await getOfferVersion(base44, table.offer_version_id);
  if (!offerVersion || offerVersion.status !== "published") {
    return Response.json(
      { error: "A versão da oferta a que esta tabela se aplica não está publicada.", code: "offer_version_not_published" },
      { status: 422 },
    );
  }

  const reason = validateReason(body.reason);
  if (reason.error) return Response.json({ error: reason.error }, { status: 422 });

  const effectiveFrom = body.effective_from || table.effective_from || today();
  const before = snapshotOf({ ...table, entity_type: "PriceTable" });

  const updated = await base44.asServiceRole.entities.PriceTable.update(table.id, {
    status: "published",
    effective_from: effectiveFrom,
    effective_to: null,
    published_by: user.email || "",
    published_at: new Date().toISOString(),
  });

  await recordChange(base44, user, {
    entityType: "PriceTable",
    entityId: table.id,
    label: updated.label,
    action: CHANGES.publish,
    reason: reason.reason,
    before,
    after: snapshotOf({ ...updated, entity_type: "PriceTable" }),
  });
  await audit(base44, user, "commercial_price_table_published", "PriceTable", table.id, {
    offer_version_code: table.offer_version_code,
    effective_from: effectiveFrom,
    reason: reason.reason,
  });

  const superseded = await supersedePriceTables(
    base44,
    user,
    table.id,
    table.offer_version_id,
    effectiveFrom,
    reason.reason,
  );

  return Response.json({ price_table: updated, superseded_tables: superseded.map((row: any) => row.label) });
}

/** Uma só tabela publicada por versão da oferta: a anterior fecha no dia antes. */
async function supersedePriceTables(
  base44: any,
  user: any,
  keepId: string,
  offerVersionId: string,
  effectiveFrom: string,
  reason: string,
) {
  const tables = await base44.asServiceRole.entities.PriceTable.list("-created_date", MAX_SCAN);
  const superseded: any[] = [];
  for (const table of tables || []) {
    if (table.id === keepId || table.status !== "published") continue;
    if (table.offer_version_id !== offerVersionId) continue;
    const before = snapshotOf({ ...table, entity_type: "PriceTable" });
    const updated = await base44.asServiceRole.entities.PriceTable.update(table.id, {
      status: "retired",
      effective_to: dayBefore(effectiveFrom),
    });
    superseded.push(updated);
    await recordChange(base44, user, {
      entityType: "PriceTable",
      entityId: table.id,
      label: updated.label,
      action: CHANGES.retire,
      reason: `Substituída pela tabela vigente a partir de ${effectiveFrom}. ${reason}`.trim(),
      before,
      after: snapshotOf({ ...updated, entity_type: "PriceTable" }),
    });
    await audit(base44, user, "commercial_price_table_retired", "PriceTable", table.id, {
      superseded_by_effective_from: effectiveFrom,
    });
  }
  return superseded;
}

async function retirePriceTable(base44: any, user: any, body: any) {
  const table = await getPriceTable(base44, body.id);
  if (!table) return Response.json({ error: "Tabela de preços não encontrada." }, { status: 404 });
  if (table.status === "retired") {
    return Response.json({ error: "Esta tabela já foi retirada.", code: "already_retired" }, { status: 409 });
  }

  const reason = validateReason(body.reason);
  if (reason.error) return Response.json({ error: reason.error }, { status: 422 });

  const before = snapshotOf({ ...table, entity_type: "PriceTable" });
  const updated = await base44.asServiceRole.entities.PriceTable.update(table.id, {
    status: "retired",
    effective_to: body.effective_to || today(),
  });

  await recordChange(base44, user, {
    entityType: "PriceTable",
    entityId: table.id,
    label: updated.label,
    action: CHANGES.retire,
    reason: reason.reason,
    before,
    after: snapshotOf({ ...updated, entity_type: "PriceTable" }),
  });
  await audit(base44, user, "commercial_price_table_retired", "PriceTable", table.id, {
    reason: reason.reason,
  });

  return Response.json({ price_table: updated });
}

/**
 * Histórico comercial: mesma forma de `listLicenseChanges` — filtros aplicados
 * antes da paginação, cursor opaco, facetas do âmbito todo e o total.
 */
async function readHistory(base44: any, body: any) {
  const { entity_type = "", action = "", cursor = 0, limit = DEFAULT_LIMIT } = body || {};
  const pageSize = Math.min(Math.max(Number.parseInt(String(limit), 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(Number.parseInt(String(cursor), 10) || 0, 0);

  const all = (await base44.asServiceRole.entities.CommercialChangeLog.list("-created_date", MAX_SCAN)) || [];
  const matches = all.filter(
    (entry: any) => (!entity_type || entry.entity_type === entity_type) && (!action || entry.action === action),
  );

  const entries = matches.slice(offset, offset + pageSize);
  const next = offset + entries.length;

  return Response.json({
    entries,
    total: matches.length,
    scanned: all.length,
    truncated: all.length >= MAX_SCAN,
    next_cursor: next < matches.length ? String(next) : null,
    filters: {
      actions: ["create", "update", "publish", "retire"].filter((code) =>
        all.some((entry: any) => entry.action === code)
      ),
      entity_types: ["OfferVersion", "PriceTable"].filter((code) =>
        all.some((entry: any) => entry.entity_type === code)
      ),
    },
  });
}

/** A linha de histórico. Sem campos alterados não se escreve nada. */
async function recordChange(
  base44: any,
  user: any,
  change: {
    entityType: string;
    entityId: string;
    label?: string | null;
    action: string;
    reason?: string;
    before: any;
    after: any;
  },
) {
  const diff = change.action === CHANGES.create
    ? { changed_fields: ["*"], before: null, after: change.after }
    : diffSnapshots(change.entityType, change.before, change.after);

  if (!diff.changed_fields.length) return;

  await base44.asServiceRole.entities.CommercialChangeLog.create({
    entity_type: change.entityType,
    entity_id: change.entityId,
    entity_label: change.label || "",
    action: change.action,
    actor_email: user.email || "",
    actor_role: normalizeRole(user.role),
    reason: change.reason || "",
    changed_fields: diff.changed_fields,
    before: diff.before,
    after: diff.after,
  });
}

/**
 * Trilha técnica. `customer_id` vazio de propósito: a alteração é de plataforma e
 * não pertence a nenhum tenant — é assim que `listAuditLog` os distingue.
 */
async function audit(base44: any, user: any, action: string, entityType: string, entityId: string, details: any) {
  await writeAccessAuditLog(base44, action, "", user.email || "", JSON.stringify(details), entityType, entityId);
}
