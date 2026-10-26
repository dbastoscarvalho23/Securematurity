import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import MaturityRadar from '@/components/dashboard/MaturityRadar';
import TrendChart from '@/components/dashboard/TrendChart';
import FrameworkScoreCard from '@/components/dashboard/FrameworkScoreCard';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Loader2, Download } from 'lucide-react';
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
    const fw = r.framework_code || t('x_group_other');
    const domain = r.domain || t('common_general');
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
        title={t('page_reports')}
        description={t('reports_subtitle')}
        actions={isAdmin && (
          <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
            <SelectTrigger className="h-8 w-full sm:w-56 rounded-lg bg-card border-border shadow-none text-[11px] font-semibold"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('reports_all_customers')}</SelectItem>
              {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      />

      {/* Secção 1 — pontuações atuais vs período anterior */}
      {latest && (
        <section className="space-y-3">
          <h2 className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-semibold">
            <span className="text-[15px] text-foreground">{t('reports_current_framework_scores')}</span>
            {previous && <span className="text-[11px] text-muted-foreground">{t('reports_vs')} {previous.period}</span>}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
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
        </section>
      )}

      {/* Secção 2 — gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MaturityRadar data={radarData} title={t('reports_domain_coverage')} />
        <TrendChart data={trendData} frameworks={Object.keys(FRAMEWORK_NAMES)} />
      </div>

      {/* Secção 3 — histórico de avaliações */}
      <section className="bg-card border border-border rounded-[10px] p-5 space-y-4">
        <h2 className="text-[13px] font-semibold text-foreground">{t('reports_assessment_history')}</h2>
        {completed.length === 0 ? (
          <EmptyState compact title={t('reports_no_completed')} />
        ) : (
          <div className="space-y-2">
            {completed.map(a => {
              const isOpen = expandedId === a.id;
              return (
                <div key={a.id} className="rounded-lg border border-border bg-card overflow-hidden">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    className="w-full flex flex-col gap-3 px-4 py-3 text-left cursor-pointer hover:bg-muted/40 transition-colors md:flex-row md:items-center md:justify-between"
                    onClick={() => setExpandedId(isOpen ? null : a.id)}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setExpandedId(isOpen ? null : a.id); }
                    }}
                  >
                    <div className="min-w-0 space-y-1 md:w-[280px] md:flex-shrink-0">
                      <p className="text-[11px] font-semibold text-foreground truncate">{a.title}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{a.customer_name} · {a.period}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end md:flex-1 min-w-0">
                      {(a.framework_scores || []).map(fs => (
                        <span key={fs.framework_code} className="rounded-md bg-muted/60 px-2 py-[3px] text-[9px] font-semibold leading-none text-muted-foreground whitespace-nowrap">
                          {fs.framework_code}: <span className="text-foreground">{fs.score.toFixed(1)}</span>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 md:gap-6 md:pl-6 flex-shrink-0">
                      <span className="font-display text-base leading-none text-foreground">{a.overall_score?.toFixed(1)}</span>
                      <Button size="sm" variant="outline"
                        className="h-auto gap-1 rounded-md px-2 py-[3px] text-[9px] font-semibold shadow-none bg-transparent"
                        onClick={(e) => handleExportPdf(a, e)}
                        disabled={exportingId === a.id}>
                        {exportingId === a.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Download className="w-3 h-3" />}
                        PDF
                      </Button>
                      <span className="ml-auto md:ml-0 flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        {isOpen
                          ? <ChevronUp className="w-3 h-3" />
                          : <ChevronDown className="w-3 h-3" />}
                      </span>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-border bg-muted/20">
                      <AssessmentAnswersPanel assessmentId={a.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Secção 4 — relatório anual */}
      <AnnualReport selectedCustomer={selectedCustomer} />
    </div>
  );
}
