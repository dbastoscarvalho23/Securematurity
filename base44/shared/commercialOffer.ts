/**
 * Oferta comercial — regras partilhadas da versão de oferta e da tabela de preços
 * (FM1/FM2). Vive no backend porque é lá que a decisão comercial é validada e
 * registada; o frontend só apresenta o resultado.
 *
 * Fronteira deliberada (FB7): a composição **técnica** dos tiers e dos packs
 * continua curada em código (`licenseGuard.ts`, espelho em `src/lib/licenseModules.js`)
 * e é a única fonte do gating. `OfferVersion` é o registo **comercial** versionado
 * — o que estava à venda, com que normas, que packs e em que intervalo de vigência
 * — e a `catalogue_signature` marca quando o código em execução já não coincide
 * com a versão publicada. Nenhuma página nem função lê a oferta para decidir
 * acessos.
 */

import {
  ADDON_PACKS,
  ALL_ADDON_CODES,
  TIER_MODULES,
  LEGACY_TIER_ALIASES,
  COMMERCIALLY_AVAILABLE_TIERS,
  addonName,
  modulesForAddon,
} from "./licenseGuard.ts";

/** Tiers da oferta comercial, na ordem cumulativa (Core ⊂ Profissional ⊂ Avançado). */
export const OFFER_TIER_CODES = ["core", "professional", "advanced"];

/** Packs/acréscimos da oferta, na ordem em que são apresentados. */
export const OFFER_ADDON_CODES = ALL_ADDON_CODES;

/** Periodicidade do preço base. */
export const BILLING_PERIODS = ["monthly", "annual"];

/** Ordem cumulativa dos tiers comerciais (Core ⊂ Profissional ⊂ Avançado). */
export const TIER_ORDER = OFFER_TIER_CODES;

/** Posição de um tier na escala cumulativa (-1 se não pertence à oferta). */
export function tierRank(tierCode: string): number {
  const resolved = LEGACY_TIER_ALIASES[tierCode] || tierCode;
  return TIER_ORDER.indexOf(resolved);
}

/** Estados de uma versão de oferta e de uma tabela de preços. */
export const COMMERCIAL_STATUSES = ["draft", "published", "retired"];

/** Campos escalares comparados no antes/depois de cada registo. */
const SCALAR_FIELDS: Record<string, string[]> = {
  OfferVersion: ["label", "status", "effective_from", "effective_to", "notes"],
  PriceTable: ["label", "status", "currency", "billing_period", "effective_from", "effective_to", "notes"],
};

/**
 * Coleções comparadas linha a linha (a chave ↔ o prefixo do campo alterado).
 * Cada registo tem mais do que uma: a oferta tem tiers e packs, o preço tem o
 * preço por tier e o preço de cada pack.
 */
const COLLECTIONS: Record<string, { key: string; prefix: string; keyField: string }[]> = {
  OfferVersion: [
    { key: "tiers", prefix: "tier:", keyField: "tier_code" },
    { key: "addons", prefix: "addon:", keyField: "addon_code" },
  ],
  PriceTable: [
    { key: "entries", prefix: "price:", keyField: "tier_code" },
    { key: "addon_entries", prefix: "addon_price:", keyField: "addon_code" },
  ],
};

function collectionsOf(entityType: string) {
  return COLLECTIONS[entityType] || COLLECTIONS.OfferVersion;
}

export function modulesForTierCode(tierCode: string): string[] {
  return TIER_MODULES[LEGACY_TIER_ALIASES[tierCode] || tierCode] || [];
}

/**
 * Assinatura determinística da composição em código. Guardada na versão da
 * oferta: se mudar o código (módulos por tier, tiers comercializáveis ou a
 * composição dos packs), a versão publicada deixa de coincidir e a consola
 * assinala a divergência.
 */
