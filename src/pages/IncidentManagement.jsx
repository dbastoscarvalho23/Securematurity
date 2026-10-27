import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Plus, Pencil, Loader2, Search, Clock, CheckCircle2, AlertOctagon, ListChecks } from 'lucide-react';
import IncidentPlanDialog from '@/components/incidents/IncidentPlanDialog';
import { nextIncidentAction } from '@/lib/incidentPlan';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { writeAuditLog } from '@/lib/auditLog';
import { formatDateTime, hoursRemaining, incidentDeadlines } from '@/lib/complianceUtils';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import EvidencePanel from '@/components/evidence/EvidencePanel';
import AiDraftDialog from '@/components/ai/AiDraftDialog';
import { INCIDENT_KINDS, useAiEnabled } from '@/lib/ai';
import { useLicense, hasModule } from '@/lib/licensing';
import { Sparkles } from 'lucide-react';

const CATEGORIES = ['malware_ransomware','data_breach','ddos','phishing','unauthorized_access','insider_threat','system_failure','physical_security','supply_chain','other'];

const STATUS_LABELS = {
  detected: 'inc_status_detected',
  investigating: 'inc_status_investigating',
  contained: 'inc_status_contained',
  resolved: 'inc_status_resolved',
  closed: 'inc_status_closed',
};

const SEVERITY_LABELS = {
  critical: 'risk_level_critical',
  high: 'risk_level_high',
  medium: 'risk_level_medium',
  low: 'risk_level_low',
};

const DEFAULT_FORM = {
  title: '', description: '', category: 'data_breach', severity: 'medium', status: 'detected',
  detected_at: '', affected_systems: '', affected_data_description: '', affected_individuals_count: 0,
  data_breach: false, personal_data_affected: false, assigned_to: '', impact_assessment: '',
  early_warning_sent: false, notification_sent: false, final_report_sent: false,
  supervisor_authority_notified: false, individuals_notified: false,
  reporting_regime: 'rjc', significant_verified_at: '', impact_ended_at: '', resolved_within_2h: false,
  end_of_impact_notification_sent: false, dora_classified_major_at: '',
};

// Campos de data/hora do incidente (formulário em hora local ↔ ISO na base de dados)
const DATETIME_FIELDS = ['detected_at', 'significant_verified_at', 'impact_ended_at', 'dora_classified_major_at',
  'early_warning_sent_at', 'notification_sent_at', 'final_report_sent_at', 'end_of_impact_notification_sent_at'];
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
// Momento de envio de cada notificação (inicia a contagem da fase seguinte). Ao marcar como enviada propõe-se
// a hora atual, que o utilizador pode corrigir para a hora real de envio.
const SENT_AT = {
  early_warning_sent: 'early_warning_sent_at', notification_sent: 'notification_sent_at',
  final_report_sent: 'final_report_sent_at', end_of_impact_notification_sent: 'end_of_impact_notification_sent_at',
};

function SentCheck({ form, set, flag, label, t }) {
  const at = SENT_AT[flag];
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!form[flag]} onChange={e => {
          set(flag, e.target.checked);
          if (e.target.checked && !form[at]) set(at, toLocalInput(new Date().toISOString()));
        }} /> {label}
      </label>
      {form[flag] && (
        <Input type="datetime-local" aria-label={`${label} — ${t('inc_sent_at')}`} title={t('inc_sent_at')} className="h-8 text-xs"
          value={form[at] || ''} onChange={e => set(at, e.target.value)} />
      )}
    </div>
  );
}

