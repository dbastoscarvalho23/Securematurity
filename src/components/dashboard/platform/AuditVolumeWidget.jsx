/**
 * AuditVolumeWidget — bar chart of audit events per day (last 30 days).
 * Fetches its own data via AuditLog.list().
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
};

export default function AuditVolumeWidget() {
  const { t, language } = useLanguage();

  const { data: logs = [] } = useQuery({
    queryKey: ['audit-logs-volume'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 500),
  });

  const data = React.useMemo(() => {
    const now = new Date();
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const count = logs.filter(l => {
        if (!l.created_date) return false;
        const ld = new Date(l.created_date);
        return ld >= d && ld < next;
      }).length;
      const label = d.toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-GB', { day: '2-digit', month: '2-digit' });
      days.push({ date: label, events: count });
    }
    return days;
  }, [logs, language]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        <CardTitle className="text-base">{t('admin_dashboard_audit_volume')}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">{t('common_no_data')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="events" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
