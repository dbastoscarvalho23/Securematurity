/**
 * ExecutiveDashboard — dashboard for executive role.
 * Strategic view: compliance scores, risk exposure, maturity trends,
 * framework scores, and key compliance metrics. Read-only.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldAlert, TrendingUp, ClipboardCheck, AlertTriangle } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import MaturityRadar from '@/components/dashboard/MaturityRadar';
import FrameworkScoreCard from '@/components/dashboard/FrameworkScoreCard';
import TrendChart from '@/components/dashboard/TrendChart';
import RiskExposureTrend from '@/components/dashboard/RiskExposureTrend';
import RiskMatrixWidget from '@/components/dashboard/RiskMatrixWidget';
import ComplianceJourneyStatusCard from '@/components/dashboard/ComplianceJourneyStatusCard';
import MaturityOverview from '@/components/dashboard/MaturityOverview';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { FRAMEWORK_NAMES } from '@/lib/frameworkConstants';
import PageHeader from '@/components/shared/PageHeader';

export default function ExecutiveDashboard({ readOnly = true }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const customerId = user?.customer_id;

  const { data: assessments = [] } = useQuery({
    queryKey: ['assessments-exec', customerId],
    queryFn: () => base44.entities.Assessment.filter({ customer_id: customerId }, '-created_date', 50),
    enabled: !!customerId,
  });

  const { data: risks = [] } = useQuery({
    queryKey: ['risks-exec', customerId],
    queryFn: () => base44.entities.RiskItem.filter({ customer_id: customerId }, '-created_date', 100),
    enabled: !!customerId,
  });

  const completedAssessments = assessments.filter(a => a.status === 'completed');
  const latestAssessment = completedAssessments[0];

  // Overall maturity score
  const overallScore = latestAssessment?.framework_scores?.reduce((acc, fs) => acc + fs.score, 0) / (latestAssessment?.framework_scores?.length || 1) || 0;

  // Risk summary
  const highRisks = risks.filter(r => r.severity === 'high' || r.severity === 'critical');
  const openRisks = risks.filter(r => r.status !== 'closed' && r.status !== 'resolved');

  // Build radar data
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

  return (
    <div className="space-y-6">
      <PageHeader
        description={t('dashboard_subtitle')}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full">
              {t('dashboard_read_only')}
            </span>
            <div className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
              {new Date().toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        }
      />

      {/* Executive KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard_overall_maturity')}
          value={overallScore > 0 ? overallScore.toFixed(1) : '—'}
          subtitle={t('dashboard_out_of_5')}
          icon={TrendingUp}
        />
        <StatCard
          title={t('dashboard_completed_assessments')}
          value={completedAssessments.length}
          subtitle={`${assessments.filter(a => a.status === 'in_progress').length} ${t('dashboard_in_progress')}`}
          icon={ClipboardCheck}
          href="/assessments"
        />
        <StatCard
          title={t('dashboard_high_risks')}
          value={highRisks.length}
          subtitle={`${openRisks.length} ${t('dashboard_open_risks')}`}
          icon={AlertTriangle}
          href="/risk-assessment"
        />
        <StatCard
          title={t('dashboard_risk_exposure')}
          value={risks.length}
          subtitle={t('dashboard_total_risks')}
          icon={ShieldAlert}
          href="/risk-assessment"
        />
      </div>

      {/* Compliance journey status */}
      <ComplianceJourneyStatusCard />

      {/* Framework Scores */}
      {latestAssessment?.framework_scores && (
        <div>
          <h2 className="text-lg font-semibold mb-3">{t('dashboard_framework_scores')}</h2>
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

      {/* Maturity overview */}
      <MaturityOverview assessment={latestAssessment} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MaturityRadar data={radarData} />
        <TrendChart data={trendData} frameworks={Object.keys(FRAMEWORK_NAMES)} />
        <RiskExposureTrend customerId={customerId} isAdmin={false} />
      </div>

      {/* Risk Matrix */}
      <div className="grid grid-cols-1">
        <RiskMatrixWidget />
      </div>
    </div>
  );
}
