import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';

const frameworkColors = {
  NIS2: 'bg-chart-1/10 text-chart-1 border-chart-1/20',
  ISO27001: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  NIST_CSF: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  CIS_V8: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
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
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <Badge variant="outline" className={cn("text-xs font-semibold border", colorClass)}>
            {framework_code.replace('_', ' ')}
          </Badge>
          {delta != null && (
            <span className={cn("text-xs font-medium", delta >= 0 ? "text-accent" : "text-destructive")}>
              {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-1">{name}</p>
        <div className="flex items-end gap-2 mb-2">
          <span className="text-2xl font-bold">{score.toFixed(1)}</span>
          <span className="text-sm text-muted-foreground mb-0.5">/ 5.0</span>
        </div>
        <Progress value={pct} className="h-2 mb-2" />
        <p className="text-xs text-muted-foreground">{t('maturity_level')}: <span className="font-medium text-foreground">{label}</span></p>
      </CardContent>
    </Card>
  );
}