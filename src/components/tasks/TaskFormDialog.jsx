import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import TaskComments from './TaskComments';
import TaskAttachments from './TaskAttachments';
import UserSelect from '@/components/shared/UserSelect';
import { useCustomerUsers } from '@/hooks/useCustomerUsers';

const DEFAULT_TASK = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  assigned_to: '',
  due_date: '',
  notes: '',
};

export default function TaskFormDialog({ open, onOpenChange, task, onSave }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(DEFAULT_TASK);
  const [saving, setSaving] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const customerUsers = useCustomerUsers(form.customer_id);

  useEffect(() => {
    setForm(task ? { ...DEFAULT_TASK, ...task } : DEFAULT_TASK);
  }, [task, open]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{task ? t('task_dlg_edit') : t('task_dlg_new')}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          <div className="space-y-1.5">
            <Label>{t('common_title')} *</Label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} required placeholder={t('task_dlg_title_ph')} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('common_description')}</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder={t('task_dlg_description_ph')} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('common_status')}</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">{t('tasks_status_todo')}</SelectItem>
                  <SelectItem value="in_progress">{t('tasks_status_in_progress')}</SelectItem>
                  <SelectItem value="blocked">{t('tasks_status_blocked')}</SelectItem>
                  <SelectItem value="done">{t('tasks_status_done')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('common_priority')}</Label>
              <Select value={form.priority} onValueChange={v => set('priority', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">{t('tasks_priority_critical')}</SelectItem>
                  <SelectItem value="high">{t('tasks_priority_high')}</SelectItem>
                  <SelectItem value="medium">{t('tasks_priority_medium')}</SelectItem>
                  <SelectItem value="low">{t('tasks_priority_low')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('common_customer')}</Label>
            <Select value={form.customer_id || ''} onValueChange={v => {
              const c = customers.find(c => c.id === v);
              setForm(f => ({ ...f, customer_id: v, customer_name: c?.name || '', assigned_to: '' }));
            }}>
              <SelectTrigger><SelectValue placeholder={t('common_select_customer_ph')} /></SelectTrigger>
              <SelectContent>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('common_assigned_to')}</Label>
              <UserSelect
                value={form.assigned_to}
                onChange={v => set('assigned_to', v)}
                users={customerUsers}
                placeholder={form.customer_id ? t('task_dlg_select_user') : t('task_dlg_select_customer_first')}
                disabled={!form.customer_id}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('common_due_date')}</Label>
              <Input value={form.due_date} onChange={e => set('due_date', e.target.value)} type="date" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('common_notes')}</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={t('task_dlg_notes_ph')} rows={2} />
          </div>
          <div className="border-t pt-4">
            <TaskAttachments
              attachments={form.attachments || []}
              onChange={val => set('attachments', val)}
            />
          </div>
          {task?.id && (
            <div className="border-t pt-4">
              <TaskComments taskId={task.id} />
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common_cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {task ? t('common_save_changes') : t('task_dlg_create_task')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}