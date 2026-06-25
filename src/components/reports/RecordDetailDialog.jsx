import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { riskScore, riskLevelLabel } from '@/lib/riskEngine';

const TYPE_TITLES = {
  risk: 'Risk Item',
  task: 'Task',
  recommendation: 'Recommendation',
  assessment: 'Assessment',
  assessment_response: 'Assessment Response',
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

const MATURITY_LABELS = ['Not Implemented', 'Initial', 'Developing', 'Defined', 'Managed', 'Optimizing'];
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

function maturityBadge(level) {
  if (level === null || level === undefined) return null;
  return <Badge className={`text-xs ${MATURITY_COLORS[level] || ''}`}>{level} — {MATURITY_LABELS[level] || ''}</Badge>;
}

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function RecordDetailDialog({ record, type, open, onOpenChange }) {
  if (!record) return null;

  const riskScoreValue = type === 'risk' ? riskScore(record.impact, record.likelihood) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{TYPE_TITLES[type] || 'Record'}</Badge>
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
            {record.title || record.question_text || TYPE_TITLES[type] || 'Record'}
          </DialogTitle>
          <DialogDescription className="text-xs font-mono break-all">
            {record.id || '—'}
            {record.customer_name && <span className="font-sans"> · {record.customer_name}</span>}
          </DialogDescription>
        </DialogHeader>

        <dl className="mt-1">
          {type === 'risk' && (
            <>
              {record.risk_id && <Field label="Risk ID">{record.risk_id}</Field>}
              <Field label="Category">{record.category}</Field>
              <Field label="Impact">{record.impact ?? null}</Field>
              <Field label="Likelihood">{record.likelihood ?? null}</Field>
              <Field label="Score / Level">
                <Badge className="text-xs">
                  {riskScoreValue} — {riskLevelLabel(riskScoreValue)}
                </Badge>
              </Field>
              <Field label="Owner Email">{record.owner_email}</Field>
              <Field label="Due Date">{record.due_date}</Field>
              <Field label="Linked Documents">
                {(record.linked_document_ids || []).length > 0
                  ? `${record.linked_document_ids.length} linked: ${record.linked_document_ids.join(', ')}`
                  : null}
              </Field>
              <Field label="Description">{record.description}</Field>
              <Field label="Treatment Notes">{record.treatment_notes}</Field>
              {record.created_date && <Field label="Created">{formatDate(record.created_date)}</Field>}
              {record.updated_date && <Field label="Updated">{formatDate(record.updated_date)}</Field>}
            </>
          )}

          {type === 'task' && (
            <>
              <Field label="Priority">{record.priority && <Badge className={`text-xs ${PRIORITY_COLORS[record.priority] || ''}`}>{record.priority}</Badge>}</Field>
              <Field label="Assigned To">{record.assigned_to}</Field>
              <Field label="Due Date">{record.due_date}</Field>
              <Field label="Customer">{record.customer_name}</Field>
              <Field label="Framework">{record.framework_code}</Field>
              <Field label="Domain">{record.domain}</Field>
              <Field label="Assessment ID">{record.assessment_id}</Field>
              <Field label="Recommendation ID">{record.recommendation_id}</Field>
              <Field label="Description">{record.description}</Field>
              <Field label="Notes">{record.notes}</Field>
              <Field label="Attachments">
                {(record.attachments || []).map((a, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] mr-1 mb-1">{a.name}</Badge>
                ))}
              </Field>
              {record.created_date && <Field label="Created">{formatDate(record.created_date)}</Field>}
              {record.updated_date && <Field label="Updated">{formatDate(record.updated_date)}</Field>}
            </>
          )}

          {type === 'recommendation' && (
            <>
              {record.title_pt && record.title_pt !== record.title && <Field label="Title (PT)">{record.title_pt}</Field>}
              <Field label="Framework">{record.framework_code}</Field>
              <Field label="Domain">{record.domain}</Field>
              <Field label="Control ID">{record.control_id}</Field>
              <Field label="Current → Target">
                {record.current_level ?? '—'} → {record.target_level ?? '—'}
              </Field>
              <Field label="Effort">{record.effort}</Field>
              <Field label="Timeline">{record.timeline}</Field>
              <Field label="Assessment ID">{record.assessment_id}</Field>
              <Field label="Description">{record.description}</Field>
              {record.description_pt && record.description_pt !== record.description && (
                <Field label="Description (PT)">{record.description_pt}</Field>
              )}
              {record.created_date && <Field label="Created">{formatDate(record.created_date)}</Field>}
              {record.updated_date && <Field label="Updated">{formatDate(record.updated_date)}</Field>}
            </>
          )}

          {type === 'assessment' && (
            <>
              <Field label="Period">{record.period}</Field>
              <Field label="Customer">{record.customer_name}</Field>
              <Field label="Overall Score">
                {record.overall_score != null
                  ? (typeof record.overall_score === 'number' ? record.overall_score.toFixed(2) : record.overall_score)
                  : '—'}
              </Field>
              <Field label="Frameworks">{(record.frameworks || []).join(', ')}</Field>
              <Field label="Completed Date">{record.completed_date}</Field>
              <Field label="Assessor Email">{record.assessor_email}</Field>
              <Field label="Notes">{record.notes}</Field>
              {(record.framework_scores || []).length > 0 && (
                <Field label="Framework Scores">
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
              {record.created_date && <Field label="Created">{formatDate(record.created_date)}</Field>}
              {record.updated_date && <Field label="Updated">{formatDate(record.updated_date)}</Field>}
            </>
          )}

          {type === 'assessment_response' && (
            <>
              <Field label="Assessment ID">{record.assessment_id}</Field>
              <Field label="Question ID">{record.question_id}</Field>
              <Field label="Framework">{record.framework_code}</Field>
              <Field label="Control ID">{record.control_id}</Field>
              <Field label="Domain">{record.domain}</Field>
              <Field label="Maturity Level">{maturityBadge(record.maturity_level)}</Field>
              <Field label="Target Level">{maturityBadge(record.target_level)}</Field>
              <Field label="Evidence Notes">{record.evidence_notes}</Field>
              <Field label="Attachments">
                {(record.attachments || []).map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mr-2">
                    {a.name}
                  </a>
                ))}
              </Field>
              {record.created_date && <Field label="Created">{formatDate(record.created_date)}</Field>}
              {record.updated_date && <Field label="Updated">{formatDate(record.updated_date)}</Field>}
            </>
          )}
        </dl>
      </DialogContent>
    </Dialog>
  );
}