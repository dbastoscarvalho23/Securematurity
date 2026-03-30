import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const statusStyles = {
  draft: 'bg-muted text-muted-foreground',
  in_progress: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  completed: 'bg-accent/10 text-accent border-accent/20',
  archived: 'bg-muted text-muted-foreground',
};

export default function RecentActivity({ assessments }) {
  if (!assessments || assessments.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Recent Assessments</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground text-sm py-8 text-center">
          No assessments yet. Create your first assessment to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Recent Assessments</CardTitle>
          <Link to="/assessments" className="text-xs text-primary hover:underline">View all</Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {assessments.map(a => (
            <Link
              key={a.id}
              to={`/assessments/${a.id}`}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                  {a.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {a.customer_name} · {a.period}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Badge variant="outline" className={cn("text-xs border", statusStyles[a.status])}>
                  {a.status?.replace('_', ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {a.created_date ? format(new Date(a.created_date), 'MMM d') : ''}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}