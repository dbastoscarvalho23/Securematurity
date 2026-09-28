/**
 * TopAIConsumersWidget — list of top 8 users by AI consumption this month.
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function TopAIConsumersWidget({ usage = [] }) {
  const { t } = useLanguage();

  const { topUsers, byOperation } = React.useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthUsage = usage.filter(u => u.created_date && new Date(u.created_date) >= monthStart);

    // Top users by count
    const userCounts = {};
    monthUsage.forEach(u => {
      const email = u.user_email || u.email || 'unknown';
      userCounts[email] = (userCounts[email] || 0) + 1;
    });
    const top = Object.entries(userCounts)
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // By operation
    const opCounts = {};
    monthUsage.forEach(u => {
      const op = u.operation || u.action || 'unknown';
      opCounts[op] = (opCounts[op] || 0) + 1;
    });
    const ops = Object.entries(opCounts)
      .map(([operation, count]) => ({ operation, count }))
      .sort((a, b) => b.count - a.count);

    return { topUsers: top, byOperation: ops };
  }, [usage]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        <CardTitle className="text-base">{t('admin_dashboard_top_ai_consumers')}</CardTitle>
      </CardHeader>
      <CardContent>
        {topUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">{t('common_no_data')}</p>
        ) : (
          <div className="space-y-3">
            {/* Top users */}
            <div className="space-y-2">
              {topUsers.map((u, i) => (
                <div key={u.email} className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-sm flex-1 truncate">{u.email}</span>
                  <span className="text-sm font-medium text-muted-foreground">{u.count}</span>
                </div>
              ))}
            </div>
            {/* By operation */}
            {byOperation.length > 0 && (
              <div className="pt-3 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('admin_dashboard_by_operation')}</p>
                <div className="flex flex-wrap gap-2">
                  {byOperation.slice(0, 6).map(op => (
                    <span key={op.operation} className="bg-muted/50 rounded-lg px-2.5 py-1.5 text-xs">
                      {op.operation}: {op.count}
                    </span>
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
