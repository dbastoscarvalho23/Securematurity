import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, Save, ShieldCheck } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { isPlatformOwner } from '@/lib/rbac';

/**
 * Automações e conservação (FB4).
 *
 * Dá ao master_admin o que faltava: a última execução (e as últimas cinco) de
 * cada automação, com duração e erro; a política de conservação por entidade e
 * por tenant; e uma simulação de purga que não apaga nada. Toda a leitura e
 * escrita passa por `managePlatformOperations` — a página não escreve entidades.
 */

const STATUS_STYLE = {
  success: { key: 'ops_status_success', variant: 'outline', className: 'bg-chart-2/10 text-chart-2 border-chart-2/20' },
  failed: { key: 'ops_status_failed', variant: 'outline', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

function formatDuration(ms, fallback) {
  if (typeof ms !== 'number') return fallback;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export default function PlatformOperations() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const allowed = isPlatformOwner(user?.role);

  const [form, setForm] = useState({
    entity_name: 'DataProcessingActivity',
    customer_id: '',
    retention_days: 365,
    action: 'purge',
    is_active: true,
    notes: '',
  });
  const [simulation, setSimulation] = useState(null);

  const overview = useQuery({
    queryKey: ['platform-operations'],
    queryFn: () => base44.functions.invoke('managePlatformOperations', { action: 'overview' }),
    enabled: allowed,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['ops-customers'],
    queryFn: () => base44.entities.Customer.list('name', 500),
    enabled: allowed,
  });

  const savePolicy = useMutation({
    mutationFn: () => base44.functions.invoke('managePlatformOperations', {
      action: 'set_policy',
      policy: {
        ...form,
        customer_id: form.customer_id || null,
        customer_name: customers.find((c) => c.id === form.customer_id)?.name || '',
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-operations'] });
      toast({ title: t('ops_policy_updated') });
    },
    onError: () => toast({ title: t('ops_policy_error'), variant: 'destructive' }),
  });

  const runSimulation = useMutation({
    mutationFn: () => base44.functions.invoke('managePlatformOperations', {
      action: 'simulate',
      policy: { ...form, customer_id: form.customer_id || null },
    }),
    onSuccess: (result) => setSimulation(result),
    onError: () => toast({ title: t('ops_simulation_error'), variant: 'destructive' }),
  });

  if (!allowed) {
    return <EmptyState icon={ShieldCheck} title={t('common_no_permission')} className="h-64" />;
  }

  const dateFormatter = new Intl.DateTimeFormat(language === 'pt' ? 'pt-PT' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const formatDate = (value) => (value ? dateFormatter.format(new Date(value)) : t('ops_never_run'));

  const data = overview.data || {};
  const workflows = data.workflows || [];
  const policies = data.policies || [];
  const entities = data.entities || [];

  return (
    <div className="space-y-6">
      <PageHeader description={t('platform_ops_subtitle')} />

      {/* ── Automações agendadas ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('ops_automations_title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('ops_automations_desc')}</p>
        </CardHeader>
        <CardContent className="p-0">
          {overview.isError ? (
            <ErrorState variant="inline" onRetry={() => overview.refetch()} />
          ) : overview.isLoading ? (
            <LoadingState variant="skeleton" rows={5} label={t('common_loading')} className="p-4" />
          ) : workflows.length === 0 ? (
            <EmptyState compact icon={Play} title={t('common_no_data')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('ops_col_workflow')}</TableHead>
                  <TableHead>{t('ops_col_trigger')}</TableHead>
                  <TableHead>{t('ops_col_last_run')}</TableHead>
                  <TableHead>{t('ops_col_duration')}</TableHead>
                  <TableHead>{t('ops_col_status')}</TableHead>
                  <TableHead>{t('ops_col_error')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((workflow) => {
                  const last = workflow.last_run;
                  const style = STATUS_STYLE[last?.status] || { key: 'ops_status_unknown', variant: 'outline', className: '' };
                  return (
                    <TableRow key={workflow.name}>
                      <TableCell className="text-sm font-medium">{t(workflow.label_key)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {workflow.trigger === 'scheduled' ? t('ops_trigger_scheduled') : t('ops_trigger_event')}
                        {workflow.cron ? ` · ${workflow.cron}` : ''}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(last?.started_at)}</TableCell>
                      <TableCell className="text-sm">{last ? formatDuration(last.duration_ms, '—') : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={style.variant} className={style.className}>{t(style.key)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate" title={last?.error || ''}>
                        {last?.error || '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Políticas de conservação ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('ops_retention_title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('ops_retention_desc')}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {policies.length === 0 ? (
            <EmptyState compact title={t('common_no_data')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('ops_col_entity')}</TableHead>
                  <TableHead>{t('ops_col_tenant')}</TableHead>
                  <TableHead>{t('ops_col_days')}</TableHead>
                  <TableHead>{t('ops_col_action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="text-sm">{policy.entity_name}</TableCell>
                    <TableCell className="text-sm">{policy.customer_name || t('ops_all_tenants')}</TableCell>
                    <TableCell className="text-sm">{policy.retention_days}</TableCell>
                    <TableCell className="text-sm">{t(`ops_action_${policy.action}`)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Formulário */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end border-t pt-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('ops_policy_entity')}</Label>
              <Select value={form.entity_name} onValueChange={(v) => setForm((f) => ({ ...f, entity_name: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(entities.length ? entities : [{ name: 'DataProcessingActivity' }, { name: 'DataSubjectRequest' }]).map((e) => (
                    <SelectItem key={e.name} value={e.name}>{e.label || e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('ops_col_tenant')}</Label>
              <Select value={form.customer_id || 'all'} onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v === 'all' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('ops_all_tenants')}</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('ops_col_days')}</Label>
              <Input
                type="number"
                min={1}
                value={form.retention_days}
                onChange={(e) => setForm((f) => ({ ...f, retention_days: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('ops_col_action')}</Label>
              <Select value={form.action} onValueChange={(v) => setForm((f) => ({ ...f, action: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="purge">{t('ops_action_purge')}</SelectItem>
                  <SelectItem value="archive">{t('ops_action_archive')}</SelectItem>
                  <SelectItem value="anonymise">{t('ops_action_anonymise')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('ops_policy_hint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-2" onClick={() => savePolicy.mutate()} disabled={savePolicy.isPending}>
              <Save className="w-3.5 h-3.5" /> {t('ops_policy_save')}
            </Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => runSimulation.mutate()} disabled={runSimulation.isPending}>
              <Play className="w-3.5 h-3.5" /> {t('ops_simulate')}
            </Button>
          </div>

          {/* Resultado da simulação */}
          {simulation && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="text-sm font-medium">{t('ops_simulation_title')}</p>
              <p className="text-xs text-muted-foreground">{t('ops_simulation_desc')}</p>
              <p className="text-sm">
                <span className="font-semibold">{simulation.affected_count}</span> {t('ops_simulation_affected')} ·{' '}
                {simulation.scanned} {t('ops_simulation_scanned')}
              </p>
              {simulation.affected_count === 0 ? (
                <p className="text-sm text-muted-foreground">{t('ops_simulation_no_action')}</p>
              ) : (
                <ul className="text-xs text-muted-foreground space-y-1">
                  {simulation.sample.map((row) => (
                    <li key={row.id} className="truncate">
                      {row.label} · {row.date ? row.date.slice(0, 10) : '—'} {row.customer_name ? `· ${row.customer_name}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
