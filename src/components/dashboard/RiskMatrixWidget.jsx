import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { ShieldAlert, ExternalLink } from 'lucide-react';
import { deriveRisksFromAssessment, mergeRisks, summariseRisks, riskScore } from '@/lib/riskEngine';
import { cn } from '@/lib/utils';

const CELL_COLOR = (impact, likelihood) => {
  const score = impact * likelihood;
  if (score >= 16) return 'bg-destructive/80 text-white';
  if (score >= 9) return 'bg-chart-4/60 text-white';
  if (score >= 4) return 'bg-chart-3/50 text-foreground';
  return 'bg-chart-2/25 text-muted-foreground';
};

const LEVEL_COLORS = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  medium: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  low: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
};

export default function RiskMatrixWidget() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const customerId = user?.customer_id;
  const [hoveredRisks, setHoveredRisks] = useState([]);

  const { data: manualRisks = [] } = useQuery({
    queryKey: ['riskItems-dashboard'],
    queryFn: () => base44.entities.RiskItem.list('-created_date', 200),
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ['assessments-risk', user?.email, customerId],
    queryFn: () => isAdmin
      ? base44.entities.Assessment.filter({ status: 'completed' }, '-completed_date', 20)
      : base44.entities.Assessment.filter({ customer_id: customerId, status: 'completed' }, '-completed_date', 10),
    enabled: isAdmin || !!customerId,
  });

  const derivedRisks = useMemo(() => {
    const seen = new Set();
    const latest = [];
    assessments.forEach(a => {
      const key = a.customer_id || 'global';
      if (!seen.has(key)) { seen.add(key); latest.push(a); }
    });
    return latest.flatMap(deriveRisksFromAssessment);
  }, [assessments]);

  const scopedManual = useMemo(() => {
    if (isAdmin) return manualRisks;
    return manualRisks.filter(r => !r.customer_id || r.customer_id === customerId);
  }, [manualRisks, isAdmin, customerId]);

  const allRisks = useMemo(() => mergeRisks(scopedManual, derivedRisks), [scopedManual, derivedRisks]);
  const summary = useMemo(() => summariseRisks(scopedManual), [scopedManual]);

  const getCell = (impact, likelihood) =>
    allRisks.filter(r => r.impact === impact && r.likelihood === likelihood);

  const topRisks = useMemo(() =>
    [...allRisks]
      .sort((a, b) => riskScore(b.impact, b.likelihood) - riskScore(a.impact, a.likelihood))
      .slice(0, 5),
    [allRisks]
  );

  const total = scopedManual.length;
  const distPct = {
    critical: total ? Math.round((summary.critical / total) * 100) : 0,
    high:     total ? Math.round((summary.high     / total) * 100) : 0,
    medium:   total ? Math.round((summary.medium   / total) * 100) : 0,
    low:      total ? Math.round((summary.low      / total) * 100) : 0,
  };

  const levelLabel = (level) => {
    if (level === 'critical') return t('risk_level_critical');
    if (level === 'high') return t('risk_level_high');
    if (level === 'medium') return t('risk_level_medium');
    return t('risk_level_low');
  };

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <div className="flex flex-row items-center justify-between mb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-destructive" />
            {t('dashboard_risk_heatmap')}
            <span className="text-xs font-normal text-muted-foreground ml-1">
              {t('dashboard_risk_heatmap_sub')}
            </span>
          </CardTitle>
          <Link to="/risk-assessment" className="text-xs text-primary flex items-center gap-1 hover:underline">
            {t('dashboard_manage_risks')} <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        {total > 0 && (
          <div className="space-y-1">
            <div className="flex h-2.5 rounded-full overflow-hidden w-full gap-px">
              {distPct.critical > 0 && <div className="bg-red-500 transition-all duration-700"    style={{ width: `${distPct.critical}%` }} title={`${t('risk_level_critical')}: ${summary.critical}`} />}
              {distPct.high > 0     && <div className="bg-orange-400 transition-all duration-700" style={{ width: `${distPct.high}%` }}     title={`${t('risk_level_high')}: ${summary.high}`} />}
              {distPct.medium > 0   && <div className="bg-yellow-400 transition-all duration-700" style={{ width: `${distPct.medium}%` }}   title={`${t('risk_level_medium')}: ${summary.medium}`} />}
              {distPct.low > 0      && <div className="bg-emerald-400 transition-all duration-700" style={{ width: `${distPct.low}%` }}    title={`${t('risk_level_low')}: ${summary.low}`} />}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {t('dashboard_score_dist')} <strong>{total}</strong> {total !== 1 ? t('dashboard_risks') : t('dashboard_risk')}
              {summary.critical > 0 && <span className="text-red-600 ml-1">· {summary.critical} {t('dashboard_critical_risks')}</span>}
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Matrix */}
          <div className="lg:col-span-2">
            <div className="flex gap-2 mb-4 flex-wrap">
              {[
                { key: 'critical', count: summary.critical },
                { key: 'high', count: summary.high },
                { key: 'medium', count: summary.medium },
                { key: 'low', count: summary.low },
              ].map(({ key, count }) => (
                <Badge key={key} variant="outline" className={cn('border text-xs px-2.5 py-1', LEVEL_COLORS[key])}>
                  {count} {levelLabel(key)}
                </Badge>
              ))}
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[280px] max-w-md">
                <div className="flex items-center mb-1">
                  <div className="w-12 text-[10px] text-muted-foreground text-right pr-2">{t('dashboard_impact')}</div>
                  <div className="flex-1 text-center text-[10px] text-muted-foreground">{t('dashboard_likelihood')}</div>
                </div>
                <div className="flex">
                  <div className="w-12 flex flex-col-reverse pr-2 py-0.5 gap-0.5">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="h-9 flex items-center justify-end text-[10px] text-muted-foreground font-medium">{i}</div>
                    ))}
                  </div>
                  <div className="flex-1">
                    <div className="flex mb-1 gap-0.5">
                      {[1, 2, 3, 4, 5].map(l => (
                        <div key={l} className="flex-1 text-center text-[10px] text-muted-foreground font-medium">{l}</div>
                      ))}
                    </div>
                    {[5, 4, 3, 2, 1].map(impact => (
                      <div key={impact} className="flex gap-0.5 mb-0.5">
                        {[1, 2, 3, 4, 5].map(likelihood => {
                          const cell = getCell(impact, likelihood);
                          return (
                            <div
                              key={likelihood}
                              className={cn(
                                'flex-1 h-9 rounded flex items-center justify-center text-xs font-semibold cursor-default transition-opacity',
                                CELL_COLOR(impact, likelihood),
                                cell.length > 0 ? 'opacity-100 ring-1 ring-white/20' : 'opacity-60'
                              )}
                              title={cell.map(r => r.title).join('\n') || `I:${impact} × L:${likelihood} = ${impact * likelihood}`}
                              onMouseEnter={() => setHoveredRisks(cell)}
                              onMouseLeave={() => setHoveredRisks([])}
                            >
                              {cell.length > 0 ? cell.length : ''}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-chart-2/25 inline-block" /> {t('risk_trend_low')}</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-chart-3/50 inline-block" /> {t('risk_trend_medium')}</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-chart-4/60 inline-block" /> {t('risk_trend_high')}</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-destructive/80 inline-block" /> {t('risk_trend_critical')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top risks sidebar */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t('dashboard_top_risks')}
            </p>
            {topRisks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">{t('dashboard_no_risks')}</p>
            ) : topRisks.map(risk => {
              const score = riskScore(risk.impact, risk.likelihood);
              const level = score >= 16 ? 'critical' : score >= 9 ? 'high' : score >= 4 ? 'medium' : 'low';
              return (
                <div
                  key={risk.id}
                  className={cn(
                    'flex items-start gap-2.5 p-2.5 rounded-lg border text-xs transition-colors',
                    hoveredRisks.find(h => h.id === risk.id) ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-muted/40'
                  )}
                >
                  <div className={cn(
                    'w-7 h-7 rounded-md flex items-center justify-center font-bold flex-shrink-0 text-xs',
                    level === 'critical' ? 'bg-destructive/15 text-destructive' :
                    level === 'high' ? 'bg-chart-4/15 text-chart-4' :
                    level === 'medium' ? 'bg-chart-3/15 text-chart-3' : 'bg-chart-2/15 text-chart-2'
                  )}>
                    {score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium leading-snug truncate">{risk.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <Badge variant="outline" className={cn('text-[10px] border py-0', LEVEL_COLORS[level])}>{levelLabel(level)}</Badge>
                      {risk.isDerived && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">auto</span>
                      )}
                      {risk.framework_code && (
                        <span className="text-[10px] text-muted-foreground">{risk.framework_code}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {scopedManual.length > 5 && (
              <Link to="/risk-assessment" className="text-xs text-primary hover:underline block text-center pt-1">
                {t('dashboard_view_all_risks')} {scopedManual.length} {t('dashboard_risks')} →
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}