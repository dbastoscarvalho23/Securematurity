import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Layers } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';

const TIERS = [
  { key: 'tier_1', fill: 'hsl(var(--accent))' },
  { key: 'tier_2', fill: 'hsl(var(--primary))' },
  { key: 'tier_3', fill: 'hsl(var(--chart-3))' },
];

export default function SupplierTierDistributionChart({ suppliers = [] }) {
  const { t } = useLanguage();

  const counts = { tier_1: 0, tier_2: 0, tier_3: 0 };
  suppliers.forEach(s => { if (s.tier && counts[s.tier] !== undefined) counts[s.tier]++; });
  const total = suppliers.length;
  const data = TIERS.map(tier => ({ name: t(`suppliers_${tier.key}`), value: counts[tier.key], fill: tier.fill }));

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold">{t('sst_tier_distribution_title')}</h3>
            <p className="text-xs text-muted-foreground">{t('sst_tier_distribution_subtitle')}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers className="w-4 h-4 text-primary" />
          </div>
        </div>

        {total === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
            {t('sst_tier_distribution_empty')}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={2} stroke="none">
                    {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [value, t('suppliers_total')]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold leading-none">{total}</span>
                <span className="text-[11px] text-muted-foreground mt-1">{t('suppliers_total')}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
              {TIERS.map(tier => (
                <div key={tier.key} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tier.fill }} />
                  <span className="text-muted-foreground">{t(`suppliers_${tier.key}`)}</span>
                  <span className="font-semibold">{counts[tier.key]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}