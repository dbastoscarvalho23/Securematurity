/**
 * TenantGrowthWidget — area chart of cumulative tenant growth over 12 months.
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
};

export default function TenantGrowthWidget({ customers = [] }) {
  const { t, language } = useLanguage();

  const data = React.useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const cumulative = customers.filter(c => c.created_date && new Date(c.created_date) <= monthEnd).length;
      const newThisMonth = customers.filter(c => {
        if (!c.created_date) return false;
        const cd = new Date(c.created_date);
        return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth();
      }).length;
      const label = d.toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-GB', { month: 'short' });
      months.push({ period: label, total: cumulative, new_tenants: newThisMonth });
    }
    return months;
  }, [customers, language]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <CardTitle className="text-base">{t('admin_dashboard_tenant_growth')}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 || customers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">{t('common_no_data')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="total" name={t('admin_dashboard_total_tenants')} stroke="hsl(var(--chart-1))" fill="url(#gradTotal)" strokeWidth={2} />
              <Area type="monotone" dataKey="new_tenants" name={t('admin_dashboard_new_tenants')} stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
