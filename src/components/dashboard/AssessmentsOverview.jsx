import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { ClipboardCheck, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';

const statusStyles = {
  draft: 'bg-muted text-muted-foreground',
  in_progress: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  completed: 'bg-accent/10 text-accent border-accent/20',
  archived: 'bg-muted text-muted-foreground',
};

export default function AssessmentsOverview({ assessments }) {
  const { t } = useLanguage();
  const completed = assessments.filter(a => a.status === 'completed').length;
  const inProgress = assessments.filter(a => a.status === 'in_progress').length;
  const draft = assessments.filter(a => a.status === 'draft').length;

  const statusLabel = (s) => {
    if (s === 'completed') return t('dashboard_completed');
    if (s === 'in_progress') return t('assessments_status_in_progress');
    if (s === 'draft') return t('dashboard_draft');
    if (s === 'archived') return t('assessments_status_archived');
    return s;
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" /> {t('dashboard_assessments')}
          </CardTitle>
          <Link to="/assessments" className="text-xs text-primary hover:underline flex items-center gap-1">
            {t('dashboard_view_all')} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="flex gap-3 text-sm mt-1">
          <span><span className="font-semibold text-accent">{completed}</span> <span className="text-muted-foreground text-xs">{t('dashboard_completed')}</span></span>
          <span><span className="font-semibold text-chart-3">{inProgress}</span> <span className="text-muted-foreground text-xs">{t('dashboard_in_prog')}</span></span>
          <span><span className="font-semibold text-muted-foreground">{draft}</span> <span className="text-muted-foreground text-xs">{t('dashboard_draft')}</span></span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {assessments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t('dashboard_no_assessments')}</p>
        ) : (
          <div className="space-y-2">
            {assessments.slice(0, 6).map(a => (
              <Link key={a.id} to={`/assessments/${a.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/40 transition-colors group">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{a.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.customer_name} · {a.period}
                    {a.overall_score ? ` · ${t('dashboard_score')}: ${a.overall_score.toFixed(1)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <Badge variant="outline" className={cn("text-xs border capitalize", statusStyles[a.status])}>
                    {statusLabel(a.status)}
                  </Badge>
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {a.created_date ? format(new Date(a.created_date), 'MMM d') : ''}
                  </span>
                </div>
              </Link>
            ))}
            {assessments.length > 6 && (
              <p className="text-xs text-muted-foreground text-center pt-1">+{assessments.length - 6} {t('dashboard_more')}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}