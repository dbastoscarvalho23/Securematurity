import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Building2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';

const statusStyles = {
  active: 'bg-accent/10 text-accent border-accent/20',
  inactive: 'bg-muted text-muted-foreground',
  onboarding: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
};

export default function CustomersOverview({ customers }) {
  const { t } = useLanguage();
  const active = customers.filter(c => c.status === 'active').length;
  const onboarding = customers.filter(c => c.status === 'onboarding').length;
  const inactive = customers.filter(c => c.status === 'inactive').length;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> {t('dashboard_customers')}
          </CardTitle>
          <Link to="/customers" className="text-xs text-primary hover:underline flex items-center gap-1">
            {t('dashboard_view_all')} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="flex gap-3 text-sm mt-1">
          <span><span className="font-semibold text-accent">{active}</span> <span className="text-muted-foreground text-xs">{t('dashboard_active')}</span></span>
          <span><span className="font-semibold text-chart-3">{onboarding}</span> <span className="text-muted-foreground text-xs">{t('dashboard_onboarding')}</span></span>
          <span><span className="font-semibold text-muted-foreground">{inactive}</span> <span className="text-muted-foreground text-xs">{t('dashboard_inactive')}</span></span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {customers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t('dashboard_no_customers')}</p>
        ) : (
          <div className="space-y-2">
            {customers.slice(0, 6).map(c => (
              <Link key={c.id} to="/customers" className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/40 transition-colors group">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {c.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{c.name}</p>
                    <p className="text-xs text-muted-foreground capitalize truncate">{c.sector?.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <Badge variant="outline" className={cn("text-xs border flex-shrink-0 capitalize", statusStyles[c.status])}>
                  {c.status === 'active' ? t('dashboard_active') : c.status === 'onboarding' ? t('dashboard_onboarding') : t('dashboard_inactive')}
                </Badge>
              </Link>
            ))}
            {customers.length > 6 && (
              <p className="text-xs text-muted-foreground text-center pt-1">+{customers.length - 6} {t('dashboard_more')}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}