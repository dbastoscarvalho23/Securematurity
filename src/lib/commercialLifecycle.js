/**
 * Ciclo de vida da subscrição (FM3) e quotas contratuais (FM4) — apresentação.
 *
 * Só apresentação: o estado de vigência e o estado das quotas são decididos no
 * servidor (`base44/shared/quotaState.ts`, usado por `provisionTenantLicense`,
 * `getEffectiveLicense` e `getCommercialMetrics`), para que exista uma só regra
 * por número. Nada aqui abre ou fecha módulos — a quota **sinaliza**, nunca
 * bloqueia, e não há faturação nem pagamentos nesta fase (FM6).
 */

/** Ordem cumulativa dos níveis comerciais. */
export const LIFECYCLE_TIER_ORDER = ['core', 'professional', 'advanced'];

export const LIFECYCLE_TIER_LABEL_KEYS = {
  core: 'license_tier_core',
  professional: 'license_tier_professional',
  advanced: 'license_tier_advanced',
};

/** Estados de vigência devolvidos pelo servidor. */
export const LIFECYCLE_STATE_META = {
  none: { labelKey: 'lifecycle_state_none', className: 'bg-muted text-muted-foreground' },
  open: { labelKey: 'lifecycle_state_open', className: 'bg-chart-2/10 text-chart-2' },
  trial: { labelKey: 'lifecycle_state_trial', className: 'bg-chart-5/10 text-chart-5' },
  expiring: { labelKey: 'lifecycle_state_expiring', className: 'bg-status-warning/10 text-status-warning' },
  expired: { labelKey: 'lifecycle_state_expired', className: 'bg-destructive/10 text-destructive' },
  suspended: { labelKey: 'lifecycle_state_suspended', className: 'bg-destructive/10 text-destructive' },
  closed: { labelKey: 'lifecycle_state_closed', className: 'bg-muted text-muted-foreground' },
};

/** Níveis da quota: ok, aviso (limiar atingido) e excedente (quota ultrapassada). */
export const QUOTA_LEVEL_META = {
  ok: { labelKey: 'quota_level_ok', className: 'bg-chart-2/10 text-chart-2' },
  warning: { labelKey: 'quota_level_warning', className: 'bg-status-warning/10 text-status-warning' },
  excess: { labelKey: 'quota_level_excess', className: 'bg-destructive/10 text-destructive' },
};

export const QUOTA_METRIC_LABEL_KEYS = {
  seats: 'quota_metric_seats',
  ai_usage: 'quota_metric_ai',
};

/** Coortes de utilização (FM5) — a banda vem do servidor. */
export const COHORT_LABEL_KEYS = {
  no_quota: 'metrics_cohort_no_quota',
  no_usage: 'metrics_cohort_no_usage',
  below_half: 'metrics_cohort_below_half',
  half_to_quota: 'metrics_cohort_half_to_quota',
  above_quota: 'metrics_cohort_above_quota',
};

/** Posição de um nível na escala cumulativa (-1 se não pertence à oferta). */
export function tierPosition(tierCode) {
  return LIFECYCLE_TIER_ORDER.indexOf(tierCode);
}

/** Sentido da mudança de nível entre dois códigos. */
export function tierDirection(fromTier, toTier) {
  const from = tierPosition(fromTier);
  const to = tierPosition(toTier);
  if (from < 0 || to < 0 || from === to) return 'same';
  return to > from ? 'upgrade' : 'downgrade';
}

/** Percentagem escrita de forma legível (— quando não há quota definida). */
export function formatPct(value) {
  if (value === null || value === undefined) return '—';
  return `${value}%`;
}

/** Consumo face a uma quota: «3 / 10» ou «3 (sem quota definida)» quando não há. */
export function formatQuotaUsage(state) {
  if (!state) return '—';
  if (!state.defined) return `${state.consumed} · —`;
  return `${state.consumed} / ${state.quota}`;
}

/** Vigência em texto curto: a validade e, quando faz sentido, os dias que faltam. */
export function formatLifecycleValidity(lifecycle, t, locale = 'pt-PT') {
  if (!lifecycle || lifecycle.state === 'none') return t('lifecycle_validity_none');
  const date = lifecycle.expires_date
    ? new Date(`${lifecycle.expires_date}T00:00:00`).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'en-GB')
    : null;

  if (lifecycle.state === 'expired') {
    return date
      ? t('lifecycle_validity_expired_on').replace('{date}', date)
      : t('lifecycle_validity_expired_unknown');
  }
  if (lifecycle.state === 'closed') return t('lifecycle_validity_closed');
  if (!date) return t('lifecycle_validity_open');

  const days = lifecycle.days_left;
  if (days === null || days === undefined) return date;
  return t('lifecycle_validity_until').replace('{date}', date).replace('{days}', String(days));
}
