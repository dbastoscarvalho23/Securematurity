import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const DEFAULT = {
  title: '', level: 'policy', status: 'draft', description: '',
  version: '', approved_by: '', approved_date: '', review_date: '',
  file_url: '', file_name: '', tags: [], framework_codes: [],
  customer_id: '', customer_name: '',
};

export default function SecurityDocumentDialog({ open, onOpenChange, doc, customers, isAdmin, isUser, onSave }) {
  const { user } = useAuth();
  const [form, setForm] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [frameworksInput, setFrameworksInput] = useState('');
  const [changeNote, setChangeNote] = useState('');

  useEffect(() => {
    if (doc) {
      setForm({ ...DEFAULT, ...doc });
      setTagsInput((doc.tags || []).join(', '));
      setFrameworksInput((doc.framework_codes || []).join(', '));
    } else {
      setForm(DEFAULT);
      setTagsInput('');
      setFrameworksInput('');
    }
    setChangeNote('');
  }, [doc, open]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('file_url', file_url);
    set('file_name', file.name);
    setUploading(false);
    toast.success('File uploaded');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    const framework_codes = frameworksInput.split(',').map(f => f.trim()).filter(Boolean);
    // If editing an existing doc, snapshot the current state as a version before saving
    if (doc?.id) {
      await base44.entities.DocumentVersion.create({
        document_id: doc.id,
        version_label: doc.version,
        title: doc.title,
        description: doc.description,
        level: doc.level,
        status: doc.status,
        file_url: doc.file_url,
        file_name: doc.file_name,
        approved_by: doc.approved_by,
        approved_date: doc.approved_date,
        review_date: doc.review_date,
        tags: doc.tags,
        framework_codes: doc.framework_codes,
        changed_by: user?.email,
        change_note: changeNote || 'Document updated',
      });
    }
    await onSave({ ...form, tags, framework_codes });
    setSaving(false);
  };

  const handleCustomerChange = (id) => {
    const c = customers.find(c => c.id === id);
    setForm(f => ({ ...f, customer_id: id, customer_name: c?.name || '' }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {doc?.id ? 'Edit Document' : 'New Document'}
            {isUser && <span className="text-xs font-normal text-muted-foreground ml-2">(will be submitted for approval)</span>}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} required placeholder="Document title" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Level *</Label>
              <Select value={form.level} onValueChange={v => set('level', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="policy">L1 — Policy</SelectItem>
                  <SelectItem value="standard">L2 — Standard</SelectItem>
                  <SelectItem value="procedure">L3 — Procedure</SelectItem>
                  <SelectItem value="playbook">L4 — Playbook / Runbook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!isUser && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="deprecated">Deprecated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Brief description..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Version</Label>
              <Input value={form.version} onChange={e => set('version', e.target.value)} placeholder="e.g. 1.0" />
            </div>
            <div className="space-y-1.5">
              <Label>Approved By</Label>
              <Input value={form.approved_by} onChange={e => set('approved_by', e.target.value)} placeholder="Name or role" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Approval Date</Label>
              <Input value={form.approved_date} onChange={e => set('approved_date', e.target.value)} type="date" />
            </div>
            <div className="space-y-1.5">
              <Label>Next Review Date</Label>
              <Input value={form.review_date} onChange={e => set('review_date', e.target.value)} type="date" />
            </div>
          </div>

          {isAdmin && customers.length > 0 && (
            <div className="space-y-1.5">
              <Label>Customer (optional)</Label>
              <Select value={form.customer_id || ''} onValueChange={handleCustomerChange}>
                <SelectTrigger><SelectValue placeholder="Global (all customers)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Global (all customers)</SelectItem>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Framework Codes (comma-separated)</Label>
            <Input value={frameworksInput} onChange={e => setFrameworksInput(e.target.value)} placeholder="e.g. NIS2, ISO27001, GDPR" />
          </div>

          <div className="space-y-1.5">
            <Label>Tags (comma-separated)</Label>
            <Input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="e.g. access-control, privacy, backup" />
          </div>

          <div className="space-y-1.5">
            <Label>Document File</Label>
            {form.file_name && (
              <p className="text-xs text-muted-foreground mb-1">Current: {form.file_name}</p>
            )}
            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <Button type="button" variant="outline" size="sm" className="gap-2" disabled={uploading} asChild>
                  <span>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'Uploading...' : form.file_name ? 'Replace File' : 'Upload File'}
                  </span>
                </Button>
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.xlsx,.pptx,.txt,.md" />
              </label>
              {form.file_url && (
                <a href={form.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                  View current file
                </a>
              )}
            </div>
          </div>

          {doc?.id && (
            <div className="space-y-1.5">
              <Label>Change Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={changeNote} onChange={e => setChangeNote(e.target.value)} placeholder="Briefly describe what changed..." />
            </div>
          )}

          </div>
          <div className="flex-shrink-0 flex justify-end gap-2 pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {doc?.id ? 'Save Changes' : 'Create Document'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}