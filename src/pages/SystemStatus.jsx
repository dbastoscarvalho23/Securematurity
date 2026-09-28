import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Server, Database, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import MaintenanceWindowPanel from '@/components/settings/MaintenanceWindowPanel';
import { format } from 'date-fns';

export default function SystemStatus() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    return <EmptyState icon={Activity} title={t('common_no_permission')} className="h-64" />;
  }

  // Fetch system stats
  const { data: customers = [] } = useQuery({
    queryKey: ['sys-customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['sys-audit'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 20),
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['sys-subs'],
    queryFn: () => base44.entities.TenantSubscription.list(),
  });

  const activeSubs = subscriptions.filter(s => s.status === 'active' || s.status === 'trial');
  const trialSubs = subscriptions.filter(s => s.status === 'trial');
  const expiredSubs = subscriptions.filter(s => s.status === 'expired');

  const recentActions = auditLogs.slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader description={t('sysstatus_subtitle')} />

      {/* Health indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-2xl font-bold text-green-600">Online</p>
                <p className="text-xs text-muted-foreground">{t('sysstatus_platform')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg"><Server className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{customers.length}</p>
                <p className="text-xs text-muted-foreground">{t('sysstatus_tenants')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg"><ShieldCheck className="w-5 h-5 text-purple-600" /></div>
              <div>
                <p className="text-2xl font-bold">{activeSubs.length}</p>
                <p className="text-xs text-muted-foreground">{t('sysstatus_active_subs')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${expiredSubs.length > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <AlertTriangle className={`w-5 h-5 ${expiredSubs.length > 0 ? 'text-red-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{expiredSubs.length}</p>
                <p className="text-xs text-muted-foreground">{t('sysstatus_expired_subs')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('sysstatus_sub_overview')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {activeSubs.length} {t('sysstatus_active')}
            </Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {trialSubs.length} {t('sysstatus_trial')}
            </Badge>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              {expiredSubs.length} {t('sysstatus_expired')}
            </Badge>
            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
              {subscriptions.length} {t('common_total')}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance windows */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" /> {t('sysstatus_maintenance')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MaintenanceWindowPanel />
        </CardContent>
      </Card>

      {/* Recent audit activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('sysstatus_recent_activity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentActions.map(log => (
              <div key={log.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <Database className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{log.action?.replace(/_/g, ' ') || '—'}</p>
                  <p className="text-xs text-muted-foreground truncate">{log.details || log.user_email || '—'}</p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {log.created_date ? format(new Date(log.created_date), 'dd MMM HH:mm') : '—'}
                </span>
              </div>
            ))}
            {recentActions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t('common_no_data')}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
