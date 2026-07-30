import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarClock, AlertTriangle, Clock, Pencil } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

function UrgencyBadge({ days, t }) {
  if (days < 0) return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">{t('prp_overdue')}</Badge>;
  if (days <= 7) return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">{t('prp_days_left', { days })}</Badge>;
  if (days <= 14) return <Badge className="bg-chart-4/10 text-chart-4 border-chart-4/20 text-xs">{t('prp_days_left', { days })}</Badge>;
  return <Badge className="bg-chart-3/10 text-chart-3 border-chart-3/20 text-xs">{t('prp_days_left', { days })}</Badge>;
}

const LEVEL_LABELS_KEY = { policy: 'prp_level_policy', standard: 'prp_level_standard', procedure: 'prp_level_procedure', playbook: 'prp_level_playbook' };

export default function PendingReviewsPanel({ docs, onEdit }) {
  const { t } = useLanguage();
  const pending = useMemo(() => {
    const today = new Date();
    const in30 = new Date(); in30.setDate(today.getDate() + 30);
    const todayStr = today.toISOString().split('T')[0];
    const in30Str = in30.toISOString().split('T')[0];

    return docs
      .filter(d => {
        if (!d.review_date || d.status === 'deprecated') return false;
        return d.review_date <= in30Str; // overdue or within 30 days
      })
      .map(d => ({ ...d, daysUntil: getDaysUntil(d.review_date) }))
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [docs]);

  if (pending.length === 0) return null;

  const overdueCount = pending.filter(d => d.daysUntil < 0).length;
  const urgentCount = pending.filter(d => d.daysUntil >= 0 && d.daysUntil <= 7).length;

  return (
    <Card className="border-chart-4/30 bg-chart-4/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-chart-4" />
          {t('prp_title')}
          <Badge className="ml-1 bg-chart-4/10 text-chart-4 border-chart-4/20">{pending.length}</Badge>
          {overdueCount > 0 && (
            <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
              <AlertTriangle className="w-3 h-3" />{t('prp_overdue_count', { count: overdueCount })}
            </Badge>
          )}
          {urgentCount > 0 && overdueCount === 0 && (
            <Badge className="bg-chart-4/10 text-chart-4 border-chart-4/20 gap-1">
              <Clock className="w-3 h-3" />{t('prp_urgent', { count: urgentCount })}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {pending.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background hover:bg-muted/30 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <span className="text-xs text-muted-foreground">{t(LEVEL_LABELS_KEY[doc.level]) || doc.level}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('prp_review_date')} <span className="font-medium">{doc.review_date}</span>
                  {doc.owner_email && <span> · {doc.owner_email}</span>}
                </p>
              </div>
              <UrgencyBadge days={doc.daysUntil} t={t} />
              {onEdit && (
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => onEdit(doc)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}