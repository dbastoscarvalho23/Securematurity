import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const STATUS_COLORS = {
  approved: 'hsl(var(--chart-2))',
  under_review: 'hsl(var(--chart-3))',
  draft: 'hsl(var(--muted-foreground))',
  deprecated: 'hsl(var(--destructive))',
};

export default function DocCustomerBreakdown({ docs, customers, isAdmin, user }) {
  const { t } = useLanguage();
  const breakdown = useMemo(() => {
    if (isAdmin) {
      // Group by customer
      const map = {};
      for (const doc of docs) {
        const name = doc.customer_name || 'Global';
        if (!map[name]) map[name] = { name, total: 0, approved: 0, under_review: 0, draft: 0, deprecated: 0 };
        map[name].total++;
        if (doc.status) map[name][doc.status] = (map[name][doc.status] || 0) + 1;
      }
      return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
    } else {
      // Group by level for customer users
      const map = {};
      for (const doc of docs) {
        const name = doc.level?.charAt(0).toUpperCase() + doc.level?.slice(1) || 'Unknown';
        if (!map[name]) map[name] = { name, total: 0, approved: 0, under_review: 0, draft: 0, deprecated: 0 };
        map[name].total++;
        if (doc.status) map[name][doc.status] = (map[name][doc.status] || 0) + 1;
      }
      return Object.values(map).sort((a, b) => b.total - a.total);
    }
  }, [docs, isAdmin]);

  const title = isAdmin ? t('doc_audit_breakdown_by_customer') : t('doc_audit_breakdown_by_level');

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-chart-2" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={breakdown} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="approved" name={t('doc_audit_bar_approved')} stackId="a" fill="hsl(var(--chart-2))" radius={[0, 0, 0, 0]} />
            <Bar dataKey="under_review" name={t('doc_audit_bar_under_review')} stackId="a" fill="hsl(var(--chart-3))" />
            <Bar dataKey="draft" name={t('doc_audit_bar_draft')} stackId="a" fill="hsl(var(--muted-foreground))" opacity={0.5} />
            <Bar dataKey="deprecated" name={t('doc_audit_bar_deprecated')} stackId="a" fill="hsl(var(--destructive))" opacity={0.6} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* Summary table */}
        <div className="space-y-1">
          {breakdown.map(row => (
            <div key={row.name} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/20 text-sm">
              <p className="flex-1 font-medium truncate">{row.name}</p>
              <span className="text-xs text-muted-foreground">{row.total} {t('doc_audit_breakdown_total')}</span>
              {row.under_review > 0 && (
                <Badge className="bg-chart-3/10 text-chart-3 border-chart-3/20 text-xs">{row.under_review} {t('doc_audit_breakdown_pending')}</Badge>
              )}
              {row.approved > 0 && (
                <Badge className="bg-chart-2/10 text-chart-2 border-chart-2/20 text-xs">{row.approved} {t('doc_audit_breakdown_approved')}</Badge>
              )}
            </div>
          ))}
          {breakdown.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t('doc_audit_breakdown_no_data')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}