export function catalogueSignature(): string {
  const tiers = OFFER_TIER_CODES
    .map((code) => {
      const sale = COMMERCIALLY_AVAILABLE_TIERS.includes(code) ? "sale" : "prepared";
      return `${code}:${modulesForTierCode(code).join("+")}:${sale}`;
    })
    .join("|");
  const addons = OFFER_ADDON_CODES.map((code) => `${code}:${modulesForAddon(code).join("+")}`).join("|");
  return `${tiers}#addons:${addons}`;
}

/**
 * Composição inicial de uma versão da oferta: tiers, módulos e packs vêm do
 * catálogo de código, os nomes dos tiers do espelho semeado (`LicenseTier`) e as
 * normas da lista de normas ativas. O estado comercializável nasce da decisão de
 * lançamento — nenhum pack nasce comercializável, é decisão desta versão.
 */
export function composeTiers(opts: { tierNames?: Record<string, string>; standardCodes?: string[] } = {}) {
  const tierNames = opts.tierNames || {};
  const standardCodes = opts.standardCodes || [];
  return OFFER_TIER_CODES.map((code) => ({
    tier_code: code,
    name: tierNames[code] || null,
    commercially_available: COMMERCIALLY_AVAILABLE_TIERS.includes(code),
    modules: modulesForTierCode(code),
    standards: [...standardCodes],
  }));
}

/** Packs de uma versão da oferta, compostos a partir do catálogo de código. */
export function composeAddons() {
  return OFFER_ADDON_CODES.map((code) => ({
    addon_code: code,
    name: addonName(code),
    commercially_available: false,
    modules: modulesForAddon(code),
  }));
}

/**
 * Normaliza a composição submetida. Aceita apenas tiers do catálogo, sem
 * repetições, com normas conhecidas; os módulos **não** são aceites do corpo do
 * pedido — são sempre os do catálogo de código, para que o registo comercial
 * nunca descreva um pacote que o gating não abre.
 */
export function normalizeTiers(raw: any, opts: { standardCodes?: string[] } = {}) {
  const standardCodes = opts.standardCodes || [];
  if (raw === undefined) return { error: null, tiers: undefined };
  if (!Array.isArray(raw)) return { error: "tiers inválido.", tiers: undefined };

  const seen = new Set<string>();
  const tiers: any[] = [];

  for (const row of raw) {
    const code = String(row?.tier_code || "");
    if (!code) return { error: "tier_code is required", tiers: undefined };
    if (!OFFER_TIER_CODES.includes(code)) {
      return { error: `tier_code desconhecido: ${code}.`, tiers: undefined };
    }
    if (seen.has(code)) return { error: `tier_code repetido: ${code}.`, tiers: undefined };
    seen.add(code);

    const standards = Array.isArray(row.standards) ? row.standards.map((s: any) => String(s)) : [];
    const unknown = standards.find((s) => !standardCodes.includes(s));
    if (unknown) return { error: `standard desconhecido: ${unknown}.`, tiers: undefined };

    tiers.push({
      tier_code: code,
      name: row.name ? String(row.name) : null,
      commercially_available: row.commercially_available === true,
      modules: modulesForTierCode(code),
      standards,
    });
  }

  if (tiers.length === 0) return { error: "A oferta tem de ter pelo menos um tier.", tiers: undefined };
  return { error: null, tiers };
}

/**
 * Normaliza a decisão comercial sobre os packs. Tal como nos tiers, os módulos
 * vêm do catálogo de código: o que a versão decide é se o pack está à venda.
 */
