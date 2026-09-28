/**
 * CommercialMetricsWidget — indicadores comerciais da plataforma (FM5).
 *
 * Receita contratada, movimento do período, churn, peso de cada nível e coortes
 * de utilização — todos calculados no servidor (`getCommercialMetrics`), a partir
 * das tabelas de preços em vigor e do histórico de licenciamento.
 *
 * A fronteira de âmbito é dita na interface, não só no código: a receita é
 * **contratada**, não faturada (não há faturação nem pagamentos nesta fase), e
 * cada cartão traz a comparação com o período anterior para que um número
 * isolado não valha como tendência.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Coins, Gauge, Info, TrendingDown, TrendingUp } from 'lucide-react';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
import { useLanguage } from '@/lib/LanguageContext';
import { formatMoney } from '@/lib/commercialOffer';
import { COHORT_LABEL_KEYS, LIFECYCLE_TIER_LABEL_KEYS } from '@/lib/commercialLifecycle';

const MOVEMENT_KEYS = {
  new: 'metrics_movement_new',
  renewals: 'metrics_movement_renewals',
  upgrades: 'metrics_movement_upgrades',
  downgrades: 'metrics_movement_downgrades',
  closed: 'metrics_movement_closed',
};

export default function CommercialMetricsWidget() {
  const { t, language } = useLanguage();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['commercial-metrics'],
    queryFn: async () => {
      const result = await base44.functions.invoke('getCommercialMetrics', {});
      return result?.data || result;
    },
  });

  const revenue = data?.revenue;
  const movement = data?.movement;
  const churn = data?.churn;
  const conversion = data?.conversion;
  const cohorts = data?.cohorts || [];
  const signals = data?.signals;
  const currency = data?.currency || 'EUR';
  const currencyLabel = { EUR: 'EUR', USD: 'USD', GBP: 'GBP' };

  const title = (
    <CardTitle className="text-base flex items-center gap-2">
      <Coins className="w-4 h-4" />
      {t('metrics_title')}
    </CardTitle>
  );

  if (isError) {
    return (
      <Card>
        <CardHeader>{title}</CardHeader>
        <CardContent>
          <ErrorState variant="inline" onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>{title}</CardHeader>
        <CardContent>
          <LoadingState variant="skeleton" rows={4} label={t('metrics_loading')} />
        </CardContent>
      </Card>
    );
  }

  const delta = revenue?.delta_pct;
  const formatCount = (value) => new Intl.NumberFormat(language === 'pt' ? 'pt-PT' : 'en-GB').format(value || 0);

  return (
    <div className="space-y-6">
      {/* Receita contratada */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            {title}
            <p className="text-sm text-muted-foreground mt-1">{t('metrics_subtitle')}</p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/licensing">
              {t('metrics_open_ops')}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">{t('metrics_mrr')}</p>
              <p className="text-2xl font-semibold mt-1">
                {formatMoney(revenue?.mrr_cents, currency, language === 'pt' ? 'pt-PT' : 'en-GB')}
              </p>
              {delta !== null && delta !== undefined && (
                <p className={`mt-1 flex items-center gap-1 text-xs ${delta >= 0 ? 'text-chart-2' : 'text-destructive'}`}>
                  {delta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {t('metrics_vs_previous').replace('{value}', String(delta))}
                </p>
              )}
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">{t('metrics_arr')}</p>
              <p className="text-2xl font-semibold mt-1">
                {formatMoney(revenue?.arr_cents, currency, language === 'pt' ? 'pt-PT' : 'en-GB')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t('metrics_contracted_note')}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">{t('metrics_conversion_title')}</p>
              <div className="mt-2 space-y-1.5">
                {(conversion?.tiers || []).map((tier) => (
                  <div key={tier.tier_code} className="flex items-center justify-between gap-2 text-sm">
                    <span>{t(LIFECYCLE_TIER_LABEL_KEYS[tier.tier_code]) || tier.tier_code}</span>
                    <span className="text-muted-foreground">
                      {tier.subscriptions} · {tier.share_pct}%
                      {tier.delta_pp !== 0 && (
                        <span className={tier.delta_pp > 0 ? ' text-chart-2' : ' text-destructive'}>
                          {' '}({tier.delta_pp > 0 ? '+' : ''}{tier.delta_pp} pp)
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t('metrics_conversion_help')}</p>
            </div>
          </div>

          {(revenue?.unpriced_subscriptions > 0 || data?.truncated) && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                {revenue?.unpriced_subscriptions > 0
                  ? t('metrics_unpriced').replace('{n}', String(revenue.unpriced_subscriptions))
                  : null}
              </span>
            </div>
          )}

          {(revenue?.by_billing_period || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {revenue.by_billing_period.map((row) => (
                <Badge key={row.billing_period} variant="outline" className="text-xs">
                  {row.billing_period === 'monthly' || row.billing_period === 'annual'
                    ? t(`commercial_period_${row.billing_period}`)
                    : t('commercial_value_empty')}{' '}
                  · {row.subscriptions} ·{' '}
                  {formatMoney(row.mrr_cents, currency, language === 'pt' ? 'pt-PT' : 'en-GB')}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Movimento do período */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {t('metrics_movement_title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(MOVEMENT_KEYS).map(([key, labelKey]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span>{t(labelKey)}</span>
                <span className="font-medium">
                  {formatCount(movement?.[key])}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({formatCount(movement?.previous?.[key])})
                  </span>
                </span>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">
              {t('metrics_previous_period').replace('{period}', movement?.previous?.period || '—')}
            </p>
          </CardContent>
        </Card>

        {/* Churn */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              {t('metrics_churn_title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">{churn?.rate_pct ?? 0}%</p>
            <p className="text-xs text-muted-foreground">
              {t('metrics_churn_detail')
                .replace('{closed}', formatCount(churn?.closed_in_period))
                .replace('{active}', formatCount(churn?.active_at_start))}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('metrics_churn_rate').replace('{value}', String(churn?.rate_pct ?? 0))}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('metrics_previous_period').replace('{period}', movement?.previous?.period || '—')}: {formatCount(churn?.previous_closed)}
            </p>
          </CardContent>
        </Card>

        {/* Coortes de utilização */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              {t('metrics_cohorts_title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cohorts.map((band) => (
              <div key={band.band} className="flex items-center justify-between text-sm">
                <span>{t(COHORT_LABEL_KEYS[band.band] || 'metrics_cohort_no_usage')}</span>
                <span className="text-muted-foreground">
                  {formatCount(band.tenants)} {t('metrics_tenants')}
                </span>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">{t('metrics_cohorts_help')}</p>
            {signals && (
              <p className="text-xs text-status-warning">
                {t('metrics_signals_detail')
                  .replace('{warning}', formatCount(signals.warning))
                  .replace('{excess}', formatCount(signals.excess))}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
