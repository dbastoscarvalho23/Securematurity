import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Database, Plus, Pencil, Trash2, Loader2, Search, FileText } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { writeAuditLog } from '@/lib/auditLog';
import { STATUS_STYLES } from '@/lib/complianceUtils';
import { toast } from 'sonner';

const LEGAL_BASES = [
  { value: 'consent', key: 'ropa_lb_consent' },
  { value: 'contract', key: 'ropa_lb_contract' },
  { value: 'legal_obligation', key: 'ropa_lb_legal_obligation' },
  { value: 'vital_interests', key: 'ropa_lb_vital_interests' },
  { value: 'public_task', key: 'ropa_lb_public_task' },
  { value: 'legitimate_interests', key: 'ropa_lb_legitimate_interests' },
];

const STATUS_LABELS = { active: 'ropa_status_active', inactive: 'ropa_status_inactive', draft: 'ropa_status_draft' };

const DEFAULT_FORM = {
  activity_name: '', purpose: '', legal_basis: 'consent', data_subjects: '',
  data_categories: '', special_categories: false, recipients: '', third_country_transfers: '',
  transfer_safeguards: '', retention_period: '', retention_action: 'delete',
  retention_expiry_date: '', processor_name: '', processor_contact: '', dpo_name: '',
  dpo_contact: '', security_measures: '', status: 'draft', last_reviewed: '', next_review: '',
};