export function normalizeAddons(raw: any) {
  if (raw === undefined) return { error: null, addons: undefined };
  if (!Array.isArray(raw)) return { error: "addons inválido.", addons: undefined };

  const seen = new Set<string>();
  const addons: any[] = [];

  for (const row of raw) {
    const code = String(row?.addon_code || "");
    if (!code) return { error: "Cada pack precisa de addon_code.", addons: undefined };
    if (!OFFER_ADDON_CODES.includes(code)) {
      return { error: `addon_code desconhecido: ${code}.`, addons: undefined };
    }
    if (seen.has(code)) return { error: `addon_code repetido: ${code}.`, addons: undefined };
    seen.add(code);

    addons.push({
      addon_code: code,
      name: addonName(code),
      commercially_available: row.commercially_available === true,
      modules: modulesForAddon(code),
    });
  }

  if (addons.length === 0) return { error: "A oferta tem de ter pelo menos um pack.", addons: undefined };
  return { error: null, addons };
}

/** Números de preço: aceita null (por preencher) e recusa negativos ou não-números. */
function priceNumber(value: any, field: string, { max }: { max?: number } = {}) {
  if (value === null || value === undefined || value === "") return { error: null, value: null };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { error: `${field} tem de ser um número igual ou superior a zero.`, value: null };
  }
  if (max !== undefined && parsed > max) return { error: `${field} não pode ser superior a ${max}.`, value: null };
  return { error: null, value: parsed };
}

/** Normaliza e valida as linhas de preço de uma tabela. */
export function normalizeEntries(raw: any) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "A tabela tem de ter pelo menos uma linha de preço.", entries: undefined };
  }

  const seen = new Set<string>();
  const entries: any[] = [];

  for (const row of raw) {
    const code = String(row?.tier_code || "");
    if (!code) return { error: "Cada linha precisa de tier_code.", entries: undefined };
    if (!OFFER_TIER_CODES.includes(code)) return { error: `tier_code desconhecido: ${code}.`, entries: undefined };
    if (seen.has(code)) return { error: `tier_code repetido: ${code}.`, entries: undefined };
    seen.add(code);

    const amount = priceNumber(row?.amount_cents, "amount_cents");
    if (amount.error) return { error: amount.error, entries: undefined };
    const seats = priceNumber(row?.included_seats, "included_seats");
    if (seats.error) return { error: seats.error, entries: undefined };
    const extra = priceNumber(row?.extra_seat_amount_cents, "extra_seat_amount_cents");
    if (extra.error) return { error: extra.error, entries: undefined };
    const discount = priceNumber(row?.annual_discount_pct, "annual_discount_pct", { max: 100 });
    if (discount.error) return { error: discount.error, entries: undefined };
    const aiCalls = priceNumber(row?.included_ai_calls, "included_ai_calls");
    if (aiCalls.error) return { error: aiCalls.error, entries: undefined };

    entries.push({
      tier_code: code,
      amount_cents: amount.value,
      included_seats: seats.value,
      extra_seat_amount_cents: extra.value,
      annual_discount_pct: discount.value,
      included_ai_calls: aiCalls.value,
      notes: row?.notes ? String(row.notes) : null,
    });
  }

  return { error: null, entries };
}

/**
 * Normaliza e valida o preço dos packs. Uma tabela pode não preçar pack nenhum
 * (`addon_entries` vazio) — o pack existe na oferta, mas ainda não tem preço.
 */
export function normalizeAddonEntries(raw: any) {
  if (raw === undefined) return { error: null, addon_entries: undefined };
  if (!Array.isArray(raw)) return { error: "addon_entries inválido.", addon_entries: undefined };

  const seen = new Set<string>();
  const entries: any[] = [];

  for (const row of raw) {
    const code = String(row?.addon_code || "");
    if (!code) return { error: "Cada linha de pack precisa de addon_code.", addon_entries: undefined };
    if (!OFFER_ADDON_CODES.includes(code)) return { error: `addon_code desconhecido: ${code}.`, addon_entries: undefined };
    if (seen.has(code)) return { error: `addon_code repetido: ${code}.`, addon_entries: undefined };
    seen.add(code);

    const amount = priceNumber(row?.amount_cents, "amount_cents");
    if (amount.error) return { error: amount.error, addon_entries: undefined };
    const aiCalls = priceNumber(row?.included_ai_calls, "included_ai_calls");
    if (aiCalls.error) return { error: aiCalls.error, addon_entries: undefined };

    entries.push({
      addon_code: code,
      amount_cents: amount.value,
      included_ai_calls: aiCalls.value,
      notes: row?.notes ? String(row.notes) : null,
    });
  }

  return { error: null, addon_entries: entries };
}

