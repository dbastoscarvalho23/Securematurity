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
import { AlertTriangle, Plus, Pencil, Loader2, Search, Clock, CheckCircle2, AlertOctagon } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { writeAuditLog } from '@/lib/auditLog';
import { formatDateTime, hoursRemaining, daysRemaining } from '@/lib/complianceUtils';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';

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
};

function Nis2TimerBadge({ detected_at, sent, deadlineHours, label, overdueLabel, leftLabel }) {
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
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'admin';
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
    setForm({ ...DEFAULT_FORM, detected_at: new Date().toISOString().slice(0, 16), customer_id: customerId });
    setDialogOpen(true);
  };

  const openEdit = (rec) => {
    setEditing(rec);
    setForm({ ...DEFAULT_FORM, ...rec, detected_at: rec.detected_at?.slice(0, 16) || '' });
    setDialogOpen(true);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, detected_at: form.detected_at ? new Date(form.detected_at).toISOString() : null };
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
                  <TableHead className="w-16">{t('common_edit')}</TableHead>
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
                        <Nis2TimerBadge detected_at={r.detected_at} sent={r.early_warning_sent} deadlineHours={24} label={t('inc_badge_early_warning')} overdueLabel={t('inc_overdue')} leftLabel={t('common_left')} />
                        <Nis2TimerBadge detected_at={r.detected_at} sent={r.notification_sent} deadlineHours={72} label={t('inc_badge_notification')} overdueLabel={t('inc_overdue')} leftLabel={t('common_left')} />
                        {r.data_breach && (
                          <Nis2TimerBadge detected_at={r.detected_at} sent={r.supervisor_authority_notified} deadlineHours={72} label={t('inc_badge_sa')} overdueLabel={t('inc_overdue')} leftLabel={t('common_left')} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button></TableCell>
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
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('inc_notif_status')}</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.early_warning_sent} onChange={e => set('early_warning_sent', e.target.checked)} /> {t('inc_early_warning')}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.notification_sent} onChange={e => set('notification_sent', e.target.checked)} /> {t('inc_notification')}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.supervisor_authority_notified} onChange={e => set('supervisor_authority_notified', e.target.checked)} /> {t('inc_sa_notified')}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.individuals_notified} onChange={e => set('individuals_notified', e.target.checked)} /> {t('inc_individuals_notified')}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.final_report_sent} onChange={e => set('final_report_sent', e.target.checked)} /> {t('inc_final_report')}</label>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common_cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !form.title || !form.detected_at}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{t('common_save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}