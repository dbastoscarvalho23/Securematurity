import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { Users, Activity, AlertTriangle, Database, HardDrive, Clock } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { normalizeRole } from '@/lib/rbac';

/** Nome apresentável de cada entidade — sempre por chave de tradução (FC3). */
const ENTITY_LABEL_KEYS = {
  assessment: 'sys_entity_assessment',
  task: 'sys_entity_task',
  risk: 'sys_entity_risk',
  security_document: 'sys_entity_security_document',
  customer: 'sys_entity_customer',
  user: 'sys_entity_user',
  nomination: 'sys_entity_nomination',
  incident: 'sys_entity_incident',
  vulnerability: 'sys_entity_vulnerability',
  supplier: 'sys_entity_supplier',
  training_user: 'sys_entity_training_user',
  knowledge_article: 'sys_entity_knowledge_article',
  assessment_response: 'sys_entity_assessment_response',
};

export default function SystemStatus() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const normalizedRole = normalizeRole(user?.role);

  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['platform-metrics'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getPlatformMetrics', {});
      return res.data || res;
    },
    enabled: normalizedRole === 'master_admin',
  });

  if (normalizedRole !== 'master_admin') {
    return <EmptyState icon={Activity} title={t('common_no_permission')} className="h-64" />;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader description={t('system_status_subtitle')} />
        <LoadingState label={t('common_loading')} fullHeight />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="space-y-6">
        <PageHeader description={t('system_status_subtitle')} />
        <EmptyState icon={AlertTriangle} title={t('common_no_data')} className="h-64" />
      </div>
    );
  }

  const activeUsersTrend = (metrics.activeUsers?.trend || []).map(d => ({
    date: d.date.slice(5),
    count: d.count,
  }));
  const auditVolumeTrend = (metrics.auditEvents?.trend || []).map(d => ({
    date: d.date.slice(5),
    count: d.count,
  }));

  return (
    <div className="space-y-6">
      <PageHeader description={t('system_status_subtitle')} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('metric_active_users')}
          value={metrics.activeUsers?.days30 ?? 0}
          subtitle={`${metrics.activeUsers?.days7 ?? 0} ${t('metric_active_users_7d').toLowerCase()}`}
          icon={Users}
        />
        <StatCard
          title={t('metric_audit_events_today')}
          value={metrics.auditEvents?.today ?? 0}
          subtitle={`${metrics.auditEvents?.days30 ?? 0} ${t('metric_audit_events_30d').toLowerCase()}`}
          icon={Activity}
        />
        <StatCard
          title={t('metric_failed_logins')}
          value={metrics.failedLogins?.days30 ?? 0}
          icon={AlertTriangle}
        />
        <StatCard
          title={t('metric_total_entities')}
          value={Object.values(metrics.entityCounts || {}).reduce((a, b) => a + b, 0)}
          icon={Database}
        />
      </div>

      {/* Estimated metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
            <HardDrive className="w-5 h-5 text-chart-3" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">{t('metric_storage_estimated')}</p>
              <Badge variant="outline" className="text-xs bg-chart-3/10 text-chart-3 border-chart-3/20">{t('metric_estimated_badge')}</Badge>
            </div>
            <p className="text-2xl font-bold mt-0.5">{metrics.storageEstimated?.totalMB?.toLocaleString() || 0} MB</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-chart-3" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">{t('metric_uptime_estimated')}</p>
              <Badge variant="outline" className="text-xs bg-chart-3/10 text-chart-3 border-chart-3/20">{t('metric_estimated_badge')}</Badge>
            </div>
            <p className="text-2xl font-bold mt-0.5">{metrics.uptimeEstimated?.percentage?.toFixed(2) || 0}%</p>
            <p className="text-xs text-muted-foreground">{metrics.uptimeEstimated?.label}</p>
          </div>
        </Card>
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('metric_active_users_trend')}</CardTitle>
          </CardHeader>
          <CardContent>
            {activeUsersTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={activeUsersTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t('common_no_data')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('metric_audit_volume_trend')}</CardTitle>
          </CardHeader>
          <CardContent>
            {auditVolumeTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={auditVolumeTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t('common_no_data')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Entity Counts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('metric_entity_counts')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common_name')}</TableHead>
                <TableHead className="text-right">{t('common_total')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(metrics.entityCounts || {}).map(([entity, count]) => (
                <TableRow key={entity}>
                  <TableCell className="font-medium">{ENTITY_LABEL_KEYS[entity] ? t(ENTITY_LABEL_KEYS[entity]) : entity.replace(/_/g, ' ')}</TableCell>
                  <TableCell className="text-right font-bold">{count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
