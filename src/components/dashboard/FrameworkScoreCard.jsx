import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';

// Cores por referencial, como no Figma (Executive Dashboard): NIS2 dourado, ISO teal, NIST amarelo, CIS laranja.
const frameworkColors = {
  NIS2: { badge: 'bg-chart-1/10 text-chart-1 border-chart-1', bar: 'bg-chart-1' },
  ISO27001: { badge: 'bg-chart-2/10 text-chart-2 border-chart-2', bar: 'bg-chart-2' },
  NIST_CSF: { badge: 'bg-chart-3/10 text-chart-3 border-chart-3', bar: 'bg-chart-3' },
  CIS_V8: { badge: 'bg-chart-4/10 text-chart-4 border-chart-4', bar: 'bg-chart-4' },
};

export default function FrameworkScoreCard({ framework_code, name, score, previousScore }) {
  const { t } = useLanguage();
  const pct = (score / 5) * 100;
  const colorClass = frameworkColors[framework_code] || frameworkColors.NIS2;
  const delta = previousScore != null ? score - previousScore : null;

  const getMaturityLabel = (s) => {
    if (s < 1) return t('maturity_initial');
    if (s < 2) return t('maturity_developing');
    if (s < 3) return t('maturity_defined');
    if (s < 4) return t('maturity_managed');
    return t('maturity_optimized');
  };

  const label = getMaturityLabel(score);

  return (
    <Card className="rounded-[10px] shadow-none hover:border-primary/40 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className={cn("rounded-md px-2 py-0.5 text-[9px] font-semibold leading-none border", colorClass.badge)}>
            {framework_code.replace('_', ' ')}
          </Badge>
          {delta != null && (
            <span className={cn("text-[10px] font-semibold leading-[14px]", delta >= 0 ? "text-risk-low" : "text-destructive")}>
              {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
            </span>
          )}
        </div>
        <p className="text-[11px] font-medium text-muted-foreground truncate">{name}</p>
        <div className="flex items-baseline gap-1">
          <span className="font-display text-[22px] leading-none text-foreground">{score.toFixed(1)}</span>
          <span className="text-[11px] text-muted-foreground">/ 5.0</span>
        </div>
        <div className="space-y-1">
          <Progress value={pct} className="h-1.5" indicatorClassName={colorClass.bar} />
          <p className="text-[9px] text-muted-foreground">{t('maturity_level')}: <span className="font-semibold text-foreground">{label}</span></p>
        </div>
      </CardContent>
    </Card>
  );
}
