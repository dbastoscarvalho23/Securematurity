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
import { writeAuditLog } from '@/lib/auditLog';
import { STATUS_STYLES, SLA_STATUS_STYLES, slaStatus, daysRemaining, calculateDsrDueDate } from '@/lib/complianceUtils';
import { toast } from 'sonner';

const REQUEST_TYPES = [
  { value: 'access', label: 'Access (Art. 15)' },
  { value: 'rectification', label: 'Rectification (Art. 16)' },
  { value: 'erasure', label: 'Erasure (Art. 17)' },
  { value: 'restriction', label: 'Restriction (Art. 18)' },
  { value: 'portability', label: 'Portability (Art. 20)' },
  { value: 'objection', label: 'Objection (Art. 21)' },
  { value: 'automated_decision', label: 'Automated Decision (Art. 22)' },
];

const DEFAULT_FORM = {
  request_type: 'access', status: 'received', data_subject_name: '', data_subject_email: '',
  data_subject_phone: '', received_date: '', assigned_to: '', description: '',
  identity_verified: false, third_party_consultation: false, extension_reason: '',
  response_summary: '', rejection_reason: '', data_exported: false, data_deleted: false,
};

export default function DSRManagement() {
  const { user } = useAuth();
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
      toast.success(editing ? 'Request updated' : 'Request created');
      queryClient.invalidateQueries({ queryKey: ['dsrs'] });
      setDialogOpen(false);
    } catch (e) {
      toast.error('Failed to save');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6" /> Data Subject Requests</h1>
          <p className="text-sm text-muted-foreground">GDPR Articles 15-22 — DSAR management with 1-month SLA tracking</p>
        </div>
        <div className="flex items-center gap-3">
          {overdueCount > 0 && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><AlertOctagon className="w-3 h-3 mr-1" />{overdueCount} overdue</Badge>}
          <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> New Request</Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="identity_verification">Identity Verification</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Users className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No data subject requests recorded.</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead className="w-16">Edit</TableHead>
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
                      <TableCell><span className="text-xs">{REQUEST_TYPES.find(t => t.value === r.request_type)?.label.split(' (')[0] || r.request_type}</span></TableCell>
                      <TableCell><Badge variant="outline" className={`text-xs ${STATUS_STYLES[r.status] || ''}`}>{r.status?.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell><p className="text-xs">{r.received_date}</p></TableCell>
                      <TableCell>
                        {isClosed ? (
                          <Badge variant="outline" className="text-xs bg-chart-2/10 text-chart-2 border-chart-2/20"><CheckCircle2 className="w-3 h-3 mr-1" />Done</Badge>
                        ) : (
                          <Badge variant="outline" className={`text-xs ${SLA_STATUS_STYLES[st] || ''}`}>
                            {days < 0 ? <AlertOctagon className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                            {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Request' : 'New Data Subject Request'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Request Type *</Label>
                <Select value={form.request_type} onValueChange={v => set('request_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REQUEST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['received','identity_verification','in_progress','completed','rejected','withdrawn'].map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data Subject Name *</Label>
                <Input value={form.data_subject_name} onChange={e => set('data_subject_name', e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={form.data_subject_email} onChange={e => set('data_subject_email', e.target.value)} placeholder="email@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Received Date *</Label>
                <Input type="date" value={form.received_date} onChange={e => set('received_date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Assigned To</Label>
                <Input value={form.assigned_to || ''} onChange={e => set('assigned_to', e.target.value)} placeholder="handler@email.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Request details from the data subject..." />
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Processing</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.identity_verified} onChange={e => set('identity_verified', e.target.checked)} /> Identity Verified</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.third_party_consultation} onChange={e => set('third_party_consultation', e.target.checked)} /> Third Party Consultation (+2 months)</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.data_exported} onChange={e => set('data_exported', e.target.checked)} /> Data Exported</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.data_deleted} onChange={e => set('data_deleted', e.target.checked)} /> Data Deleted</label>
              </div>
              {form.third_party_consultation && (
                <div className="space-y-1.5 mt-2">
                  <Label>Extension Reason</Label>
                  <Input value={form.extension_reason || ''} onChange={e => set('extension_reason', e.target.value)} placeholder="Reason for 2-month extension..." />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Response Summary</Label>
              <Textarea value={form.response_summary || ''} onChange={e => set('response_summary', e.target.value)} rows={2} placeholder="Summary of actions taken..." />
            </div>
            {form.status === 'rejected' && (
              <div className="space-y-1.5">
                <Label>Rejection Reason</Label>
                <Textarea value={form.rejection_reason || ''} onChange={e => set('rejection_reason', e.target.value)} rows={2} placeholder="Reason for rejection..." />
              </div>
            )}
            {isAdmin && !editing && (
              <div className="space-y-1.5">
                <Label>Customer *</Label>
                <Select value={form.customer_id || ''} onValueChange={v => { const c = customers.find(c => c.id === v); set('customer_id', v); set('customer_name', c?.name || ''); }}>
                  <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.data_subject_name || !form.received_date}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}