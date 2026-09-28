/**
 * ModuleAdoptionWidget — horizontal bar chart of module adoption across tenants.
 * Fetches its own data via TenantModule.list().
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Boxes } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
};

export default function ModuleAdoptionWidget() {
  const { t } = useLanguage();

  const { data: modules = [] } = useQuery({
    queryKey: ['tenant-modules'],
    queryFn: () => base44.entities.TenantModule.list(),
  });

  const data = React.useMemo(() => {
    const counts = {};
    modules.forEach(m => {
      const mod = m.module || m.module_id || 'unknown';
      counts[mod] = (counts[mod] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [modules]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Boxes className="w-4 h-4 text-primary" />
        <CardTitle className="text-base">{t('admin_dashboard_module_adoption')}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">{t('common_no_data')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis dataKey="module" type="category" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={90} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
