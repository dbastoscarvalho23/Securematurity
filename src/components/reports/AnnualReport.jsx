import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Progress } from '@/components/ui/progress';
import { Calendar, CheckCircle2, Target, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { riskScore } from '@/lib/riskEngine';
import RecordDetailDialog from '@/components/reports/RecordDetailDialog';

// Cores como no Figma (Relatórios - 2): borda colorida + fundo a 10%.
const RISK_STATUS_COLORS = {
  open: 'bg-destructive/10 text-destructive border-destructive/60',
  in_treatment: 'bg-risk-high/10 text-risk-high border-risk-high/60',
  accepted: 'bg-accent/10 text-accent border-accent/60',
  closed: 'bg-primary/10 text-primary border-primary/60',
};

const PRIORITY_COLORS = {
  critical: 'bg-destructive/10 text-destructive border-destructive/60',
  high: 'bg-risk-high/10 text-risk-high border-risk-high/60',
  medium: 'bg-risk-medium/10 text-risk-medium border-risk-medium/60',
  low: 'bg-accent/10 text-accent border-accent/60',
};

const SEVERITY_SWATCH = {
  critical: 'bg-destructive',
  high: 'bg-risk-high',
  medium: 'bg-risk-medium',
  low: 'bg-accent',
};

function Pill({ className, children }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold leading-none whitespace-nowrap', className)}>
      {children}
    </span>
  );
}

function KpiTile({ value, active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[70px] w-full flex-col items-center justify-center gap-2 rounded-lg bg-background p-3 text-center transition-colors hover:bg-muted/60',
        active && 'ring-1 ring-primary'
      )}>
      <span className="font-display text-[20px] leading-none text-foreground">{value}</span>
      {children}
    </button>
  );
}

function SectionTitle({ children }) {
  return <h3 className="text-[13px] font-semibold text-foreground">{children}</h3>;
}

function SubTitle({ icon: Icon, children }) {
  return (
    <h4 className="flex items-center gap-2 text-[11px] font-semibold text-foreground">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      {children}
    </h4>
  );
}

function ListRow({ onClick, className, children }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick?.(); } }}
      className={cn('flex items-center gap-3 rounded-md bg-background p-2.5 cursor-pointer transition-colors hover:bg-muted/60', className)}>
      {children}
    </div>
  );
}

const linkBtn = 'text-[10px] font-medium text-primary hover:underline';

