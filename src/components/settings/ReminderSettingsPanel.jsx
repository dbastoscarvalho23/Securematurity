import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Plus, X, Loader2, Save, Globe, AlertTriangle, CheckSquare, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';

const DEFAULT_SETTINGS = {
  due_date_reminders_enabled: true,
  reminder_days_before: [7, 3, 1],
  notify_on_assignment: true,
  notify_on_status_change: true,
  notify_on_document_review: true,
  notify_on_document_approval: true,
  additional_recipients: '',
};

function SettingsForm({ initialData, customerId, customerName, onSaved }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ ...DEFAULT_SETTINGS, ...initialData });
  const [saving, setSaving] = useState(false);
  const [newDay, setNewDay] = useState('');

  useEffect(() => {
    setForm({ ...DEFAULT_SETTINGS, ...initialData });
  }, [initialData?.id]);

  const addDay = () => {
    const d = parseInt(newDay, 10);
    if (!d || d < 1 || d > 365) return;
    if (form.reminder_days_before?.includes(d)) return;
    setForm(f => ({ ...f, reminder_days_before: [...(f.reminder_days_before || []), d].sort((a, b) => b - a) }));
    setNewDay('');
  };

  const removeDay = (day) => {
    setForm(f => ({ ...f, reminder_days_before: f.reminder_days_before.filter(d => d !== day) }));
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, customer_id: customerId || null, customer_name: customerName || null };
    if (initialData?.id) {
      await base44.entities.ReminderSettings.update(initialData.id, payload);
    } else {
      await base44.entities.ReminderSettings.create(payload);
    }
    setSaving(false);
    toast.success(t('reminders_saved'));
    onSaved();
  };

  const SwitchRow = ({ icon: Icon, label, desc, field }) => (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0">
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch
        checked={!!form[field]}
        onCheckedChange={v => setForm(f => ({ ...f, [field]: v }))}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Task Notifications */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t('reminders_section_tasks')}</h4>
        <div className="rounded-lg border bg-card px-4">
          <SwitchRow
            icon={CheckSquare}
            label={t('reminders_notify_assignment')}
            desc={t('reminders_notify_assignment_desc')}
            field="notify_on_assignment"
          />
          <SwitchRow
            icon={CheckSquare}
            label={t('reminders_notify_status_change')}
            desc={t('reminders_notify_status_change_desc')}
            field="notify_on_status_change"
          />
        </div>
      </div>

      {/* Risk Notifications */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t('reminders_section_risks')}</h4>
        <div className="rounded-lg border bg-card px-4">
          <SwitchRow
            icon={AlertTriangle}
            label={t('reminders_due_date')}
            desc={t('reminders_due_date_desc')}
            field="due_date_reminders_enabled"
          />
        </div>
        {form.due_date_reminders_enabled && (
          <div className="mt-3 p-4 rounded-lg border bg-muted/30 space-y-3">
            <Label className="text-sm">{t('reminders_remind_days')}</Label>
            <div className="flex flex-wrap gap-2">
              {(form.reminder_days_before || []).map(d => (
                <Badge key={d} variant="secondary" className="gap-1.5 text-sm pr-1">
                  {d} {d !== 1 ? t('reminders_days') : t('reminders_day')}
                  <button type="button" onClick={() => removeDay(d)} className="hover:text-destructive transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {(form.reminder_days_before || []).length === 0 && (
                <span className="text-xs text-muted-foreground italic">{t('reminders_no_days')}</span>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min={1}
                max={365}
                value={newDay}
                onChange={e => setNewDay(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDay())}
                placeholder={t('reminders_days_placeholder')}
                className="w-28 h-8 text-sm"
              />
              <Button type="button" size="sm" variant="outline" onClick={addDay} className="gap-1 h-8">
                <Plus className="w-3.5 h-3.5" /> {t('common_add')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('reminders_days_hint')}</p>
          </div>
        )}
      </div>

      {/* Document Notifications */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t('reminders_section_documents')}</h4>
        <div className="rounded-lg border bg-card px-4">
          <SwitchRow
            icon={FileText}
            label={t('reminders_notify_doc_review')}
            desc={t('reminders_notify_doc_review_desc')}
            field="notify_on_document_review"
          />
          <SwitchRow
            icon={FileText}
            label={t('reminders_notify_doc_approval')}
            desc={t('reminders_notify_doc_approval_desc')}
            field="notify_on_document_approval"
          />
        </div>
      </div>

      {/* Additional CC recipients */}
      <div className="space-y-1.5">
        <Label className="text-sm">{t('reminders_cc_recipients')}</Label>
        <Input
          value={form.additional_recipients}
          onChange={e => setForm(f => ({ ...f, additional_recipients: e.target.value }))}
          placeholder={t('reminders_cc_placeholder')}
        />
        <p className="text-xs text-muted-foreground">{t('reminders_cc_hint')}</p>
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? t('common_loading') : t('reminders_save')}
      </Button>
    </div>
  );
}

export default function ReminderSettingsPanel({ customers = [], isAdmin }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedCustomerId, setSelectedCustomerId] = useState('__global__');

  const { data: allSettings = [], refetch } = useQuery({
    queryKey: ['reminderSettings'],
    queryFn: () => base44.entities.ReminderSettings.list(),
  });

  const globalSettings = allSettings.find(s => !s.customer_id);
  const customerSettings = (id) => allSettings.find(s => s.customer_id === id);
  const isGlobal = selectedCustomerId === '__global__';
  const currentCustomer = isGlobal ? null : customers.find(c => c.id === selectedCustomerId);
  const activeSettings = isGlobal ? globalSettings : customerSettings(selectedCustomerId);

  const onSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['reminderSettings'] });
    refetch();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" />
            {t('reminders_title')}
          </CardTitle>
          <CardDescription>
            {t('reminders_desc')}
            {isAdmin && ` ${t('reminders_desc_admin')}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isAdmin && customers.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t('reminders_configure_for')}</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global__">
                    <span className="flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> {t('reminders_global_default')}</span>
                  </SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isGlobal
                  ? t('reminders_global_hint')
                  : `${t('reminders_customer_hint')} ${currentCustomer?.name || ''}.`}
              </p>
              {!isGlobal && !activeSettings && (
                <p className="text-xs text-primary font-medium">{t('reminders_no_custom_config')}</p>
              )}
            </div>
          )}

          <SettingsForm
            key={selectedCustomerId}
            initialData={activeSettings || (isGlobal ? {} : globalSettings || {})}
            customerId={isGlobal ? null : selectedCustomerId}
            customerName={currentCustomer?.name || null}
            onSaved={onSaved}
          />
        </CardContent>
      </Card>
    </div>
  );
}