/** Moeda ISO de três letras, em maiúsculas. */
export function normalizeCurrency(value: any) {
  const code = String(value || "EUR").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

/** Instantâneo comparável de um registo — o que o histórico mostra antes/depois. */
export function snapshotOf(record: any) {
  const snapshot: any = {};
  if (!record) return snapshot;
  const fields = SCALAR_FIELDS[record.entity_type] || SCALAR_FIELDS.OfferVersion;
  for (const field of fields) snapshot[field] = record[field] ?? null;
  for (const collection of collectionsOf(record.entity_type)) {
    snapshot[collection.key] = Array.isArray(record[collection.key])
      ? record[collection.key].map((row: any) => ({ ...row }))
      : [];
  }
  return snapshot;
}

/**
 * Diff de dois instantâneos: os códigos dos campos alterados e, só para esses, o
 * valor antes e depois. Uma repetição da mesma operação não inventa histórico.
 */
export function diffSnapshots(entityType: string, before: any, after: any) {
  const fields = SCALAR_FIELDS[entityType] || SCALAR_FIELDS.OfferVersion;

  const changedFields: string[] = [];
  const beforeDiff: any = {};
  const afterDiff: any = {};

  for (const field of fields) {
    const previous = before?.[field] ?? null;
    const next = after?.[field] ?? null;
    if (JSON.stringify(previous) === JSON.stringify(next)) continue;
    changedFields.push(field);
    beforeDiff[field] = previous;
    afterDiff[field] = next;
  }

  for (const collection of collectionsOf(entityType)) {
    const keyOf = (row: any) => String(row?.[collection.keyField] || "");
    const previousRows = new Map((before?.[collection.key] || []).map((row: any) => [keyOf(row), row]));
    const nextRows = new Map((after?.[collection.key] || []).map((row: any) => [keyOf(row), row]));

    const beforeRows: any[] = [];
    const afterRows: any[] = [];
    for (const code of new Set([...previousRows.keys(), ...nextRows.keys()])) {
      const from = previousRows.get(code) || null;
      const to = nextRows.get(code) || null;
      if (JSON.stringify(from) === JSON.stringify(to)) continue;
      changedFields.push(`${collection.prefix}${code}`);
      if (from) beforeRows.push(from);
      if (to) afterRows.push(to);
    }
    if (beforeRows.length || afterRows.length) {
      beforeDiff[collection.key] = beforeRows;
      afterDiff[collection.key] = afterRows;
    }
  }

  return { changed_fields: changedFields.sort(), before: beforeDiff, after: afterDiff };
}

/**
 * Versão da oferta vigente numa data (ISO `date`): a publicada com
 * `effective_from <= data` e sem fim de vigência anterior a essa data. É o que o
 * provisionamento regista na subscrição, para que o que foi contratado numa data
 * seja reconstruível.
 */
export function offerVersionInForce(versions: any[], at: string) {
  const when = at || new Date().toISOString().split("T")[0];
  const candidates = (versions || [])
    .filter((version: any) => version.status === "published")
    .filter((version: any) => !version.effective_from || version.effective_from <= when)
    .filter((version: any) => !version.effective_to || version.effective_to >= when);
  return candidates.sort((a: any, b: any) => String(b.effective_from || "").localeCompare(String(a.effective_from || "")))[0] || null;
}

/**
 * Normas que uma versão da oferta faz acompanhar de um tier. `null` quando a
 * versão (ou o tier) não declara uma lista — não há então regra comercial para
 * comparar, e a coerência do downgrade não se pronuncia.
 */
export function standardsForTier(offerVersion: any, tierCode: string): string[] | null {
  const tier = (offerVersion?.tiers || []).find((row: any) => row.tier_code === tierCode);
  if (!tier || !Array.isArray(tier.standards)) return null;
  return tier.standards.map((code: any) => String(code));
}

/**
 * Packs de uma versão da oferta, por código. Sem `addons` na versão (versões
 * anteriores aos packs) devolve lista vazia — não há decisão comercial sobre
 * packs para ler, e nada se presume.
 */
export function addonsOf(offerVersion: any): any[] {
  return Array.isArray(offerVersion?.addons) ? offerVersion.addons : [];
}

/** Um pack que uma versão da oferta põe à venda (null quando não é o caso). */
export function addonForSale(offerVersion: any, addonCode: string) {
  const addon = addonsOf(offerVersion).find((row: any) => row.addon_code === addonCode);
  if (!addon || addon.commercially_available !== true) return null;
  return addon;
}

/** Linha de preço de um tier numa tabela (null quando a tabela não o preça). */
export function priceEntryFor(table: any, tierCode: string) {
  const resolved = LEGACY_TIER_ALIASES[tierCode] || tierCode;
  return (table?.entries || []).find((row: any) => row.tier_code === resolved) || null;
}

/** Linha de preço de um pack numa tabela (null quando a tabela não o preça). */
export function addonPriceEntryFor(table: any, addonCode: string) {
  return (table?.addon_entries || []).find((row: any) => row.addon_code === addonCode) || null;
}

/** Soma das quotas de IA incluídas nos packs activos de uma subscrição (FM4). */
export function addonIncludedAiCalls(table: any, addons: any[]): number {
  return (addons || [])
    .filter((row: any) => row?.status === "active")
    .reduce((total: number, row: any) => {
      const entry = addonPriceEntryFor(table, String(row.addon_code || ""));
      return total + (Number(entry?.included_ai_calls ?? 0) || 0);
    }, 0);
}

/**
 * Valor mensal contratado de uma subscrição, a partir da tabela de preços que
 * lhe está associada: preço base do tier (anual convertido a mês) mais os
 * lugares acima dos incluídos mais os packs activos. Sem faturação nesta fase —
 * é receita contratada, não faturada, e é o mesmo número que os indicadores
 * comerciais mostram.
 */
export function monthlyCentsFor(table: any, tierCode: string, seatLimit: number, addonCents = 0): number {
  const annual = table?.billing_period === "annual";
  const addons = Number(addonCents) || 0;
  const entry = priceEntryFor(table, tierCode);
  // Sem preço do tier, o valor dos packs contratados continua a contar.
  if (!entry) return annual ? Math.round(addons / 12) : addons;
  const base = Number(entry.amount_cents) || 0;
  const included = Number(entry.included_seats ?? 0) || 0;
  const extraSeats = Math.max(0, (Number(seatLimit) || 0) - included);
  const extra = extraSeats * (Number(entry.extra_seat_amount_cents) || 0);
  const total = base + extra + (Number(addonCents) || 0);
  return annual ? Math.round(total / 12) : total;
}

/** Tabela de preços vigente para uma versão da oferta numa data. */
export function priceTableInForce(tables: any[], offerVersionId: string, at: string) {
  const when = at || new Date().toISOString().split("T")[0];
  const candidates = (tables || [])
    .filter((table: any) => table.status === "published" && table.offer_version_id === offerVersionId)
    .filter((table: any) => !table.effective_from || table.effective_from <= when)
    .filter((table: any) => !table.effective_to || table.effective_to >= when);
  return candidates.sort((a: any, b: any) => String(b.effective_from || "").localeCompare(String(a.effective_from || "")))[0] || null;
}

/** Códigos de pack do catálogo de código (para validar o que se contrata). */
export function addonCatalogueCodes(): string[] {
  return Object.keys(ADDON_PACKS);
}