export default function RoPA() {
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
    queryKey: ['ropa'],
    queryFn: () => base44.entities.DataProcessingActivity.list('-updated_date', 200),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: isAdmin,
  });

  const filtered = records.filter(r => {
    const matchSearch = !search ||
      r.activity_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.purpose?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...DEFAULT_FORM, customer_id: customerId });
    setDialogOpen(true);
  };

  const openEdit = (rec) => {
    setEditing(rec);
    setForm({
      ...DEFAULT_FORM,
      ...rec,
      data_subjects: (rec.data_subjects || []).join(', '),
      data_categories: (rec.data_categories || []).join(', '),
      third_country_transfers: (rec.third_country_transfers || []).join(', '),
    });
    setDialogOpen(true);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      ...form,
      data_subjects: form.data_subjects.split(',').map(s => s.trim()).filter(Boolean),
      data_categories: form.data_categories.split(',').map(s => s.trim()).filter(Boolean),
      third_country_transfers: form.third_country_transfers.split(',').map(s => s.trim()).filter(Boolean),
    };
    if (isAdmin && !editing) {
      const c = customers.find(c => c.id === form.customer_id);
      payload.customer_name = c?.name || '';
    }
    try {
      if (editing) {
        await base44.entities.DataProcessingActivity.update(editing.id, payload);
        await writeAuditLog({ action: 'ropa_updated', entity_type: 'DataProcessingActivity', entity_id: editing.id, details: `RoPA updated: ${form.activity_name}` });
      } else {
        const created = await base44.entities.DataProcessingActivity.create(payload);
        await writeAuditLog({ action: 'ropa_created', entity_type: 'DataProcessingActivity', entity_id: created.id, details: `RoPA created: ${form.activity_name}` });
      }
      toast.success(editing ? t('ropa_updated') : t('ropa_created'));
      queryClient.invalidateQueries({ queryKey: ['ropa'] });
      setDialogOpen(false);
    } catch (e) {
      toast.error(t('common_save_failed'));
    }
    setSaving(false);
  };

  const handleDelete = async (rec) => {
    if (!confirm(t('ropa_delete_confirm').replace('{name}', rec.activity_name))) return;
    await base44.entities.DataProcessingActivity.delete(rec.id);
    await writeAuditLog({ action: 'ropa_deleted', entity_type: 'DataProcessingActivity', entity_id: rec.id, details: `RoPA deleted: ${rec.activity_name}` });
    toast.success(t('ropa_deleted'));
    queryClient.invalidateQueries({ queryKey: ['ropa'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Database className="w-6 h-6" /> {t('page_ropa')}</h1>
          <p className="text-sm text-muted-foreground">{t('ropa_subtitle')}</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> {t('ropa_new')}</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('ropa_search_placeholder')} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('ropa_filter_all_statuses')}</SelectItem>
            <SelectItem value="active">{t('ropa_status_active')}</SelectItem>
            <SelectItem value="inactive">{t('ropa_status_inactive')}</SelectItem>
            <SelectItem value="draft">{t('ropa_status_draft')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>{t('ropa_empty')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('ropa_col_activity')}</TableHead>
                  <TableHead>{t('ropa_col_legal_basis')}</TableHead>
                  <TableHead>{t('ropa_col_retention')}</TableHead>
                  <TableHead>{t('common_status')}</TableHead>
                  <TableHead className="w-20">{t('common_actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium">{r.activity_name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-xs">{r.purpose}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{(LEGAL_BASES.find(b => b.value === r.legal_basis)?.key ? t(LEGAL_BASES.find(b => b.value === r.legal_basis).key) : r.legal_basis).split(' (')[0]}</span>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs">{r.retention_period || '—'}</p>
                      {r.retention_expiry_date && <p className="text-xs text-muted-foreground">{t('ropa_exp')}: {r.retention_expiry_date}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${STATUS_STYLES[r.status] || ''}`}>{t(STATUS_LABELS[r.status] || r.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(r)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? t('ropa_edit_title') : t('ropa_new_title')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('ropa_activity_name')} *</Label>
              <Input value={form.activity_name} onChange={e => set('activity_name', e.target.value)} placeholder={t('ropa_ph_activity')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('ropa_purpose')} *</Label>
              <Textarea value={form.purpose} onChange={e => set('purpose', e.target.value)} rows={2} placeholder={t('ropa_ph_purpose')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('ropa_legal_basis')} *</Label>
                <Select value={form.legal_basis} onValueChange={v => set('legal_basis', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEGAL_BASES.map(b => <SelectItem key={b.value} value={b.value}>{t(b.key)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('common_status')}</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t('ropa_status_draft')}</SelectItem>
                    <SelectItem value="active">{t('ropa_status_active')}</SelectItem>
                    <SelectItem value="inactive">{t('ropa_status_inactive')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('ropa_data_subjects')}</Label>
                <Input value={form.data_subjects} onChange={e => set('data_subjects', e.target.value)} placeholder={t('ropa_ph_subjects')} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('ropa_data_categories')}</Label>
                <Input value={form.data_categories} onChange={e => set('data_categories', e.target.value)} placeholder={t('ropa_ph_categories')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('ropa_retention_period')}</Label>
                <Input value={form.retention_period} onChange={e => set('retention_period', e.target.value)} placeholder={t('ropa_ph_retention')} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('ropa_retention_action')}</Label>
                <Select value={form.retention_action} onValueChange={v => set('retention_action', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delete">{t('ropa_action_delete')}</SelectItem>
                    <SelectItem value="anonymize">{t('ropa_action_anonymize')}</SelectItem>
                    <SelectItem value="archive">{t('ropa_action_archive')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('ropa_retention_expiry')}</Label>
                <Input type="date" value={form.retention_expiry_date || ''} onChange={e => set('retention_expiry_date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('ropa_next_review')}</Label>
                <Input type="date" value={form.next_review || ''} onChange={e => set('next_review', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('ropa_processor_name')}</Label>
              <Input value={form.processor_name} onChange={e => set('processor_name', e.target.value)} placeholder={t('ropa_ph_processor')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('ropa_dpo_name')}</Label>
              <Input value={form.dpo_name} onChange={e => set('dpo_name', e.target.value)} placeholder={t('ropa_ph_dpo')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('ropa_security_measures')}</Label>
              <Textarea value={form.security_measures} onChange={e => set('security_measures', e.target.value)} rows={2} placeholder={t('ropa_ph_measures')} />
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
            <Button onClick={handleSave} disabled={saving || !form.activity_name || !form.purpose}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{t('common_save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}