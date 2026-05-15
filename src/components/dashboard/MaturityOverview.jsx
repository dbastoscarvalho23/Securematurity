import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';

function MaturityGauge({ score }) {
  const pct = (score / 5) * 100;
  const color = score < 2 ? 'hsl(var(--destructive))' : score < 3.5 ? 'hsl(var(--chart-3))' : 'hsl(var(--accent))';

  return (
    <div className="relative flex items-center justify-center" style={{ height: 140 }}>
      <ResponsiveContainer width="100%" height={140}>
        <RadialBarChart
          cx="50%" cy="75%"
          innerRadius="70%"
          outerRadius="100%"
          startAngle={180} endAngle={0}
          data={[{ value: pct, fill: color }]}
          barSize={14}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: 'hsl(var(--muted))' }} dataKey="value" cornerRadius={8} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute bottom-2 text-center">
        <p className="text-3xl font-bold tracking-tight">{score.toFixed(1)}</p>
        <p className="text-xs text-muted-foreground">/ 5.0</p>
      </div>
    </div>
  );
}

export default function MaturityOverview({ assessment }) {
  const { t } = useLanguage();
  const score = assessment?.overall_score || 0;

  const MATURITY_LABELS = [
    '',
    t('maturity_initial'),
    t('maturity_developing'),
    t('maturity_defined'),
    t('maturity_managed'),
    t('maturity_optimized'),
  ];

  const label = MATURITY_LABELS[Math.round(score)] || t('maturity_na');

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> {t('dashboard_overall_maturity')}
          </CardTitle>
          <Link to="/reports" className="text-xs text-primary hover:underline flex items-center gap-1">
            {t('dashboard_reports')} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {score === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t('dashboard_no_maturity')}</p>
        ) : (
          <>
            <MaturityGauge score={score} />
            <p className="text-center text-sm font-semibold mt-1">{label}</p>
            {assessment?.period && (
              <p className="text-center text-xs text-muted-foreground mt-0.5">{t('dashboard_based_on')} {assessment.period}</p>
            )}
            {assessment?.framework_scores?.length > 0 && (
              <div className="mt-4 space-y-2">
                {assessment.framework_scores.map(fs => (
                  <div key={fs.framework_code} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-20 flex-shrink-0 truncate">{fs.framework_code}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${(fs.score / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-6 text-right">{fs.score.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}