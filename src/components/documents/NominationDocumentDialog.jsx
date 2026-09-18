import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { uploadFile } from '@/lib/cloudStorage';
import { Upload, Loader2, FileText, X } from 'lucide-react';
import { validators, validateForm, hasErrors } from '@/lib/validation';
import { useLanguage } from '@/lib/LanguageContext';

const ROLE_TYPES = [
  { value: 'risk_officer', labelKey: 'nom_role_risk_officer' },
  { value: 'risk_committee', labelKey: 'nom_role_risk_committee' },
  { value: 'cybersecurity_manager', labelKey: 'nom_role_cybersecurity_manager' },
  { value: 'cybersecurity_committee', labelKey: 'nom_role_cybersecurity_committee' },
  { value: 'dpo', labelKey: 'nom_role_dpo' },
  { value: 'ciso', labelKey: 'nom_role_ciso' },
  { value: 'incident_response_lead', labelKey: 'nom_role_incident_response_lead' },
  { value: 'compliance_officer', labelKey: 'nom_role_compliance_officer' },
  { value: 'other', labelKey: 'nom_role_other' },
];

const ALLOWED_ROLES = ROLE_TYPES.map(r => r.value);

const DEFAULT = { title: '', role_type: '', nominated_person: '', nomination_date: '', expiry_date: '', status: 'draft', description: '', file_url: '', file_name: '' };

export default function NominationDocumentDialog({ open, onOpenChange, doc, customers, isAdmin, onSave }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (doc) setForm({ ...DEFAULT, ...doc });
    else setForm(DEFAULT);
    setErrors({});
  }, [doc, open]);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: null }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await uploadFile(file);
    set('file_url', file_url);
    set('file_name', file.name);
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const schema = {
      title: [validators.required, (v) => validators.minLength(v, 3), (v) => validators.maxLength(v, 200)],
      role_type: [(v) => validators.required(v), (v) => validators.enum(v, ALLOWED_ROLES)],
      expiry_date: (v) => validators.dateAfter(v, form.nomination_date),
    };
    const formErrors = validateForm(form, schema);
    setErrors(formErrors);
    if (hasErrors(formErrors)) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{doc?.id ? t('nom_edit') : t('nom_new')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>{t('common_title')} *</Label>
            <Input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder={t('nom_title_ph')}
              className={errors.title ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>{t('nom_governance_role')} *</Label>
            <Select value={form.role_type} onValueChange={v => set('role_type', v)} required>
              <SelectTrigger className={errors.role_type ? 'border-destructive' : ''}><SelectValue placeholder={t('common_select_role')} /></SelectTrigger>
              <SelectContent>
                {ROLE_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{t(r.labelKey)}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.role_type && <p className="text-xs text-destructive">{errors.role_type}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('common_status')}</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t('nom_status_draft')}</SelectItem>
                  <SelectItem value="active">{t('nom_status_active')}</SelectItem>
                  <SelectItem value="expired">{t('nom_status_expired')}</SelectItem>
                  <SelectItem value="revoked">{t('nom_status_revoked')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('nom_nominated_person')}</Label>
              <Input value={form.nominated_person} onChange={e => set('nominated_person', e.target.value)} placeholder={t('nom_nominated_person_ph')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('nom_nomination_date')}</Label>
              <Input type="date" value={form.nomination_date} onChange={e => set('nomination_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('nom_expiry_date')}</Label>
              <Input
                type="date"
                value={form.expiry_date}
                onChange={e => set('expiry_date', e.target.value)}
                className={errors.expiry_date ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {errors.expiry_date && <p className="text-xs text-destructive">{errors.expiry_date}</p>}
            </div>
          </div>

          {isAdmin && customers?.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t('common_customer')}</Label>
              <Select value={form.customer_id || ''} onValueChange={v => { const c = customers.find(x => x.id === v); set('customer_id', v); set('customer_name', c?.name || ''); }}>
                <SelectTrigger><SelectValue placeholder={t('common_select_customer_ph')} /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t('docs_dlg_approved_by')}</Label>
            <Input value={form.approved_by || ''} onChange={e => set('approved_by', e.target.value)} placeholder={t('nom_approved_by_ph')} />
          </div>

          <div className="space-y-1.5">
            <Label>{t('nom_approved_date')}</Label>
            <Input type="date" value={form.approved_date || ''} onChange={e => set('approved_date', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>{t('nom_notes')}</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder={t('nom_notes_ph')} rows={2} />
          </div>

          {/* File upload */}
          <div className="space-y-1.5">
            <Label>{t('docs_dlg_file')}</Label>
            {form.file_url ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border text-sm">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <a href={form.file_url} target="_blank" rel="noreferrer" className="text-primary underline flex-1 truncate">{form.file_name || t('common_view_file')}</a>
                <button type="button" onClick={() => { set('file_url', ''); set('file_name', ''); }} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer border border-dashed rounded-lg px-4 py-3 hover:bg-muted/30 transition-colors">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
                <span className="text-sm text-muted-foreground">{uploading ? t('common_uploading') : t('nom_upload_hint')}</span>
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" disabled={uploading} />
              </label>
            )}
          </div>

          </div>
          <div className="flex-shrink-0 flex justify-end gap-2 pt-4 border-t mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common_cancel')}</Button>
            <Button type="submit" disabled={saving || uploading || !form.title || !form.role_type}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {doc?.id ? t('common_save_changes') : t('common_create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}