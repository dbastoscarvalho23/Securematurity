import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ShieldAlert, CheckCircle2, AlertTriangle, TrendingUp,
  ClipboardList, Calendar, Target, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { riskScore } from '@/lib/riskEngine';

const RISK_STATUS_COLORS = {
  open: 'bg-destructive/10 text-destructive border-destructive/20',
  in_treatment: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  accepted: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  closed: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
};

const PRIORITY_COLORS = {
  critical: 'bg-destructive/10 text-destructive',
  high: 'bg-chart-4/10 text-chart-4',
  medium: 'bg-chart-3/10 text-chart-3',
  low: 'bg-chart-2/10 text-chart-2',
};

export default function AnnualReport() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const customerId = user?.customer_id;

  const { data: risks = [] } = useQuery({
    queryKey: ['annual-report-risks', customerId],
    queryFn: () => isAdmin
      ? base44.entities.RiskItem.list('-created_date', 500)
      : base44.entities.RiskItem.filter({ customer_id: customerId }, '-created_date', 500),
    enabled: isAdmin || !!customerId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['annual-report-tasks', customerId],
    queryFn: () => isAdmin
      ? base44.entities.Task.list('-created_date', 500)
      : base44.entities.Task.filter({ customer_id: customerId }, '-created_date', 500),
    enabled: isAdmin || !!customerId,
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ['annual-report-recs', customerId],
    queryFn: () => isAdmin
      ? base44.entities.Recommendation.list('-created_date', 500)
      : base44.entities.Recommendation.filter({ customer_id: customerId }, '-created_date', 500),
    enabled: isAdmin || !!customerId,
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ['annual-report-assessments', customerId],
    queryFn: () => isAdmin
      ? base44.entities.Assessment.list('-created_date', 50)
      : base44.entities.Assessment.filter({ customer_id: customerId }, '-created_date', 50),
    enabled: isAdmin || !!customerId,
  });

  // --- Computed stats ---

  const riskStats = useMemo(() => {
    const byStatus = { open: 0, in_treatment: 0, accepted: 0, closed: 0 };
    const byCategory = {};
    let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0;
    risks.forEach(r => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      const cat = r.category || 'other';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      const score = riskScore(r.impact, r.likelihood);
      if (score >= 16) criticalCount++;
      else if (score >= 9) highCount++;
      else if (score >= 4) mediumCount++;
      else lowCount++;
    });
    return { byStatus, byCategory, criticalCount, highCount, mediumCount, lowCount, total: risks.length };
  }, [risks]);

  const measureStats = useMemo(() => {
    const taskDone = tasks.filter(t => t.status === 'done').length;
    const taskInProgress = tasks.filter(t => t.status === 'in_progress').length;
    const taskTodo = tasks.filter(t => t.status === 'todo').length;
    const taskBlocked = tasks.filter(t => t.status === 'blocked').length;
    const recPending = recommendations.filter(r => r.status === 'pending').length;
    const recInProgress = recommendations.filter(r => r.status === 'in_progress').length;
    const recCompleted = recommendations.filter(r => r.status === 'completed').length;
    const taskTotal = tasks.length;
    const recTotal = recommendations.length;
    const taskCompletionRate = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
    const recCompletionRate = recTotal > 0 ? Math.round(((recCompleted + recInProgress) / recTotal) * 100) : 0;
    return { taskDone, taskInProgress, taskTodo, taskBlocked, taskTotal, taskCompletionRate, recPending, recInProgress, recCompleted, recTotal, recCompletionRate };
  }, [tasks, recommendations]);

  const incidentRisks = useMemo(() =>
    risks.filter(r => {
      const score = riskScore(r.impact, r.likelihood);
      return score >= 9 && r.status !== 'closed';
    }).sort((a, b) => riskScore(b.impact, b.likelihood) - riskScore(a.impact, a.likelihood)),
    [risks]
  );

  const futurePlans = useMemo(() => {
    const upcomingAssessments = assessments.filter(a => a.status === 'draft' || a.status === 'in_progress');
    const pendingHighRecs = recommendations.filter(r => r.priority === 'critical' || r.priority === 'high').filter(r => r.status !== 'completed' && r.status !== 'dismissed');
    const upcomingTasks = tasks.filter(t => t.due_date && t.status !== 'done').sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    return { upcomingAssessments, pendingHighRecs, upcomingTasks };
  }, [assessments, recommendations, tasks]);

  const yearLabel = new Date().getFullYear();

  // --- Helpers ---
  const statusLabel = (s) => ({
    open: t('risk_status_open'),
    in_treatment: t('risk_status_in_treatment'),
    accepted: t('risk_status_accepted'),
    closed: t('risk_status_closed'),
  })[s] || s;

  const priorityLabel = (p) => ({
    critical: t('tasks_priority_critical'),
    high: t('tasks_priority_high'),
    medium: t('tasks_priority_medium'),
    low: t('tasks_priority_low'),
  })[p] || p;

  const catLabel = (cat) => {
    const map = {
      access_control: t('risk_cat_access_control'),
      data_protection: t('risk_cat_data_protection'),
      network_security: t('risk_cat_network_security'),
      physical_security: t('risk_cat_physical_security'),
      third_party: t('risk_cat_third_party'),
      compliance: t('risk_cat_compliance'),
      operational: t('risk_cat_operational'),
      other: t('risk_cat_other'),
    };
    return map[cat] || cat;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            {t('annual_report_title')} {yearLabel}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t('annual_report_subtitle')}</p>
        </div>
      </div>

      {/* Section 1: Risks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-destructive" />
            {t('annual_report_section_risks')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Risk KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{riskStats.total}</p>
              <p className="text-xs text-muted-foreground">{t('annual_report_total_risks')}</p>
            </div>
            {Object.entries(riskStats.byStatus).map(([status, count]) => (
              <div key={status} className="bg-muted/40 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{count}</p>
                <Badge variant="outline" className={cn('text-[10px] mt-0.5', RISK_STATUS_COLORS[status])}>
                  {statusLabel(status)}
                </Badge>
              </div>
            ))}
          </div>

          {/* Severity distribution */}
          {riskStats.total > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{t('annual_report_risk_severity')}</p>
              <div className="flex h-2.5 rounded-full overflow-hidden w-full gap-px">
                {riskStats.criticalCount > 0 && <div className="bg-destructive transition-all" style={{ width: `${Math.round((riskStats.criticalCount / riskStats.total) * 100)}%` }} />}
                {riskStats.highCount > 0 && <div className="bg-chart-4 transition-all" style={{ width: `${Math.round((riskStats.highCount / riskStats.total) * 100)}%` }} />}
                {riskStats.mediumCount > 0 && <div className="bg-chart-3 transition-all" style={{ width: `${Math.round((riskStats.mediumCount / riskStats.total) * 100)}%` }} />}
                {riskStats.lowCount > 0 && <div className="bg-chart-2 transition-all" style={{ width: `${Math.round((riskStats.lowCount / riskStats.total) * 100)}%` }} />}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-destructive inline-block" /> {t('risk_level_critical')}: {riskStats.criticalCount}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-chart-4 inline-block" /> {t('risk_level_high')}: {riskStats.highCount}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-chart-3 inline-block" /> {t('risk_level_medium')}: {riskStats.mediumCount}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-chart-2 inline-block" /> {t('risk_level_low')}: {riskStats.lowCount}</span>
              </div>
            </div>
          )}

          {/* Top categories */}
          {Object.keys(riskStats.byCategory).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{t('annual_report_risk_by_category')}</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(riskStats.byCategory)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([cat, count]) => (
                    <Badge key={cat} variant="outline" className="text-xs">
                      {catLabel(cat)}: {count}
                    </Badge>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Measures */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            {t('annual_report_section_measures')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tasks */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">{t('annual_report_tasks')}</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">{measureStats.taskDone}</p>
                  <p className="text-xs text-muted-foreground">{t('tasks_status_done')}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">{measureStats.taskInProgress}</p>
                  <p className="text-xs text-muted-foreground">{t('tasks_status_in_progress')}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">{measureStats.taskTodo}</p>
                  <p className="text-xs text-muted-foreground">{t('tasks_status_todo')}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">{measureStats.taskBlocked}</p>
                  <p className="text-xs text-muted-foreground">{t('tasks_status_blocked')}</p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('annual_report_completion')}</span>
                  <span className="font-medium">{measureStats.taskCompletionRate}%</span>
                </div>
                <Progress value={measureStats.taskCompletionRate} className="h-2" />
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">{t('annual_report_recommendations')}</h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">{measureStats.recCompleted}</p>
                  <p className="text-xs text-muted-foreground">{t('annual_report_completed')}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">{measureStats.recInProgress}</p>
                  <p className="text-xs text-muted-foreground">{t('annual_report_in_progress')}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">{measureStats.recPending}</p>
                  <p className="text-xs text-muted-foreground">{t('annual_report_pending')}</p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('annual_report_progress')}</span>
                  <span className="font-medium">{measureStats.recCompletionRate}%</span>
                </div>
                <Progress value={measureStats.recCompletionRate} className="h-2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Incidents */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-chart-4" />
            {t('annual_report_section_incidents')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {incidentRisks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t('annual_report_no_incidents')}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">
                {t('annual_report_incidents_desc')} <strong>{incidentRisks.length}</strong> {t('annual_report_active_high_risks')}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {incidentRisks.slice(0, 8).map(r => {
                  const score = riskScore(r.impact, r.likelihood);
                  const level = score >= 16 ? 'critical' : 'high';
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/20 text-sm">
                      <div className={cn('w-8 h-8 rounded-md flex items-center justify-center font-bold text-xs flex-shrink-0',
                        level === 'critical' ? 'bg-destructive/15 text-destructive' : 'bg-chart-4/15 text-chart-4')}>
                        {score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">{r.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className={cn('text-[10px] py-0', PRIORITY_COLORS[level])}>{t(level === 'critical' ? 'risk_level_critical' : 'risk_level_high')}</Badge>
                          <span className="text-[10px] text-muted-foreground">{statusLabel(r.status)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {incidentRisks.length > 8 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{incidentRisks.length - 8} {t('annual_report_more')}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Future Plans */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" />
            {t('annual_report_section_future')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Upcoming assessments */}
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              {t('annual_report_upcoming_assessments')}
            </h4>
            {futurePlans.upcomingAssessments.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('annual_report_no_upcoming_assessments')}</p>
            ) : (
              <div className="space-y-1.5">
                {futurePlans.upcomingAssessments.slice(0, 4).map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/30">
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium flex-1">{a.title}</span>
                    <span className="text-xs text-muted-foreground">{a.customer_name} · {a.period}</span>
                    <Badge variant="outline" className="text-[10px]">{t(`assessments_status_${a.status}`)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Priority recommendations */}
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <Target className="w-3.5 h-3.5 text-muted-foreground" />
              {t('annual_report_priority_actions')}
            </h4>
            {futurePlans.pendingHighRecs.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('annual_report_no_priority_recs')}</p>
            ) : (
              <div className="space-y-1.5">
                {futurePlans.pendingHighRecs.slice(0, 4).map(rec => (
                  <div key={rec.id} className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/30">
                    <Badge className={cn('text-[10px] py-0', PRIORITY_COLORS[rec.priority] || '')}>
                      {priorityLabel(rec.priority)}
                    </Badge>
                    <span className="font-medium text-xs flex-1 truncate">{rec.title}</span>
                    <span className="text-[10px] text-muted-foreground">{rec.framework_code}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming tasks */}
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
              {t('annual_report_upcoming_tasks')}
            </h4>
            {futurePlans.upcomingTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('annual_report_no_upcoming_tasks')}</p>
            ) : (
              <div className="space-y-1.5">
                {futurePlans.upcomingTasks.slice(0, 4).map(task => (
                  <div key={task.id} className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/30">
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium text-xs flex-1 truncate">{task.title}</span>
                    {task.due_date && <span className="text-[10px] text-muted-foreground">{task.due_date}</span>}
                    <Badge className={cn('text-[10px] py-0', PRIORITY_COLORS[task.priority] || '')}>
                      {priorityLabel(task.priority)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}