/**
 * Oferta comercial — regras partilhadas da versão de oferta e da tabela de preços
 * (FM1/FM2). Vive no backend porque é lá que a decisão comercial é validada e
 * registada; o frontend só apresenta o resultado.
 *
 * Fronteira deliberada (FB7): a composição **técnica** dos tiers continua curada
 * em código (`licenseGuard.ts`, espelho em `src/lib/licenseModules.js`) e é a
 * única fonte do gating. `OfferVersion` é o registo **comercial** versionado —
 * o que estava à venda, com que normas e em que intervalo de vigência — e a
 * `catalogue_signature` marca quando o código em execução já não coincide com a
 * versão publicada. Nenhuma página nem função lê a oferta para decidir acessos.
 */

import {
  TIER_MODULES,
  LEGACY_TIER_ALIASES,
  COMMERCIALLY_AVAILABLE_TIERS,
} from "./licenseGuard.ts";

/** Tiers da oferta comercial, na ordem cumulativa (Core ⊂ Profissional ⊂ Avançado). */
export const OFFER_TIER_CODES = ["core", "professional", "advanced"];

/** Periodicidade do preço base. */
export const BILLING_PERIODS = ["monthly", "annual"];

/** Estados de uma versão de oferta e de uma tabela de preços. */
export const COMMERCIAL_STATUSES = ["draft", "published", "retired"];

/** Campos escalares comparados no antes/depois de cada registo. */
const SCALAR_FIELDS: Record<string, string[]> = {
  OfferVersion: ["label", "status", "effective_from", "effective_to", "notes"],
  PriceTable: ["label", "status", "currency", "billing_period", "effective_from", "effective_to", "notes"],
};

/** Coleção comparada linha a linha (o par chave ↔ prefixo do campo alterado). */
const COLLECTIONS: Record<string, { key: string; prefix: string }> = {
  OfferVersion: { key: "tiers", prefix: "tier:" },
  PriceTable: { key: "entries", prefix: "price:" },
};

export function modulesForTierCode(tierCode: string): string[] {
  return TIER_MODULES[LEGACY_TIER_ALIASES[tierCode] || tierCode] || [];
}

/**
 * Assinatura determinística da composição em código. Guardada na versão da
 * oferta: se mudar o código (módulos por tier ou tiers comercializáveis), a
 * versão publicada deixa de coincidir e a consola assinala a divergência.
 */
export function catalogueSignature(): string {
  return OFFER_TIER_CODES
    .map((code) => {
      const sale = COMMERCIALLY_AVAILABLE_TIERS.includes(code) ? "sale" : "prepared";
      return `${code}:${modulesForTierCode(code).join("+")}:${sale}`;
    })
    .join("|");
}

/**
 * Composição inicial de uma versão da oferta: tiers e módulos vêm do catálogo de
 * código, os nomes do espelho semeado (`LicenseTier`) e as normas da lista de
 * normas ativas. O estado comercializável nasce da decisão de lançamento.
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

    entries.push({
      tier_code: code,
      amount_cents: amount.value,
      included_seats: seats.value,
      extra_seat_amount_cents: extra.value,
      annual_discount_pct: discount.value,
      notes: row?.notes ? String(row.notes) : null,
    });
  }

  return { error: null, entries };
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
  const collection = COLLECTIONS[record.entity_type] || COLLECTIONS.OfferVersion;
  snapshot[collection.key] = Array.isArray(record[collection.key])
    ? record[collection.key].map((row: any) => ({ ...row }))
    : [];
  return snapshot;
}

/**
 * Diff de dois instantâneos: os códigos dos campos alterados e, só para esses, o
 * valor antes e depois. Uma repetição da mesma operação não inventa histórico.
 */
export function diffSnapshots(entityType: string, before: any, after: any) {
  const fields = SCALAR_FIELDS[entityType] || SCALAR_FIELDS.OfferVersion;
  const collection = COLLECTIONS[entityType] || COLLECTIONS.OfferVersion;

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

  const keyOf = (row: any) => String(row?.tier_code || "");
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

/** Tabela de preços vigente para uma versão da oferta numa data. */
export function priceTableInForce(tables: any[], offerVersionId: string, at: string) {
  const when = at || new Date().toISOString().split("T")[0];
  const candidates = (tables || [])
    .filter((table: any) => table.status === "published" && table.offer_version_id === offerVersionId)
    .filter((table: any) => !table.effective_from || table.effective_from <= when)
    .filter((table: any) => !table.effective_to || table.effective_to >= when);
  return candidates.sort((a: any, b: any) => String(b.effective_from || "").localeCompare(String(a.effective_from || "")))[0] || null;
}
