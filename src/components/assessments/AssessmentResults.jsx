import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Sparkles, FileText, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import MaturityRadar from '@/components/dashboard/MaturityRadar';
import FrameworkScoreCard from '@/components/dashboard/FrameworkScoreCard';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { exportReportPdf } from '@/lib/exportReportPdf';
import { useLanguage } from '@/lib/LanguageContext';

const FRAMEWORK_NAMES = {
  NIS2: 'NIS2 / DL 125/2025',
  ISO27001: 'ISO/IEC 27001',
  NIST_CSF: 'NIST CSF',
  CIS_V8: 'CIS Controls v8',
  GDPR: 'GDPR',
};

const PRIORITY_KEYS = {
  critical: 'tasks_priority_critical',
  high: 'tasks_priority_high',
  medium: 'tasks_priority_medium',
  low: 'tasks_priority_low',
};

function timelineKey(timeline) {
  if (!timeline) return null;
  return 'recs_timeline_' + timeline.replace('_term', '');
}

export default function AssessmentResults({ assessment, responses }) {
  const { t } = useLanguage();
  const [isExporting, setIsExporting] = useState(false);
  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations', assessment.id],
    queryFn: () => base44.entities.Recommendation.filter({ assessment_id: assessment.id }),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks-for-export', assessment.customer_id],
    queryFn: () => base44.entities.Task.filter({ customer_id: assessment.customer_id }, '-created_date', 200),
    enabled: !!assessment.customer_id,
  });

  const { data: questions = [] } = useQuery({
    queryKey: ['questions'],
    queryFn: () => base44.entities.Question.list('-order_index', 500),
  });

  // Build evidence list: only responses that have attachments
  const evidenceItems = responses
    .filter(r => r.attachments?.length > 0)
    .map(r => {
      const question = questions.find(q => q.id === r.question_id);
      return { response: r, question };
    });

  // Build radar data from all domain scores
  const radarData = [];
  (assessment.framework_scores || []).forEach(fs => {
    (fs.domain_scores || []).forEach(ds => {
      radarData.push({ domain: ds.domain, current: ds.score, target: 4 });
    });
  });

  const priorityColors = {
    critical: 'bg-destructive/10 text-destructive border-destructive/20',
    high: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
    medium: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
    low: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/assessments">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{assessment.title}</h1>
            <Badge className="bg-accent/10 text-accent border-accent/20">{t('assessment_results_completed')}</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            {assessment.customer_name} · {assessment.period} · {t('assessment_results_score')}: {assessment.overall_score?.toFixed(1)}/5.0
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          disabled={isExporting}
          onClick={async () => {
            setIsExporting(true);
            try { exportReportPdf(assessment, recommendations, tasks); } finally { setIsExporting(false); }
          }}
        >
          <Download className="w-4 h-4" />
          {isExporting ? t('assessment_results_exporting') : t('assessment_results_export_pdf')}
        </Button>
      </div>

      {/* Overall Score */}
      <Card className="bg-gradient-to-r from-primary/5 to-accent/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-sm text-muted-foreground">{t('assessment_results_overall_maturity')}</p>
              <p className="text-5xl font-bold mt-1">{assessment.overall_score?.toFixed(1)}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('assessment_results_out_of')}</p>
            </div>
            <div className="flex-1">
              <Progress value={(assessment.overall_score / 5) * 100} className="h-3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Framework Scores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(assessment.framework_scores || []).map(fs => (
          <FrameworkScoreCard
            key={fs.framework_code}
            framework_code={fs.framework_code}
            name={FRAMEWORK_NAMES[fs.framework_code] || fs.framework_code}
            score={fs.score}
          />
        ))}
      </div>

      {/* Radar Chart */}
      <MaturityRadar data={radarData} title={t('assessment_results_domain_analysis')} />

      {/* Evidence Review */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-primary" />
            {t('assessment_results_evidence_review')}
            {evidenceItems.length > 0 && (
              <Badge variant="secondary" className="ml-1">{evidenceItems.reduce((acc, e) => acc + e.response.attachments.length, 0)} {t('assessment_results_files')}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {evidenceItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t('assessment_results_no_evidence')}</p>
          ) : (
            <div className="space-y-4">
              {evidenceItems.map(({ response: r, question: q }) => (
                <div key={r.id} className="border rounded-lg p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <Badge variant="outline" className="text-xs font-mono flex-shrink-0">{r.control_id || r.framework_code}</Badge>
                    <p className="text-sm font-medium leading-snug">
                      {q?.question_text || r.domain}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted text-xs text-muted-foreground border hover:text-foreground hover:border-foreground/30 transition-colors"
                      >
                        <FileText className="w-3 h-3 flex-shrink-0" />
                        <span className="max-w-[180px] truncate">{att.name}</span>
                      </a>
                    ))}
                  </div>
                  {r.evidence_notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">"{r.evidence_notes}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {t('assessment_results_ai_recs')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div key={rec.id || i} className="p-4 rounded-lg border hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={priorityColors[rec.priority]}>
                        {t(PRIORITY_KEYS[rec.priority]) || rec.priority}
                      </Badge>
                      {rec.framework_code && (
                        <Badge variant="outline" className="text-xs">{rec.framework_code}</Badge>
                      )}
                      {rec.timeline && (
                        <span className="text-xs text-muted-foreground">
                          {t(timelineKey(rec.timeline)) || rec.timeline.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    {rec.current_level != null && rec.target_level != null && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {rec.current_level} → {rec.target_level}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium">{rec.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}