import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';

export default function TrainingUserFormDialog({ open, onOpenChange, onSave, customer, editing }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ full_name: '', position: '', department: '', email: '', phone: '', notes: '', status: 'active' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editing
        ? { full_name: editing.full_name || '', position: editing.position || '', department: editing.department || '', email: editing.email || '', phone: editing.phone || '', notes: editing.notes || '', status: editing.status || 'active' }
        : { full_name: '', position: '', department: '', email: '', phone: '', notes: '', status: 'active' });
    }
  }, [open, editing]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.full_name?.trim() || !form.email?.trim()) {
      toast.error(t('training_form_required'));
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...form, customer_id: customer?.id, customer_name: customer?.name });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onOpenChange(false)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t('training_edit_user') : t('training_add_user')}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <div className="sm:col-span-2">
            <Label className="text-xs">{t('training_form_name')} *</Label>
            <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t('training_form_position')}</Label>
            <Input value={form.position} onChange={e => set('position', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t('training_form_department')}</Label>
            <Input value={form.department} onChange={e => set('department', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t('training_form_email')} *</Label>
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t('training_form_phone')}</Label>
            <Input value={form.phone} onChange={e => set('phone', e.target.value)} className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">{t('training_form_notes')}</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="mt-1" rows={2} />
          </div>
          <div>
            <Label className="text-xs">{t('training_form_status')}</Label>
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common_cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t('common_loading') : t('common_save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}