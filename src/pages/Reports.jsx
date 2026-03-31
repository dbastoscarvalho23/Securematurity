import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import MaturityRadar from '@/components/dashboard/MaturityRadar';
import TrendChart from '@/components/dashboard/TrendChart';
import FrameworkScoreCard from '@/components/dashboard/FrameworkScoreCard';
import { BarChart3, TrendingUp } from 'lucide-react';

const FRAMEWORK_NAMES = {
  NIS2: 'NIS2 / DL 125/2025',
  ISO27001: 'ISO/IEC 27001',
  NIST_CSF: 'NIST CSF',
  CIS_V8: 'CIS Controls v8',
  QNRC: 'QNRC',
};

export default function Reports() {
  const [selectedCustomer, setSelectedCustomer] = useState('all');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ['assessments'],
    queryFn: () => base44.entities.Assessment.list('-created_date', 100),
  });

  const completed = assessments
    .filter(a => a.status === 'completed')
    .filter(a => selectedCustomer === 'all' || a.customer_id === selectedCustomer);

  // Build historical comparison
  const trendData = completed
    .slice(0, 10)
    .reverse()
    .map(a => {
      const point = { period: a.period };
      (a.framework_scores || []).forEach(fs => {
        point[fs.framework_code] = fs.score;
      });
      return point;
    });

  // Latest vs previous comparison
  const latest = completed[0];
  const previous = completed[1];

  // Radar data from latest
  const radarData = [];
  if (latest?.framework_scores) {
    latest.framework_scores.forEach(fs => {
      (fs.domain_scores || []).forEach(ds => {
        radarData.push({ domain: ds.domain, current: ds.score, target: 4 });
      });
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Historical comparison and maturity trends</p>
        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Current vs Previous */}
      {latest && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Current Framework Scores
            {previous && <span className="text-sm font-normal text-muted-foreground">vs {previous.period}</span>}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(latest.framework_scores || []).map(fs => {
              const prevScore = previous?.framework_scores?.find(p => p.framework_code === fs.framework_code)?.score;
              return (
                <FrameworkScoreCard
                  key={fs.framework_code}
                  framework_code={fs.framework_code}
                  name={FRAMEWORK_NAMES[fs.framework_code] || fs.framework_code}
                  score={fs.score}
                  previousScore={prevScore}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MaturityRadar data={radarData} title="Domain Coverage Analysis" />
        <TrendChart
          data={trendData}
          frameworks={Object.keys(FRAMEWORK_NAMES)}
          title="Maturity Evolution"
        />
      </div>

      {/* Assessment History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Assessment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {completed.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No completed assessments to report on.</p>
          ) : (
            <div className="space-y-3">
              {completed.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.customer_name} · {a.period}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      {(a.framework_scores || []).map(fs => (
                        <Badge key={fs.framework_code} variant="outline" className="text-xs font-mono">
                          {fs.framework_code}: {fs.score.toFixed(1)}
                        </Badge>
                      ))}
                    </div>
                    <span className="text-lg font-bold">{a.overall_score?.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}