import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';

export default function MaturityRadar({ data }) {
  const { t } = useLanguage();
  const title = t('dashboard_maturity_overview');

  if (!data || data.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          {t('dashboard_radar_empty')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center">
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={data}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="domain"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 5]}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            />
            <Radar
              name={t('maturity_initial') === 'Inicial' ? 'Atual' : 'Current'}
              dataKey="current"
              stroke="hsl(var(--chart-1))"
              fill="hsl(var(--chart-1))"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <Radar
              name={t('maturity_initial') === 'Inicial' ? 'Objetivo' : 'Target'}
              dataKey="target"
              stroke="hsl(var(--chart-2))"
              fill="hsl(var(--chart-2))"
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}