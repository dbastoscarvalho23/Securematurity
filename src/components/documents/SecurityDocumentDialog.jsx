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
import { useLanguage } from '@/lib/LanguageContext';
import { validators, validateForm, hasErrors } from '@/lib/validation';

const DEFAULT = {
  title: '', level: 'policy', status: 'draft', description: '',
  version: '', approved_by: '', approved_date: '', review_date: '',
  file_url: '', file_name: '', tags: [], framework_codes: [],
  customer_id: '', customer_name: '',
};

export default function SecurityDocumentDialog({ open, onOpenChange, doc, customers, isAdmin, isUser, onSave }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [form, setForm] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [frameworksInput, setFrameworksInput] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [errors, setErrors] = useState({});

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
    setErrors({});
  }, [doc, open]);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: null }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('file_url', file_url);
    set('file_name', file.name);
    setUploading(false);
    toast.success(t('docs_dlg_file_uploaded'));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const schema = {
      title: [validators.required, (v) => validators.minLength(v, 3), (v) => validators.maxLength(v, 200)],
      level: (v) => validators.enum(v, ['policy', 'standard', 'procedure', 'playbook']),
      ...(isAdmin && { customer_id: validators.required }),
    };
    const formErrors = validateForm(form, schema);
    setErrors(formErrors);
    if (hasErrors(formErrors)) {
      toast.error(t('docs_dlg_correct_fields'));
      return;
    }
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
            {doc?.id ? t('docs_dlg_edit') : t('docs_dlg_new')}
            {isUser && <span className="text-xs font-normal text-muted-foreground ml-2">{t('docs_dlg_submit_note')}</span>}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          <div className="space-y-1.5">
            <Label>{t('common_title')} *</Label>
            <Input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder={t('docs_dlg_title_ph')}
              className={errors.title ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('docs_dlg_level')} *</Label>
              <Select value={form.level} onValueChange={v => set('level', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="policy">{t('docs_dlg_level_policy')}</SelectItem>
                  <SelectItem value="standard">{t('docs_dlg_level_standard')}</SelectItem>
                  <SelectItem value="procedure">{t('docs_dlg_level_procedure')}</SelectItem>
                  <SelectItem value="playbook">{t('docs_dlg_level_playbook')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!isUser && (
              <div className="space-y-1.5">
                <Label>{t('common_status')}</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t('docs_status_draft')}</SelectItem>
                    <SelectItem value="under_review">{t('docs_status_under_review')}</SelectItem>
                    <SelectItem value="approved">{t('docs_status_approved')}</SelectItem>
                    <SelectItem value="deprecated">{t('docs_status_deprecated')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t('common_description')}</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder={t('docs_dlg_description_ph')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('docs_dlg_version')}</Label>
              <Input value={form.version} onChange={e => set('version', e.target.value)} placeholder={t('docs_dlg_version_ph')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('docs_dlg_approved_by')}</Label>
              <Input value={form.approved_by} onChange={e => set('approved_by', e.target.value)} placeholder={t('docs_dlg_approved_by_ph')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('docs_dlg_approval_date')}</Label>
              <Input value={form.approved_date} onChange={e => set('approved_date', e.target.value)} type="date" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('docs_dlg_review_date')}</Label>
              <Input value={form.review_date} onChange={e => set('review_date', e.target.value)} type="date" />
            </div>
          </div>

          {isAdmin && customers.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t('common_customer')} *</Label>
              <Select value={form.customer_id || ''} onValueChange={handleCustomerChange} required>
                <SelectTrigger className={errors.customer_id ? 'border-destructive' : ''}><SelectValue placeholder={t('docs_dlg_select_customer_ph')} /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.customer_id && <p className="text-xs text-destructive">{errors.customer_id}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t('docs_dlg_framework_codes')}</Label>
            <Input value={frameworksInput} onChange={e => setFrameworksInput(e.target.value)} placeholder={t('docs_dlg_framework_codes_ph')} />
          </div>

          <div className="space-y-1.5">
            <Label>{t('docs_dlg_tags')}</Label>
            <Input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder={t('docs_dlg_tags_ph')} />
          </div>

          <div className="space-y-1.5">
            <Label>{t('docs_dlg_file')}</Label>
            {form.file_name && (
              <p className="text-xs text-muted-foreground mb-1">{t('docs_dlg_current')}: {form.file_name}</p>
            )}
            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <Button type="button" variant="outline" size="sm" className="gap-2" disabled={uploading} asChild>
                  <span>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? t('common_uploading') : form.file_name ? t('docs_dlg_replace_file') : t('docs_dlg_upload_file')}
                  </span>
                </Button>
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.xlsx,.pptx,.txt,.md" />
              </label>
              {form.file_url && (
                <a href={form.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                  {t('docs_dlg_view_current')}
                </a>
              )}
            </div>
          </div>

          {doc?.id && (
            <div className="space-y-1.5">
              <Label>{t('docs_dlg_change_note')} <span className="text-muted-foreground font-normal">{t('common_optional')}</span></Label>
              <Input value={changeNote} onChange={e => setChangeNote(e.target.value)} placeholder={t('docs_dlg_change_note_ph')} />
            </div>
          )}

          </div>
          <div className="flex-shrink-0 flex justify-end gap-2 pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common_cancel')}</Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {doc?.id ? t('common_save_changes') : t('docs_dlg_create_doc')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}