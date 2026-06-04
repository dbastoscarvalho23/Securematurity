import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';

const PRESET_AREAS = [
  'Information Security',
  'Data Protection & GDPR',
  'Business Continuity',
  'Access Control',
  'Network Security',
  'Physical Security',
  'Incident Response',
  'Third-Party Management',
  'Vulnerability Management',
  'Compliance & Certifications',
];

export default function QuestionnaireFormDialog({ open, onClose, questionnaire, customers, onSaved }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    title: '',
    customer_id: '',
    supplier_name: '',
    supplier_email: '',
    areas: [],
    status: 'draft',
    due_date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [customArea, setCustomArea] = useState('');

  useEffect(() => {
    if (questionnaire) {
      setForm({ ...questionnaire });
    } else {
      setForm({ title: '', customer_id: '', supplier_name: '', supplier_email: '', areas: [], status: 'draft', due_date: '', notes: '' });
    }
  }, [questionnaire, open]);

  const toggleArea = (area) => {
    setForm(f => ({
      ...f,
      areas: f.areas.includes(area) ? f.areas.filter(a => a !== area) : [...f.areas, area],
    }));
  };

  const addCustomArea = () => {
    const trimmed = customArea.trim();
    if (trimmed && !form.areas.includes(trimmed)) {
      setForm(f => ({ ...f, areas: [...f.areas, trimmed] }));
    }
    setCustomArea('');
  };

  const handleSave = async () => {
    setSaving(true);
    const customer = customers.find(c => c.id === form.customer_id);
    const payload = { ...form, customer_name: customer?.name || '' };
    if (questionnaire?.id) {
      await base44.entities.SupplierQuestionnaire.update(questionnaire.id, payload);
    } else {
      await base44.entities.SupplierQuestionnaire.create(payload);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{questionnaire ? t('sc_form_edit_title') : t('sc_form_new_title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>{t('sc_form_title')}</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t('sc_form_title_placeholder')} />
            </div>
            <div>
              <Label>{t('sc_form_customer')}</Label>
              <Select value={form.customer_id} onValueChange={v => setForm(f => ({ ...f, customer_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t('sc_form_customer_placeholder')} /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('common_status')}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['draft','sent','in_progress','completed','archived'].map(s => (
                    <SelectItem key={s} value={s}>{t(`sc_status_${s}`) || s.replace('_',' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('sc_form_supplier_name')}</Label>
              <Input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} placeholder={t('sc_form_supplier_name_placeholder')} />
            </div>
            <div>
              <Label>{t('sc_form_supplier_email')}</Label>
              <Input value={form.supplier_email} onChange={e => setForm(f => ({ ...f, supplier_email: e.target.value }))} placeholder="supplier@company.com" />
            </div>
            <div>
              <Label>{t('sc_form_due_date')}</Label>
              <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">{t('sc_form_coverage_areas')}</Label>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_AREAS.map(area => (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleArea(area)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    form.areas.includes(area)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-border hover:border-primary'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
            {/* Custom areas */}
            {form.areas.filter(a => !PRESET_AREAS.includes(a)).map(a => (
              <Badge key={a} variant="secondary" className="mr-1 mb-1">
                {a}
                <button onClick={() => toggleArea(a)} className="ml-1"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
            <div className="flex gap-2 mt-2">
              <Input
                placeholder={t('sc_form_custom_area_placeholder')}
                value={customArea}
                onChange={e => setCustomArea(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomArea())}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustomArea}>{t('sc_add')}</Button>
            </div>
          </div>

          <div>
            <Label>{t('common_notes')}</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('sc_form_notes_placeholder')} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>{t('common_cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !form.title || !form.customer_id}>
              {saving ? t('common_loading') : questionnaire ? t('sc_form_save') : t('sc_form_create')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}