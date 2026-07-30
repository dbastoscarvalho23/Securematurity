import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import MaturityRadar from '@/components/dashboard/MaturityRadar';
import TrendChart from '@/components/dashboard/TrendChart';
import FrameworkScoreCard from '@/components/dashboard/FrameworkScoreCard';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, ChevronDown, ChevronUp, Loader2, Download } from 'lucide-react';
import { exportReportPdf } from '@/lib/exportReportPdf';
import AnnualReport from '@/components/reports/AnnualReport';
import RecordDetailDialog from '@/components/reports/RecordDetailDialog';
import { FRAMEWORK_NAMES } from '@/lib/frameworkConstants';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';

const MATURITY_LABEL_KEYS = ['maturity_not_implemented', 'maturity_initial', 'maturity_developing', 'maturity_defined', 'maturity_managed', 'maturity_optimized'];

const MATURITY_COLORS = [
  'bg-destructive/10 text-destructive',
  'bg-chart-4/10 text-chart-4',
  'bg-chart-3/10 text-chart-3',
  'bg-chart-1/10 text-chart-1',
  'bg-accent/10 text-accent',
  'bg-accent/20 text-accent',
];

function AssessmentAnswersPanel({ assessmentId }) {
  const { t } = useLanguage();
  const MATURITY_LABELS = MATURITY_LABEL_KEYS.map(k => t(k));
  const [detail, setDetail] = useState(null);
  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['responses', assessmentId],
    queryFn: () => base44.entities.AssessmentResponse.filter({ assessment_id: assessmentId }),
  });

  const { data: questions = [] } = useQuery({
    queryKey: ['questions'],
    queryFn: () => base44.entities.Question.list('-order_index', 500),
  });

  if (isLoading) {
    return <LoadingState label={t('reports_loading_answers')} className="py-8" />;
  }

  if (responses.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">{t('reports_no_answers')}</p>;
  }

  // Group by framework then domain
  const grouped = {};
  responses.forEach(r => {
    const fw = r.framework_code || 'Other';
    const domain = r.domain || 'General';
    if (!grouped[fw]) grouped[fw] = {};
    if (!grouped[fw][domain]) grouped[fw][domain] = [];
    grouped[fw][domain].push(r);
  });

  return (
    <div className="mt-4 space-y-5">
      {Object.entries(grouped).map(([fw, domains]) => (
        <div key={fw}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {FRAMEWORK_NAMES[fw] || fw}
          </p>
          <div className="space-y-4">
            {Object.entries(domains).map(([domain, items]) => (
              <div key={domain}>
                <p className="text-xs font-medium text-foreground mb-1.5 pl-1 border-l-2 border-primary">{domain}</p>
                <div className="space-y-2">
                  {items.map(r => {
                    const question = questions.find(q => q.id === r.question_id);
                    const level = r.maturity_level ?? null;
                    return (
                      <div key={r.id} className="flex items-start gap-3 p-3 rounded-md bg-muted/40 border text-sm cursor-pointer hover:bg-muted/60 transition-colors" onClick={() => setDetail({ type: 'assessment_response', record: r })}>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium leading-snug">
                            {question?.question_text || r.control_id || t('reports_question')}
                          </p>
                          {r.evidence_notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">"{r.evidence_notes}"</p>
                          )}
                        </div>
                        <div className="flex-shrink-0 flex flex-col items-end gap-1">
                          {level !== null && (
                            <Badge className={`text-xs ${MATURITY_COLORS[level] || ''}`}>
                              {level} — {MATURITY_LABELS[level] || ''}
                            </Badge>
                          )}
                          {r.control_id && (
                            <span className="text-xs font-mono text-muted-foreground">{r.control_id}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <RecordDetailDialog
        record={detail?.record}
        type={detail?.type}
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
      />
    </div>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const customerId = user?.customer_id;

  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [exportingId, setExportingId] = useState(null);

  const handleExportPdf = async (a, e) => {
    e.stopPropagation();
    setExportingId(a.id);
    const [recommendations, tasks] = await Promise.all([
      base44.entities.Recommendation.filter({ assessment_id: a.id }),
      base44.entities.Task.filter({ assessment_id: a.id }),
    ]);
    exportReportPdf(a, recommendations, tasks);
    setExportingId(null);
  };

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: isAdmin,
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ['assessments', customerId],
    queryFn: () => isAdmin
      ? base44.entities.Assessment.list('-created_date', 100)
      : base44.entities.Assessment.filter({ customer_id: customerId }, '-created_date', 100),
    enabled: isAdmin || !!customerId,
  });

  const completed = assessments
    .filter(a => a.status === 'completed')
    .filter(a => !isAdmin || selectedCustomer === 'all' || a.customer_id === selectedCustomer);

  const trendData = completed
    .slice(0, 10)
    .reverse()
    .map(a => {
      const point = { period: a.period };
      (a.framework_scores || []).forEach(fs => { point[fs.framework_code] = fs.score; });
      return point;
    });

  const latest = completed[0];
  const previous = completed[1];

  const radarData = [];
  if (latest?.framework_scores) {
    latest.framework_scores.forEach(fs => {
      (fs.domain_scores || []).forEach(ds => {
        radarData.push({ domain: ds.domain, current: ds.score, target: 4 });
      });
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description={t('reports_subtitle')}
        actions={isAdmin && (
          <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('reports_all_customers')}</SelectItem>
              {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      />

      {/* Current vs Previous */}
      {latest && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            {t('reports_current_framework_scores')}
            {previous && <span className="text-sm font-normal text-muted-foreground">{t('reports_vs')} {previous.period}</span>}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {(latest.framework_scores || []).map(fs => {
              const prevScore = previous?.framework_scores?.find(p => p.framework_code === fs.framework_code)?.score;
              return (
                <FrameworkScoreCard
                  key={fs.framework_code}
                  framework_code={fs.framework_code}
                  name={FRAMEWORK_NAMES[fs.framework_code] || fs.framework_code}
                  score={fs.score}
                  previousScore={prevScore}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MaturityRadar data={radarData} title={t('reports_domain_coverage')} />
        <TrendChart data={trendData} frameworks={Object.keys(FRAMEWORK_NAMES)} title={t('reports_maturity_evolution')} />
      </div>

      {/* Assessment History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            {t('reports_assessment_history')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {completed.length === 0 ? (
            <EmptyState compact title={t('reports_no_completed')} />
          ) : (
            <div className="space-y-2">
              {completed.map(a => {
                const isOpen = expandedId === a.id;
                return (
                  <div key={a.id} className="rounded-lg border overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/40 transition-colors text-left"
                      onClick={() => setExpandedId(isOpen ? null : a.id)}
                    >
                      <div>
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.customer_name} · {a.period}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex gap-2 flex-wrap justify-end">
                          {(a.framework_scores || []).map(fs => (
                            <Badge key={fs.framework_code} variant="outline" className="text-xs font-mono">
                              {fs.framework_code}: {fs.score.toFixed(1)}
                            </Badge>
                          ))}
                        </div>
                        <span className="text-lg font-bold">{a.overall_score?.toFixed(1)}</span>
                        <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs"
                          onClick={(e) => handleExportPdf(a, e)}
                          disabled={exportingId === a.id}>
                          {exportingId === a.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Download className="w-3.5 h-3.5" />}
                          PDF
                        </Button>
                        {isOpen
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        }
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 border-t bg-muted/20">
                        <AssessmentAnswersPanel assessmentId={a.id} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
        </Card>

        {/* Annual Report */}
        <AnnualReport selectedCustomer={selectedCustomer} />
        </div>
        );
        }