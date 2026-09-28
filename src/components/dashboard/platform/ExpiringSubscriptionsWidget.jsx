/**
 * ExpiringSubscriptionsWidget — list of subscriptions expiring in next 30 days,
 * plus suspended subscriptions.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function ExpiringSubscriptionsWidget({ subscriptions = [] }) {
  const { t, language } = useLanguage();

  const { expiring, suspended } = React.useMemo(() => {
    const now = new Date();
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);

    const exp = subscriptions
      .filter(s => {
        if (!s.end_date || s.status === 'cancelled' || s.status === 'expired') return false;
        const end = new Date(s.end_date);
        return end >= now && end <= in30Days;
      })
      .map(s => {
        const end = new Date(s.end_date);
        const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
        return { ...s, daysLeft };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 8);

    const susp = subscriptions.filter(s => s.status === 'suspended').slice(0, 8);

    return { expiring: exp, suspended: susp };
  }, [subscriptions]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <CalendarClock className="w-4 h-4 text-primary" />
        <CardTitle className="text-base">{t('admin_dashboard_expiring_subs')}</CardTitle>
      </CardHeader>
      <CardContent>
        {expiring.length === 0 && suspended.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">{t('common_no_data')}</p>
        ) : (
          <div className="space-y-3">
            {/* Expiring */}
            {expiring.length > 0 && (
              <div className="space-y-2">
                {expiring.map(s => (
                  <Link key={s.id} to="/licensing" className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{s.customer_name || s.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.end_date ? new Date(s.end_date).toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-GB') : '—'}
                      </p>
                    </div>
                    <Badge variant={s.daysLeft <= 7 ? 'destructive' : 'secondary'} className="ml-2">
                      {s.daysLeft} {t('admin_dashboard_days')}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
            {/* Suspended */}
            {suspended.length > 0 && (
              <div className="pt-3 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <p className="text-xs font-medium text-muted-foreground">{t('admin_dashboard_suspended_subs')}</p>
                </div>
                <div className="space-y-1">
                  {suspended.map(s => (
                    <Link key={s.id} to="/licensing" className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <p className="text-sm truncate flex-1">{s.customer_name || s.name || '—'}</p>
                      <Badge variant="destructive" className="ml-2">{t('admin_dashboard_status_suspended')}</Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
