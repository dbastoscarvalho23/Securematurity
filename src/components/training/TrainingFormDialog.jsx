import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/lib/LanguageContext';

const TOPICS = [
  'phishing_awareness', 'data_protection_gdpr', 'nis2_awareness', 'incident_response',
  'secure_development', 'access_management', 'social_engineering', 'physical_security', 'other',
];
const MODALITIES = ['presential', 'online', 'hybrid'];
const STATUSES = ['scheduled', 'completed', 'cancelled'];

const toInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function TrainingFormDialog({ open, onOpenChange, onSave, customer, editing }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    title: '', topic: 'phishing_awareness', topic_other: '', description: '',
    modality: 'presential', trainer: '', location: '', scheduled_date: '',
    duration_minutes: 60, status: 'scheduled', notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          title: editing.title || '',
          topic: editing.topic || 'phishing_awareness',
          topic_other: editing.topic_other || '',
          description: editing.description || '',
          modality: editing.modality || 'presential',
          trainer: editing.trainer || '',
          location: editing.location || '',
          scheduled_date: toInput(editing.scheduled_date),
          duration_minutes: editing.duration_minutes ?? 60,
          status: editing.status || 'scheduled',
          notes: editing.notes || '',
        });
      } else {
        setForm({
          title: '', topic: 'phishing_awareness', topic_other: '', description: '',
          modality: 'presential', trainer: '', location: '', scheduled_date: '',
          duration_minutes: 60, status: 'scheduled', notes: '',
        });
      }
    }
  }, [open, editing]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title?.trim() || !form.scheduled_date) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        scheduled_date: new Date(form.scheduled_date).toISOString(),
        duration_minutes: Number(form.duration_minutes) || 0,
        customer_id: customer?.id,
        customer_name: customer?.name,
      };
      await onSave(payload);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onOpenChange(false)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t('training_edit_training') : t('training_add_training')}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <div className="sm:col-span-2">
            <Label className="text-xs">{t('training_form_title')} *</Label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t('training_form_topic')}</Label>
            <Select value={form.topic} onValueChange={v => set('topic', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TOPICS.map(tp => <SelectItem key={tp} value={tp}>{t(`training_topic_${tp}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t('training_form_modality')}</Label>
            <Select value={form.modality} onValueChange={v => set('modality', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODALITIES.map(m => <SelectItem key={m} value={m}>{t(`training_modality_${m}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.topic === 'other' && (
            <div className="sm:col-span-2">
              <Label className="text-xs">{t('training_form_topic_other')}</Label>
              <Input value={form.topic_other} onChange={e => set('topic_other', e.target.value)} className="mt-1" />
            </div>
          )}
          <div className="sm:col-span-2">
            <Label className="text-xs">{t('training_form_description')}</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} className="mt-1" rows={2} />
          </div>
          <div>
            <Label className="text-xs">{t('training_form_trainer')}</Label>
            <Input value={form.trainer} onChange={e => set('trainer', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t('training_form_location')}</Label>
            <Input value={form.location} onChange={e => set('location', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t('training_form_scheduled_date')} *</Label>
            <Input type="datetime-local" value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t('training_form_duration')}</Label>
            <Input type="number" min="0" value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t('training_form_status')}</Label>
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{t(`training_status_${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">{t('training_form_notes')}</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="mt-1" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common_cancel')}</Button>
          <Button onClick={handleSave} disabled={saving || !form.title?.trim() || !form.scheduled_date}>
            {saving ? t('common_loading') : t('common_save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}