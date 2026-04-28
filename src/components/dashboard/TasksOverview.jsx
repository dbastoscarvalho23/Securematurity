import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { CheckSquare, ArrowRight, Circle, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const priorityStyles = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  medium: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  low: 'bg-muted text-muted-foreground',
};

const StatusIcon = ({ status }) => {
  if (status === 'done') return <CheckCircle2 className="w-3.5 h-3.5 text-accent flex-shrink-0" />;
  if (status === 'in_progress') return <Loader2 className="w-3.5 h-3.5 text-chart-3 flex-shrink-0" />;
  return <Circle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />;
};

export default function TasksOverview({ tasks }) {
  const done = tasks.filter(t => t.status === 'done').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const todo = tasks.filter(t => t.status === 'todo').length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const recentTasks = [...tasks]
    .sort((a, b) => {
      const order = { in_progress: 0, todo: 1, done: 2 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    })
    .slice(0, 6);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-primary" /> Task Implementation
          </CardTitle>
          <Link to="/tasks" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {/* Progress bar */}
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{done} of {total} tasks completed</span>
            <span className="font-semibold text-foreground">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground pt-0.5">
            <span><span className="font-medium text-chart-3">{inProgress}</span> in progress</span>
            <span><span className="font-medium text-muted-foreground">{todo}</span> to do</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No tasks yet.</p>
        ) : (
          <div className="space-y-1.5">
            {recentTasks.map(t => (
              <Link key={t.id} to="/tasks" className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/40 transition-colors group">
                <StatusIcon status={t.status} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm truncate group-hover:text-primary transition-colors", t.status === 'done' && "line-through text-muted-foreground")}>
                    {t.title}
                  </p>
                  {t.customer_name && (
                    <p className="text-xs text-muted-foreground truncate">{t.customer_name}</p>
                  )}
                </div>
                {t.priority && (
                  <Badge variant="outline" className={cn("text-xs border capitalize flex-shrink-0", priorityStyles[t.priority])}>
                    {t.priority}
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}