import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function TrainingReportEditDialog({ report, open, onOpenChange, onSave, saving }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ title: '', description: '', status: 'approved', version: '' });

  useEffect(() => {
    if (report) {
      setForm({
        title: report.title || '',
        description: report.description || '',
        status: report.status || 'approved',
        version: report.version || '',
      });
    }
  }, [report]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.title) return;
    onSave(report, form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('treports_edit_title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('treports_field_title')}</Label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label>{t('treports_field_description')}</Label>
            <Textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('treports_field_status')}</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t('genreports_status_draft')}</SelectItem>
                  <SelectItem value="under_review">{t('genreports_status_under_review')}</SelectItem>
                  <SelectItem value="approved">{t('genreports_status_approved')}</SelectItem>
                  <SelectItem value="deprecated">{t('genreports_status_deprecated')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('treports_field_version')}</Label>
              <Input value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common_cancel')}</Button>
            <Button type="submit" disabled={saving || !form.title}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t('common_save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}