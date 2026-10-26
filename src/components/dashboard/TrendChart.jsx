import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';
import { FRAMEWORK_NAMES } from '@/lib/frameworkConstants';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default function TrendChart({ data, frameworks, title: titleProp }) {
  const { t } = useLanguage();
  const title = titleProp || t('dashboard_maturity_trends');
  const fwList = frameworks || [];
  const [hidden, setHidden] = useState(() => new Set());

  // Reset hidden set when the framework list changes
  useEffect(() => {
    setHidden(new Set());
  }, [fwList.join(',')]);

  const toggle = (fw) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(fw)) next.delete(fw);
      else next.add(fw);
      return next;
    });
  };

  const visibleFws = fwList.filter((fw) => !hidden.has(fw));

  if (!data || data.length === 0) {
    return (
      <Card className="h-full flex flex-col rounded-[10px] shadow-none">
        <CardHeader className="p-5 pb-4"><CardTitle className="text-[13px] font-semibold">{title}</CardTitle></CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-5 pt-0 text-muted-foreground text-xs">
          {t('dashboard_trends_empty')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col rounded-[10px] shadow-none">
      <CardHeader className="p-5 pb-4">
        <CardTitle className="text-[13px] font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 p-5 pt-0">
        <div className="flex-1 flex items-center justify-center min-h-[220px]">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis domain={[0, 5]} axisLine={false} tickLine={false} width={36} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '11px'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              {visibleFws.map((fw) => {
                const i = fwList.indexOf(fw);
                const color = COLORS[i % COLORS.length];
                return (
                  <Line
                    key={fw}
                    type="monotone"
                    dataKey={fw}
                    name={FRAMEWORK_NAMES?.[fw] || fw}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 2, stroke: color, fill: 'hsl(var(--card))' }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--foreground))', fill: color }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {fwList.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {fwList.map((fw, i) => {
              const isHidden = hidden.has(fw);
              const color = COLORS[i % COLORS.length];
              return (
                <button
                  key={fw}
                  type="button"
                  onClick={() => toggle(fw)}
                  title={FRAMEWORK_NAMES?.[fw] || fw}
                  className={`inline-flex items-center gap-1.5 text-[9px] font-medium transition-opacity ${
                    isHidden ? 'text-muted-foreground opacity-50 line-through' : 'text-foreground hover:opacity-80'
                  }`}
                  aria-pressed={!isHidden}
                >
                  <span
                    className="h-0.5 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isHidden ? 'hsl(var(--muted-foreground) / 0.4)' : color }}
                  />
                  {fw}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
