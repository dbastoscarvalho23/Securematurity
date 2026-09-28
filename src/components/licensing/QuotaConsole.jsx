import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Gauge, Info, Loader2, SlidersHorizontal } from 'lucide-react';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import QuotaDialog from '@/components/licensing/QuotaDialog';
import {
  QUOTA_LEVEL_META,
  QUOTA_METRIC_LABEL_KEYS,
  formatQuotaUsage,
  formatPct,
} from '@/lib/commercialLifecycle';

/**
 * Quotas contratuais e sinalização de excedente (FM4).
 *
 * Lugares e consumo de IA do mês face ao que cada cliente contratou, com o nível
 * (dentro / perto / acima da quota) calculado no servidor. **Sinalizar não
 * bloqueia nem cobra**: quem passa a quota mantém o acesso, e a consola di-lo de
 * forma explícita — a fronteira do FM6 continua de pé.
 *
 * O histórico de sinalizações é escrito pela própria função
 * (`record_quota_signals`), uma linha por cliente, período e grandeza: repetir
 * actualiza o valor, e um cliente que baixa o consumo volta a «dentro da quota».
 */
export default function QuotaConsole() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(null);
  const [error, setError] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['quota-overview'],
    queryFn: async () => {
      const result = await base44.functions.invoke('provisionTenantLicense', { action: 'quota_overview' });
      return result?.data || result;
    },
  });

  const tenants = data?.tenants || [];
  const signals = data?.signals || [];
  const defaults = data?.quota_source_pricing || null;

  const saveQuotas = useMutation({
    mutationFn: (payload) => base44.functions.invoke('provisionTenantLicense', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quota-overview'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-licenses'] });
      queryClient.invalidateQueries({ queryKey: ['license-changes'] });
      setDialog(null);
      setError('');
      toast.success(t('quota_saved'));
    },
    onError: (err) => {
      const message = err?.response?.data?.error || err?.data?.error || err?.message;
      setError(message || t('quota_error'));
    },
  });

  const recordSignals = useMutation({
    mutationFn: () => base44.functions.invoke('provisionTenantLicense', {
      action: 'record_quota_signals',
      period: data?.period,
    }),
    onSuccess: (result) => {
      const body = result?.data || result;
      queryClient.invalidateQueries({ queryKey: ['quota-overview'] });
      toast.success(t('quota_signals_recorded').replace('{n}', String(body?.totals?.recorded ?? 0)));
      if ((body?.totals?.flagged ?? 0) > 0) {
        toast.success(t('quota_signals_flagged').replace('{n}', String(body.totals.flagged)));
      }
      if ((body?.totals?.resolved ?? 0) > 0) {
        toast.success(t('quota_signals_resolved').replace('{n}', String(body.totals.resolved)));
      }
    },
    onError: () => toast.error(t('quota_error')),
  });

  const levelBadge = (state) => {
    const meta = QUOTA_LEVEL_META[state?.level] || QUOTA_LEVEL_META.ok;
    return <Badge className={`text-xs ${meta.className}`}>{t(meta.labelKey)}</Badge>;
  };

  const dateText = (iso) => (iso ? new Date(iso).toLocaleString(language === 'pt' ? 'pt-PT' : 'en-GB') : '—');

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="w-4 h-4" />
            {t('quota_title')}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{t('quota_subtitle')}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={recordSignals.isPending || tenants.length === 0}
          onClick={() => recordSignals.mutate()}
        >
          {recordSignals.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gauge className="w-4 h-4" />}
          {t('quota_record_signals')}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sinalizar nunca bloqueia: o aviso de âmbito é parte da leitura. */}
        <div className="flex items-start gap-2 rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-xs text-status-warning">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{t('quota_notice')}</span>
        </div>

        {isError ? (
          <ErrorState variant="inline" onRetry={() => refetch()} />
        ) : isLoading ? (
          <LoadingState variant="skeleton" rows={4} label={t('quota_loading')} />
        ) : tenants.length === 0 ? (
          <EmptyState compact icon={Gauge} title={t('quota_empty')} />
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('licensing_col_customer')}</TableHead>
                  <TableHead>{t('quota_col_seats')}</TableHead>
                  <TableHead>{t('quota_col_ai')}</TableHead>
                  <TableHead>{t('quota_col_state')}</TableHead>
                  <TableHead>{t('quota_col_source')}</TableHead>
                  <TableHead className="text-right">{t('licensing_provision_col_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">
                          {formatQuotaUsage(tenant.seats)} · {formatPct(tenant.seats?.used_pct)}
                        </span>
                        <div>{levelBadge(tenant.seats)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">
                          {formatQuotaUsage(tenant.ai)} · {formatPct(tenant.ai?.used_pct)}
                        </span>
                        <div>{levelBadge(tenant.ai)}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t('quota_no_charge')}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {tenant.quota_source_price_table_id
                        ? t('quota_source_from_price')
                        : t('quota_source_manual')}
                    </TableCell>
                    <TableCell className="text-right">
                      {tenant.subscription_id ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1"
                          onClick={() => {
                            setError('');
                            setDialog(tenant);
                          }}
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" /> {t('quota_set')}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t('lifecycle_no_subscription')}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Histórico de sinalizações do período */}
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">{t('quota_signals_title')}</p>
            <p className="text-xs text-muted-foreground">{t('quota_signals_help')}</p>
          </div>

          {signals.length === 0 ? (
            <EmptyState compact icon={Gauge} title={t('quota_signals_empty')} />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('quota_signals_col_customer')}</TableHead>
                    <TableHead>{t('quota_signals_col_metric')}</TableHead>
                    <TableHead>{t('quota_signals_col_level')}</TableHead>
                    <TableHead>{t('quota_signals_col_quota')}</TableHead>
                    <TableHead>{t('quota_signals_col_consumed')}</TableHead>
                    <TableHead>{t('quota_signals_col_excess')}</TableHead>
                    <TableHead>{t('quota_signals_col_date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signals.map((signal) => {
                    const meta = QUOTA_LEVEL_META[signal.level] || QUOTA_LEVEL_META.ok;
                    return (
                      <TableRow key={signal.id}>
                        <TableCell className="font-medium">{signal.customer_name || '—'}</TableCell>
                        <TableCell className="text-sm">{t(QUOTA_METRIC_LABEL_KEYS[signal.metric] || 'quota_metric_seats')}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${meta.className}`}>{t(meta.labelKey)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{signal.quota}</TableCell>
                        <TableCell className="text-sm">{signal.consumed}</TableCell>
                        <TableCell className="text-sm">{signal.excess || 0}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {dateText(signal.detected_at || signal.created_date)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>

      {dialog && (
        <QuotaDialog
          tenant={dialog}
          defaults={defaults}
          pending={saveQuotas.isPending}
          error={error}
          onSubmit={(payload) => saveQuotas.mutate(payload)}
          onClose={() => {
            setDialog(null);
            setError('');
          }}
        />
      )}
    </Card>
  );
}
