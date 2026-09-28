/**
 * TopAIConsumersWidget — top 8 tenants by AI consumption this month.
 * Source: LicenseUsageRecord, the monthly per-customer counter written by
 * enforceUsageLimit() when an AI-backed action is used.
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function TopAIConsumersWidget({ usage = [], customers = [] }) {
  const { t } = useLanguage();

  const topConsumers = React.useMemo(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const nameById = Object.fromEntries(customers.map(c => [c.id, c.name]));

    return usage
      .filter(u => u.month === month && (u.usage_count || 0) > 0)
      .map(u => ({
        id: u.id,
        name: nameById[u.customer_id] || u.customer_id,
        count: u.usage_count || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [usage, customers]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        <CardTitle className="text-base">{t('admin_dashboard_top_ai_consumers')}</CardTitle>
      </CardHeader>
      <CardContent>
        {topConsumers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">{t('common_no_data')}</p>
        ) : (
          <div className="space-y-2">
            {topConsumers.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                  {i + 1}
                </div>
                <span className="text-sm flex-1 truncate">{c.name}</span>
                <span className="text-sm font-medium text-muted-foreground">{c.count}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
