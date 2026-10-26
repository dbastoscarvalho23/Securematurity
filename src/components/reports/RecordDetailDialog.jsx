import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { riskScore, riskLevelLabel } from '@/lib/riskEngine';
import { useLanguage } from '@/lib/LanguageContext';

const TYPE_TITLES = {
  risk: 'x_rd_type_risk',
  task: 'x_rd_type_task',
  recommendation: 'x_rd_type_recommendation',
  assessment: 'x_rd_type_assessment',
  assessment_response: 'x_rd_type_assessment_response',
};

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

const MATURITY_LABELS = ['maturity_not_implemented', 'maturity_initial', 'maturity_developing', 'maturity_defined', 'maturity_managed', 'maturity_optimized'];
const MATURITY_COLORS = [
  'bg-destructive/10 text-destructive',
  'bg-chart-4/10 text-chart-4',
  'bg-chart-3/10 text-chart-3',
  'bg-chart-1/10 text-chart-1',
  'bg-accent/10 text-accent',
  'bg-accent/20 text-accent',
];

function Field({ label, children }) {
  const empty = children === null || children === undefined || children === ''
    || (Array.isArray(children) && children.length === 0);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[170px_1fr] gap-1 sm:gap-3 py-2.5 border-b last:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground break-words whitespace-pre-wrap">
        {empty ? <span className="text-muted-foreground">—</span> : children}
      </dd>
    </div>
  );
}

