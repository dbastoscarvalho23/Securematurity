import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Clock, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_LABELS = { open: 'Open', in_treatment: 'In Treatment', accepted: 'Accepted', closed: 'Closed' };
const STATUS_COLORS = {
  open: 'text-destructive bg-destructive/10',
  in_treatment: 'text-chart-3 bg-chart-3/10',
  accepted: 'text-chart-4 bg-chart-4/10',
  closed: 'text-chart-2 bg-chart-2/10',
};
const SCORE_LABELS = { 1: 'Very Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Very High' };

function scoreBg(score) {
  const s = score * score;
  if (s >= 16) return 'bg-destructive/15 text-destructive';
  if (s >= 9)  return 'bg-chart-4/15 text-chart-4';
  if (s >= 4)  return 'bg-chart-3/15 text-chart-3';
  return 'bg-chart-2/15 text-chart-2';
}

export default function RiskHistoryTimeline({ riskId }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['riskHistory', riskId],
    queryFn: () => base44.entities.RiskHistory.filter({ risk_id: riskId }, '-created_date', 50),
    enabled: !!riskId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        <Clock className="w-4 h-4 mr-2 animate-pulse" /> Loading history...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm gap-2">
        <Clock className="w-5 h-5 opacity-30" />
        <p>No history yet. Changes will appear here after saving.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0 relative">
      {/* vertical line */}
      <div className="absolute left-3.5 top-2 bottom-2 w-px bg-border" />

      {history.map((entry, idx) => {
        const prev = history[idx + 1];
        const score = (entry.impact || 0) * (entry.likelihood || 0);
        const prevScore = prev ? (prev.impact || 0) * (prev.likelihood || 0) : null;

        const impactChanged  = prev && entry.impact     !== prev.impact;
        const likelyChanged  = prev && entry.likelihood !== prev.likelihood;
        const statusChanged  = prev && entry.status     !== prev.status;
        const scoreChanged   = prev && score            !== prevScore;

        const isFirst = idx === 0;

        return (
          <div key={entry.id} className="flex gap-3 pb-5 relative">
            {/* dot */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 mt-0.5 border-2 border-background ${isFirst ? 'bg-primary' : 'bg-muted'}`}>
              <Clock className={`w-3.5 h-3.5 ${isFirst ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              {/* header */}
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-xs font-medium text-foreground">{entry.changed_by}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.created_date
                    ? format(new Date(entry.created_date), 'dd MMM yyyy, HH:mm')
                    : '—'}
                </span>
                {isFirst && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Latest</span>
                )}
              </div>

              {/* changes */}
              <div className="flex flex-wrap gap-2">
                {/* score pill */}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${scoreBg(entry.impact)}`}>
                  Score {score}
                </span>

                {/* status */}
                <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${STATUS_COLORS[entry.status] || 'bg-muted text-muted-foreground'}`}>
                  {STATUS_LABELS[entry.status] || entry.status}
                </span>

                {/* impact change */}
                {impactChanged && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                    Impact {prev.impact} <ArrowRight className="w-3 h-3" /> <strong>{entry.impact}</strong>
                    <span className="text-[10px] opacity-70">({SCORE_LABELS[entry.impact]})</span>
                  </span>
                )}

                {/* likelihood change */}
                {likelyChanged && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                    Likelihood {prev.likelihood} <ArrowRight className="w-3 h-3" /> <strong>{entry.likelihood}</strong>
                    <span className="text-[10px] opacity-70">({SCORE_LABELS[entry.likelihood]})</span>
                  </span>
                )}

                {/* status change arrow */}
                {statusChanged && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                    {STATUS_LABELS[prev.status]} <ArrowRight className="w-3 h-3" /> <strong>{STATUS_LABELS[entry.status]}</strong>
                  </span>
                )}

                {/* first save */}
                {!prev && (
                  <span className="text-xs text-muted-foreground italic">Initial record created</span>
                )}
              </div>

              {/* note */}
              {entry.note && (
                <p className="text-xs text-muted-foreground mt-1 italic border-l-2 border-muted pl-2">{entry.note}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}