function DeadlineBadge({ phase, t }) {
  const label = t(phase.labelKey);
  if (phase.sent) return <Badge variant="outline" className="text-xs bg-chart-2/10 text-chart-2 border-chart-2/20"><CheckCircle2 className="w-3 h-3 mr-1" />{label}</Badge>;
  if (!phase.due) return <Badge variant="outline" className="text-xs text-muted-foreground" title={phase.ref}>{label}</Badge>;
  const ms = phase.due.getTime() - Date.now();
  const hours = Math.floor(ms / 3600000);
  if (ms < 0) return <Badge variant="outline" title={phase.ref} className={`text-xs ${phase.optional ? 'text-muted-foreground' : 'bg-destructive/10 text-destructive border-destructive/20'}`}><AlertOctagon className="w-3 h-3 mr-1" />{label} {t('inc_overdue')}</Badge>;
  const left = hours >= 48 ? `${Math.floor(hours / 24)}d` : `${hours}h`;
  return <Badge variant="outline" title={phase.ref} className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20"><Clock className="w-3 h-3 mr-1" />{label}: {left} {t('common_left')}</Badge>;
}

function GdprTimerBadge({ detected_at, sent, deadlineHours, label, overdueLabel, leftLabel }) {
  const hours = hoursRemaining(detected_at, deadlineHours);
  if (sent) return <Badge variant="outline" className="text-xs bg-chart-2/10 text-chart-2 border-chart-2/20"><CheckCircle2 className="w-3 h-3 mr-1" />{label}</Badge>;
  if (hours === null) return <Badge variant="outline" className="text-xs text-muted-foreground">{label}</Badge>;
  if (hours < 0) return <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20"><AlertOctagon className="w-3 h-3 mr-1" />{label} {overdueLabel}</Badge>;
  return <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20"><Clock className="w-3 h-3 mr-1" />{label}: {hours}h {leftLabel}</Badge>;
}

