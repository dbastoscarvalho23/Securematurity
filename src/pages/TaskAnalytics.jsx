import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, CheckCircle2, Clock, Users, ListTodo } from 'lucide-react';
import { format, isAfter, parseISO } from 'date-fns';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444'];

const PRIORITY_STYLES = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  medium: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  low: 'bg-muted text-muted-foreground',
};

const STATUS_STYLES = {
  todo: 'bg-destructive/10 text-destructive border-destructive/20',
  in_progress: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  done: 'bg-accent/10 text-accent border-accent/20',
};

const STATUS_LABELS = { todo: 'To-Do', in_progress: 'In Progress', done: 'Done' };

function TaskRow({ task }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{task.title}</p>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-muted-foreground">
          {task.assigned_to && <span>👤 {task.assigned_to}</span>}
          {task.due_date && <span>📅 {format(parseISO(task.due_date), 'MMM d, yyyy')}</span>}
          {task.customer_name && <span>🏢 {task.customer_name}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <Badge variant="outline" className={`text-xs border ${STATUS_STYLES[task.status]}`}>
          {STATUS_LABELS[task.status] || task.status}
        </Badge>
        {task.priority && (
          <Badge variant="outline" className={`text-xs border capitalize ${PRIORITY_STYLES[task.priority]}`}>
            {task.priority}
          </Badge>
        )}
      </div>
    </div>
  );
}

