import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Plus, Sparkles, Search, CheckCircle2, Circle, ArrowUpCircle,
  AlertTriangle, CalendarDays, User, ChevronDown, ChevronUp, ListChecks
} from 'lucide-react';
import TaskFormDialog from '@/components/tasks/TaskFormDialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

const PRIORITY_STYLES = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  medium: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  low: 'bg-muted text-muted-foreground border-border',
};

const STATUS_ICONS = {
  todo: <Circle className="w-4 h-4 text-muted-foreground" />,
  in_progress: <ArrowUpCircle className="w-4 h-4 text-chart-4" />,
  done: <CheckCircle2 className="w-4 h-4 text-accent" />,
};

const STATUS_LABELS = { todo: 'To-Do', in_progress: 'In Progress', done: 'Done' };

function RecommendationRow({ rec, tasks, onAddTask, onEditTask, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const linked = tasks.filter(t => t.recommendation_id === rec.id);
  const done = linked.filter(t => t.status === 'done').length;
  const progress = linked.length > 0 ? Math.round((done / linked.length) * 100) : 0;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="outline" className={`text-xs border ${PRIORITY_STYLES[rec.priority]}`}>
              {rec.priority}
            </Badge>
            {rec.framework_code && (
              <Badge variant="outline" className="text-xs">{rec.framework_code}</Badge>
            )}
            {rec.domain && <span className="text-xs text-muted-foreground">{rec.domain}</span>}
          </div>
          <p className="text-sm font-medium leading-snug">{rec.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{rec.description}</p>
          {linked.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Progress value={progress} className="h-1.5 flex-1 max-w-[160px]" />
              <span className="text-xs text-muted-foreground">{done}/{linked.length} tasks done</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-7"
            onClick={e => { e.stopPropagation(); onAddTask(rec); }}
          >
            <Plus className="w-3 h-3" /> Add Task
          </Button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/10 px-4 py-3 space-y-2">
          <p className="text-xs text-muted-foreground">{rec.description}</p>
          {linked.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">No tasks yet. Click "Add Task" to create one.</p>
          ) : (
            <div className="space-y-2 mt-2">
              {linked.map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-2.5 rounded-md bg-card border text-sm cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => onEditTask(task)}
                >
                  <button
                    onClick={e => { e.stopPropagation(); onStatusChange(task.id, task.status === 'done' ? 'todo' : task.status === 'todo' ? 'in_progress' : 'done'); }}
                    className="flex-shrink-0"
                  >
                    {STATUS_ICONS[task.status]}
                  </button>
                  <span className={`flex-1 font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                    {task.title}
                  </span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {task.assigned_to && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />{task.assigned_to.split('@')[0]}
                      </span>
                    )}
                    {task.due_date && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {format(new Date(task.due_date), 'MMM d')}
                      </span>
                    )}
                    <Badge variant="outline" className={`text-xs border ${PRIORITY_STYLES[task.priority]}`}>
                      {task.priority}
                    </Badge>
                    <span>{STATUS_LABELS[task.status]}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ActionPlan() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterFramework, setFilterFramework] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [prefillTask, setPrefillTask] = useState(null);

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => base44.entities.Recommendation.list('-created_date', 200),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-created_date', 200),
  });

  const saveMutation = useMutation({
    mutationFn: async (form) => form.id
      ? base44.entities.Task.update(form.id, form)
      : base44.entities.Task.create(form),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(vars.id ? 'Task updated' : 'Task created');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Task.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const handleAddTask = (rec) => {
    setPrefillTask({
      title: rec.title,
      description: rec.description,
      priority: rec.priority,
      framework_code: rec.framework_code,
      domain: rec.domain,
      recommendation_id: rec.id,
      customer_id: rec.customer_id,
      status: 'todo',
    });
    setEditingTask(null);
    setDialogOpen(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setPrefillTask(null);
    setDialogOpen(true);
  };

  // Stats
  const allLinkedTasks = tasks.filter(t => t.recommendation_id);
  const totalDone = allLinkedTasks.filter(t => t.status === 'done').length;
  const totalInProgress = allLinkedTasks.filter(t => t.status === 'in_progress').length;
  const overallProgress = allLinkedTasks.length > 0 ? Math.round((totalDone / allLinkedTasks.length) * 100) : 0;

  const frameworks = [...new Set(recommendations.map(r => r.framework_code).filter(Boolean))];

  const filtered = recommendations.filter(r => {
    const matchSearch = !search || r.title?.toLowerCase().includes(search.toLowerCase());
    const matchPriority = filterPriority === 'all' || r.priority === filterPriority;
    const matchFramework = filterFramework === 'all' || r.framework_code === filterFramework;
    return matchSearch && matchPriority && matchFramework;
  });

  // Group by priority
  const priorityOrder = ['critical', 'high', 'medium', 'low'];
  const grouped = priorityOrder.reduce((acc, p) => {
    const items = filtered.filter(r => r.priority === p);
    if (items.length) acc[p] = items;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Recommendations</p>
            <p className="text-2xl font-bold mt-1">{recommendations.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tasks Created</p>
            <p className="text-2xl font-bold mt-1">{allLinkedTasks.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold mt-1 text-chart-4">{totalInProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Overall Progress</p>
            <p className="text-2xl font-bold mt-1 text-accent">{overallProgress}%</p>
            <Progress value={overallProgress} className="h-1.5 mt-1" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recommendations..." className="pl-9" />
        </div>
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
        {frameworks.length > 0 && (
          <Select value={filterFramework} onValueChange={setFilterFramework}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Framework" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frameworks</SelectItem>
              {frameworks.map(fw => <SelectItem key={fw} value={fw}>{fw}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Recommendation groups */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No recommendations found</p>
            <p className="text-sm mt-1">Generate recommendations from the Recommendations page first.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([priority, recs]) => (
          <div key={priority}>
            <div className="flex items-center gap-2 mb-3">
              {priority === 'critical' && <AlertTriangle className="w-4 h-4 text-destructive" />}
              <h2 className="text-sm font-semibold capitalize">{priority} Priority</h2>
              <Badge variant="secondary" className="text-xs">{recs.length}</Badge>
            </div>
            <div className="space-y-2">
              {recs.map(rec => (
                <RecommendationRow
                  key={rec.id}
                  rec={rec}
                  tasks={tasks}
                  onAddTask={handleAddTask}
                  onEditTask={handleEditTask}
                  onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditingTask(null); setPrefillTask(null); } }}
        task={editingTask ?? prefillTask}
        onSave={(form) => saveMutation.mutateAsync(form)}
      />
    </div>
  );
}