export default function IncidentManagement() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [aiIncident, setAiIncident] = useState(null);
  const [planIncident, setPlanIncident] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'admin';
  const { data: aiLicense } = useLicense(isAdmin ? editing?.customer_id || undefined : undefined);
  // Ponto de uso «documents» (Definições → Aplicação → Assistente de IA); a licença continua a ser verificada à parte.
  const aiDocs = useAiEnabled('documents');
  const customerId = user?.data?.customer_id || user?.customer_id;

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => base44.entities.Incident.list('-updated_date', 200),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: isAdmin,
  });

  const filtered = records.filter(r => {
    const matchSearch = !search || r.title?.toLowerCase().includes(search.toLowerCase());
    const matchSeverity = severityFilter === 'all' || r.severity === severityFilter;
    return matchSearch && matchSeverity;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...DEFAULT_FORM, detected_at: toLocalInput(new Date().toISOString()), customer_id: customerId });
    setDialogOpen(true);
  };

  const openEdit = (rec) => {
    setEditing(rec);
    setForm({ ...DEFAULT_FORM, ...rec, ...Object.fromEntries(DATETIME_FIELDS.map((f) => [f, toLocalInput(rec[f])])) });
    setDialogOpen(true);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form };
    for (const f of DATETIME_FIELDS) payload[f] = form[f] ? new Date(form[f]).toISOString() : null;
    for (const [flag, at] of Object.entries(SENT_AT)) {
      // Sem hora indicada (ex.: registos antigos) não se inventa uma: fica vazia até o utilizador a preencher.
      if (!payload[flag]) payload[at] = null;
    }
    if (isAdmin && !editing) {
      const c = customers.find(c => c.id === form.customer_id);
      payload.customer_name = c?.name || '';
    }
    try {
      if (editing) {
        await base44.entities.Incident.update(editing.id, payload);
        await writeAuditLog({ action: 'incident_updated', entity_type: 'Incident', entity_id: editing.id, details: `Incident updated: ${form.title}` });
      } else {
        const created = await base44.entities.Incident.create(payload);
        await writeAuditLog({ action: 'incident_created', entity_type: 'Incident', entity_id: created.id, details: `Incident created: ${form.title}` });
      }
      toast.success(editing ? t('inc_updated') : t('inc_created'));
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      setDialogOpen(false);
    } catch (e) {
      toast.error(t('common_save_failed'));
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description={t('inc_subtitle')}
        actions={<Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> {t('inc_new')}</Button>}
      />

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('inc_search_placeholder')} className="pl-9" />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('inc_filter_all_severities')}</SelectItem>
            <SelectItem value="critical">{t('risk_level_critical')}</SelectItem>
            <SelectItem value="high">{t('risk_level_high')}</SelectItem>
            <SelectItem value="medium">{t('risk_level_medium')}</SelectItem>
            <SelectItem value="low">{t('risk_level_low')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState label={t('common_loading')} className="py-12" />
          ) : filtered.length === 0 ? (
            <EmptyState compact icon={AlertTriangle} title={t('inc_empty')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('inc_col_incident')}</TableHead>
                  <TableHead>{t('common_severity')}</TableHead>
                  <TableHead>{t('common_status')}</TableHead>
                  <TableHead>{t('inc_col_detected')}</TableHead>
                  <TableHead>{t('inc_col_notifications')}</TableHead>
                  <TableHead className="w-24">{t('common_edit')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{t(`inc_cat_${r.category}`) || r.category?.replace(/_/g, ' ')}</p>
                      {r.incident_id && <p className="text-xs text-muted-foreground">{r.incident_id}</p>}
                    </TableCell>
                    <TableCell><StatusBadge variant="severity" status={r.severity} label={t(SEVERITY_LABELS[r.severity] || r.severity)} /></TableCell>
                    <TableCell><StatusBadge status={r.status} label={t(STATUS_LABELS[r.status] || r.status)} /></TableCell>
                    <TableCell><p className="text-xs">{formatDateTime(r.detected_at, language === 'pt' ? 'pt-PT' : 'en-GB')}</p></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {incidentDeadlines(r).map((p) => <DeadlineBadge key={p.id} phase={p} t={t} />)}
                        {r.data_breach && (
                          <GdprTimerBadge detected_at={r.detected_at} sent={r.supervisor_authority_notified} deadlineHours={72} label={t('inc_badge_sa')} overdueLabel={t('inc_overdue')} leftLabel={t('common_left')} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex">
                        <Button variant="ghost" size="icon" onClick={() => setPlanIncident(r)} aria-label={t('incplan_open')} title={t('incplan_open')}
                          className={nextIncidentAction(r).overdue ? 'text-destructive' : ''}><ListChecks className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)} aria-label={t('common_edit')}><Pencil className="w-3.5 h-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? t('inc_edit_title') : t('inc_new_title')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('inc_title')} *</Label>
              <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder={t('inc_ph_title')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('common_description')}</Label>
              <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder={t('inc_ph_description')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>{t('inc_category')}</Label>
                <Select value={form.category} onValueChange={v => set('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`inc_cat_${c}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('common_severity')}</Label>
                <Select value={form.severity} onValueChange={v => set('severity', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['critical','high','medium','low'].map(s => <SelectItem key={s} value={s}>{t(SEVERITY_LABELS[s])}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('common_status')}</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['detected','investigating','contained','resolved','closed'].map(s => <SelectItem key={s} value={s}>{t(STATUS_LABELS[s])}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('inc_detected_at')} *</Label>
                <Input type="datetime-local" value={form.detected_at} onChange={e => set('detected_at', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('common_assigned_to')}</Label>
                <Input value={form.assigned_to || ''} onChange={e => set('assigned_to', e.target.value)} placeholder={t('inc_ph_assigned_to')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('inc_affected_systems')}</Label>
              <Input value={form.affected_systems} onChange={e => set('affected_systems', e.target.value)} placeholder={t('inc_ph_systems')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('inc_affected_data')}</Label>
              <Textarea value={form.affected_data_description || ''} onChange={e => set('affected_data_description', e.target.value)} rows={2} placeholder={t('inc_ph_affected_data')} />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.data_breach} onChange={e => set('data_breach', e.target.checked)} /> {t('inc_data_breach')}</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.personal_data_affected} onChange={e => set('personal_data_affected', e.target.checked)} /> {t('inc_personal_data')}</label>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('inc_notif_status')}</p>
                <Select value={form.reporting_regime || 'rjc'} onValueChange={v => set('reporting_regime', v)}>
                  <SelectTrigger className="h-8 w-64 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rjc">{t('inc_regime_rjc')}</SelectItem>
                    <SelectItem value="dora">{t('inc_regime_dora')}</SelectItem>
                    <SelectItem value="nenhum">{t('inc_regime_none')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.reporting_regime !== 'dora' && form.reporting_regime !== 'nenhum' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('inc_significant_verified_at')}</Label>
                      <Input type="datetime-local" value={form.significant_verified_at || ''} onChange={e => set('significant_verified_at', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('inc_impact_ended_at')}</Label>
                      <Input type="datetime-local" value={form.impact_ended_at || ''} onChange={e => set('impact_ended_at', e.target.value)} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.resolved_within_2h} onChange={e => set('resolved_within_2h', e.target.checked)} /> {t('inc_resolved_within_2h')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {!form.resolved_within_2h && <SentCheck form={form} set={set} flag="early_warning_sent" label={t('inc_early_warning')} t={t} />}
                    {!form.resolved_within_2h && <SentCheck form={form} set={set} flag="notification_sent" label={t('inc_notification')} t={t} />}
                    <SentCheck form={form} set={set} flag="end_of_impact_notification_sent" label={t('inc_end_of_impact')} t={t} />
                    <SentCheck form={form} set={set} flag="final_report_sent" label={t('inc_final_report')} t={t} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t('inc_rjc_help')}</p>
                </>
              )}
              {form.reporting_regime === 'dora' && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('inc_dora_classified_at')}</Label>
                    <Input type="datetime-local" value={form.dora_classified_major_at || ''} onChange={e => set('dora_classified_major_at', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <SentCheck form={form} set={set} flag="early_warning_sent" label={t('inc_dora_initial')} t={t} />
                    <SentCheck form={form} set={set} flag="notification_sent" label={t('inc_dora_intermediate')} t={t} />
                    <SentCheck form={form} set={set} flag="final_report_sent" label={t('inc_dora_final')} t={t} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t('inc_dora_help')}</p>
                </>
              )}
              <div className="grid grid-cols-2 gap-2 border-t pt-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.supervisor_authority_notified} onChange={e => set('supervisor_authority_notified', e.target.checked)} /> {t('inc_sa_notified')}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.individuals_notified} onChange={e => set('individuals_notified', e.target.checked)} /> {t('inc_individuals_notified')}</label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('inc_impact_assessment')}</Label>
              <Textarea value={form.impact_assessment || ''} onChange={e => set('impact_assessment', e.target.value)} rows={2} placeholder={t('inc_ph_impact')} />
            </div>
            {isAdmin && !editing && (
              <div className="space-y-1.5">
                <Label>{t('common_customer')} *</Label>
                <Select value={form.customer_id || ''} onValueChange={v => { const c = customers.find(c => c.id === v); set('customer_id', v); set('customer_name', c?.name || ''); }}>
                  <SelectTrigger><SelectValue placeholder={t('common_select_customer')} /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {editing?.customer_id && (isAdmin || user?.role === 'customer_admin') && hasModule(aiLicense, user, 'ai_assistant') && aiDocs && (
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setAiIncident(editing)}><Sparkles className="w-3.5 h-3.5 mr-1" />{t('ai_incident_button')}</Button>
            )}
            {editing?.customer_id && (
              <EvidencePanel customerId={editing.customer_id}
                provider={customers.find((c) => c.id === editing.customer_id)?.storage_provider}
                links={[{ type: 'incident', id: editing.id, label: editing.title }]} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common_cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !form.title || !form.detected_at}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{t('common_save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <IncidentPlanDialog incident={planIncident} open={planIncident !== null} onOpenChange={(v) => !v && setPlanIncident(null)}
        canUseAi={aiDocs} canEdit />
      <AiDraftDialog open={aiIncident !== null} onOpenChange={(v) => !v && setAiIncident(null)} customerId={aiIncident?.customer_id}
        target={aiIncident ? { type: 'incident', id: aiIncident.id } : null} kinds={INCIDENT_KINDS} title={aiIncident ? `${t('ai_incident_button')} — ${aiIncident.title}` : ''} />
    </div>
  );
}