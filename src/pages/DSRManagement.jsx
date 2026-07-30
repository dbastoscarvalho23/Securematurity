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
import { Users, Plus, Pencil, Loader2, Search, Clock, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { writeAuditLog } from '@/lib/auditLog';
import { SLA_STATUS_STYLES, slaStatus, daysRemaining, calculateDsrDueDate } from '@/lib/complianceUtils';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';

const REQUEST_TYPES = [
  { value: 'access', labelKey: 'dsr_type_access' },
  { value: 'rectification', labelKey: 'dsr_type_rectification' },
  { value: 'erasure', labelKey: 'dsr_type_erasure' },
  { value: 'restriction', labelKey: 'dsr_type_restriction' },
  { value: 'portability', labelKey: 'dsr_type_portability' },
  { value: 'objection', labelKey: 'dsr_type_objection' },
  { value: 'automated_decision', labelKey: 'dsr_type_automated_decision' },
];

const STATUS_LABELS = {
  received: 'dsr_status_received',
  identity_verification: 'dsr_status_identity_verification',
  in_progress: 'dsr_status_in_progress',
  completed: 'dsr_status_completed',
  rejected: 'dsr_status_rejected',
  withdrawn: 'dsr_status_withdrawn',
};

const DEFAULT_FORM = {
  request_type: 'access', status: 'received', data_subject_name: '', data_subject_email: '',
  data_subject_phone: '', received_date: '', assigned_to: '', description: '',
  identity_verified: false, third_party_consultation: false, extension_reason: '',
  response_summary: '', rejection_reason: '', data_exported: false, data_deleted: false,
};

export default function DSRManagement() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'admin';
  const customerId = user?.data?.customer_id || user?.customer_id;

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['dsrs'],
    queryFn: () => base44.entities.DataSubjectRequest.list('-updated_date', 200),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: isAdmin,
  });

  const filtered = records.filter(r => {
    const matchSearch = !search || r.data_subject_name?.toLowerCase().includes(search.toLowerCase()) || r.request_id?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...DEFAULT_FORM, received_date: new Date().toISOString().split('T')[0], customer_id: customerId });
    setDialogOpen(true);
  };

  const openEdit = (rec) => { setEditing(rec); setForm({ ...DEFAULT_FORM, ...rec }); setDialogOpen(true); };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const effectiveDueDate = (r) => r.extended_due_date || r.due_date;
  const overdueCount = records.filter(r => r.status !== 'completed' && r.status !== 'rejected' && daysRemaining(effectiveDueDate(r)) < 0).length;

  const handleSave = async () => {
    setSaving(true);
    const due = calculateDsrDueDate(form.received_date, form.third_party_consultation);
    const payload = { ...form, due_date: form.due_date || due };
    if (form.third_party_consultation && !form.extended_due_date) payload.extended_due_date = due;
    if (form.status === 'completed' && !form.completed_date) payload.completed_date = new Date().toISOString().split('T')[0];
    if (isAdmin && !editing) {
      const c = customers.find(c => c.id === form.customer_id);
      payload.customer_name = c?.name || '';
    }
    try {
      if (editing) {
        await base44.entities.DataSubjectRequest.update(editing.id, payload);
        await writeAuditLog({ action: form.status === 'completed' ? 'dsr_completed' : 'dsr_updated', entity_type: 'DataSubjectRequest', entity_id: editing.id, details: `DSR updated: ${form.data_subject_name} (${form.request_type})` });
        if (form.data_exported) await writeAuditLog({ action: 'data_exported', entity_type: 'DataSubjectRequest', entity_id: editing.id, details: `Data exported for DSR: ${form.data_subject_name}` });
        if (form.data_deleted) await writeAuditLog({ action: 'data_deleted', entity_type: 'DataSubjectRequest', entity_id: editing.id, details: `Data deleted for DSR: ${form.data_subject_name}` });
      } else {
        const created = await base44.entities.DataSubjectRequest.create(payload);
        await writeAuditLog({ action: 'dsr_created', entity_type: 'DataSubjectRequest', entity_id: created.id, details: `DSR created: ${form.data_subject_name} (${form.request_type})` });
      }
      toast.success(editing ? t('dsr_updated') : t('dsr_created'));
      queryClient.invalidateQueries({ queryKey: ['dsrs'] });
      setDialogOpen(false);
    } catch (e) {
      toast.error(t('common_save_failed'));
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description={t('dsr_subtitle')}
        actions={
          <div className="flex items-center gap-3">
            {overdueCount > 0 && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><AlertOctagon className="w-3 h-3 mr-1" />{overdueCount} {t('dsr_overdue')}</Badge>}
            <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> {t('dsr_new')}</Button>
          </div>
        }
      />

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('dsr_search_placeholder')} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('dsr_filter_all_statuses')}</SelectItem>
            <SelectItem value="received">{t('dsr_status_received')}</SelectItem>
            <SelectItem value="identity_verification">{t('dsr_status_identity_verification')}</SelectItem>
            <SelectItem value="in_progress">{t('dsr_status_in_progress')}</SelectItem>
            <SelectItem value="completed">{t('dsr_status_completed')}</SelectItem>
            <SelectItem value="rejected">{t('dsr_status_rejected')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState label={t('common_loading')} className="py-12" />
          ) : filtered.length === 0 ? (
            <EmptyState compact icon={Users} title={t('dsr_empty')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('dsr_col_request')}</TableHead>
                  <TableHead>{t('dsr_col_type')}</TableHead>
                  <TableHead>{t('common_status')}</TableHead>
                  <TableHead>{t('dsr_col_received')}</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead className="w-16">{t('common_edit')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => {
                  const due = effectiveDueDate(r);
                  const st = slaStatus(due);
                  const days = daysRemaining(due);
                  const isClosed = r.status === 'completed' || r.status === 'rejected';
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <p className="font-medium">{r.data_subject_name}</p>
                        <p className="text-xs text-muted-foreground">{r.data_subject_email}</p>
                        {r.request_id && <p className="text-xs text-muted-foreground">{r.request_id}</p>}
                      </TableCell>
                      <TableCell><span className="text-xs">{(REQUEST_TYPES.find(ty => ty.value === r.request_type)?.labelKey ? t(REQUEST_TYPES.find(ty => ty.value === r.request_type).labelKey) : r.request_type).split(' (')[0]}</span></TableCell>
                      <TableCell><StatusBadge status={r.status} label={t(STATUS_LABELS[r.status] || r.status)} /></TableCell>
                      <TableCell><p className="text-xs">{r.received_date}</p></TableCell>
                      <TableCell>
                        {isClosed ? (
                          <Badge variant="outline" className="text-xs bg-chart-2/10 text-chart-2 border-chart-2/20"><CheckCircle2 className="w-3 h-3 mr-1" />{t('dsr_sla_done')}</Badge>
                        ) : (
                          <Badge variant="outline" className={`text-xs ${SLA_STATUS_STYLES[st] || ''}`}>
                            {days < 0 ? <AlertOctagon className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                            {days < 0 ? `${Math.abs(days)}d ${t('dsr_overdue')}` : `${days}d`}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? t('dsr_edit_title') : t('dsr_new_title')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('dsr_request_type')} *</Label>
                <Select value={form.request_type} onValueChange={v => set('request_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REQUEST_TYPES.map(ty => <SelectItem key={ty.value} value={ty.value}>{t(ty.labelKey)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('common_status')}</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['received','identity_verification','in_progress','completed','rejected','withdrawn'].map(s => <SelectItem key={s} value={s}>{t(STATUS_LABELS[s] || s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('dsr_data_subject_name')} *</Label>
                <Input value={form.data_subject_name} onChange={e => set('data_subject_name', e.target.value)} placeholder={t('dsr_ph_full_name')} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('suppliers_form_email')}</Label>
                <Input value={form.data_subject_email} onChange={e => set('data_subject_email', e.target.value)} placeholder="email@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('dsr_received_date')} *</Label>
                <Input type="date" value={form.received_date} onChange={e => set('received_date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('common_not_assigned')}</Label>
                <Input value={form.assigned_to || ''} onChange={e => set('assigned_to', e.target.value)} placeholder="handler@email.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('common_description')}</Label>
              <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder={t('dsr_ph_description')} />
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('dsr_processing')}</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.identity_verified} onChange={e => set('identity_verified', e.target.checked)} /> {t('dsr_identity_verified')}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.third_party_consultation} onChange={e => set('third_party_consultation', e.target.checked)} /> {t('dsr_third_party')}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.data_exported} onChange={e => set('data_exported', e.target.checked)} /> {t('dsr_data_exported')}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.data_deleted} onChange={e => set('data_deleted', e.target.checked)} /> {t('dsr_data_deleted')}</label>
              </div>
              {form.third_party_consultation && (
                <div className="space-y-1.5 mt-2">
                  <Label>{t('dsr_extension_reason')}</Label>
                  <Input value={form.extension_reason || ''} onChange={e => set('extension_reason', e.target.value)} placeholder={t('dsr_ph_extension')} />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t('dsr_response_summary')}</Label>
              <Textarea value={form.response_summary || ''} onChange={e => set('response_summary', e.target.value)} rows={2} placeholder={t('dsr_ph_response')} />
            </div>
            {form.status === 'rejected' && (
              <div className="space-y-1.5">
                <Label>{t('dsr_rejection_reason')}</Label>
                <Textarea value={form.rejection_reason || ''} onChange={e => set('rejection_reason', e.target.value)} rows={2} placeholder={t('dsr_ph_rejection')} />
              </div>
            )}
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
            <Button onClick={handleSave} disabled={saving || !form.data_subject_name || !form.received_date}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{t('common_save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}