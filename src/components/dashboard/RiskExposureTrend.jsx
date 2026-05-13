import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TrendingDown, TrendingUp, Minus, Activity } from 'lucide-react';
import { format, startOfMonth, subMonths, parseISO } from 'date-fns';

// Build month buckets for the last N months
function buildMonthBuckets(n = 6) {
  const buckets = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    buckets.push({
      key: format(d, 'yyyy-MM'),
      label: format(d, 'MMM yy'),
    });
  }
  return buckets;
}

function avgScore(risks) {
  if (!risks.length) return null;
  const sum = risks.reduce((acc, r) => acc + (r.impact || 1) * (r.likelihood || 1), 0);
  return parseFloat((sum / risks.length).toFixed(1));
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  const level = val >= 16 ? { label: 'Critical', cls: 'text-red-600' }
    : val >= 9  ? { label: 'High',     cls: 'text-orange-600' }
    : val >= 4  ? { label: 'Medium',   cls: 'text-yellow-600' }
    : val !== null ? { label: 'Low',   cls: 'text-emerald-600' }
    : { label: 'No data', cls: 'text-muted-foreground' };

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      {val !== null ? (
        <>
          <p className="text-muted-foreground">Avg exposure score: <span className="font-bold text-foreground">{val}</span></p>
          <p className={`font-semibold ${level.cls}`}>{level.label} risk zone</p>
          {payload[0]?.payload?.count != null && (
            <p className="text-muted-foreground">{payload[0].payload.count} open risk{payload[0].payload.count !== 1 ? 's' : ''}</p>
          )}
        </>
      ) : (
        <p className="text-muted-foreground">No open risks recorded</p>
      )}
    </div>
  );
};

export default function RiskExposureTrend({ customerId, isAdmin }) {
  const { data: risks = [] } = useQuery({
    queryKey: ['risks-trend', customerId, isAdmin],
    queryFn: () => isAdmin
      ? base44.entities.RiskItem.list('-created_date', 200)
      : base44.entities.RiskItem.filter({ customer_id: customerId }, '-created_date', 200),
    enabled: isAdmin || !!customerId,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['risk-history-trend', customerId, isAdmin],
    queryFn: () => isAdmin
      ? base44.entities.RiskHistory.list('-created_date', 500)
      : base44.entities.RiskHistory.filter({}, '-created_date', 500),
    enabled: isAdmin || !!customerId,
  });

  const chartData = useMemo(() => {
    const buckets = buildMonthBuckets(6);

    // For each month, reconstruct what the open-risk exposure score was.
    // Strategy: use RiskHistory snapshots that fall within that month.
    // For months without history, carry-forward or use current snapshot.

    // Group history by month key
    const histByMonth = {};
    history.forEach(h => {
      if (!h.created_date) return;
      const mk = format(parseISO(h.created_date), 'yyyy-MM');
      if (!histByMonth[mk]) histByMonth[mk] = [];
      histByMonth[mk].push(h);
    });

    // Current open risks snapshot (for the latest month)
    const openRisks = risks.filter(r => r.status === 'open' || r.status === 'in_treatment');

    return buckets.map((bucket, idx) => {
      const isCurrentMonth = idx === buckets.length - 1;

      if (isCurrentMonth) {
        return {
          period: bucket.label,
          score: avgScore(openRisks),
          count: openRisks.length,
        };
      }

      // Use history entries for this month
      const monthHistory = histByMonth[bucket.key] || [];
      if (monthHistory.length > 0) {
        // Extract snapshots from history records that have valid impact/likelihood
        const snapshots = monthHistory
          .filter(h => h.snapshot?.impact && h.snapshot?.likelihood)
          .map(h => ({ impact: h.snapshot.impact, likelihood: h.snapshot.likelihood }));

        if (snapshots.length > 0) {
          return {
            period: bucket.label,
            score: avgScore(snapshots),
            count: snapshots.length,
          };
        }
      }

      // No history for this month — use current open risks as best estimate for earlier months
      // (shows a flat line if there's no history, which is honest)
      return {
        period: bucket.label,
        score: openRisks.length > 0 ? avgScore(openRisks) : null,
        count: openRisks.length,
      };
    });
  }, [risks, history]);

  // Trend delta: compare latest vs previous month
  const latestScore  = chartData[chartData.length - 1]?.score;
  const previousScore = chartData[chartData.length - 2]?.score;
  const delta = (latestScore != null && previousScore != null)
    ? parseFloat((latestScore - previousScore).toFixed(1))
    : null;

  const hasData = openRisks => risks.filter(r => r.status === 'open' || r.status === 'in_treatment').length > 0;
  const noData = !risks.length || risks.filter(r => r.status === 'open' || r.status === 'in_treatment').length === 0;

  const TrendIcon = delta === null ? Activity
    : delta < 0 ? TrendingDown
    : delta > 0 ? TrendingUp
    : Minus;

  const trendColor = delta === null ? 'text-muted-foreground'
    : delta < 0 ? 'text-emerald-600'   // score fell = good
    : delta > 0 ? 'text-red-500'       // score rose = bad
    : 'text-muted-foreground';

  const trendLabel = delta === null ? 'No comparison data'
    : delta < 0 ? `↓ ${Math.abs(delta)} vs last month (improving)`
    : delta > 0 ? `↑ ${delta} vs last month (worsening)`
    : 'Unchanged vs last month';

  // Gradient fill color based on current score
  const currentLevel = latestScore >= 16 ? 'red' : latestScore >= 9 ? 'orange' : latestScore >= 4 ? 'yellow' : 'green';
  const gradientColor = {
    red: ['#ef4444', '#fca5a5'],
    orange: ['#f97316', '#fdba74'],
    yellow: ['#eab308', '#fde047'],
    green: ['#10b981', '#6ee7b7'],
  }[currentLevel];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Risk Exposure Trend
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Average residual score of open risks — last 6 months
            </p>
          </div>
          {latestScore != null && (
            <div className="text-right">
              <div className="text-2xl font-bold text-foreground">{latestScore}</div>
              <div className={`text-xs font-medium flex items-center gap-1 justify-end ${trendColor}`}>
                <TrendIcon className="w-3 h-3" />
                {delta !== null ? `${delta > 0 ? '+' : ''}${delta}` : '—'}
              </div>
            </div>
          )}
        </div>
        {delta !== null && (
          <p className={`text-xs mt-1 ${trendColor}`}>{trendLabel}</p>
        )}
      </CardHeader>

      <CardContent>
        {noData ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            No open risks to track yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={gradientColor[0]} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={gradientColor[0]} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 25]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                ticks={[0, 4, 9, 16, 25]}
              />
              {/* Zone reference lines */}
              <ReferenceLine y={4}  stroke="#10b981" strokeDasharray="4 3" strokeOpacity={0.5} />
              <ReferenceLine y={9}  stroke="#eab308" strokeDasharray="4 3" strokeOpacity={0.5} />
              <ReferenceLine y={16} stroke="#ef4444" strokeDasharray="4 3" strokeOpacity={0.5} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="score"
                stroke={gradientColor[0]}
                strokeWidth={2.5}
                fill="url(#riskGradient)"
                dot={{ r: 4, fill: gradientColor[0], strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, fill: gradientColor[0], stroke: '#fff', strokeWidth: 2 }}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {/* Zone legend */}
        <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground justify-center flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Low (&lt;4)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Medium (4–8)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> High (9–15)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Critical (16+)</span>
        </div>
      </CardContent>
    </Card>
  );
}