/**
 * StrategicReport — executive dashboard with maturity trends, framework
 * compliance scores, and strategic KPIs. Aggregates data from Assessment,
 * Recommendation, and ComplianceChecklist.
 *
 * Admin sees all customers (with filter); tenant users see their own.
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { TrendingUp, Target, CheckCircle2, AlertTriangle, ClipboardCheck, Lightbulb } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EmptyState from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { isPlatformOwner } from '@/lib/rbac';

// Rótulos de maturidade por chave de tradução (FC3).
const MATURITY_LABEL_KEYS = {
  0: 'maturity_0', 1: 'maturity_1', 2: 'maturity_2',
  3: 'maturity_3', 4: 'maturity_4', 5: 'maturity_5',
};

function maturityLabel(t, score) {
  const key = MATURITY_LABEL_KEYS[Math.round(score)];
  return key ? t(key) : '—';
}

// Escala de maturidade nos tokens do design system (FC2).
function maturityColor(score) {
  if (score >= 4) return 'text-accent';
  if (score >= 3) return 'text-chart-1';
  if (score >= 2) return 'text-chart-3';
  return 'text-destructive';
}

function MaturityBar({ score }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', maturityColor(score).replace('text-', 'bg-'))}
          style={{ width: `${(score / 5) * 100}%` }}
        />
      </div>
      <span className={cn('text-sm font-semibold tabular-nums', maturityColor(score))}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

export default function StrategicReport() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isAdmin = isPlatformOwner(user?.role);
  const customerId = user?.customer_id;
  const [selectedCustomer, setSelectedCustomer] = useState(customerId || 'all');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: isAdmin,
  });

  const effectiveCustomerId = isAdmin ? (selectedCustomer === 'all' ? null : selectedCustomer) : customerId;

  const { data: assessments = [], isLoading: loadingAssessments } = useQuery({
    queryKey: ['strategic-assessments', effectiveCustomerId],
    queryFn: () => isAdmin && !effectiveCustomerId
      ? base44.entities.Assessment.list('-completed_date', 200)
      : base44.entities.Assessment.filter({ customer_id: effectiveCustomerId }, '-completed_date', 200),
  });

  const { data: recommendations = [], isLoading: loadingRecs } = useQuery({
    queryKey: ['strategic-recommendations', effectiveCustomerId],
    queryFn: () => isAdmin && !effectiveCustomerId
      ? base44.entities.Recommendation.list('-created_date', 200)
      : base44.entities.Recommendation.filter({ customer_id: effectiveCustomerId }, '-created_date', 200),
  });

  const { data: checklistItems = [], isLoading: loadingChecklist } = useQuery({
    queryKey: ['strategic-checklist', effectiveCustomerId],
    queryFn: () => isAdmin && !effectiveCustomerId
      ? base44.entities.ComplianceChecklist.list('-created_date', 500)
      : base44.entities.ComplianceChecklist.filter({ customer_id: effectiveCustomerId }, '-created_date', 500),
    enabled: !!effectiveCustomerId,
  });

  const isLoading = loadingAssessments || loadingRecs || loadingChecklist;

  // ─── KPIs ──────────────────────────────────────────────────
  const completedAssessments = assessments.filter(a => a.status === 'completed');
  const avgMaturity = completedAssessments.length > 0
    ? completedAssessments.reduce((sum, a) => sum + (a.overall_score || 0), 0) / completedAssessments.length
    : 0;

  const pendingRecs = recommendations.filter(r => r.status === 'pending');
  const criticalRecs = pendingRecs.filter(r => r.priority === 'critical' || r.priority === 'high');

  const checklistDone = checklistItems.filter(c => c.status === 'done').length;
  const checklistTotal = checklistItems.length;
  const complianceRate = checklistTotal > 0 ? (checklistDone / checklistTotal) * 100 : 0;

  // ─── Framework scores ──────────────────────────────────────
  const frameworkScores = useMemo(() => {
    const byFramework = {};
    completedAssessments.forEach(a => {
      (a.framework_scores || []).forEach(fs => {
        if (!byFramework[fs.framework_code]) byFramework[fs.framework_code] = [];
        byFramework[fs.framework_code].push(fs.score || 0);
      });
    });
    return Object.entries(byFramework).map(([code, scores]) => ({
      framework: code,
      avgScore: scores.reduce((s, v) => s + v, 0) / scores.length,
      count: scores.length,
    })).sort((a, b) => b.avgScore - a.avgScore);
  }, [completedAssessments]);

  // ─── Maturity trend (by assessment period) ─────────────────
  const maturityTrend = useMemo(() => {
    return completedAssessments
      .filter(a => a.period && a.overall_score != null)
      .sort((a, b) => (a.period || '').localeCompare(b.period || ''))
      .slice(-6)
      .map(a => ({ period: a.period, score: a.overall_score, title: a.title }));
  }, [completedAssessments]);

  // ─── Recommendation breakdown ──────────────────────────────
  const recByPriority = useMemo(() => {
    const groups = { critical: 0, high: 0, medium: 0, low: 0 };
    recommendations.forEach(r => {
      if (groups[r.priority] !== undefined) groups[r.priority]++;
    });
    return groups;
  }, [recommendations]);

  const localeStr = language === 'pt' ? 'pt-PT' : 'en-GB';

  return (
    <div className="space-y-6">
      <PageHeader
        description={t('strategic_report_subtitle')}
        actions={isAdmin && (
          <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common_all')} — {t('common_customer')}</SelectItem>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('strategic_avg_maturity')}</CardTitle>
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', maturityColor(avgMaturity))}>
              {avgMaturity.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              {maturityLabel(t, avgMaturity)} · {completedAssessments.length} {t('strategic_completed_assessments')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('strategic_compliance_rate')}</CardTitle>
            <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{complianceRate.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">{checklistDone}/{checklistTotal} {t('strategic_checklist_items')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('strategic_open_recommendations')}</CardTitle>
            <Lightbulb className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRecs.length}</div>
            <p className="text-xs text-muted-foreground">{criticalRecs.length} {t('strategic_critical_high')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('strategic_total_assessments')}</CardTitle>
            <ClipboardCheck className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assessments.length}</div>
            <p className="text-xs text-muted-foreground">{completedAssessments.length} {t('strategic_completed')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Framework scores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('strategic_framework_scores')}</CardTitle>
        </CardHeader>
        <CardContent>
          {frameworkScores.length === 0 ? (
            <EmptyState icon={Target} title={t('strategic_no_framework_data')} compact />
          ) : (
            <div className="space-y-4">
              {frameworkScores.map(fs => (
                <div key={fs.framework} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{fs.framework.replace(/_/g, ' ')}</span>
                    <Badge variant="secondary" className="text-xs">{fs.count} {t('strategic_assessments')}</Badge>
                  </div>
                  <MaturityBar score={fs.avgScore} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Maturity trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('strategic_maturity_trend')}</CardTitle>
          </CardHeader>
          <CardContent>
            {maturityTrend.length === 0 ? (
              <EmptyState icon={TrendingUp} title={t('strategic_no_trend_data')} compact />
            ) : (
              <div className="space-y-3">
                {maturityTrend.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20 tabular-nums">{item.period}</span>
                    <div className="flex-1">
                      <MaturityBar score={item.score} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommendation priorities */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('strategic_rec_priorities')}</CardTitle>
          </CardHeader>
          <CardContent>
            {recommendations.length === 0 ? (
              <EmptyState icon={AlertTriangle} title={t('strategic_no_recommendations')} compact />
            ) : (
              <div className="space-y-3">
                {Object.entries(recByPriority).map(([priority, count]) => (
                  <div key={priority} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-3 h-3 rounded-full',
                        priority === 'critical' && 'bg-destructive',
                        priority === 'high' && 'bg-chart-3',
                        priority === 'medium' && 'bg-chart-4',
                        priority === 'low' && 'bg-chart-1',
                      )} />
                      <span className="text-sm capitalize">{priority}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent assessments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('strategic_recent_assessments')}</CardTitle>
        </CardHeader>
        <CardContent>
          {assessments.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title={t('strategic_no_assessments')} compact />
          ) : (
            <div className="space-y-2">
              {assessments.slice(0, 8).map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.customer_name || '—'} · {a.period || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-2">
                    {a.overall_score != null && (
                      <span className={cn('text-sm font-semibold', maturityColor(a.overall_score))}>
                        {a.overall_score.toFixed(1)}
                      </span>
                    )}
                    <Badge variant="secondary" className="text-xs capitalize">{a.status?.replace('_', ' ')}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
