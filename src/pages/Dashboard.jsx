import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldAlert, Building2, ClipboardCheck } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import MaturityRadar from '@/components/dashboard/MaturityRadar';
import FrameworkScoreCard from '@/components/dashboard/FrameworkScoreCard';
import TrendChart from '@/components/dashboard/TrendChart';
import CustomersOverview from '@/components/dashboard/CustomersOverview';
import AssessmentsOverview from '@/components/dashboard/AssessmentsOverview';
import MaturityOverview from '@/components/dashboard/MaturityOverview';
import TasksOverview from '@/components/dashboard/TasksOverview';
import RiskMatrixWidget from '@/components/dashboard/RiskMatrixWidget';
import RiskExposureTrend from '@/components/dashboard/RiskExposureTrend';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';

const FRAMEWORK_NAMES = {
  NIS2: 'NIS2 / DL 125/2025',
  ISO27001: 'ISO/IEC 27001',
  NIST_CSF: 'NIST CSF',
  CIS_V8: 'CIS Controls v8',
  QNRC: 'QNRC',
};

export default function Dashboard() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const customerId = user?.customer_id;

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: isAdmin,
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ['assessments', user?.email, customerId],
    queryFn: () => isAdmin
      ? base44.entities.Assessment.list('-created_date', 50)
      : base44.entities.Assessment.filter({ customer_id: customerId }, '-created_date', 50),
    enabled: isAdmin || !!customerId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', user?.email, customerId],
    queryFn: () => isAdmin
      ? base44.entities.Task.list('-created_date', 100)
      : base44.entities.Task.filter({ customer_id: customerId }, '-created_date', 100),
    enabled: isAdmin || !!customerId,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{t('dashboard_subtitle')}</p>
        <div className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
          {new Date().toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Top stat strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isAdmin && (
          <StatCard
            title={t('dashboard_active_customers')}
            value={customers.filter(c => c.status === 'active').length}
            subtitle={`${customers.length} ${t('dashboard_total')}`}
            icon={Building2}
            href="/customers"
          />
        )}
        <StatCard
          title={t('dashboard_completed_assessments')}
          value={completedAssessments.length}
          subtitle={`${assessments.filter(a => a.status === 'in_progress').length} ${t('dashboard_in_progress')}`}
          icon={ClipboardCheck}
          href="/assessments"
        />
      </div>

      {/* Main 4-panel overview grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {isAdmin && <CustomersOverview customers={customers} />}
        <AssessmentsOverview assessments={assessments} />
        <MaturityOverview assessment={latestAssessment} />
        <TasksOverview tasks={tasks} />
      </div>

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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MaturityRadar data={radarData} />
        <TrendChart data={trendData} frameworks={Object.keys(FRAMEWORK_NAMES)} />
        <RiskExposureTrend customerId={customerId} isAdmin={isAdmin} />
      </div>

      {/* Risk Matrix */}
      <div className="grid grid-cols-1">
        <RiskMatrixWidget />
      </div>
    </div>
  );
}