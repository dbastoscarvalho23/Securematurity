/**
 * PlatformOverview — 4 business analytics charts for master_admin.
 * Fetches its own data via React Query.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';
import { BarChart3, PieChart as PieIcon, Layers, AlertCircle } from 'lucide-react';
import { chartColor } from '@/lib/palette';

/** Palettes resolved from the design-system tokens (FC2) — never a literal. */
const STATUS_COLORS = {
  Active: 'hsl(var(--chart-2))',
  Onboarding: 'hsl(var(--chart-3))',
  Inactive: 'hsl(var(--muted-foreground))',
};
const RISK_COLORS = {
  open: 'hsl(var(--destructive))',
  in_treatment: 'hsl(var(--chart-3))',
  accepted: 'hsl(var(--chart-1))',
  closed: 'hsl(var(--chart-2))',
};

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
};

export default function PlatformOverview() {
  const { t } = useLanguage();

  const { data: customers = [] } = useQuery({
    queryKey: ['overview-customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: risks = [] } = useQuery({
    queryKey: ['overview-risks'],
    queryFn: () => base44.entities.RiskItem.list('-created_date', 500),
  });

  // Maturity by sector
  const sectorData = React.useMemo(() => {
    const bySector = {};
    customers.forEach(c => {
      const sector = c.sector || 'Unknown';
      if (!bySector[sector]) bySector[sector] = { sector, total: 0, sum: 0 };
      if (c.maturity_score != null) {
        bySector[sector].sum += c.maturity_score;
        bySector[sector].total += 1;
      }
    });
    return Object.values(bySector)
      .map(s => ({ sector: s.sector, avg_score: s.total > 0 ? +(s.sum / s.total).toFixed(2) : 0 }))
      .sort((a, b) => b.avg_score - a.avg_score)
      .slice(0, 8);
  }, [customers]);

  // Customer status
  const statusData = React.useMemo(() => {
    const counts = { active: 0, onboarding: 0, inactive: 0 };
    customers.forEach(c => {
      const s = c.status || 'inactive';
      if (counts[s] !== undefined) counts[s]++;
    });
    return [
      { name: 'Active', value: counts.active },
      { name: 'Onboarding', value: counts.onboarding },
      { name: 'Inactive', value: counts.inactive },
    ].filter(d => d.value > 0);
  }, [customers]);

  // Framework usage
  const frameworkData = React.useMemo(() => {
    const counts = {};
    customers.forEach(c => {
      (c.frameworks || []).forEach(fw => {
        counts[fw] = (counts[fw] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([framework, count]) => ({ framework, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [customers]);

  // Risk breakdown
  const riskData = React.useMemo(() => {
    const counts = { open: 0, in_treatment: 0, accepted: 0, closed: 0 };
    risks.forEach(r => {
      const s = r.status || 'open';
      if (counts[s] !== undefined) counts[s]++;
    });
    return [
      { name: 'Open', value: counts.open, color: RISK_COLORS.open },
      { name: 'In Treatment', value: counts.in_treatment, color: RISK_COLORS.in_treatment },
      { name: 'Accepted', value: counts.accepted, color: RISK_COLORS.accepted },
      { name: 'Closed', value: counts.closed, color: RISK_COLORS.closed },
    ].filter(d => d.value > 0);
  }, [risks]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Maturity by sector */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">{t('admin_maturity_by_sector')}</CardTitle>
        </CardHeader>
        <CardContent>
          {sectorData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">{t('admin_no_benchmark')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={sectorData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis dataKey="sector" type="category" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={80} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="avg_score" name={t('admin_avg_maturity')} radius={[0, 4, 4, 0]}>
                  {sectorData.map((_, i) => (
                    <Cell key={i} fill={chartColor(i)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Customer status */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <PieIcon className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">{t('admin_customer_status')}</CardTitle>
        </CardHeader>
        <CardContent>
          {statusData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">{t('common_no_data')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={STATUS_COLORS[statusData[i].name]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Framework usage */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">{t('admin_framework_usage')}</CardTitle>
        </CardHeader>
        <CardContent>
          {frameworkData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">{t('common_no_data')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={frameworkData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis dataKey="framework" type="category" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={80} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Risk breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <AlertCircle className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">{t('admin_risk_breakdown')}</CardTitle>
        </CardHeader>
        <CardContent>
          {riskData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">{t('common_no_data')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={riskData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {riskData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
