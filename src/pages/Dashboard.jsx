import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, ClipboardCheck, ShieldAlert, TrendingUp } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import MaturityRadar from '@/components/dashboard/MaturityRadar';
import FrameworkScoreCard from '@/components/dashboard/FrameworkScoreCard';
import TrendChart from '@/components/dashboard/TrendChart';
import RecentActivity from '@/components/dashboard/RecentActivity';

const FRAMEWORK_NAMES = {
  NIS2: 'NIS2 / DL 125/2025',
  ISO27001: 'ISO/IEC 27001',
  NIST_CSF: 'NIST CSF',
  CIS_V8: 'CIS Controls v8',
};

export default function Dashboard() {
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ['assessments'],
    queryFn: () => base44.entities.Assessment.list('-created_date', 50),
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => base44.entities.Recommendation.list('-created_date', 50),
  });

  const completedAssessments = assessments.filter(a => a.status === 'completed');
  const latestAssessment = completedAssessments[0];
  
  // Build radar data from latest assessment
  const radarData = [];
  if (latestAssessment?.framework_scores) {
    latestAssessment.framework_scores.forEach(fs => {
      (fs.domain_scores || []).forEach(ds => {
        const existing = radarData.find(r => r.domain === ds.domain);
        if (existing) {
          existing.current = Math.max(existing.current, ds.score);
        } else {
          radarData.push({ domain: ds.domain, current: ds.score, target: 4 });
        }
      });
    });
  }

  // Build trend data
  const trendData = completedAssessments
    .slice(0, 10)
    .reverse()
    .map(a => {
      const point = { period: a.period };
      (a.framework_scores || []).forEach(fs => {
        point[fs.framework_code] = fs.score;
      });
      return point;
    });

  const overallScore = latestAssessment?.overall_score || 0;
  const openRecs = recommendations.filter(r => r.status === 'pending' || r.status === 'in_progress').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cybersecurity & Compliance Maturity Overview
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Customers"
          value={customers.filter(c => c.status === 'active').length}
          subtitle={`${customers.length} total`}
          icon={Building2}
          href="/customers"
        />
        <StatCard
          title="Assessments"
          value={completedAssessments.length}
          subtitle={`${assessments.filter(a => a.status === 'in_progress').length} in progress`}
          icon={ClipboardCheck}
          href="/assessments"
        />
        <StatCard
          title="Overall Maturity"
          value={overallScore.toFixed(1)}
          subtitle="out of 5.0"
          icon={TrendingUp}
          trend={completedAssessments.length > 1 ? "+0.3" : undefined}
          trendUp
          href="/reports"
        />
        <StatCard
          title="Open Recommendations"
          value={openRecs}
          subtitle={`${recommendations.filter(r => r.priority === 'critical').length} critical`}
          icon={ShieldAlert}
          href="/recommendations"
        />
      </div>

      {/* Framework Scores */}
      {latestAssessment?.framework_scores && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Framework Scores</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {latestAssessment.framework_scores.map(fs => (
              <FrameworkScoreCard
                key={fs.framework_code}
                framework_code={fs.framework_code}
                name={FRAMEWORK_NAMES[fs.framework_code] || fs.framework_code}
                score={fs.score}
              />
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MaturityRadar data={radarData} />
        <TrendChart
          data={trendData}
          frameworks={Object.keys(FRAMEWORK_NAMES)}
        />
      </div>

      {/* Recent Activity */}
      <RecentActivity assessments={assessments.slice(0, 5)} />
    </div>
  );
}