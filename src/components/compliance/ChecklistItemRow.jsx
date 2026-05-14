import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CheckCircle2, Circle, Clock, MinusCircle, CalendarDays, User, Pencil, X, Check } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';

export default function ChecklistItemRow({ item, queryKey }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ status: item.status, owner: item.owner || '', due_date: item.due_date || '', notes: item.notes || '' });
  const [calOpen, setCalOpen] = useState(false);

  const STATUS_CONFIG = {
    pending:        { labelKey: 'status_pending',        icon: Circle,       color: 'text-muted-foreground', bg: 'bg-muted/50 border-border' },
    in_progress:    { labelKey: 'status_in_progress',    icon: Clock,        color: 'text-chart-4',          bg: 'bg-chart-4/10 border-chart-4/20' },
    done:           { labelKey: 'status_done',           icon: CheckCircle2, color: 'text-accent',            bg: 'bg-accent/10 border-accent/20' },
    not_applicable: { labelKey: 'status_not_applicable', icon: MinusCircle,  color: 'text-muted-foreground', bg: 'bg-muted/30 border-border' },
  };

  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.ComplianceChecklist.update(item.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditing(false);
    },
  });

  const quickStatus = useMutation({
    mutationFn: (status) => base44.entities.ComplianceChecklist.update(item.id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const cycleStatus = () => {
    const order = ['pending', 'in_progress', 'done', 'not_applicable'];
    const next = order[(order.indexOf(item.status) + 1) % order.length];
    quickStatus.mutate(next);
  };

  return (
    <div className={cn('rounded-lg border p-3 transition-colors', cfg.bg)}>
      <div className="flex items-start gap-3">
        <button onClick={cycleStatus} className="mt-0.5 flex-shrink-0" title="Click to change status">
          <StatusIcon className={cn('w-4 h-4', cfg.color)} />
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm leading-snug', item.status === 'done' && 'line-through text-muted-foreground', item.status === 'not_applicable' && 'text-muted-foreground')}>
            {item.task_text}
          </p>
          {!editing && (item.owner || item.due_date || item.notes) && (
            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
              {item.owner && <span className="flex items-center gap-1"><User className="w-3 h-3" />{item.owner}</span>}
              {item.due_date && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{format(new Date(item.due_date), 'dd/MM/yyyy')}</span>}
              {item.notes && <span className="italic truncate max-w-[300px]">{item.notes}</span>}
            </div>
          )}
          {editing && (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{t(v.labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 text-xs"
                  placeholder={t('checklist_owner_placeholder')}
                  value={form.owner}
                  onChange={e => setForm(p => ({ ...p, owner: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Popover open={calOpen} onOpenChange={setCalOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs justify-start gap-1.5 font-normal">
                      <CalendarDays className="w-3 h-3" />
                      {form.due_date ? format(new Date(form.due_date), 'dd/MM/yyyy') : t('checklist_due_date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.due_date ? new Date(form.due_date) : undefined}
                      onSelect={d => { setForm(p => ({ ...p, due_date: d ? format(d, 'yyyy-MM-dd') : '' })); setCalOpen(false); }}
                    />
                  </PopoverContent>
                </Popover>
                {form.due_date && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setForm(p => ({ ...p, due_date: '' }))}>
                    {t('checklist_clear_date')}
                  </Button>
                )}
              </div>
              <Textarea
                className="text-xs min-h-[60px]"
                placeholder={t('checklist_notes_placeholder')}
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}>
                  <Check className="w-3 h-3" /> {t('checklist_save')}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setEditing(false)}>
                  <X className="w-3 h-3" /> {t('checklist_cancel')}
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Badge variant="outline" className={cn('text-xs border', cfg.bg, cfg.color)}>{t(cfg.labelKey)}</Badge>
          {!editing && (
            <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => { setForm({ status: item.status, owner: item.owner || '', due_date: item.due_date || '', notes: item.notes || '' }); setEditing(true); }}>
              <Pencil className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}