export default function AnnualReport({ selectedCustomer = 'all' }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const customerId = user?.customer_id;

  // Fetch all records from all customers, then filter client-side for consistency with Risk Assessment page
  const { data: allRisks = [] } = useQuery({
    queryKey: ['annual-report-risks'],
    queryFn: () => base44.entities.RiskItem.list('-created_date', 5000),
    enabled: isAdmin || !!customerId,
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['annual-report-tasks'],
    queryFn: () => base44.entities.Task.list('-created_date', 5000),
    enabled: isAdmin || !!customerId,
  });

  const { data: allRecommendations = [] } = useQuery({
    queryKey: ['annual-report-recs'],
    queryFn: () => base44.entities.Recommendation.list('-created_date', 5000),
    enabled: isAdmin || !!customerId,
  });

  const { data: allAssessments = [] } = useQuery({
    queryKey: ['annual-report-assessments'],
    queryFn: () => base44.entities.Assessment.list('-created_date', 500),
    enabled: isAdmin || !!customerId,
  });

  // Client-side scope by selected customer (matching Risk Assessment page behavior)
  const scopeByCustomer = (items) => {
    if (!isAdmin) return items.filter(r => !r.customer_id || r.customer_id === customerId);
    if (selectedCustomer === 'all') return items;
    return items.filter(r => r.customer_id === selectedCustomer);
  };

  const risks = useMemo(() => scopeByCustomer(allRisks), [allRisks, isAdmin, customerId, selectedCustomer]);
  const tasks = useMemo(() => scopeByCustomer(allTasks), [allTasks, isAdmin, customerId, selectedCustomer]);
  const recommendations = useMemo(() => scopeByCustomer(allRecommendations), [allRecommendations, isAdmin, customerId, selectedCustomer]);
  const assessments = useMemo(() => scopeByCustomer(allAssessments), [allAssessments, isAdmin, customerId, selectedCustomer]);

  // --- Drill-down state ---
  const [drillDown, setDrillDown] = useState(null); // { section, filter }
  const [detail, setDetail] = useState(null); // { type, record }

  const clearDrillDown = () => setDrillDown(null);
  const isDrillActive = (section, filter) =>
    drillDown?.section === section && JSON.stringify(drillDown.filter) === JSON.stringify(filter);

  // Filtered data for drill-down display
  const filteredRisks = useMemo(() => {
    if (drillDown?.section !== 'risks') return [];
    const { filter } = drillDown;
    return risks.filter(r => {
      if (filter.status && r.status !== filter.status) return false;
      if (filter.category && r.category !== filter.category) return false;
      if (filter.severity) {
        const score = riskScore(r.impact, r.likelihood);
        if (filter.severity === 'critical' && score < 16) return false;
        if (filter.severity === 'high' && (score < 9 || score >= 16)) return false;
        if (filter.severity === 'medium' && (score < 4 || score >= 9)) return false;
        if (filter.severity === 'low' && score >= 4) return false;
      }
      return true;
    });
  }, [drillDown, risks]);

  const filteredTasks = useMemo(() => {
    if (drillDown?.section !== 'measures') return [];
    const { filter } = drillDown;
    if (filter?.type === 'tasks') return tasks.filter(t => t.status === filter.status);
    return [];
  }, [drillDown, tasks]);

  const filteredRecs = useMemo(() => {
    if (drillDown?.section !== 'measures') return [];
    const { filter } = drillDown;
    if (filter?.type === 'recommendations') return recommendations.filter(r => r.status === filter.status);
    return [];
  }, [drillDown, recommendations]);

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

  const drillLabel = useMemo(() => {
    if (!drillDown) return '';
    const { section, filter } = drillDown;
    if (section === 'risks') {
      if (filter.status) return `${statusLabel(filter.status)} — ${t('risks')}`;
      if (filter.severity) return `${t('risk_level_' + filter.severity)} — ${t('risks')}`;
      if (filter.category) return `${catLabel(filter.category)} — ${t('risks')}`;
    }
    if (section === 'measures') {
      if (filter.type === 'tasks') return `${t('annual_report_tasks')} — ${statusLabel(filter.status)}`;
      if (filter.type === 'recommendations') return `${t('annual_report_recommendations')} — ${statusLabel(filter.status)}`;
    }
    return '';
  }, [drillDown, t]);

  // Drill-down renderer
  const drillHeader = () => (
    <div className="flex items-center justify-between mb-2">
      <p className="text-[11px] font-semibold text-foreground">{drillLabel}</p>
      <button onClick={clearDrillDown} className={linkBtn}>{t('annual_report_close')}</button>
    </div>
  );

  const renderDrillRisks = () => (
    <div className="border-t border-border pt-3">
      {drillHeader()}
      {filteredRisks.length === 0 ? (
        <p className="text-[11px] text-muted-foreground text-center py-4">{t('annual_report_no_results')}</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {filteredRisks.map(r => {
            const score = riskScore(r.impact, r.likelihood);
            const level = score >= 16 ? 'critical' : score >= 9 ? 'high' : score >= 4 ? 'medium' : 'low';
            return (
              <ListRow key={r.id} onClick={() => setDetail({ type: 'risk', record: r })}>
                <span className={cn('font-display w-8 h-6 rounded-md border text-[10px] flex items-center justify-center flex-shrink-0', PRIORITY_COLORS[level])}>
                  {score}
                </span>
                <span className="font-medium text-[10px] text-foreground flex-1 truncate">{r.title}</span>
                <Pill className={RISK_STATUS_COLORS[r.status]}>{statusLabel(r.status)}</Pill>
              </ListRow>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderDrillItems = (items, type) => (
    <div className="border-t border-border pt-3">
      {drillHeader()}
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground text-center py-4">{t('annual_report_no_results')}</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {items.map(item => (
            <ListRow key={item.id} onClick={() => setDetail({ type: type === 'tasks' ? 'task' : 'recommendation', record: item })}>
              <span className="font-medium text-[10px] text-foreground flex-1 truncate">{item.title}</span>
              {item.priority && (
                <Pill className={PRIORITY_COLORS[item.priority]}>{priorityLabel(item.priority)}</Pill>
              )}
              {type === 'recommendations' && item.framework_code && (
                <span className="text-[9px] text-muted-foreground">{item.framework_code}</span>
              )}
            </ListRow>
          ))}
        </div>
      )}
    </div>
  );

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

  const renderIncidentRow = (r) => {
    const score = riskScore(r.impact, r.likelihood);
    const level = score >= 16 ? 'critical' : 'high';
    return (
      <ListRow key={r.id} onClick={() => setDetail({ type: 'risk', record: r })}>
        <span className={cn('font-display w-8 h-8 rounded-md border flex items-center justify-center text-[11px] flex-shrink-0', PRIORITY_COLORS[level])}>
          {score}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[10px] text-foreground truncate">{r.title}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Pill className={PRIORITY_COLORS[level]}>{t(level === 'critical' ? 'risk_level_critical' : 'risk_level_high')}</Pill>
            <span className="text-[9px] text-muted-foreground">{statusLabel(r.status)}</span>
          </div>
        </div>
      </ListRow>
    );
  };

  const severityItems = [
    { key: 'critical', count: riskStats.criticalCount },
    { key: 'high', count: riskStats.highCount },
    { key: 'medium', count: riskStats.mediumCount },
    { key: 'low', count: riskStats.lowCount },
  ];

  return (
    <section className="bg-card border border-border rounded-[12px] p-5 sm:p-6 space-y-5">
      {/* Cabeçalho */}
      <div className="space-y-1">
        <h2 className="text-[18px] font-bold leading-tight text-foreground">
          {t('annual_report_title')} {yearLabel}
        </h2>
        <p className="text-[11px] text-muted-foreground">{t('annual_report_subtitle')}</p>
      </div>

      {/* 1. Riscos */}
      <div className="space-y-3">
        <SectionTitle>{t('annual_report_section_risks')}</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiTile
            value={riskStats.total}
            onClick={() => setDrillDown({ section: 'risks', filter: {} })}>
            <span className="text-[9px] font-medium text-muted-foreground">{t('annual_report_total_risks')}</span>
          </KpiTile>
          {Object.entries(riskStats.byStatus).map(([status, count]) => (
            <KpiTile key={status}
              value={count}
              active={isDrillActive('risks', { status })}
              onClick={() => setDrillDown(
                isDrillActive('risks', { status }) ? null : { section: 'risks', filter: { status } }
              )}>
              <Pill className={RISK_STATUS_COLORS[status]}>{statusLabel(status)}</Pill>
            </KpiTile>
          ))}
        </div>

        {/* Distribuição por gravidade */}
        {riskStats.total > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] text-muted-foreground">{t('annual_report_risk_severity')}</p>
            <div className="flex h-1.5 rounded-[3px] overflow-hidden w-full gap-px bg-border">
              {severityItems.map(({ key, count }) => count > 0 && (
                <div key={key} className={cn(SEVERITY_SWATCH[key], 'transition-all')} style={{ width: `${Math.round((count / riskStats.total) * 100)}%` }} />
              ))}
            </div>
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground flex-wrap">
              {severityItems.map(({ key, count }) => (
                <button key={key} type="button"
                  className={cn('flex items-center gap-1 hover:text-foreground transition-colors', isDrillActive('risks', { severity: key }) && 'text-foreground font-semibold')}
                  onClick={() => setDrillDown(isDrillActive('risks', { severity: key }) ? null : { section: 'risks', filter: { severity: key } })}>
                  <span className={cn('w-2 h-2 rounded-sm inline-block', SEVERITY_SWATCH[key])} /> {t('risk_level_' + key)}: {count}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Categorias principais */}
        {Object.keys(riskStats.byCategory).length > 0 && (
          <div className="space-y-2">
            <p className="text-[9px] text-muted-foreground">{t('annual_report_risk_by_category')}</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(riskStats.byCategory)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([cat, count]) => (
                  <button key={cat} type="button"
                    className={cn('rounded-md border border-border bg-background px-2 py-[3px] text-[9px] font-semibold text-muted-foreground hover:text-foreground transition-colors',
                      isDrillActive('risks', { category: cat }) && 'border-primary text-foreground')}
                    onClick={() => setDrillDown(isDrillActive('risks', { category: cat }) ? null : { section: 'risks', filter: { category: cat } })}>
                    {catLabel(cat)}: <span className="text-foreground">{count}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
        {drillDown?.section === 'risks' && renderDrillRisks()}
      </div>

      {/* 2. Medidas */}
      <div className="space-y-3">
        <SectionTitle>{t('annual_report_section_measures')}</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {/* Tarefas */}
          <div className="rounded-lg border border-border p-4 space-y-4">
            <h4 className="text-[11px] font-semibold text-foreground">{t('annual_report_tasks')}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { status: 'done', count: measureStats.taskDone, label: t('tasks_status_done') },
                { status: 'in_progress', count: measureStats.taskInProgress, label: t('tasks_status_in_progress') },
                { status: 'todo', count: measureStats.taskTodo, label: t('tasks_status_todo') },
                { status: 'blocked', count: measureStats.taskBlocked, label: t('tasks_status_blocked') },
              ].map(({ status, count, label }) => (
                <KpiTile key={status}
                  value={count}
                  active={isDrillActive('measures', { type: 'tasks', status })}
                  onClick={() => setDrillDown(
                    isDrillActive('measures', { type: 'tasks', status }) ? null : { section: 'measures', filter: { type: 'tasks', status } }
                  )}>
                  <span className="text-[9px] font-medium text-muted-foreground">{label}</span>
                </KpiTile>
              ))}
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[9px]">
                <span className="text-muted-foreground">{t('annual_report_completion')}</span>
                <span className="font-semibold text-foreground">{measureStats.taskCompletionRate}%</span>
              </div>
              <Progress value={measureStats.taskCompletionRate} className="h-1.5 rounded-[3px]" indicatorClassName="rounded-none" />
            </div>
          </div>

          {/* Recomendações */}
          <div className="rounded-lg border border-border p-4 space-y-4">
            <h4 className="text-[11px] font-semibold text-foreground">{t('annual_report_recommendations')}</h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { status: 'completed', count: measureStats.recCompleted, label: t('annual_report_completed') },
                { status: 'in_progress', count: measureStats.recInProgress, label: t('annual_report_in_progress') },
                { status: 'pending', count: measureStats.recPending, label: t('annual_report_pending') },
              ].map(({ status, count, label }) => (
                <KpiTile key={status}
                  value={count}
                  active={isDrillActive('measures', { type: 'recommendations', status })}
                  onClick={() => setDrillDown(
                    isDrillActive('measures', { type: 'recommendations', status }) ? null : { section: 'measures', filter: { type: 'recommendations', status } }
                  )}>
                  <span className="text-[9px] font-medium text-muted-foreground">{label}</span>
                </KpiTile>
              ))}
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[9px]">
                <span className="text-muted-foreground">{t('annual_report_progress')}</span>
                <span className="font-semibold text-foreground">{measureStats.recCompletionRate}%</span>
              </div>
              <Progress value={measureStats.recCompletionRate} className="h-1.5 rounded-[3px]" indicatorClassName="rounded-none" />
            </div>
          </div>
        </div>
        {drillDown?.section === 'measures' && (
          drillDown.filter?.type === 'tasks'
            ? renderDrillItems(filteredTasks, 'tasks')
            : renderDrillItems(filteredRecs, 'recommendations')
        )}
      </div>

      {/* 3. Incidentes */}
      <div className="space-y-3">
        <SectionTitle>{t('annual_report_section_incidents')}</SectionTitle>
        {incidentRisks.length === 0 ? (
          <div className="rounded-lg border border-accent/60 bg-accent/5 p-4">
            <p className="text-[11px] text-foreground">{t('annual_report_no_incidents')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              {t('annual_report_incidents_desc')} <strong className="text-foreground">{incidentRisks.length}</strong> {t('annual_report_active_high_risks')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {incidentRisks.slice(0, 8).map(renderIncidentRow)}
            </div>
            {incidentRisks.length > 8 && !isDrillActive('incidents', {}) && (
              <button
                className={cn(linkBtn, 'block w-full text-center pt-1')}
                onClick={() => setDrillDown({ section: 'incidents', filter: {} })}>
                +{incidentRisks.length - 8} {t('annual_report_more')}
              </button>
            )}
            {drillDown?.section === 'incidents' && (
              <div className="border-t border-border pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-foreground">{t('annual_report_all_incidents')} ({incidentRisks.length})</p>
                  <button onClick={clearDrillDown} className={linkBtn}>{t('annual_report_close')}</button>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {incidentRisks.map(renderIncidentRow)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Planos futuros */}
      <div className="space-y-4">
        <SectionTitle>{t('annual_report_section_future')}</SectionTitle>
        <div className="space-y-3">
          {/* Próximas avaliações */}
          <div className="space-y-2">
            <SubTitle icon={Calendar}>{t('annual_report_upcoming_assessments')}</SubTitle>
            {futurePlans.upcomingAssessments.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">{t('annual_report_no_upcoming_assessments')}</p>
            ) : (
              <div className="space-y-1.5">
                {futurePlans.upcomingAssessments.slice(0, isDrillActive('future', { type: 'assessments' }) ? undefined : 4).map(a => (
                  <ListRow key={a.id} className="flex-wrap p-3 sm:flex-nowrap" onClick={() => setDetail({ type: 'assessment', record: a })}>
                    <ArrowRight className="w-3 h-3 text-foreground flex-shrink-0" />
                    <span className="text-[10px] font-semibold text-foreground flex-1 min-w-0 truncate">{a.title}</span>
                    <span className="text-[9px] text-muted-foreground">{a.customer_name} · {a.period}</span>
                    <span className="rounded-md px-2 py-[3px] text-[9px] font-semibold text-foreground">{t(`assessments_status_${a.status}`)}</span>
                  </ListRow>
                ))}
                {futurePlans.upcomingAssessments.length > 4 && !isDrillActive('future', { type: 'assessments' }) && (
                  <button className={cn(linkBtn, 'block w-full text-center pt-1')}
                    onClick={() => setDrillDown({ section: 'future', filter: { type: 'assessments' } })}>
                    +{futurePlans.upcomingAssessments.length - 4} {t('annual_report_more')}
                  </button>
                )}
              </div>
            )}
            {drillDown?.section === 'future' && drillDown.filter?.type === 'assessments' && (
              <button onClick={clearDrillDown} className={linkBtn}>{t('annual_report_show_less')}</button>
            )}
          </div>

          {/* Recomendações prioritárias */}
          <div className="space-y-2">
            <SubTitle icon={Target}>{t('annual_report_priority_actions')}</SubTitle>
            {futurePlans.pendingHighRecs.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">{t('annual_report_no_priority_recs')}</p>
            ) : (
              <div className="space-y-1.5">
                {futurePlans.pendingHighRecs.slice(0, isDrillActive('future', { type: 'recommendations' }) ? undefined : 4).map(rec => (
                  <ListRow key={rec.id} onClick={() => setDetail({ type: 'recommendation', record: rec })}>
                    <Pill className={PRIORITY_COLORS[rec.priority]}>{priorityLabel(rec.priority)}</Pill>
                    <span className="font-medium text-[9px] text-foreground flex-1 truncate">{rec.title}</span>
                    <span className="text-[9px] text-muted-foreground">{rec.framework_code}</span>
                  </ListRow>
                ))}
                {futurePlans.pendingHighRecs.length > 4 && !isDrillActive('future', { type: 'recommendations' }) && (
                  <button className={cn(linkBtn, 'block w-full text-center pt-1')}
                    onClick={() => setDrillDown({ section: 'future', filter: { type: 'recommendations' } })}>
                    +{futurePlans.pendingHighRecs.length - 4} {t('annual_report_more')}
                  </button>
                )}
              </div>
            )}
            {drillDown?.section === 'future' && drillDown.filter?.type === 'recommendations' && (
              <button onClick={clearDrillDown} className={linkBtn}>{t('annual_report_show_less')}</button>
            )}
          </div>

          {/* Próximas tarefas */}
          <div className="space-y-2">
            <SubTitle icon={CheckCircle2}>{t('annual_report_upcoming_tasks')}</SubTitle>
            {futurePlans.upcomingTasks.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">{t('annual_report_no_upcoming_tasks')}</p>
            ) : (
              <div className="space-y-1.5">
                {futurePlans.upcomingTasks.slice(0, isDrillActive('future', { type: 'tasks' }) ? undefined : 4).map(task => (
                  <ListRow key={task.id} onClick={() => setDetail({ type: 'task', record: task })}>
                    <ArrowRight className="w-3 h-3 text-foreground flex-shrink-0" />
                    <span className="font-semibold text-[9px] text-foreground flex-1 truncate">{task.title}</span>
                    {task.due_date && <span className="text-[9px] text-muted-foreground whitespace-nowrap">{task.due_date}</span>}
                    {task.priority && <Pill className={PRIORITY_COLORS[task.priority]}>{priorityLabel(task.priority)}</Pill>}
                  </ListRow>
                ))}
                {futurePlans.upcomingTasks.length > 4 && !isDrillActive('future', { type: 'tasks' }) && (
                  <button className={cn(linkBtn, 'block w-full text-center pt-1')}
                    onClick={() => setDrillDown({ section: 'future', filter: { type: 'tasks' } })}>
                    +{futurePlans.upcomingTasks.length - 4} {t('annual_report_more')}
                  </button>
                )}
              </div>
            )}
            {drillDown?.section === 'future' && drillDown.filter?.type === 'tasks' && (
              <button onClick={clearDrillDown} className={linkBtn}>{t('annual_report_show_less')}</button>
            )}
          </div>
        </div>
      </div>

      <RecordDetailDialog
        record={detail?.record}
        type={detail?.type}
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
      />
    </section>
  );
}
