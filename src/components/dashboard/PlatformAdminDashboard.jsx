/**
 * PlatformAdminDashboard — dashboard for master_admin.
 * Shows global KPIs, license distribution, business analytics, performance,
 * and consumption/alerts.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, Users, Layers, Zap } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import PlatformOverview from '@/components/dashboard/PlatformOverview';
import TierDistributionWidget from '@/components/dashboard/platform/TierDistributionWidget';
import SubscriptionStatusWidget from '@/components/dashboard/platform/SubscriptionStatusWidget';
import ModuleAdoptionWidget from '@/components/dashboard/platform/ModuleAdoptionWidget';
import TenantGrowthWidget from '@/components/dashboard/platform/TenantGrowthWidget';
import AuditVolumeWidget from '@/components/dashboard/platform/AuditVolumeWidget';
import TopAIConsumersWidget from '@/components/dashboard/platform/TopAIConsumersWidget';
import ExpiringSubscriptionsWidget from '@/components/dashboard/platform/ExpiringSubscriptionsWidget';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';

export default function PlatformAdminDashboard() {
  const { t, language } = useLanguage();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => base44.entities.TenantSubscription.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: usage = [] } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: () => base44.entities.LicenseUsageRecord.list('-created_date', 500),
  });

  const activeTenants = customers.filter(c => c.status === 'active');
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const creditsThisMonth = usage
    .filter(u => u.month === currentMonth)
    .reduce((sum, u) => sum + (u.usage_count || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        description={t('admin_dashboard_subtitle')}
        actions={
          <div className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
            {new Date().toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        }
      />

      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('admin_dashboard_active_tenants')}
          value={activeTenants.length}
          subtitle={`${customers.length} ${t('common_total')}`}
          icon={Building2}
          href="/customers"
        />
        <StatCard
          title={t('admin_dashboard_total_users')}
          value={users.length}
          icon={Users}
        />
        <StatCard
          title={t('admin_dashboard_subs_distribution')}
          value={subscriptions.length}
          icon={Layers}
          href="/licensing"
        />
        <StatCard
          title={t('admin_dashboard_ai_credits')}
          value={creditsThisMonth}
          subtitle={t('admin_dashboard_this_month')}
          icon={Zap}
        />
      </div>

      {/* License distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TierDistributionWidget subscriptions={subscriptions} />
        <SubscriptionStatusWidget subscriptions={subscriptions} />
        <ModuleAdoptionWidget />
      </div>

      {/* Business analytics */}
      <PlatformOverview />

      {/* Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TenantGrowthWidget customers={customers} />
        <AuditVolumeWidget />
      </div>

      {/* Consumption and alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopAIConsumersWidget usage={usage} customers={customers} />
        <ExpiringSubscriptionsWidget subscriptions={subscriptions} />
      </div>
    </div>
  );
}
