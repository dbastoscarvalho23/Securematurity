import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, LayoutGrid, List, CalendarDays } from 'lucide-react';
import TaskBoard from '@/components/tasks/TaskBoard';
import TaskFormDialog from '@/components/tasks/TaskFormDialog';
import TaskListView from '@/components/tasks/TaskListView';
import TaskCalendar from '@/components/tasks/TaskCalendar';
import BulkActionBar from '@/components/tasks/BulkActionBar';
import { toast } from 'sonner';
import { writeAuditLog } from '@/lib/auditLog';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';

export default function Tasks() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [view, setView] = useState('board');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const canBulkEdit = user?.role === 'admin' || user?.role === 'customer_admin';
  const customerId = user?.customer_id;

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', customerId],
    queryFn: () => isAdmin
      ? base44.entities.Task.list('-created_date', 200)
      : base44.entities.Task.filter({ customer_id: customerId }, '-created_date', 200),
    enabled: isAdmin || !!customerId,
  });

  const saveMutation = useMutation({
    mutationFn: async (form) => {
      if (form.id) {
        const previousTask = tasks.find(t => t.id === form.id);
        const result = await base44.entities.Task.update(form.id, form);
        await writeAuditLog({ action: 'task_updated', entity_type: 'Task', entity_id: form.id, details: `Updated task: ${form.title}` });

        if (form.assigned_to) {
          const assigneeChanged = previousTask?.assigned_to !== form.assigned_to;
          const statusChanged = previousTask?.status !== form.status;
          if (assigneeChanged) {
            base44.functions.invoke('taskNotifications', { type: 'assigned', task: result || form, previousTask }).catch(() => {});
          }
          if (statusChanged) {
            base44.functions.invoke('taskNotifications', { type: 'status_changed', task: result || form, previousTask }).catch(() => {});
          }
        }
        return result;
      }
      const result = await base44.entities.Task.create(form);
      await writeAuditLog({ action: 'task_created', entity_type: 'Task', entity_id: result?.id, details: `Created task: ${form.title}` });
      if (result?.assigned_to) {
        base44.functions.invoke('taskNotifications', { type: 'assigned', task: result, previousTask: null }).catch(() => {});
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(editingTask ? t('tasks_updated') : t('tasks_created'));
    },
    onError: (err) => toast.error(err?.message || t('tasks_save_error')),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, title }) => {
      const previousTask = tasks.find(t => t.id === id);
      await base44.entities.Task.update(id, { status });
      await writeAuditLog({ action: 'task_status_changed', entity_type: 'Task', entity_id: id, details: `Task status changed to "${status}"${title ? `: ${title}` : ''}` });
      if (previousTask?.assigned_to) {
        base44.functions.invoke('taskNotifications', { type: 'status_changed', task: { ...previousTask, status }, previousTask }).catch(() => {});
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (err) => toast.error(err?.message || t('tasks_status_error')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (task) => {
      await base44.entities.Task.delete(task.id || task);
      await writeAuditLog({ action: 'task_deleted', entity_type: 'Task', entity_id: task.id || task, details: `Deleted task${task.title ? `: ${task.title}` : ''}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(t('tasks_deleted'));
    },
    onError: (err) => toast.error(err?.message || t('tasks_delete_error')),
  });

  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (visibleTasks) => {
    setSelectedIds(prev => {
      const allVisible = visibleTasks.every(t => prev.has(t.id));
      const next = new Set(prev);
      if (allVisible) {
        visibleTasks.forEach(t => next.delete(t.id));
      } else {
        visibleTasks.forEach(t => next.add(t.id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, updates }) => {
      const payload = ids.map(id => ({ id, ...updates }));
      await base44.entities.Task.bulkUpdate(payload);
      const desc = Object.entries(updates).map(([k, v]) => `${k} → ${v}`).join(', ');
      await writeAuditLog({ action: 'task_updated', entity_type: 'Task', details: `Bulk updated ${ids.length} tasks (${desc})` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(`${selectedIds.size} ${t('tasks_bulk_updated')}`);
      clearSelection();
    },
    onError: (err) => toast.error(err?.message || t('tasks_bulk_error')),
  });

  const handleEdit = (task) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingTask(null);
    setDialogOpen(true);
  };

  const filteredTasks = tasks.filter(t => {
    const matchSearch = !search || t.title?.toLowerCase().includes(search.toLowerCase()) || t.assigned_to?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchPriority = filterPriority === 'all' || t.priority === filterPriority;
    return matchSearch && matchStatus && matchPriority;
  });

  const counts = {
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description={
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span><strong className="text-foreground">{counts.todo}</strong> {t('tasks_count_todo')}</span>
            <span>·</span>
            <span><strong className="text-chart-4">{counts.in_progress}</strong> {t('tasks_count_in_progress')}</span>
            <span>·</span>
            <span><strong className="text-destructive">{counts.blocked}</strong> {t('tasks_count_blocked')}</span>
            <span>·</span>
            <span><strong className="text-accent">{counts.done}</strong> {t('tasks_count_done')}</span>
          </div>
        }
        actions={
          <Button onClick={handleNew} className="gap-2">
            <Plus className="w-4 h-4" />
            {t('tasks_new')}
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('tasks_search_placeholder')}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder={t('common_status')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('tasks_filter_all_statuses')}</SelectItem>
            <SelectItem value="todo">{t('tasks_status_todo')}</SelectItem>
            <SelectItem value="in_progress">{t('tasks_status_in_progress')}</SelectItem>
            <SelectItem value="blocked">{t('tasks_status_blocked')}</SelectItem>
            <SelectItem value="done">{t('tasks_status_done')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36"><SelectValue placeholder={t('common_priority')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('tasks_filter_all_priorities')}</SelectItem>
            <SelectItem value="critical">{t('tasks_priority_critical')}</SelectItem>
            <SelectItem value="high">{t('tasks_priority_high')}</SelectItem>
            <SelectItem value="medium">{t('tasks_priority_medium')}</SelectItem>
            <SelectItem value="low">{t('tasks_priority_low')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex rounded-md border border-border overflow-hidden ml-auto">
          <button
            onClick={() => setView('board')}
            className={`px-3 py-1.5 text-sm transition-colors ${view === 'board' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 text-sm transition-colors ${view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`px-3 py-1.5 text-sm transition-colors ${view === 'calendar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            title={t('tasks_calendar_month')}
          >
            <CalendarDays className="w-4 h-4" />
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && canBulkEdit && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onBulkUpdate={(updates) => bulkUpdateMutation.mutate({ ids: [...selectedIds], updates })}
          onClear={clearSelection}
        />
      )}

      {view === 'board' ? (
        <TaskBoard
          tasks={filteredTasks}
          onStatusChange={(id, status, title) => statusMutation.mutate({ id, status, title })}
          onEdit={handleEdit}
          onDelete={(task) => deleteMutation.mutate(task)}
        />
      ) : view === 'list' ? (
        <TaskListView
          tasks={filteredTasks}
          onStatusChange={(id, status, title) => statusMutation.mutate({ id, status, title })}
          onEdit={handleEdit}
          onDelete={(task) => deleteMutation.mutate(task)}
          selectionEnabled={canBulkEdit}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
      ) : (
        <TaskCalendar
          tasks={filteredTasks}
          onEdit={handleEdit}
        />
      )}

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        onSave={(form) => saveMutation.mutateAsync(form)}
      />
    </div>
  );
}