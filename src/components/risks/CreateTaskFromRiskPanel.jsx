import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, ClipboardList, ExternalLink, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const PRIORITY_STYLES = {
  low:      'bg-chart-2/10 text-chart-2 border-chart-2/20',
  medium:   'bg-chart-3/10 text-chart-3 border-chart-3/20',
  high:     'bg-chart-4/10 text-chart-4 border-chart-4/20',
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
};

const STATUS_LABELS = { todo: 'To-Do', in_progress: 'In Progress', blocked: 'Blocked', done: 'Done' };

export default function CreateTaskFromRiskPanel({ risk }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: `Mitigate: ${risk?.title || ''}`,
    description: risk?.treatment_notes || risk?.description || '',
    status: 'todo',
    priority: risk?.impact >= 4 ? (risk?.impact === 5 ? 'critical' : 'high') : 'medium',
    assigned_to: risk?.owner_email || '',
    due_date: risk?.due_date || '',
    notes: '',
    customer_id: risk?.customer_id || '',
    customer_name: risk?.customer_name || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // List tasks already linked to this risk (by title prefix or customer)
  const { data: linkedTasks = [] } = useQuery({
    queryKey: ['tasksForRisk', risk?.id],
    queryFn: async () => {
      if (!risk?.id) return [];
      const all = risk?.customer_id
        ? await base44.entities.Task.filter({ customer_id: risk.customer_id }, '-created_date', 100)
        : await base44.entities.Task.list('-created_date', 100);
      return all.filter(t => t.notes?.includes(risk.id) || t.title?.includes(risk.title?.slice(0, 20)));
    },
    enabled: !!risk?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create({
      ...data,
      notes: data.notes ? `${data.notes}\n[Risk: ${risk.id}]` : `[Risk: ${risk.id}]`,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasksForRisk', risk?.id] });
      toast.success('Task created successfully');
      setShowForm(false);
      // Reset form for next creation
      setForm({
        title: `Mitigate: ${risk?.title || ''}`,
        description: risk?.treatment_notes || risk?.description || '',
        status: 'todo',
        priority: risk?.impact >= 4 ? (risk?.impact === 5 ? 'critical' : 'high') : 'medium',
        assigned_to: risk?.owner_email || '',
        due_date: risk?.due_date || '',
        notes: '',
        customer_id: risk?.customer_id || '',
        customer_name: risk?.customer_name || '',
      });
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await createMutation.mutateAsync(form);
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Existing linked tasks */}
      {linkedTasks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Linked Tasks</p>
          <div className="space-y-1.5">
            {linkedTasks.map(task => (
              <div key={task.id} className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-muted/20 text-sm">
                <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${task.status === 'done' ? 'text-chart-2' : 'text-muted-foreground'}`} />
                <span className={`flex-1 min-w-0 truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                  {task.title}
                </span>
                <Badge variant="outline" className={`text-[10px] border flex-shrink-0 ${PRIORITY_STYLES[task.priority]}`}>
                  {task.priority}
                </Badge>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {STATUS_LABELS[task.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!showForm ? (
        <div className="flex flex-col items-center justify-center py-8 border border-dashed rounded-lg gap-3 text-muted-foreground">
          <ClipboardList className="w-6 h-6 opacity-30" />
          <p className="text-sm">Create a task to remediate this risk.</p>
          <Button type="button" size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Task
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 border rounded-lg p-4 bg-muted/10">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Remediation Task</p>

          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} required placeholder="Task title" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="What needs to be done?" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To-Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={form.priority} onValueChange={v => set('priority', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Assigned To</Label>
              <Input value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} placeholder="email@company.com" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={1} placeholder="Additional notes..." />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={!form.title || saving}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              Create Task
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}