function DrillDownSheet({ open, onClose, title, description, tasks }) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No tasks to display</p>
          ) : (
            tasks.map(t => <TaskRow key={t.id} task={t} />)
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function TaskAnalytics() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const customerId = user?.customer_id;

  const [drillDown, setDrillDown] = useState(null); // { title, description, tasks }

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks-analytics', customerId],
    queryFn: () => isAdmin
      ? base44.entities.Task.list('-created_date', 500)
      : base44.entities.Task.filter({ customer_id: customerId }, '-created_date', 500),
    enabled: isAdmin || !!customerId,
  });

  const analytics = useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const workloadMap = {};
    tasks.forEach(task => {
      if (task.assigned_to) {
        if (!workloadMap[task.assigned_to]) {
          workloadMap[task.assigned_to] = { user: task.assigned_to, total: 0, completed: 0, inProgress: 0, tasks: [] };
        }
        workloadMap[task.assigned_to].total++;
        workloadMap[task.assigned_to].tasks.push(task);
        if (task.status === 'done') workloadMap[task.assigned_to].completed++;
        if (task.status === 'in_progress') workloadMap[task.assigned_to].inProgress++;
      }
    });
    const workloadData = Object.values(workloadMap).sort((a, b) => b.total - a.total);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueTasks = tasks.filter(t =>
      t.due_date && t.status !== 'done' && isAfter(today, parseISO(t.due_date))
    );

    const statusCounts = {
      todo: tasks.filter(t => t.status === 'todo').length,
      in_progress: inProgressTasks.length,
      done: completedTasks,
    };
    const statusData = [
      { name: STATUS_LABELS.todo, value: statusCounts.todo, color: COLORS[3] },
      { name: STATUS_LABELS.in_progress, value: statusCounts.in_progress, color: COLORS[2] },
      { name: STATUS_LABELS.done, value: statusCounts.done, color: COLORS[1] },
    ].filter(s => s.value > 0);

    const priorityCounts = {};
    tasks.forEach(task => {
      priorityCounts[task.priority] = (priorityCounts[task.priority] || 0) + 1;
    });
    const priorityData = Object.entries(priorityCounts).map(([priority, count]) => ({
      priority: priority.charAt(0).toUpperCase() + priority.slice(1),
      count,
    }));

    return {
      totalTasks,
      completedTasks,
      completionRate,
      inProgressTasks,
      workloadData,
      overdueTasks,
      statusData,
      priorityData,
    };
  }, [tasks]);

  const openDrillDown = (title, description, taskList) => {
    setDrillDown({ title, description, tasks: taskList });
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats — all clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
          onClick={() => openDrillDown(t('analytics_all_tasks'), `${analytics.totalTasks} ${t('analytics_tasks_total')}`, tasks)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">{t('analytics_total_tasks')}</p>
              <ListTodo className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{analytics.totalTasks}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('analytics_view_all')}</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md hover:border-accent/30 transition-all"
          onClick={() => openDrillDown(t('analytics_completed_tasks'), `${analytics.completedTasks} ${t('analytics_tasks_done')}`, tasks.filter(tk => tk.status === 'done'))}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">{t('analytics_completion_rate')}</p>
              <CheckCircle2 className="w-4 h-4 text-accent" />
            </div>
            <p className="text-2xl font-bold text-accent">{analytics.completionRate}%</p>
            <Progress value={analytics.completionRate} className="h-1.5 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">{analytics.completedTasks} {t('analytics_completed')}</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md hover:border-chart-3/30 transition-all"
          onClick={() => openDrillDown(t('analytics_in_progress'), `${analytics.inProgressTasks.length} ${t('analytics_tasks_active')}`, analytics.inProgressTasks)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">{t('analytics_in_progress')}</p>
              <Clock className="w-4 h-4 text-chart-3" />
            </div>
            <p className="text-2xl font-bold text-chart-3">{analytics.inProgressTasks.length}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('analytics_view_active')}</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md hover:border-destructive/30 transition-all"
          onClick={() => openDrillDown(t('analytics_overdue_title'), `${analytics.overdueTasks.length} ${t('analytics_tasks_past_due')}`, analytics.overdueTasks)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">{t('analytics_overdue')}</p>
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <p className="text-2xl font-bold text-destructive">{analytics.overdueTasks.length}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('analytics_view_overdue')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">{t('analytics_status_distribution')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center">
            {analytics.statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={analytics.statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name} (${value})`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {analytics.statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center">No tasks to display</p>
            )}
          </CardContent>
        </Card>

        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">{t('analytics_by_priority')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center">
            {analytics.priorityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={analytics.priorityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="priority" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center">No tasks to display</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Workload — rows clickable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            {t('analytics_workload')}
          </CardTitle>
          <CardDescription>{t('analytics_workload_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.workloadData.length > 0 ? (
            <div className="space-y-3">
              {analytics.workloadData.map((u) => {
                const rate = u.total > 0 ? Math.round((u.completed / u.total) * 100) : 0;
                return (
                  <div
                    key={u.user}
                    className="space-y-1.5 p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => openDrillDown(`${t('analytics_tasks_for')} ${u.user}`, `${u.total} ${u.total !== 1 ? t('analytics_tasks_assigned') : t('analytics_task_assigned')}`, u.tasks)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{u.user}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{u.total} {t('analytics_tasks_assigned')}</Badge>
                        <Badge variant="secondary" className="text-xs">{rate}%</Badge>
                      </div>
                    </div>
                    <Progress value={rate} className="h-2" />
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>✓ {u.completed} {t('analytics_done')}</span>
                      <span>→ {u.inProgress} {t('analytics_in_prog')}</span>
                      <span>○ {u.total - u.completed - u.inProgress} {t('analytics_todo')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('analytics_no_assigned')}</p>
          )}
        </CardContent>
      </Card>

      {/* Overdue Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            {t('analytics_overdue_title')} ({analytics.overdueTasks.length})
          </CardTitle>
          <CardDescription>{t('analytics_overdue_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.overdueTasks.length > 0 ? (
            <div className="space-y-2">
              {analytics.overdueTasks.map(task => <TaskRow key={task.id} task={task} />)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center text-accent">{t('analytics_no_overdue')}</p>
          )}
        </CardContent>
      </Card>

      {/* Drill-down sheet */}
      {drillDown && (
        <DrillDownSheet
          open={!!drillDown}
          onClose={() => setDrillDown(null)}
          title={drillDown.title}
          description={drillDown.description}
          tasks={drillDown.tasks}
        />
      )}
    </div>
  );
}