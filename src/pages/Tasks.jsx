import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, LayoutGrid, List } from 'lucide-react';
import TaskBoard from '@/components/tasks/TaskBoard';
import TaskFormDialog from '@/components/tasks/TaskFormDialog';
import TaskListView from '@/components/tasks/TaskListView';
import { toast } from 'sonner';
import { writeAuditLog } from '@/lib/auditLog';

export default function Tasks() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [view, setView] = useState('board');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
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
      toast.success(editingTask ? 'Task updated' : 'Task created');
    },
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
  });

  const deleteMutation = useMutation({
    mutationFn: async (task) => {
      await base44.entities.Task.delete(task.id || task);
      await writeAuditLog({ action: 'task_deleted', entity_type: 'Task', entity_id: task.id || task, details: `Deleted task${task.title ? `: ${task.title}` : ''}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted');
    },
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span><strong className="text-foreground">{counts.todo}</strong> to-do</span>
          <span>·</span>
          <span><strong className="text-chart-4">{counts.in_progress}</strong> in progress</span>
          <span>·</span>
          <span><strong className="text-destructive">{counts.blocked}</strong> blocked</span>
          <span>·</span>
          <span><strong className="text-accent">{counts.done}</strong> done</span>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" />
          New Task
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="todo">To-Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
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
        </div>
      </div>

      {view === 'board' ? (
        <TaskBoard
          tasks={filteredTasks}
          onStatusChange={(id, status, title) => statusMutation.mutate({ id, status, title })}
          onEdit={handleEdit}
          onDelete={(task) => deleteMutation.mutate(task)}
        />
      ) : (
        <TaskListView
          tasks={filteredTasks}
          onStatusChange={(id, status, title) => statusMutation.mutate({ id, status, title })}
          onEdit={handleEdit}
          onDelete={(task) => deleteMutation.mutate(task)}
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