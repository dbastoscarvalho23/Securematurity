import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { Upload, Loader2, FileText, X } from 'lucide-react';

const ROLE_TYPES = [
  { value: 'risk_officer', label: 'Risk Officer Manager' },
  { value: 'risk_committee', label: 'Risk Committee' },
  { value: 'cybersecurity_manager', label: 'Cybersecurity Manager' },
  { value: 'cybersecurity_committee', label: 'Cybersecurity Committee' },
  { value: 'dpo', label: 'Data Protection Officer (DPO)' },
  { value: 'ciso', label: 'CISO / Chief Information Security Officer' },
  { value: 'incident_response_lead', label: 'Incident Response Lead' },
  { value: 'compliance_officer', label: 'Compliance Officer' },
  { value: 'other', label: 'Other Governance Role' },
];

const DEFAULT = { title: '', role_type: '', nominated_person: '', nomination_date: '', expiry_date: '', status: 'draft', description: '', file_url: '', file_name: '' };

export default function NominationDocumentDialog({ open, onOpenChange, doc, customers, isAdmin, onSave }) {
  const [form, setForm] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (doc) setForm({ ...DEFAULT, ...doc });
    else setForm(DEFAULT);
  }, [doc, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('file_url', file_url);
    set('file_name', file.name);
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{doc?.id ? 'Edit Nomination Document' : 'New Nomination Document'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Appointment of Risk Officer Manager" required />
          </div>

          <div className="space-y-1.5">
            <Label>Governance Role *</Label>
            <Select value={form.role_type} onValueChange={v => set('role_type', v)} required>
              <SelectTrigger><SelectValue placeholder="Select role type..." /></SelectTrigger>
              <SelectContent>
                {ROLE_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nominated Person / Committee</Label>
              <Input value={form.nominated_person} onChange={e => set('nominated_person', e.target.value)} placeholder="Full name or committee name" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nomination Date</Label>
              <Input type="date" value={form.nomination_date} onChange={e => set('nomination_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry / Renewal Date</Label>
              <Input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
            </div>
          </div>

          {isAdmin && customers?.length > 0 && (
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select value={form.customer_id || ''} onValueChange={v => { const c = customers.find(x => x.id === v); set('customer_id', v); set('customer_name', c?.name || ''); }}>
                <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Approved By</Label>
            <Input value={form.approved_by || ''} onChange={e => set('approved_by', e.target.value)} placeholder="Name of approver / signing authority" />
          </div>

          <div className="space-y-1.5">
            <Label>Approved Date</Label>
            <Input type="date" value={form.approved_date || ''} onChange={e => set('approved_date', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Notes / Context</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Additional context, mandate scope, etc." rows={2} />
          </div>

          {/* File upload */}
          <div className="space-y-1.5">
            <Label>Document File</Label>
            {form.file_url ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border text-sm">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <a href={form.file_url} target="_blank" rel="noreferrer" className="text-primary underline flex-1 truncate">{form.file_name || 'View file'}</a>
                <button type="button" onClick={() => { set('file_url', ''); set('file_name', ''); }} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer border border-dashed rounded-lg px-4 py-3 hover:bg-muted/30 transition-colors">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
                <span className="text-sm text-muted-foreground">{uploading ? 'Uploading...' : 'Click to upload nomination document (PDF, DOCX, etc.)'}</span>
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" disabled={uploading} />
              </label>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || uploading || !form.title || !form.role_type}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {doc?.id ? 'Save Changes' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}