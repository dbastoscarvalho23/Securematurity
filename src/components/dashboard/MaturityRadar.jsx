import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';

export default function MaturityRadar({ data }) {
  const { t } = useLanguage();
  const title = t('dashboard_maturity_overview');

  if (!data || data.length === 0) {
    return (
      <Card className="h-full flex flex-col rounded-[10px] shadow-none">
        <CardHeader className="p-5 pb-4"><CardTitle className="text-[13px] font-semibold">{title}</CardTitle></CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-5 pt-0 text-muted-foreground text-xs">
          {t('dashboard_radar_empty')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col rounded-[10px] shadow-none">
      <CardHeader className="p-5 pb-4">
        <CardTitle className="text-[13px] font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center p-5 pt-0">
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={data}>
            <PolarGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <PolarAngleAxis
              dataKey="domain"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 5]}
              axisLine={false}
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            />
            <Radar
              name={t('x_radar_target')}
              dataKey="target"
              stroke="hsl(var(--primary))"
              fill="none"
              fillOpacity={0}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <Radar
              name={t('x_radar_current')}
              dataKey="current"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.35}
              strokeWidth={1.5}
            />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }} />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}