import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus, Sparkles, Search, CheckCircle2, Circle, ArrowUpCircle,
  AlertTriangle, CalendarDays, User, ChevronDown, ChevronUp,
  Filter, ListTodo, ShieldCheck, Loader2
} from 'lucide-react';
import TaskFormDialog from '@/components/tasks/TaskFormDialog';
import AIRecommendationDialog from '@/components/recommendations/AIRecommendationDialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { writeAuditLog } from '@/lib/auditLog';
import { cn } from '@/lib/utils';

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
const REC_STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'dismissed'];

function RecommendationRow({ rec, tasks, onAddTask, onEditTask, onStatusChange, onRecStatusChange }) {
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
            {rec.effort && <span className="text-xs text-muted-foreground">Effort: {rec.effort}</span>}
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
        <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-7"
            onClick={() => onAddTask(rec)}
          >
            <Plus className="w-3 h-3" /> Add Task
          </Button>
          <Select value={rec.status} onValueChange={(v) => onRecStatusChange(rec.id, v, rec.title)}>
            <SelectTrigger className="w-28 text-xs h-7">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REC_STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                    onClick={e => {
                      e.stopPropagation();
                      onStatusChange(task.id, task.status === 'done' ? 'todo' : task.status === 'todo' ? 'in_progress' : 'done');
                    }}
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
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFramework, setFilterFramework] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [prefillTask, setPrefillTask] = useState(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [newRecDialog, setNewRecDialog] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [newRecForm, setNewRecForm] = useState({
    title: '', description: '', priority: 'medium', framework_code: '',
    domain: '', control_id: '', effort: 'medium', timeline: 'short_term',
  });
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const customerId = user?.customer_id;

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations', customerId],
    queryFn: () => isAdmin
      ? base44.entities.Recommendation.list('-created_date', 200)
      : base44.entities.Recommendation.filter({ customer_id: customerId }, '-created_date', 200),
    enabled: isAdmin || !!customerId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', customerId],
    queryFn: () => isAdmin
      ? base44.entities.Task.list('-created_date', 200)
      : base44.entities.Task.filter({ customer_id: customerId }, '-created_date', 200),
    enabled: isAdmin || !!customerId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: isAdmin,
  });

  const { data: activeFrameworks = [] } = useQuery({
    queryKey: ['frameworks-active'],
    queryFn: () => base44.entities.Framework.filter({ status: 'active' }),
  });
  const activeFrameworkCodes = new Set(activeFrameworks.map(fw => fw.code));

  const updateRecMutation = useMutation({
    mutationFn: async ({ id, data, title }) => {
      await base44.entities.Recommendation.update(id, data);
      await writeAuditLog({ action: 'recommendation_updated', entity_type: 'Recommendation', entity_id: id, details: `Status → ${data.status}` });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
  });

  const createRecMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.Recommendation.create({ ...data, customer_id: customerId || data.customer_id, status: 'pending' });
      await writeAuditLog({ action: 'recommendation_created', entity_type: 'Recommendation', entity_id: result?.id, details: `Created: ${data.title}` });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      setNewRecDialog(false);
      setNewRecForm({ title: '', description: '', priority: 'medium', framework_code: '', domain: '', control_id: '', effort: 'medium', timeline: 'short_term' });
      toast.success('Recommendation created');
    },
  });

  const saveTaskMutation = useMutation({
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
      title: rec.title, description: rec.description, priority: rec.priority,
      framework_code: rec.framework_code, domain: rec.domain,
      recommendation_id: rec.id, customer_id: rec.customer_id, status: 'todo',
    });
    setEditingTask(null);
    setDialogOpen(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setPrefillTask(null);
    setDialogOpen(true);
  };

  const handleCheckDuplicates = async () => {
    setIsCheckingDuplicates(true);
    const normalize = str => str?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
    const seen = new Set();
    let dupes = 0;
    recommendations.forEach(rec => {
      const key = normalize(rec.title);
      if (seen.has(key)) dupes++; else seen.add(key);
    });
    setIsCheckingDuplicates(false);
    dupes === 0
      ? toast.success('No duplicates found — your recommendations are clean!')
      : toast.info(`Found ${dupes} potential duplicate${dupes !== 1 ? 's' : ''}`);
  };

  // Stats
  const linkedTasks = tasks.filter(t => t.recommendation_id);
  const totalDone = linkedTasks.filter(t => t.status === 'done').length;
  const totalInProgress = linkedTasks.filter(t => t.status === 'in_progress').length;
  const overallProgress = linkedTasks.length > 0 ? Math.round((totalDone / linkedTasks.length) * 100) : 0;

  const frameworks = [...new Set(recommendations.map(r => r.framework_code).filter(Boolean))]
    .filter(fw => activeFrameworks.length === 0 || activeFrameworkCodes.has(fw))
    .sort();

  const filtered = recommendations.filter(r => {
    if (!r.title?.toLowerCase().includes(search.toLowerCase()) &&
        !r.description?.toLowerCase().includes(search.toLowerCase())) return !search || false;
    if (filterPriority !== 'all' && r.priority !== filterPriority) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterFramework !== 'all' && r.framework_code !== filterFramework) return false;
    if (r.framework_code && activeFrameworks.length > 0 && !activeFrameworkCodes.has(r.framework_code)) return false;
    return true;
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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-muted-foreground text-sm">
          Recommendations & action plan · <span className="text-foreground font-medium">{recommendations.length}</span> recommendations
        </p>
        <div className="flex gap-2 items-center flex-wrap">
          <Button onClick={handleCheckDuplicates} variant="outline" disabled={isCheckingDuplicates} className="gap-2">
            {isCheckingDuplicates ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Check Duplicates
          </Button>
          <Button onClick={() => setAiDialogOpen(true)} variant="outline" className="gap-2">
            <Sparkles className="w-4 h-4" /> AI Generate
          </Button>
          <Button onClick={() => setNewRecDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Recommendation
          </Button>
        </div>
      </div>

      {/* Summary cards */}
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
            <p className="text-2xl font-bold mt-1">{linkedTasks.length}</p>
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
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {REC_STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {frameworks.length > 0 && (
          <Select value={filterFramework} onValueChange={setFilterFramework}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Frameworks" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frameworks</SelectItem>
              {frameworks.map(fw => <SelectItem key={fw} value={fw}>{fw.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} shown</span>
      </div>

      {/* Recommendation groups by priority */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No recommendations found</p>
            <p className="text-sm mt-1">Use AI Generate or complete an assessment to get recommendations.</p>
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
                  onRecStatusChange={(id, status, title) => updateRecMutation.mutate({ id, data: { status }, title })}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Task form dialog */}
      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditingTask(null); setPrefillTask(null); } }}
        task={editingTask ?? prefillTask}
        onSave={(form) => saveTaskMutation.mutateAsync(form)}
      />

      {/* AI Generate dialog */}
      <AIRecommendationDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        customers={customers}
        onSave={async (recs) => {
          await base44.entities.Recommendation.bulkCreate(recs);
          queryClient.invalidateQueries({ queryKey: ['recommendations'] });
          toast.success(`${recs.length} recommendation${recs.length !== 1 ? 's' : ''} added`);
        }}
      />

      {/* New Recommendation dialog */}
      <Dialog open={newRecDialog} onOpenChange={setNewRecDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Recommendation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={newRecForm.title} onChange={e => setNewRecForm(p => ({ ...p, title: e.target.value }))} placeholder="Recommendation title" />
            </div>
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Textarea value={newRecForm.description} onChange={e => setNewRecForm(p => ({ ...p, description: e.target.value }))} placeholder="Detailed description" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={newRecForm.priority} onValueChange={v => setNewRecForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Framework</Label>
                <Select value={newRecForm.framework_code} onValueChange={v => setNewRecForm(p => ({ ...p, framework_code: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {frameworks.map(fw => <SelectItem key={fw} value={fw}>{fw}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Effort</Label>
                <Select value={newRecForm.effort} onValueChange={v => setNewRecForm(p => ({ ...p, effort: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Timeline</Label>
                <Select value={newRecForm.timeline} onValueChange={v => setNewRecForm(p => ({ ...p, timeline: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="short_term">Short Term</SelectItem>
                    <SelectItem value="medium_term">Medium Term</SelectItem>
                    <SelectItem value="long_term">Long Term</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Domain</Label>
                <Input value={newRecForm.domain} onChange={e => setNewRecForm(p => ({ ...p, domain: e.target.value }))} placeholder="e.g. Access Control" />
              </div>
              <div className="space-y-1.5">
                <Label>Control ID</Label>
                <Input value={newRecForm.control_id} onChange={e => setNewRecForm(p => ({ ...p, control_id: e.target.value }))} placeholder="e.g. A.5.1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRecDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createRecMutation.mutate(newRecForm)}
              disabled={createRecMutation.isPending || !newRecForm.title || !newRecForm.description}
            >
              {createRecMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}