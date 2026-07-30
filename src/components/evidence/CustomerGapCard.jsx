import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarClock, FileClock } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { useLanguage } from '@/lib/LanguageContext';
import StatusBadge from '@/components/shared/StatusBadge';

export default function CustomerGapCard({ gap }) {
  const { t } = useLanguage();
  const overdueCount = gap.deadlines.filter(d => d.overdue).length;
  const underReviewCount = gap.missingDocs.filter(d => d.status === 'under_review').length;
  const draftCount = gap.missingDocs.filter(d => d.status === 'draft').length;
  const topDeadlines = gap.deadlines.slice(0, 4);
  const totalGap = gap.missingDocs.length + gap.deadlines.length + gap.upcomingReviews.length;

  return (
    <Card className={totalGap > 0 ? 'border-destructive/20' : ''}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold truncate">{gap.name}</h3>
          {totalGap > 0 && (
            <span className="text-xs font-semibold bg-destructive/10 text-destructive rounded-full px-2 py-0.5">{totalGap}</span>
          )}
        </div>

        {/* Missing documents */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-chart-4/10 flex items-center justify-center flex-shrink-0">
            <FileClock className="w-4 h-4 text-chart-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{t('evidence_gap_missing_docs')}</p>
            {gap.missingDocs.length === 0 ? (
              <p className="text-sm text-accent font-medium">{t('evidence_gap_no_docs')}</p>
            ) : (
              <div className="flex items-center flex-wrap gap-2 mt-0.5">
                <span className="text-xl font-bold">{gap.missingDocs.length}</span>
                {underReviewCount > 0 && <StatusBadge status="under_review" label={`${underReviewCount} ${t('evidence_gap_under_review')}`} />}
                {draftCount > 0 && <StatusBadge status="draft" label={`${draftCount} ${t('evidence_gap_draft')}`} />}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming deadlines */}
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${overdueCount > 0 ? 'bg-destructive/10' : 'bg-chart-3/10'}`}>
            <CalendarClock className={`w-4 h-4 ${overdueCount > 0 ? 'text-destructive' : 'text-chart-3'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{t('evidence_gap_upcoming_deadlines')}</p>
            {gap.deadlines.length === 0 ? (
              <p className="text-sm text-accent font-medium">{t('evidence_gap_no_deadlines')}</p>
            ) : (
              <div className="flex items-center flex-wrap gap-2 mt-0.5">
                <span className="text-xl font-bold">{gap.deadlines.length}</span>
                {overdueCount > 0 && (
                  <span className="text-xs font-semibold bg-destructive/10 text-destructive rounded-full px-2 py-0.5">{overdueCount} {t('evidence_gap_overdue')}</span>
                )}
                {gap.upcomingReviews.length > 0 && (
                  <span className="text-xs text-muted-foreground">{gap.upcomingReviews.length} {t('evidence_gap_doc_review')}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Top deadlines list */}
        {topDeadlines.length > 0 && (
          <div className="space-y-1 pt-2 border-t">
            {topDeadlines.map((d, i) => {
              const days = differenceInCalendarDays(parseISO(d.date), new Date());
              return (
                <Link
                  key={i}
                  to={d.route}
                  className="flex items-center gap-2 text-xs hover:bg-muted/40 rounded px-1 py-1 transition-colors"
                >
                  <span className={`font-mono w-12 flex-shrink-0 ${d.overdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                    {format(parseISO(d.date), 'dd MMM')}
                  </span>
                  <span className="truncate flex-1">{d.title}</span>
                  <span className="text-muted-foreground flex-shrink-0">{d.typeLabel}</span>
                  <span className={`flex-shrink-0 ${d.overdue ? 'text-destructive font-semibold' : days <= 7 ? 'text-chart-3' : 'text-muted-foreground'}`}>
                    {d.overdue ? `${Math.abs(days)}d` : `${days}d`}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}