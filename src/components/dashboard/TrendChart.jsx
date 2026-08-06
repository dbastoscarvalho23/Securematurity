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
      <Card className="h-full flex flex-col">
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          {t('dashboard_trends_empty')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {fwList.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {fwList.map((fw, i) => {
              const isHidden = hidden.has(fw);
              const color = COLORS[i % COLORS.length];
              const label = FRAMEWORK_NAMES?.[fw] || fw;
              return (
                <button
                  key={fw}
                  type="button"
                  onClick={() => toggle(fw)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    isHidden
                      ? 'bg-muted/40 text-muted-foreground border-border opacity-60'
                      : 'bg-background text-foreground border-border hover:bg-muted/50'
                  }`}
                  aria-pressed={!isHidden}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isHidden ? 'hsl(var(--muted-foreground) / 0.4)' : color }}
                  />
                  {label}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex-1 flex items-center justify-center min-h-[240px]">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              {visibleFws.map((fw) => {
                const i = fwList.indexOf(fw);
                return (
                  <Line
                    key={fw}
                    type="monotone"
                    dataKey={fw}
                    name={FRAMEWORK_NAMES?.[fw] || fw}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}