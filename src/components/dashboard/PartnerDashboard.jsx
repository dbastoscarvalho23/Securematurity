/**
 * PartnerDashboard — dashboard for workspace_admin / partner_admin.
 * Shows KPIs of the subtree and managed tenants.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, Users, ClipboardCheck, ShieldCheck } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function PartnerDashboard() {
  const { user } = useAuth();
  const { t, language } = useLanguage();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ['assessments-partner'],
    queryFn: () => base44.entities.Assessment.list('-created_date', 100),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-partner'],
    queryFn: () => base44.entities.User.list(),
  });

  const activeTenants = customers.filter(c => c.status === 'active');
  const completedAssessments = assessments.filter(a => a.status === 'completed');

  return (
    <div className="space-y-6">
      <PageHeader
        description={t('dashboard_subtitle')}
        actions={
          <div className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
            {new Date().toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        }
      />

      {/* KPIs */}
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
          title={t('dashboard_completed_assessments')}
          value={completedAssessments.length}
          subtitle={`${assessments.filter(a => a.status === 'in_progress').length} ${t('dashboard_in_progress')}`}
          icon={ClipboardCheck}
          href="/assessments"
        />
        <StatCard
          title={t('dashboard_active_customers')}
          value={activeTenants.length}
          icon={ShieldCheck}
          href="/customers"
        />
      </div>

      {/* Managed tenants list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('page_customers')}</CardTitle>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('common_no_data')}</p>
          ) : (
            <div className="space-y-2">
              {customers.slice(0, 10).map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.sector || '—'}</p>
                  </div>
                  <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
                    {c.status || '—'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
