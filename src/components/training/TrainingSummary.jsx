import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { GraduationCap, CalendarClock, CheckCircle2, Percent, AlertTriangle, Building2 } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';

export default function TrainingSummary({ customer }) {
  const { t } = useLanguage();
  const enabled = !!customer?.id;

  const { data: trainings = [], isLoading: lt } = useQuery({
    queryKey: ['trainings', customer?.id],
    queryFn: () => base44.entities.Training.filter({ customer_id: customer.id }, '-scheduled_date', 1000),
    enabled,
  });
  const { data: enrollments = [], isLoading: le } = useQuery({
    queryKey: ['training-enrollments-all', customer?.id],
    queryFn: () => base44.entities.TrainingEnrollment.filter({ customer_id: customer.id }, '-created_date', 1000),
    enabled,
  });
  const { data: users = [] } = useQuery({
    queryKey: ['training-users', customer?.id],
    queryFn: () => base44.entities.TrainingUser.filter({ customer_id: customer.id }, '-created_date', 1000),
    enabled,
  });

  const loading = lt || le;

  const stats = useMemo(() => {
    const scheduled = trainings.filter(tr => tr.status === 'scheduled').length;
    const completed = trainings.filter(tr => tr.status === 'completed').length;
    const attended = enrollments.filter(e => e.attendance_status === 'attended').length;
    const completionRate = enrollments.length ? Math.round((attended / enrollments.length) * 100) : 0;
    return { total: trainings.length, scheduled, completed, completionRate };
  }, [trainings, enrollments]);

  const byDepartment = useMemo(() => {
    const map = {};
    enrollments.forEach(e => {
      const dept = (e.user_department || t('training_summary_no_department')).trim() || t('training_summary_no_department');
      if (!map[dept]) map[dept] = { department: dept, total: 0, attended: 0, pending: 0 };
      map[dept].total += 1;
      if (e.attendance_status === 'attended') map[dept].attended += 1;
      else if (e.attendance_status === 'invited' || e.attendance_status === 'confirmed') map[dept].pending += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [enrollments, t]);

  const pendingCollaborators = useMemo(() => {
    const byUser = {};
    enrollments.forEach(e => {
      if (e.attendance_status !== 'attended' && e.attendance_status !== 'absent') {
        if (!byUser[e.training_user_id]) {
          byUser[e.training_user_id] = { user_id: e.training_user_id, name: e.user_name, department: e.user_department, pending: 0, titles: [] };
        }
        byUser[e.training_user_id].pending += 1;
        if (e.training_title && byUser[e.training_user_id].titles.length < 3) {
          byUser[e.training_user_id].titles.push(e.training_title);
        }
      }
    });
    return Object.values(byUser).sort((a, b) => b.pending - a.pending);
  }, [enrollments]);

  const kpis = [
    { label: t('training_summary_total_trainings'), value: stats.total, icon: GraduationCap, color: 'text-primary', bg: 'bg-primary/10' },
    { label: t('training_summary_scheduled'), value: stats.scheduled, icon: CalendarClock, color: 'text-chart-4', bg: 'bg-chart-4/10' },
    { label: t('training_summary_completed'), value: stats.completed, icon: CheckCircle2, color: 'text-accent', bg: 'bg-accent/10' },
    { label: t('training_summary_completion_rate'), value: `${stats.completionRate}%`, icon: Percent, color: 'text-chart-5', bg: 'bg-chart-5/10' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('training_tab_summary')} description={t('training_summary_subtitle')} />

      {loading ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((k, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${k.bg}`}>
                    <k.icon className={`w-5 h-5 ${k.color}`} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold leading-none">{k.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{k.label}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="w-4 h-4 text-primary" />
                {t('training_summary_by_department')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {byDepartment.length === 0 ? (
                <EmptyState title={t('training_summary_no_departments')} />
              ) : (
                byDepartment.map(d => {
                  const rate = d.total ? Math.round((d.attended / d.total) * 100) : 0;
                  return (
                    <div key={d.department}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium truncate">{d.department}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="secondary">{d.attended}/{d.total}</Badge>
                          {d.pending > 0 && <Badge className="bg-chart-4/15 text-chart-4">{d.pending} {t('training_summary_pending').toLowerCase()}</Badge>}
                          <span className="font-medium text-muted-foreground w-9 text-right">{rate}%</span>
                        </div>
                      </div>
                      <Progress value={rate} className="h-2" />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="w-4 h-4 text-chart-4" />
                {t('training_summary_pending_collaborators')}
                {pendingCollaborators.length > 0 && <Badge className="bg-chart-4/15 text-chart-4">{pendingCollaborators.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pendingCollaborators.length === 0 ? (
                <div className="p-6"><EmptyState icon={CheckCircle2} title={t('training_summary_no_pending')} /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t('training_form_name')}</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t('training_col_department')}</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t('training_tab_trainings')}</th>
                        <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">{t('training_summary_pending')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingCollaborators.map(u => (
                        <tr key={u.user_id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-medium truncate max-w-[200px]">{u.name}</td>
                          <td className="px-4 py-2.5 truncate max-w-[160px]">{u.department || '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-[280px]">{u.titles.join(', ')}</td>
                          <td className="px-4 py-2.5 text-center">
                            <Badge className="bg-chart-4/15 text-chart-4">{u.pending}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}