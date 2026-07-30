import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function BulkActionBar({ selectedCount, onBulkUpdate, onClear }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  const handleApply = () => {
    const updates = {};
    if (status) updates.status = status;
    if (priority) updates.priority = priority;
    if (Object.keys(updates).length === 0) return;
    onBulkUpdate(updates);
    setStatus('');
    setPriority('');
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="w-4 h-4 text-primary" />
        <span>{t('bulkb_selected', { count: selectedCount })}</span>
      </div>
      <div className="h-4 w-px bg-border" />
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-36 h-8">
          <SelectValue placeholder={t('bulkb_set_status')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todo">{t('tasks_status_todo')}</SelectItem>
          <SelectItem value="in_progress">{t('tasks_status_in_progress')}</SelectItem>
          <SelectItem value="blocked">{t('tasks_status_blocked')}</SelectItem>
          <SelectItem value="done">{t('tasks_status_done')}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={priority} onValueChange={setPriority}>
        <SelectTrigger className="w-36 h-8">
          <SelectValue placeholder={t('bulkb_set_priority')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="critical">{t('tasks_priority_critical')}</SelectItem>
          <SelectItem value="high">{t('tasks_priority_high')}</SelectItem>
          <SelectItem value="medium">{t('tasks_priority_medium')}</SelectItem>
          <SelectItem value="low">{t('tasks_priority_low')}</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" className="h-8" onClick={handleApply} disabled={!status && !priority}>
        {t('bulkb_apply')}
      </Button>
      <Button size="sm" variant="ghost" className="h-8 ml-auto" onClick={onClear}>
        <X className="w-4 h-4 mr-1" />{t('bulkb_clear')}
      </Button>
    </div>
  );
}