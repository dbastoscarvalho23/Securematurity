import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Clock, ArrowRight, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/lib/LanguageContext';

const STATUS_KEYS = {
  open: 'risk_status_open',
  in_treatment: 'risk_status_in_treatment',
  accepted: 'risk_status_accepted',
  closed: 'risk_status_closed',
};
const STATUS_COLORS = {
  open: 'text-destructive bg-destructive/10',
  in_treatment: 'text-chart-3 bg-chart-3/10',
  accepted: 'text-chart-4 bg-chart-4/10',
  closed: 'text-chart-2 bg-chart-2/10',
};

const FIELD_LABEL_KEYS = {
  title: 'risk_form_title',
  category: 'risk_form_category',
  impact: 'risk_form_impact',
  likelihood: 'risk_form_likelihood',
  status: 'risk_form_status',
  owner_email: 'risk_form_owner_email',
  due_date: 'risk_form_due_date',
  treatment_notes: 'risk_form_treatment_notes',
};

function FieldChange({ change, t }) {
  const fromLabel = change.field === 'status' ? t(STATUS_KEYS[change.from]) || change.from : change.from;
  const toLabel = change.field === 'status' ? t(STATUS_KEYS[change.to]) || change.to : change.to;
  const label = FIELD_LABEL_KEYS[change.field] ? t(FIELD_LABEL_KEYS[change.field]) : change.label;
  return (
    <div className="flex items-center gap-1.5 text-xs bg-muted px-2 py-1 rounded-md flex-wrap">
      <span className="font-medium text-foreground">{label}:</span>
      <span className="text-muted-foreground line-through">{fromLabel || '—'}</span>
      <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      <span className="font-medium text-foreground">{toLabel || '—'}</span>
    </div>
  );
}

export default function RiskHistoryTimeline({ riskId }) {
  const { t } = useLanguage();
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['riskHistory', riskId],
    queryFn: () => base44.entities.RiskHistory.filter({ risk_id: riskId }, '-created_date', 50),
    enabled: !!riskId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        <Clock className="w-4 h-4 mr-2 animate-pulse" /> {t('risk_history_loading')}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm gap-2">
        <Clock className="w-5 h-5 opacity-30" />
        <p>{t('risk_history_empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-0 relative">
      {/* vertical line */}
      <div className="absolute left-3.5 top-2 bottom-2 w-px bg-border" />

      {history.map((entry, idx) => {
        const isFirst = idx === 0;
        const isCreated = entry.action === 'created' || !entry.action;
        const changedFields = entry.changed_fields || [];

        const snapshot = entry.snapshot || {};
        const statusColor = STATUS_COLORS[snapshot.status] || 'bg-muted text-muted-foreground';

        return (
          <div key={entry.id} className="flex gap-3 pb-6 relative">
            {/* dot */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 mt-0.5 border-2 border-background ${isFirst ? 'bg-primary' : 'bg-muted'}`}>
              {isCreated
                ? <PlusCircle className={`w-3.5 h-3.5 ${isFirst ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                : <Clock className={`w-3.5 h-3.5 ${isFirst ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
              }
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              {/* header */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-xs font-semibold text-foreground">{entry.changed_by}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.created_date ? format(new Date(entry.created_date), 'dd MMM yyyy, HH:mm') : '—'}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isCreated ? 'bg-chart-2/10 text-chart-2' : 'bg-primary/10 text-primary'}`}>
                  {isCreated ? t('risk_history_created') : t('risk_history_updated')}
                </span>
                {isFirst && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{t('risk_history_latest')}</span>
                )}
              </div>

              {/* field-level changes */}
              {!isCreated && changedFields.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {changedFields.map((c, i) => <FieldChange key={i} change={c} t={t} />)}
                </div>
              ) : isCreated ? (
                <div className="flex flex-wrap gap-1.5">
                  {snapshot.title && (
                    <span className="text-xs bg-muted px-2 py-1 rounded-md">
                      <span className="font-medium">{snapshot.title}</span>
                    </span>
                  )}
                  {snapshot.status && (
                    <span className={`text-xs px-2 py-1 rounded-md font-medium ${statusColor}`}>
                      {t(STATUS_KEYS[snapshot.status]) || snapshot.status}
                    </span>
                  )}
                  {snapshot.impact && snapshot.likelihood && (
                    <span className="text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground">
                      {t('risk_score')} <strong>{snapshot.impact * snapshot.likelihood}</strong>
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">{t('risk_history_no_changes')}</span>
              )}

              {/* note */}
              {entry.note && (
                <p className="text-xs text-muted-foreground mt-1.5 italic border-l-2 border-muted pl-2">{entry.note}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}