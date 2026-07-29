import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { MapPin, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { cn } from '@/lib/utils';

export default function ComplianceJourneyStatusCard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const customerId = user?.customer_id;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['compliance-checklist-status', isAdmin, customerId],
    queryFn: () => isAdmin
      ? base44.entities.ComplianceChecklist.list('section_order', 1000)
      : base44.entities.ComplianceChecklist.filter({ customer_id: customerId, framework: 'RJCS' }, 'section_order', 1000),
    enabled: isAdmin || !!customerId,
  });

  const total = items.length;
  const done = items.filter(i => i.status === 'done').length;
  const inProgress = items.filter(i => i.status === 'in_progress').length;
  const na = items.filter(i => i.status === 'not_applicable').length;
  const active = total - na;
  const overallProgress = active > 0 ? Math.round((done / active) * 100) : 0;

  const statusLabel = !items.length
    ? t('compliance_not_initialised')
    : overallProgress === 100
      ? t('compliance_completed')
      : inProgress > 0
        ? t('status_in_progress')
        : t('compliance_total_tasks');

  const statusColor = !items.length
    ? 'text-muted-foreground'
    : overallProgress === 100
      ? 'text-accent'
      : 'text-primary';

  return (
    <Link to="/compliance-journey" className="block">
      <Card className="hover:shadow-md transition-shadow h-full">
        <CardContent className="p-5 h-full flex flex-col">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">{t('nav_compliance_journey')}</p>
          {isLoading ? (
            <div className="h-8 mt-1 bg-muted/40 rounded animate-pulse" />
          ) : (
            <>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={cn('text-2xl font-bold', statusColor)}>{overallProgress}%</span>
                <span className={cn('text-xs font-medium', statusColor)}>· {statusLabel}</span>
              </div>
              <Progress value={overallProgress} className="h-1.5 mt-3" />
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span><strong className="text-foreground">{done}</strong> {t('compliance_completed')}</span>
                <span><strong className="text-foreground">{inProgress}</strong> {t('compliance_in_progress')}</span>
                <span><strong className="text-foreground">{active}</strong> {t('compliance_total_tasks')}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}