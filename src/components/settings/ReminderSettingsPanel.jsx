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
import { Bell, Plus, X, Loader2, Save, Globe } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_SETTINGS = {
  due_date_reminders_enabled: true,
  reminder_days_before: [7, 3, 1],
  notify_on_assignment: true,
  notify_on_status_change: true,
  additional_recipients: '',
};

function SettingsForm({ initialData, customerId, customerName, onSaved }) {
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
    const payload = {
      ...form,
      customer_id: customerId || null,
      customer_name: customerName || null,
    };
    if (initialData?.id) {
      await base44.entities.ReminderSettings.update(initialData.id, payload);
    } else {
      await base44.entities.ReminderSettings.create(payload);
    }
    setSaving(false);
    toast.success('Reminder settings saved');
    onSaved();
  };

  return (
    <div className="space-y-5">
      {/* Toggle switches */}
      <div className="space-y-3">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium">Due Date Reminders</p>
            <p className="text-xs text-muted-foreground">Send email as the risk due date approaches</p>
          </div>
          <Switch
            checked={form.due_date_reminders_enabled}
            onCheckedChange={v => setForm(f => ({ ...f, due_date_reminders_enabled: v }))}
          />
        </div>
        <div className="flex items-center justify-between py-2 border-t">
          <div>
            <p className="text-sm font-medium">Notify on Assignment</p>
            <p className="text-xs text-muted-foreground">Email owner when a risk is assigned to them</p>
          </div>
          <Switch
            checked={form.notify_on_assignment}
            onCheckedChange={v => setForm(f => ({ ...f, notify_on_assignment: v }))}
          />
        </div>
        <div className="flex items-center justify-between py-2 border-t">
          <div>
            <p className="text-sm font-medium">Notify on Status Change</p>
            <p className="text-xs text-muted-foreground">Email owner when a risk status is updated</p>
          </div>
          <Switch
            checked={form.notify_on_status_change}
            onCheckedChange={v => setForm(f => ({ ...f, notify_on_status_change: v }))}
          />
        </div>
      </div>

      {/* Reminder days */}
      {form.due_date_reminders_enabled && (
        <div className="space-y-2 pt-2 border-t">
          <Label>Remind N days before due date</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(form.reminder_days_before || []).map(d => (
              <Badge key={d} variant="secondary" className="gap-1.5 text-sm pr-1">
                {d} day{d !== 1 ? 's' : ''}
                <button type="button" onClick={() => removeDay(d)} className="hover:text-destructive transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {(form.reminder_days_before || []).length === 0 && (
              <span className="text-xs text-muted-foreground italic">No days configured</span>
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
              placeholder="e.g. 14"
              className="w-28 h-8 text-sm"
            />
            <Button type="button" size="sm" variant="outline" onClick={addDay} className="gap-1 h-8">
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">The daily scheduled job checks these thresholds each morning.</p>
        </div>
      )}

      {/* Additional recipients */}
      <div className="space-y-1.5 pt-2 border-t">
        <Label>Additional CC Recipients</Label>
        <Input
          value={form.additional_recipients}
          onChange={e => setForm(f => ({ ...f, additional_recipients: e.target.value }))}
          placeholder="manager@company.com, security@company.com"
        />
        <p className="text-xs text-muted-foreground">Comma-separated emails to receive copies of all notifications.</p>
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Settings
      </Button>
    </div>
  );
}

export default function ReminderSettingsPanel({ customers = [], isAdmin }) {
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
            Email Reminder Configuration
          </CardTitle>
          <CardDescription>
            Configure when and how email notifications are sent to risk owners.
            {isAdmin && ' Set global defaults or override per customer.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Customer selector (admin only) */}
          {isAdmin && customers.length > 0 && (
            <div className="space-y-1.5">
              <Label>Configure for</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global__">
                    <span className="flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> Global Default</span>
                  </SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isGlobal
                  ? 'These settings apply to all customers that have no custom configuration.'
                  : `Custom settings for ${currentCustomer?.name || ''}. These override the global defaults.`}
              </p>
              {!isGlobal && !activeSettings && (
                <p className="text-xs text-primary font-medium">
                  No custom config yet — saving will create one using global defaults as a starting point.
                </p>
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