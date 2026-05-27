import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus, Trash2, ChevronDown, ChevronRight, CheckCircle2,
  Circle, Clock, AlertCircle, Loader2, ListChecks
} from 'lucide-react';
import { cn } from '@/lib/utils';
import UserSelect from '@/components/shared/UserSelect';
import { useCustomerUsers } from '@/hooks/useCustomerUsers';

const STATUS_CONFIG = {
  todo:        { label: 'To Do',       icon: Circle,       color: 'text-muted-foreground' },
  in_progress: { label: 'In Progress', icon: Clock,        color: 'text-primary' },
  done:        { label: 'Done',        icon: CheckCircle2, color: 'text-chart-2' },
  blocked:     { label: 'Blocked',     icon: AlertCircle,  color: 'text-destructive' },
};

const PRIORITY_STYLES = {
  low:      'bg-chart-2/10 text-chart-2 border-chart-2/20',
  medium:   'bg-chart-3/10 text-chart-3 border-chart-3/20',
  high:     'bg-chart-4/10 text-chart-4 border-chart-4/20',
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
};

function newChecklistItem(text = '') {
  return { id: crypto.randomUUID(), text, done: false };
}

const EMPTY_TASK = {
  title: '', description: '', assigned_to: '', due_date: '',
  status: 'todo', priority: 'medium', checklist: [], notes: '',
};

// ── Single task card ──────────────────────────────────────────────────────────