function maturityBadge(level, t) {
  if (level === null || level === undefined) return null;
  return <Badge className={`text-xs ${MATURITY_COLORS[level] || ''}`}>{level} — {MATURITY_LABELS[level] ? t(MATURITY_LABELS[level]) : ''}</Badge>;
}

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function RecordDetailDialog({ record, type, open, onOpenChange }) {
  const { t } = useLanguage();
  if (!record) return null;

  const riskScoreValue = type === 'risk' ? riskScore(record.impact, record.likelihood) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{t(TYPE_TITLES[type] || 'x_rd_record')}</Badge>
            {type === 'risk' && record.status && (
              <Badge variant="outline" className={`text-[10px] ${RISK_STATUS_COLORS[record.status] || ''}`}>{record.status}</Badge>
            )}
            {type === 'task' && record.status && (
              <Badge variant="outline" className="text-[10px]">{record.status}</Badge>
            )}
            {type === 'recommendation' && record.priority && (
              <Badge className={`text-[10px] ${PRIORITY_COLORS[record.priority] || ''}`}>{record.priority}</Badge>
            )}
            {type === 'recommendation' && record.status && (
              <Badge variant="outline" className="text-[10px]">{record.status}</Badge>
            )}
            {type === 'assessment' && record.status && (
              <Badge variant="outline" className="text-[10px]">{record.status}</Badge>
            )}
          </div>
          <DialogTitle className="text-lg pr-6">
            {record.title || record.question_text || t(TYPE_TITLES[type] || 'x_rd_record')}
          </DialogTitle>
          <DialogDescription className="text-xs font-mono break-all">
            {record.id || '—'}
            {record.customer_name && <span className="font-sans"> · {record.customer_name}</span>}
          </DialogDescription>
        </DialogHeader>

        <dl className="mt-1">
          {type === 'risk' && (
            <>
              {record.risk_id && <Field label={t('x_rd_risk_id')}>{record.risk_id}</Field>}
              <Field label={t('x_rd_category')}>{record.category}</Field>
              <Field label={t('x_rd_impact')}>{record.impact ?? null}</Field>
              <Field label={t('x_rd_likelihood')}>{record.likelihood ?? null}</Field>
              <Field label={t('x_rd_score_level')}>
                <Badge className="text-xs">
                  {riskScoreValue} — {t(`risk_level_${riskLevelLabel(riskScoreValue).toLowerCase()}`)}
                </Badge>
              </Field>
              <Field label={t('x_rd_owner_email')}>{record.owner_email}</Field>
              <Field label={t('x_rd_due_date')}>{record.due_date}</Field>
              <Field label={t('x_rd_linked_documents')}>
                {(record.linked_document_ids || []).length > 0
                  ? t('x_rd_linked_count', { count: record.linked_document_ids.length, ids: record.linked_document_ids.join(', ') })
                  : null}
              </Field>
              <Field label={t('x_rd_description')}>{record.description}</Field>
              <Field label={t('x_rd_treatment_notes')}>{record.treatment_notes}</Field>
              {record.created_date && <Field label={t('x_rd_created')}>{formatDate(record.created_date)}</Field>}
              {record.updated_date && <Field label={t('x_rd_updated')}>{formatDate(record.updated_date)}</Field>}
            </>
          )}

          {type === 'task' && (
            <>
              <Field label={t('x_rd_priority')}>{record.priority && <Badge className={`text-xs ${PRIORITY_COLORS[record.priority] || ''}`}>{record.priority}</Badge>}</Field>
              <Field label={t('x_rd_assigned_to')}>{record.assigned_to}</Field>
              <Field label={t('x_rd_due_date')}>{record.due_date}</Field>
              <Field label={t('x_rd_customer')}>{record.customer_name}</Field>
              <Field label={t('x_rd_framework')}>{record.framework_code}</Field>
              <Field label={t('x_rd_domain')}>{record.domain}</Field>
              <Field label={t('x_rd_assessment_id')}>{record.assessment_id}</Field>
              <Field label={t('x_rd_recommendation_id')}>{record.recommendation_id}</Field>
              <Field label={t('x_rd_description')}>{record.description}</Field>
              <Field label={t('x_rd_notes')}>{record.notes}</Field>
              <Field label={t('x_rd_attachments')}>
                {(record.attachments || []).map((a, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] mr-1 mb-1">{a.name}</Badge>
                ))}
              </Field>
              {record.created_date && <Field label={t('x_rd_created')}>{formatDate(record.created_date)}</Field>}
              {record.updated_date && <Field label={t('x_rd_updated')}>{formatDate(record.updated_date)}</Field>}
            </>
          )}

          {type === 'recommendation' && (
            <>
              {record.title_pt && record.title_pt !== record.title && <Field label={t('x_rd_title_pt')}>{record.title_pt}</Field>}
              <Field label={t('x_rd_framework')}>{record.framework_code}</Field>
              <Field label={t('x_rd_domain')}>{record.domain}</Field>
              <Field label={t('x_rd_control_id')}>{record.control_id}</Field>
              <Field label={t('x_rd_current_to_target')}>
                {record.current_level ?? '—'} → {record.target_level ?? '—'}
              </Field>
              <Field label={t('x_rd_effort')}>{record.effort}</Field>
              <Field label={t('x_rd_timeline')}>{record.timeline}</Field>
              <Field label={t('x_rd_assessment_id')}>{record.assessment_id}</Field>
              <Field label={t('x_rd_description')}>{record.description}</Field>
              {record.description_pt && record.description_pt !== record.description && (
                <Field label={t('x_rd_description_pt')}>{record.description_pt}</Field>
              )}
              {record.created_date && <Field label={t('x_rd_created')}>{formatDate(record.created_date)}</Field>}
              {record.updated_date && <Field label={t('x_rd_updated')}>{formatDate(record.updated_date)}</Field>}
            </>
          )}

          {type === 'assessment' && (
            <>
              <Field label={t('x_rd_period')}>{record.period}</Field>
              <Field label={t('x_rd_customer')}>{record.customer_name}</Field>
              <Field label={t('x_rd_overall_score')}>
                {record.overall_score != null
                  ? (typeof record.overall_score === 'number' ? record.overall_score.toFixed(2) : record.overall_score)
                  : '—'}
              </Field>
              <Field label={t('x_rd_frameworks')}>{(record.frameworks || []).join(', ')}</Field>
              <Field label={t('x_rd_completed_date')}>{record.completed_date}</Field>
              <Field label={t('x_rd_assessor_email')}>{record.assessor_email}</Field>
              <Field label={t('x_rd_notes')}>{record.notes}</Field>
              {(record.framework_scores || []).length > 0 && (
                <Field label={t('x_rd_framework_scores')}>
                  <div className="space-y-2">
                    {record.framework_scores.map((fs, i) => (
                      <div key={i} className="rounded-md border p-2 bg-muted/20">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold">{fs.framework_code}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {fs.score?.toFixed?.(2) ?? fs.score}
                          </Badge>
                        </div>
                        {(fs.domain_scores || []).length > 0 && (
                          <ul className="text-xs space-y-0.5">
                            {fs.domain_scores.map((ds, j) => (
                              <li key={j} className="flex justify-between gap-2">
                                <span className="text-muted-foreground">{ds.domain}</span>
                                <span>{ds.score?.toFixed?.(2) ?? ds.score}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </Field>
              )}
              {record.created_date && <Field label={t('x_rd_created')}>{formatDate(record.created_date)}</Field>}
              {record.updated_date && <Field label={t('x_rd_updated')}>{formatDate(record.updated_date)}</Field>}
            </>
          )}

          {type === 'assessment_response' && (
            <>
              <Field label={t('x_rd_assessment_id')}>{record.assessment_id}</Field>
              <Field label={t('x_rd_question_id')}>{record.question_id}</Field>
              <Field label={t('x_rd_framework')}>{record.framework_code}</Field>
              <Field label={t('x_rd_control_id')}>{record.control_id}</Field>
              <Field label={t('x_rd_domain')}>{record.domain}</Field>
              <Field label={t('x_rd_maturity_level')}>{maturityBadge(record.maturity_level, t)}</Field>
              <Field label={t('x_rd_target_level')}>{maturityBadge(record.target_level, t)}</Field>
              <Field label={t('x_rd_evidence_notes')}>{record.evidence_notes}</Field>
              <Field label={t('x_rd_attachments')}>
                {(record.attachments || []).map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mr-2">
                    {a.name}
                  </a>
                ))}
              </Field>
              {record.created_date && <Field label={t('x_rd_created')}>{formatDate(record.created_date)}</Field>}
              {record.updated_date && <Field label={t('x_rd_updated')}>{formatDate(record.updated_date)}</Field>}
            </>
          )}
        </dl>
      </DialogContent>
    </Dialog>
  );
}