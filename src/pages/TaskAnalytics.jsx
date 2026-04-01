import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle, CheckCircle2, Clock, Users } from 'lucide-react';
import { format, isAfter, parseISO } from 'date-fns';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444'];

export default function TaskAnalytics() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const customerId = user?.customer_id;

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks-analytics', customerId],
    queryFn: () => isAdmin
      ? base44.entities.Task.list('-created_date', 500)
      : base44.entities.Task.filter({ customer_id: customerId }, '-created_date', 500),
    enabled: isAdmin || !!customerId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => base44.entities.User.list(),
  });

  const analytics = useMemo(() => {
    // Calculate completion rate
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Workload per user
    const workloadMap = {};
    tasks.forEach(task => {
      if (task.assigned_to) {
        if (!workloadMap[task.assigned_to]) {
          workloadMap[task.assigned_to] = { user: task.assigned_to, total: 0, completed: 0, inProgress: 0 };
        }
        workloadMap[task.assigned_to].total++;
        if (task.status === 'done') workloadMap[task.assigned_to].completed++;
        if (task.status === 'in_progress') workloadMap[task.assigned_to].inProgress++;
      }
    });
    const workloadData = Object.values(workloadMap).sort((a, b) => b.total - a.total);

    // Overdue tasks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueTasks = tasks.filter(t => 
      t.due_date && 
      t.status !== 'done' && 
      isAfter(today, parseISO(t.due_date))
    );

    // Task status distribution
    const statusCounts = {
      todo: tasks.filter(t => t.status === 'todo').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      done: tasks.filter(t => t.status === 'done').length,
    };
    const statusData = [
      { name: 'To-Do', value: statusCounts.todo, color: COLORS[3] },
      { name: 'In Progress', value: statusCounts.in_progress, color: COLORS[2] },
      { name: 'Done', value: statusCounts.done, color: COLORS[1] },
    ].filter(s => s.value > 0);

    // Priority distribution
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
      workloadData,
      overdueTasks,
      statusData,
      priorityData,
    };
  }, [tasks]);

  const getPriorityColor = (priority) => {
    const colors = {
      critical: 'text-destructive',
      high: 'text-chart-4',
      medium: 'text-chart-3',
      low: 'text-muted-foreground',
    };
    return colors[priority] || 'text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Tasks</p>
            <p className="text-2xl font-bold">{analytics.totalTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Completion Rate</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-accent">{analytics.completionRate}%</p>
              <CheckCircle2 className="w-5 h-5 text-accent" />
            </div>
            <Progress value={analytics.completionRate} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">In Progress</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-chart-3">{analytics.statusData.find(s => s.name === 'In Progress')?.value || 0}</p>
              <Clock className="w-5 h-5 text-chart-3" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Overdue Tasks</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-destructive">{analytics.overdueTasks.length}</p>
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Task Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name} (${value})`}
                    outerRadius={100}
                    fill="#8884d8"
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
              <p className="text-sm text-muted-foreground py-8 text-center">No tasks to display</p>
            )}
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.priorityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.priorityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="priority" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No tasks to display</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Workload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Workload Distribution by User
          </CardTitle>
          <CardDescription>Task allocation and completion status per team member</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.workloadData.length > 0 ? (
            <div className="space-y-4">
              {analytics.workloadData.map((user) => {
                const completionRate = user.total > 0 ? Math.round((user.completed / user.total) * 100) : 0;
                return (
                  <div key={user.user} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{user.user}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{user.total} tasks</Badge>
                        <Badge variant="secondary" className="text-xs">{completionRate}%</Badge>
                      </div>
                    </div>
                    <Progress value={completionRate} className="h-2" />
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>✓ {user.completed} done</span>
                      <span>→ {user.inProgress} in progress</span>
                      <span>○ {user.total - user.completed - user.inProgress} to-do</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No assigned tasks</p>
          )}
        </CardContent>
      </Card>

      {/* Overdue Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Overdue Tasks ({analytics.overdueTasks.length})
          </CardTitle>
          <CardDescription>Tasks past due date and not completed</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.overdueTasks.length > 0 ? (
            <div className="space-y-2">
              {analytics.overdueTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border bg-destructive/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                      {task.due_date && <span>Due: {format(parseISO(task.due_date), 'MMM d')}</span>}
                      {task.assigned_to && <span>• Assigned to: {task.assigned_to}</span>}
                    </div>
                  </div>
                  <Badge className={`ml-2 flex-shrink-0 ${getPriorityColor(task.priority)}`} variant="outline">
                    {task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center text-accent">✓ No overdue tasks</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}