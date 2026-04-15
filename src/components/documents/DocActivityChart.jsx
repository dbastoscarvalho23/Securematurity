import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format, eachDayOfInterval, subDays, startOfWeek, eachWeekOfInterval } from 'date-fns';

export default function DocActivityChart({ docs, versions, rangeDays, isLoading }) {
  const chartData = useMemo(() => {
    const today = new Date();
    const useWeeks = !rangeDays || rangeDays > 60;

    if (useWeeks) {
      const start = rangeDays ? subDays(today, rangeDays) : subDays(today, 180);
      const weeks = eachWeekOfInterval({ start, end: today }, { weekStartsOn: 1 });

      return weeks.map((weekStart, i) => {
        const weekEnd = i + 1 < weeks.length ? weeks[i + 1] : new Date(today.getTime() + 86400000);
        const label = format(weekStart, 'MMM d');
        const created = docs.filter(d => {
          const dt = new Date(d.created_date);
          return dt >= weekStart && dt < weekEnd;
        }).length;
        const updated = versions.filter(v => {
          const dt = new Date(v.created_date);
          return dt >= weekStart && dt < weekEnd;
        }).length;
        return { label, created, updated };
      });
    } else {
      // Daily buckets
      const start = subDays(today, rangeDays - 1);
      return eachDayOfInterval({ start, end: today }).map(day => {
        const next = new Date(day.getTime() + 86400000);
        const label = format(day, 'MMM d');
        const created = docs.filter(d => {
          const dt = new Date(d.created_date);
          return dt >= day && dt < next;
        }).length;
        const updated = versions.filter(v => {
          const dt = new Date(v.created_date);
          return dt >= day && dt < next;
        }).length;
        return { label, created, updated };
      });
    }
  }, [docs, versions, rangeDays]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-chart-1" />
          Document Activity Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorUpdated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-5))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-5))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="created" name="Documents Created" stroke="hsl(var(--chart-1))" fill="url(#colorCreated)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="updated" name="Versions Saved" stroke="hsl(var(--chart-5))" fill="url(#colorUpdated)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}