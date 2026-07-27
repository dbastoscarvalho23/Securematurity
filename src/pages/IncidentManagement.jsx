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
import { writeAuditLog } from '@/lib/auditLog';
import { SEVERITY_STYLES, STATUS_STYLES, formatDateTime, hoursRemaining, daysRemaining } from '@/lib/complianceUtils';
import { toast } from 'sonner';

const CATEGORIES = ['malware_ransomware','data_breach','ddos','phishing','unauthorized_access','insider_threat','system_failure','physical_security','supply_chain','other'];

const DEFAULT_FORM = {
  title: '', description: '', category: 'data_breach', severity: 'medium', status: 'detected',
  detected_at: '', affected_systems: '', affected_data_description: '', affected_individuals_count: 0,
  data_breach: false, personal_data_affected: false, assigned_to: '', impact_assessment: '',
  early_warning_sent: false, notification_sent: false, final_report_sent: false,
  supervisor_authority_notified: false, individuals_notified: false,
};

function Nis2TimerBadge({ detected_at, sent, deadlineHours, label }) {
  const hours = hoursRemaining(detected_at, deadlineHours);
  if (sent) return <Badge variant="outline" className="text-xs bg-chart-2/10 text-chart-2 border-chart-2/20"><CheckCircle2 className="w-3 h-3 mr-1" />{label}</Badge>;
  if (hours === null) return <Badge variant="outline" className="text-xs text-muted-foreground">{label}</Badge>;
  if (hours < 0) return <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20"><AlertOctagon className="w-3 h-3 mr-1" />{label} overdue</Badge>;
  return <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20"><Clock className="w-3 h-3 mr-1" />{label}: {hours}h left</Badge>;
}

export default function IncidentManagement() {
  const { user } = useAuth();
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
      toast.success(editing ? 'Incident updated' : 'Incident created');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
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
          <h1 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle className="w-6 h-6" /> Incident Management</h1>
          <p className="text-sm text-muted-foreground">NIS2 Article 23 — Incident reporting with notification timers</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> New Incident</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search incidents..." className="pl-9" />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No incidents recorded.</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Incident</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead>NIS2 Notifications</TableHead>
                  <TableHead className="w-16">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{r.category?.replace(/_/g, ' ')}</p>
                      {r.incident_id && <p className="text-xs text-muted-foreground">{r.incident_id}</p>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className={`text-xs ${SEVERITY_STYLES[r.severity] || ''}`}>{r.severity}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={`text-xs ${STATUS_STYLES[r.status] || ''}`}>{r.status?.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell><p className="text-xs">{formatDateTime(r.detected_at)}</p></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Nis2TimerBadge detected_at={r.detected_at} sent={r.early_warning_sent} deadlineHours={24} label="Early Warning" />
                        <Nis2TimerBadge detected_at={r.detected_at} sent={r.notification_sent} deadlineHours={72} label="Notification" />
                        {r.data_breach && (
                          <Nis2TimerBadge detected_at={r.detected_at} sent={r.supervisor_authority_notified} deadlineHours={72} label="SA Notified" />
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Incident' : 'New Incident'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Brief incident title" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="What happened..." />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => set('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={v => set('severity', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['critical','high','medium','low'].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['detected','investigating','contained','resolved','closed'].map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Detected At *</Label>
                <Input type="datetime-local" value={form.detected_at} onChange={e => set('detected_at', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Assigned To</Label>
                <Input value={form.assigned_to || ''} onChange={e => set('assigned_to', e.target.value)} placeholder="responder@email.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Affected Systems (comma-separated)</Label>
              <Input value={form.affected_systems} onChange={e => set('affected_systems', e.target.value)} placeholder="Email server, CRM..." />
            </div>
            <div className="space-y-1.5">
              <Label>Affected Data Description</Label>
              <Textarea value={form.affected_data_description || ''} onChange={e => set('affected_data_description', e.target.value)} rows={2} placeholder="What data was affected..." />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.data_breach} onChange={e => set('data_breach', e.target.checked)} /> Data Breach</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.personal_data_affected} onChange={e => set('personal_data_affected', e.target.checked)} /> Personal Data Affected</label>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">NIS2 / GDPR Notification Status</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.early_warning_sent} onChange={e => set('early_warning_sent', e.target.checked)} /> Early Warning sent (24h)</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.notification_sent} onChange={e => set('notification_sent', e.target.checked)} /> Full Notification sent (72h)</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.supervisor_authority_notified} onChange={e => set('supervisor_authority_notified', e.target.checked)} /> Supervisory Authority notified</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.individuals_notified} onChange={e => set('individuals_notified', e.target.checked)} /> Individuals notified</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.final_report_sent} onChange={e => set('final_report_sent', e.target.checked)} /> Final Report sent (1 month)</label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Impact Assessment</Label>
              <Textarea value={form.impact_assessment || ''} onChange={e => set('impact_assessment', e.target.value)} rows={2} placeholder="Assessment of impact..." />
            </div>
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
            <Button onClick={handleSave} disabled={saving || !form.title || !form.detected_at}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}