import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Megaphone, Play, Save, ShieldCheck } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { isPlatformOwner } from '@/lib/rbac';

/**
 * Automações, conservação e anúncios (FB4/FB8).
 *
 * Dá ao master_admin o que faltava: a última execução (e as últimas cinco) de
 * cada automação, com duração e erro; a política de conservação por entidade e
 * por tenant; uma simulação de purga que não apaga nada; e o canal de
 * comunicação com os tenants (anúncios com âmbito, janela e severidade). Toda a
 * leitura e escrita passa por `managePlatformOperations` / `manageAnnouncements`
 * — a página não escreve entidades.
 */

const STATUS_STYLE = {
  success: { key: 'ops_status_success', variant: 'outline', className: 'bg-chart-2/10 text-chart-2 border-chart-2/20' },
  failed: { key: 'ops_status_failed', variant: 'outline', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const ANNOUNCEMENT_STATE_STYLE = {
  active: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  scheduled: 'bg-chart-1/10 text-chart-1 border-chart-1/20',
  expired: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
};

const SEVERITY_STYLE = {
  info: 'bg-chart-1/10 text-chart-1 border-chart-1/20',
  warning: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  maintenance: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
};

// Âmbitos e severidades espelham SEVERITIES/SCOPES em manageAnnouncements (FB8).
const SEVERITIES = ['info', 'warning', 'maintenance'];
const SCOPES = ['global', 'tier', 'customer'];
const TIER_CODES = ['core', 'professional', 'advanced'];

/** Estado derivado do anúncio: o mesmo critério que a função aplica ao servir a faixa. */
function announcementState(announcement) {
  if (announcement.is_active === false) return 'archived';
  const now = Date.now();
  if (announcement.starts_at && new Date(announcement.starts_at).getTime() > now) return 'scheduled';
  if (announcement.ends_at && new Date(announcement.ends_at).getTime() < now) return 'expired';
  return 'active';
}

// Acções suportadas por entidade, enquanto o catálogo do servidor não chega —
// a fonte é RETENTION_ENTITIES em managePlatformOperations (devolvido no `overview`).
const ENTITY_ACTIONS = {
  DataProcessingActivity: ['purge', 'archive', 'anonymise'],
  DataSubjectRequest: ['purge'],
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
  const [annForm, setAnnForm] = useState({
    title: '',
    message: '',
    severity: 'info',
    scope: 'global',
    tier_code: 'core',
    customer_id: '',
    starts_at: '',
    ends_at: '',
  });

  const overview = useQuery({
    queryKey: ['platform-operations'],
    queryFn: async () => {
      const result = await base44.functions.invoke('managePlatformOperations', { action: 'overview' });
      return result?.data || result;
    },
    enabled: allowed,
  });

  const announcements = useQuery({
    queryKey: ['platform-announcements'],
    queryFn: async () => {
      const result = await base44.functions.invoke('manageAnnouncements', { action: 'overview' });
      const payload = result?.data || result;
      return payload?.announcements || [];
    },
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
    onSuccess: (result) => setSimulation(result?.data || result),
    onError: () => toast({ title: t('ops_simulation_error'), variant: 'destructive' }),
  });

  // ── Anúncios (FB8) ──────────────────────────────────────────────────
  const refreshAnnouncements = () => {
    queryClient.invalidateQueries({ queryKey: ['platform-announcements'] });
    queryClient.invalidateQueries({ queryKey: ['platform-announcements-active'] });
  };

  const publishAnnouncement = useMutation({
    mutationFn: () => base44.functions.invoke('manageAnnouncements', {
      action: 'publish',
      announcement: {
        ...annForm,
        customer_id: annForm.customer_id || null,
        customer_name: customers.find((c) => c.id === annForm.customer_id)?.name || '',
        starts_at: annForm.starts_at ? new Date(annForm.starts_at).toISOString() : null,
        ends_at: annForm.ends_at ? new Date(annForm.ends_at).toISOString() : null,
      },
    }),
    onSuccess: () => {
      refreshAnnouncements();
      setAnnForm((f) => ({ ...f, title: '', message: '', starts_at: '', ends_at: '' }));
      toast({ title: t('ann_published') });
    },
    onError: () => toast({ title: t('ann_publish_error'), variant: 'destructive' }),
  });

  const archiveAnnouncement = useMutation({
    mutationFn: (announcement) => base44.functions.invoke('manageAnnouncements', {
      action: 'archive',
      id: announcement.id,
    }),
    onSuccess: () => {
      refreshAnnouncements();
      toast({ title: t('ann_archived') });
    },
    onError: () => toast({ title: t('ann_archive_error'), variant: 'destructive' }),
  });

  const republishAnnouncement = useMutation({
    mutationFn: (announcement) => base44.functions.invoke('manageAnnouncements', {
      action: 'update',
      id: announcement.id,
      announcement: { ...announcement, is_active: true },
    }),
    onSuccess: () => {
      refreshAnnouncements();
      toast({ title: t('ann_published') });
    },
    onError: () => toast({ title: t('ann_reactivate_error'), variant: 'destructive' }),
  });

  if (!allowed) {
    return <EmptyState icon={ShieldCheck} title={t('common_no_permission')} className="h-64" />;
  }

  const dateFormatter = new Intl.DateTimeFormat(language === 'pt' ? 'pt-PT' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const formatDate = (value) => (value ? dateFormatter.format(new Date(value)) : null);
  const formatDateTime = (value) => formatDate(value) || t('ops_never_run');

  const data = overview.data || {};
  const workflows = data.workflows || [];
  const policies = data.policies || [];
  const entities = data.entities || [];
  const announcementList = announcements.data || [];
  const entityActions = (name) =>
    entities.find((e) => e.name === name)?.actions || ENTITY_ACTIONS[name] || ['purge', 'archive', 'anonymise'];
  const chooseEntity = (name) =>
    setForm((f) => ({
      ...f,
      entity_name: name,
      action: entityActions(name).includes(f.action) ? f.action : entityActions(name)[0],
    }));

  const announcementWindow = (announcement) => {
    const start = formatDate(announcement.starts_at);
    const end = formatDate(announcement.ends_at) || t('ann_window_open');
    if (!start && !end) return '—';
    return `${start || '—'} → ${end}`;
  };
  const announcementScope = (announcement) => {
    if (announcement.scope === 'tier') return `${t('ann_scope_tier')} · ${t(`ann_tier_label_${announcement.tier_code}`)}`;
    if (announcement.scope === 'customer') return announcement.customer_name || t('ann_scope_customer');
    return t('ann_scope_global');
  };

  return (
    <div className="space-y-6">
      <PageHeader description={t('platform_ops_subtitle')} />

      {/* ── Anúncios da plataforma ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('ann_title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('ann_subtitle')}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {announcements.isError ? (
            <ErrorState variant="inline" onRetry={() => announcements.refetch()} />
          ) : announcements.isLoading ? (
            <LoadingState variant="skeleton" rows={4} label={t('common_loading')} />
          ) : announcementList.length === 0 ? (
            <EmptyState compact icon={Megaphone} title={t('ann_history_empty')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('ann_col_title')}</TableHead>
                  <TableHead>{t('ann_col_severity')}</TableHead>
                  <TableHead>{t('ann_col_scope')}</TableHead>
                  <TableHead>{t('ann_col_window')}</TableHead>
                  <TableHead>{t('ann_col_state')}</TableHead>
                  <TableHead className="text-right">{t('ops_col_action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcementList.map((announcement) => {
                  const state = announcementState(announcement);
                  return (
                    <TableRow key={announcement.id}>
                      <TableCell className="max-w-[320px]">
                        <p className="text-sm font-medium">{announcement.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{announcement.message}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={SEVERITY_STYLE[announcement.severity] || ''}>
                          {t(`ann_severity_${announcement.severity}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{announcementScope(announcement)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{announcementWindow(announcement)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ANNOUNCEMENT_STATE_STYLE[state]}>
                          {t(`ann_state_${state}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {state === 'archived' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => republishAnnouncement.mutate(announcement)}
                            disabled={republishAnnouncement.isPending}
                          >
                            {t('ann_reactivate')}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => archiveAnnouncement.mutate(announcement)}
                            disabled={archiveAnnouncement.isPending}
                          >
                            {t('ann_archive')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Formulário de publicação */}
          <div className="space-y-4 border-t pt-4">
            <p className="text-sm font-medium">{t('ann_form_title')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5 lg:col-span-2">
                <Label className="text-xs">{t('ann_field_title')}</Label>
                <Input
                  value={annForm.title}
                  onChange={(e) => setAnnForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('ann_field_severity')}</Label>
                <Select value={annForm.severity} onValueChange={(v) => setAnnForm((f) => ({ ...f, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((code) => (
                      <SelectItem key={code} value={code}>{t(`ann_severity_${code}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('ann_field_scope')}</Label>
                <Select value={annForm.scope} onValueChange={(v) => setAnnForm((f) => ({ ...f, scope: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCOPES.map((code) => (
                      <SelectItem key={code} value={code}>{t(`ann_scope_${code}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {annForm.scope === 'tier' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('ann_field_tier')}</Label>
                  <Select value={annForm.tier_code} onValueChange={(v) => setAnnForm((f) => ({ ...f, tier_code: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIER_CODES.map((code) => (
                        <SelectItem key={code} value={code}>{t(`ann_tier_label_${code}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {annForm.scope === 'customer' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('ann_field_customer')}</Label>
                  <Select value={annForm.customer_id || ''} onValueChange={(v) => setAnnForm((f) => ({ ...f, customer_id: v }))}>
                    <SelectTrigger><SelectValue placeholder={t('ann_field_customer')} /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">{t('ann_field_starts')}</Label>
                <Input
                  type="datetime-local"
                  value={annForm.starts_at}
                  onChange={(e) => setAnnForm((f) => ({ ...f, starts_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('ann_field_ends')}</Label>
                <Input
                  type="datetime-local"
                  value={annForm.ends_at}
                  onChange={(e) => setAnnForm((f) => ({ ...f, ends_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2 lg:col-span-4">
                <Label className="text-xs">{t('ann_field_message')}</Label>
                <Textarea
                  rows={2}
                  value={annForm.message}
                  onChange={(e) => setAnnForm((f) => ({ ...f, message: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {annForm.scope === 'global'
                ? t('ann_scope_all_tenants_hint')
                : t('ann_field_window_hint')}
            </p>
            <Button size="sm" className="gap-2" onClick={() => publishAnnouncement.mutate()} disabled={publishAnnouncement.isPending}>
              <Megaphone className="w-3.5 h-3.5" /> {t('ann_publish')}
            </Button>
          </div>
        </CardContent>
      </Card>

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
                      <TableCell className="text-sm">{formatDateTime(last?.started_at)}</TableCell>
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
              <Select value={form.entity_name} onValueChange={chooseEntity}>
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
                  {entityActions(form.entity_name).map((code) => (
                    <SelectItem key={code} value={code}>{t(`ops_action_${code}`)}</SelectItem>
                  ))}
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
                  {(simulation.sample || []).map((row) => (
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
