import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarClock, CheckCircle2, RefreshCw, TrendingUp, XCircle } from 'lucide-react';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import LifecycleActionDialog from '@/components/licensing/LifecycleActionDialog';
import {
  LIFECYCLE_STATE_META,
  LIFECYCLE_TIER_LABEL_KEYS,
  formatLifecycleValidity,
} from '@/lib/commercialLifecycle';

/**
 * Ciclo de vida da subscrição (FM3): vigência, renovação, mudança de nível e
 * fecho do tenant, por cliente no âmbito.
 *
 * A leitura vem da acção `lifecycle` de `provisionTenantLicense` (o mesmo âmbito
 * de escrita: dono da plataforma = todos, administrador de parceiro = a sua
 * carteira) e toda a escrita passa pela mesma função — a página nunca escreve nas
 * entidades de licenciamento. Um tenant fechado mostra o trabalho a tratar: o que
 * fica por fechar do lado do cliente, sem que nada seja apagado.
 */
export default function SubscriptionLifecycleCard() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(null);
  const [error, setError] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['subscription-lifecycle'],
    queryFn: async () => {
      const result = await base44.functions.invoke('provisionTenantLicense', { action: 'lifecycle' });
      return result?.data || result;
    },
  });

  const tenants = data?.tenants || [];

  const mutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('provisionTenantLicense', payload),
    onSuccess: (result, payload) => {
      const body = result?.data || result;
      queryClient.invalidateQueries({ queryKey: ['subscription-lifecycle'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-licenses'] });
      queryClient.invalidateQueries({ queryKey: ['license-changes'] });
      queryClient.invalidateQueries({ queryKey: ['quota-overview'] });
      setDialog(null);
      setError(null);

      if (payload.action === 'renew') {
        toast.success(t('lifecycle_saved_renew').replace('{date}', body?.expires_date || '—'));
      } else if (payload.action === 'change_tier') {
        toast.success(
          t('lifecycle_saved_tier').replace('{tier}', t(LIFECYCLE_TIER_LABEL_KEYS[body?.tier_code]) || body?.tier_code || '—'),
        );
      } else {
        toast.success(t('lifecycle_saved_close'));
      }
    },
    onError: (err) => {
      const details = err?.response?.data || err?.data || {};
      setError({
        message: details.error || err?.message || t('lifecycle_error'),
        code: details.code || null,
        leaving: details.leaving || null,
      });
    },
  });

  const open = (mode, tenant) => {
    setError(null);
    setDialog({ mode, tenant });
  };

  const tierName = (code) => (code ? t(LIFECYCLE_TIER_LABEL_KEYS[code]) || code : t('licensing_status_none'));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="w-4 h-4" />
          {t('lifecycle_title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('lifecycle_subtitle')}</p>
      </CardHeader>
      <CardContent className="p-0">
        {isError ? (
          <div className="p-6">
            <ErrorState variant="inline" onRetry={() => refetch()} />
          </div>
        ) : isLoading ? (
          <div className="p-6">
            <LoadingState variant="skeleton" rows={4} label={t('lifecycle_loading')} />
          </div>
        ) : tenants.length === 0 ? (
          <EmptyState icon={CalendarClock} title={t('lifecycle_empty')} className="py-12" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('licensing_col_customer')}</TableHead>
                <TableHead>{t('licensing_col_tier')}</TableHead>
                <TableHead>{t('lifecycle_col_validity')}</TableHead>
                <TableHead>{t('lifecycle_col_renewals')}</TableHead>
                <TableHead>{t('lifecycle_col_work')}</TableHead>
                <TableHead className="text-right">{t('licensing_provision_col_actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => {
                const meta = LIFECYCLE_STATE_META[tenant.lifecycle?.state] || LIFECYCLE_STATE_META.none;
                const closed = tenant.lifecycle?.state === 'closed';
                return (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>
                      {tenant.subscription ? (
                        <Badge variant="outline" className="text-xs">{tierName(tenant.subscription.tier_code)}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t('lifecycle_no_subscription')}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge className={`text-xs w-fit ${meta.className}`}>{t(meta.labelKey)}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatLifecycleValidity(tenant.lifecycle, t, language)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {tenant.subscription
                        ? `${tenant.subscription.renewal_count || 0}${
                            tenant.subscription.last_renewed_at ? ` · ${tenant.subscription.last_renewed_at}` : ''
                          }`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {tenant.handover ? (
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          <p>{t('lifecycle_work_delegations').replace('{n}', String(tenant.handover.live_delegations))}</p>
                          <p>{t('lifecycle_work_packages').replace('{n}', String(tenant.handover.pending_audit_packages))}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t('lifecycle_work_none')}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {tenant.subscription ? (
                        <div className="flex justify-end gap-1">
                          {!closed && (
                            <>
                              <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => open('renew', tenant)}>
                                <RefreshCw className="w-3.5 h-3.5" /> {t('lifecycle_renew')}
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => open('change_tier', tenant)}>
                                <TrendingUp className="w-3.5 h-3.5" /> {t('lifecycle_change_tier')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 text-destructive hover:text-destructive"
                                onClick={() => open('close', tenant)}
                              >
                                <XCircle className="w-3.5 h-3.5" /> {t('lifecycle_close')}
                              </Button>
                            </>
                          )}
                          {closed && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {tenant.subscription.closed_at || t('lifecycle_validity_closed')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t('licensing_provision_no_subscription')}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {dialog && (
        <LifecycleActionDialog
          mode={dialog.mode}
          tenant={dialog.tenant}
          removals={error?.code === 'removals_required' ? error.leaving : null}
          pending={mutation.isPending}
          error={error?.message || ''}
          onSubmit={(payload) => mutation.mutate(payload)}
          onClose={() => {
            setDialog(null);
            setError(null);
          }}
        />
      )}
    </Card>
  );
}
