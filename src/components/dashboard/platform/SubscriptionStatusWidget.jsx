/**
 * SubscriptionStatusWidget — horizontal bar chart of subscription statuses.
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
};

export default function SubscriptionStatusWidget({ subscriptions = [] }) {
  const { t } = useLanguage();

  const data = React.useMemo(() => {
    const statusKeys = ['active', 'trial', 'suspended', 'expired', 'cancelled'];
    const counts = {};
    statusKeys.forEach(s => { counts[s] = 0; });
    subscriptions.forEach(s => {
      const status = s.status || 'active';
      if (counts[status] !== undefined) counts[status]++;
    });
    return statusKeys
      .filter(s => counts[s] > 0)
      .map(s => ({
        status: t(`admin_dashboard_status_${s}`),
        count: counts[s],
      }));
  }, [subscriptions, t]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <CardTitle className="text-base">{t('admin_dashboard_sub_status')}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">{t('common_no_data')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis dataKey="status" type="category" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={70} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
