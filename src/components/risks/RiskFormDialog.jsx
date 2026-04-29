import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const CATEGORIES = [
  { value: 'access_control', label: 'Access Control' },
  { value: 'data_protection', label: 'Data Protection' },
  { value: 'network_security', label: 'Network Security' },
  { value: 'physical_security', label: 'Physical Security' },
  { value: 'third_party', label: 'Third Party' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'operational', label: 'Operational' },
  { value: 'other', label: 'Other' },
];

const SCORE_LABELS = { 1: 'Very Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Very High' };

function ScoreSelector({ label, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 h-9 rounded-md text-sm font-medium border transition-colors ${
              value === n
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-input hover:bg-muted'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {value && <p className="text-xs text-muted-foreground">{SCORE_LABELS[value]}</p>}
    </div>
  );
}

const DEFAULT = {
  risk_id: '', title: '', description: '', category: 'other', impact: 3, likelihood: 3,
  status: 'open', owner_email: '', treatment_notes: '', due_date: '',
  linked_document_ids: [], customer_id: '', customer_name: '',
};

export default function RiskFormDialog({ open, onOpenChange, risk, documents, customers, isAdmin, customerId, customerName, onSave }) {
  const [form, setForm] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (risk) setForm({ ...DEFAULT, ...risk });
    else setForm(DEFAULT);
  }, [risk, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleDoc = (id) => {
    setForm(f => ({
      ...f,
      linked_document_ids: f.linked_document_ids?.includes(id)
        ? f.linked_document_ids.filter(d => d !== id)
        : [...(f.linked_document_ids || []), id],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...form };
    if (!isAdmin) {
      data.customer_id = customerId;
      data.customer_name = customerName;
    } else if (form.customer_id) {
      const c = customers?.find(c => c.id === form.customer_id);
      data.customer_name = c?.name || '';
    }
    await onSave(data);
    setSaving(false);
  };

  const availableDocs = documents?.filter(d =>
    !form.customer_id || d.customer_id === form.customer_id || !d.customer_id
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{risk?.id ? 'Edit Risk' : 'New Risk'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Risk ID</Label>
              <Input value={form.risk_id} onChange={e => set('risk_id', e.target.value)} placeholder="e.g. RISK-001" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => set('title', e.target.value)} required placeholder="Brief risk description" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Detailed risk description..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_treatment">In Treatment</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScoreSelector label="Impact (1–5)" value={form.impact} onChange={v => set('impact', v)} />
          <ScoreSelector label="Likelihood (1–5)" value={form.likelihood} onChange={v => set('likelihood', v)} />

          {isAdmin && customers?.length > 0 && (
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select value={form.customer_id || ''} onValueChange={v => set('customer_id', v)}>
                <SelectTrigger><SelectValue placeholder="Global / All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Global / All</SelectItem>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Owner Email</Label>
              <Input value={form.owner_email} onChange={e => set('owner_email', e.target.value)} placeholder="risk.owner@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input value={form.due_date} onChange={e => set('due_date', e.target.value)} type="date" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Treatment Notes</Label>
            <Textarea value={form.treatment_notes} onChange={e => set('treatment_notes', e.target.value)} rows={2} placeholder="How is this risk being treated?" />
          </div>

          {availableDocs.length > 0 && (
            <div className="space-y-1.5">
              <Label>Linked Documents</Label>
              <div className="border rounded-lg p-2 max-h-36 overflow-y-auto space-y-1">
                {availableDocs.map(doc => {
                  const linked = form.linked_document_ids?.includes(doc.id);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => toggleDoc(doc.id)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                        linked ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${linked ? 'bg-primary' : 'bg-muted-foreground'}`} />
                      {doc.title}
                      <Badge variant="secondary" className="ml-auto text-xs capitalize">{doc.level}</Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {risk?.id ? 'Save Changes' : 'Create Risk'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}