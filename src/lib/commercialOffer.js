/**
 * Oferta comercial — apresentação da versão de oferta e da tabela de preços
 * (FM1/FM2) na consola de /licensing.
 *
 * Só apresentação: a validação, o antes/depois e a vigência são decididos no
 * servidor (`base44/functions/manageCommercialOffer` + `base44/shared/commercialOffer.ts`).
 * A composição técnica dos tiers continua a vir do catálogo de código
 * (`src/lib/licenseModules.js`), que é a única fonte do gating.
 */

/** Tiers da oferta, na ordem cumulativa. */
export const OFFER_TIER_ORDER = ['core', 'professional', 'advanced'];

/**
 * Packs/acréscimos da oferta, na ordem em que são apresentados. Os nomes vêm das
 * chaves `addon_*` das traduções; o catálogo técnico (que módulos cada pack abre)
 * é o de `src/lib/licenseModules.js`, espelho do backend.
 */
export const OFFER_ADDON_ORDER = ['privacy', 'risk', 'suppliers'];

/** Estados de uma versão da oferta e de uma tabela de preços. */
export const COMMERCIAL_STATUS_META = {
  draft: { labelKey: 'commercial_status_draft', className: 'bg-chart-3/10 text-chart-3' },
  published: { labelKey: 'commercial_status_published', className: 'bg-chart-2/10 text-chart-2' },
  retired: { labelKey: 'commercial_status_retired', className: 'bg-muted text-muted-foreground' },
};

/** Acções do histórico comercial. */
export const COMMERCIAL_ACTION_META = {
  create: { labelKey: 'commercial_action_create', className: 'bg-chart-1/10 text-chart-1' },
  update: { labelKey: 'commercial_action_update', className: 'bg-chart-3/10 text-chart-3' },
  publish: { labelKey: 'commercial_action_publish', className: 'bg-chart-2/10 text-chart-2' },
  retire: { labelKey: 'commercial_action_retire', className: 'bg-destructive/10 text-destructive' },
};

/** Campos escalares de cada entidade, na ordem em que o detalhe os mostra. */
export const COMMERCIAL_FIELDS = {
  OfferVersion: ['label', 'status', 'effective_from', 'effective_to', 'notes'],
  PriceTable: ['label', 'status', 'currency', 'billing_period', 'effective_from', 'effective_to', 'notes'],
};

/** Tipos de linha comparados pelo histórico (o prefixo vem do servidor). */
export const COMMERCIAL_ROW_FIELDS = {
  OfferVersion: 'tier:',
  PriceTable: 'price:',
};

/** Prefixos das linhas comparadas pelo histórico → rótulo do campo. */
const ROW_PREFIX_LABELS = {
  'tier:': 'commercial_field_tier',
  'price:': 'commercial_field_price',
  'addon:': 'commercial_field_addon',
  'addon_price:': 'commercial_field_addon_price',
};

/** Nome de um pack pela chave de tradução (`privacy` → «Pack de Privacidade»). */
export function addonLabel(code, t) {
  const key = `addon_${code}`;
  const translated = t(key);
  return translated === key ? code : translated;
}

/** Preço guardado em cêntimos, mostrado na moeda da tabela. */
export function formatMoney(cents, currency = 'EUR', locale = 'pt-PT') {
  if (cents === null || cents === undefined || cents === '') return '—';
  const value = Number(cents) / 100;
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'EUR' }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency || ''}`.trim();
  }
}

/** Valor em euros escrito pelo utilizador → cêntimos (aceita vírgula decimal). */
export function centsFromEuros(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

/** Cêntimos → euros para o campo de formulário. */
export function eurosFromCents(cents) {
  if (cents === null || cents === undefined || cents === '') return '';
  const value = Number(cents) / 100;
  return Number.isFinite(value) ? value.toFixed(2) : '';
}

/**
 * Rótulo de um campo alterado no histórico: os escalares pela chave, as linhas
 * por tier com o nome do tier (`tier:core` → «Tier · Core»).
 */
export function commercialFieldLabel(code, t, nameOf = (value) => value) {
  for (const [prefix, key] of Object.entries(ROW_PREFIX_LABELS)) {
    if (code.startsWith(prefix)) return `${t(key)} · ${nameOf(code.slice(prefix.length))}`;
  }
  return t(`commercial_field_${code}`);
}

/** Valor legível de um campo escalar do antes/depois — nunca JSON cru. */
export function commercialValueLabel(value, code, t) {
  if (value === null || value === undefined || value === '') return t('commercial_value_empty');
  if (code === 'status') {
    const key = `commercial_status_${value}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  if (code === 'billing_period') {
    const key = `commercial_period_${value}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return String(value);
}

/** Data ISO `date` (ou `date-time`) reduzida ao dia, para a lista. */
export function formatDay(value) {
  if (!value) return '—';
  return String(value).slice(0, 10);
}

/** Vigência legível: «2026-01-01 → 2026-06-30», com «—» no que está aberto. */
export function formatValidity(record) {
  const from = formatDay(record?.effective_from);
  const to = record?.effective_to ? formatDay(record.effective_to) : '—';
  if (from === '—' && to === '—') return '—';
  return `${from} → ${to}`;
}