function TaskCard({ task, onUpdate, onDelete, customerUsers = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(task);
  const [saving, setSaving] = useState(false);

  const StatusIcon = STATUS_CONFIG[task.status]?.icon || Circle;
  const doneCount = task.checklist?.filter(i => i.done).length || 0;
  const totalCount = task.checklist?.length || 0;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : null;

  const handleToggleItem = async (itemId) => {
    const updated = {
      ...task,
      checklist: task.checklist.map(i => i.id === itemId ? { ...i, done: !i.done } : i),
    };
    // auto-mark done if all checked
    if (updated.checklist.every(i => i.done) && updated.checklist.length > 0) {
      updated.status = 'done';
    } else if (updated.status === 'done' && !updated.checklist.every(i => i.done)) {
      updated.status = 'in_progress';
    }
    await onUpdate(task.id, updated);
  };

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(task.id, form);
    setSaving(false);
    setEditing(false);
  };

  const addChecklistItem = () => {
    setForm(f => ({ ...f, checklist: [...(f.checklist || []), newChecklistItem()] }));
  };

  const updateChecklistText = (id, text) => {
    setForm(f => ({ ...f, checklist: f.checklist.map(i => i.id === id ? { ...i, text } : i) }));
  };

  const removeChecklistItem = (id) => {
    setForm(f => ({ ...f, checklist: f.checklist.filter(i => i.id !== id) }));
  };

  if (editing) {
    return (
      <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
        <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title *" className="font-medium" />
        <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description / acceptance criteria..." rows={2} />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Assigned To</Label>
            <UserSelect
              value={form.assigned_to}
              onChange={v => setForm(f => ({ ...f, assigned_to: v }))}
              users={customerUsers}
              className="h-8 text-xs"
              inputClassName="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Due Date</Label>
            <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Priority</Label>
            <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Checklist editor */}
        <div className="space-y-1.5">
          <Label className="text-xs">Checklist</Label>
          {(form.checklist || []).map(item => (
            <div key={item.id} className="flex items-center gap-2">
              <Input
                value={item.text}
                onChange={e => updateChecklistText(item.id, e.target.value)}
                placeholder="Step description..."
                className="h-7 text-xs flex-1"
              />
              <button type="button" onClick={() => removeChecklistItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button type="button" onClick={addChecklistItem} className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1">
            <Plus className="w-3 h-3" /> Add step
          </button>
        </div>

        <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes..." rows={1} />

        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="outline" size="sm" onClick={() => { setEditing(false); setForm(task); }}>Cancel</Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={!form.title || saving}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />} Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('border rounded-lg overflow-hidden transition-shadow hover:shadow-sm', task.status === 'done' && 'opacity-70')}>
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button type="button" onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <StatusIcon className={cn('w-4 h-4 flex-shrink-0', STATUS_CONFIG[task.status]?.color)} />
        <span className={cn('flex-1 text-sm font-medium min-w-0 truncate', task.status === 'done' && 'line-through text-muted-foreground')}>
          {task.title}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {task.priority && (
            <Badge variant="outline" className={cn('text-[10px] border px-1.5 py-0', PRIORITY_STYLES[task.priority])}>
              {task.priority}
            </Badge>
          )}
          {progress !== null && (
            <span className="text-[10px] text-muted-foreground font-mono">{doneCount}/{totalCount}</span>
          )}
          {task.due_date && (
            <span className="text-[10px] text-muted-foreground hidden sm:block">{task.due_date}</span>
          )}
          <button type="button" onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground transition-colors px-1">
            <span className="text-[10px]">Edit</span>
          </button>
          <button type="button" onClick={() => onDelete(task.id)} className="text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {progress !== null && (
        <div className="h-0.5 bg-muted mx-3 mb-1 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', progress === 100 ? 'bg-chart-2' : 'bg-primary')} style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t pt-2 mt-0.5">
          {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
          {task.assigned_to && <p className="text-xs text-muted-foreground">Assigned: <span className="font-medium text-foreground">{task.assigned_to}</span></p>}

          {task.checklist?.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {task.checklist.map(item => (
                <div key={item.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={() => handleToggleItem(item.id)}
                    id={`chk-${item.id}`}
                  />
                  <label
                    htmlFor={`chk-${item.id}`}
                    className={cn('text-xs cursor-pointer select-none', item.done && 'line-through text-muted-foreground')}
                  >
                    {item.text}
                  </label>
                </div>
              ))}
            </div>
          )}

          {task.notes && <p className="text-xs italic text-muted-foreground border-l-2 border-muted pl-2">{task.notes}</p>}
        </div>
      )}
    </div>
  );
}

// ── New task inline form ──────────────────────────────────────────────────────

function NewTaskForm({ onAdd, onCancel, customerUsers = [] }) {
  const [form, setForm] = useState(EMPTY_TASK);

  return (
    <div className="border border-dashed border-primary/40 rounded-lg p-3 space-y-2 bg-primary/5">
      <Input
        autoFocus
        value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        placeholder="Task title *"
        className="font-medium"
      />
      <div className="grid grid-cols-2 gap-2">
        <UserSelect
          value={form.assigned_to}
          onChange={v => setForm(f => ({ ...f, assigned_to: v }))}
          users={customerUsers}
          className="h-8 text-xs"
          inputClassName="h-8 text-xs"
        />
        <Input
          type="date"
          value={form.due_date}
          onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
          className="h-8 text-xs"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" disabled={!form.title} onClick={() => onAdd(form)}>Add Task</Button>
      </div>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function MitigationTasksPanel({ riskId, customerId }) {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['mitigationTasks', riskId],
    queryFn: () => base44.entities.MitigationTask.filter({ risk_id: riskId }, 'created_date', 100),
    enabled: !!riskId,
  });

  const customerUsers = useCustomerUsers(customerId);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MitigationTask.create({ ...data, risk_id: riskId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mitigationTasks', riskId] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MitigationTask.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mitigationTasks', riskId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MitigationTask.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mitigationTasks', riskId] }),
  });

  const handleAdd = async (form) => {
    await createMutation.mutateAsync(form);
    setShowNew(false);
  };

  const handleUpdate = async (id, data) => {
    await updateMutation.mutateAsync({ id, data });
  };

  const handleDelete = async (id) => {
    await deleteMutation.mutateAsync(id);
  };

  const done = tasks.filter(t => t.status === 'done').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading tasks...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListChecks className="w-4 h-4" />
          <span>{tasks.length} task{tasks.length !== 1 ? 's' : ''}{tasks.length > 0 ? ` · ${done} done` : ''}</span>
          {tasks.length > 0 && (
            <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
              {Math.round((done / tasks.length) * 100)}%
            </span>
          )}
        </div>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowNew(true)}>
          <Plus className="w-3.5 h-3.5" /> Add Task
        </Button>
      </div>

      {/* New task form */}
      {showNew && <NewTaskForm onAdd={handleAdd} onCancel={() => setShowNew(false)} customerUsers={customerUsers} />}

      {/* Task list */}
      {tasks.length === 0 && !showNew ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm gap-2 border border-dashed rounded-lg">
          <ListChecks className="w-5 h-5 opacity-30" />
          <p>No mitigation tasks yet.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowNew(true)} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> Add first task
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              customerUsers={customerUsers}
            />
          ))}
        </div>
      )}
    </div>
  );
}