/**
 * EmployeeDashboard — personal portal for the employee role.
 * Shows personal tasks, policy attestations, training, and quick actions.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ListTodo, ShieldCheck, GraduationCap, Siren, BookOpen } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const userEmail = user?.email;

  const { data: tasks = [] } = useQuery({
    queryKey: ['emp-tasks', userEmail],
    queryFn: () => base44.entities.Task.filter({ assigned_to: userEmail }, '-created_date', 50),
    enabled: !!userEmail,
  });

  const { data: attestations = [] } = useQuery({
    queryKey: ['emp-attestations', userEmail],
    queryFn: () => base44.entities.PolicyAttestation.filter({ user_email: userEmail }, '-created_date', 50),
    enabled: !!userEmail,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['emp-training', userEmail],
    queryFn: () => base44.entities.TrainingEnrollment.filter({ user_email: userEmail }, '-created_date', 50),
    enabled: !!userEmail,
  });

  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const pendingAttestations = attestations.filter(a => a.status === 'pending');
  const upcomingTraining = enrollments.filter(e => e.status === 'enrolled' || e.status === 'in_progress');

  const priorityBadge = (priority) => {
    if (priority === 'critical' || priority === 'high') return 'destructive';
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('emp_welcome')}
        description={new Date().toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('emp_my_tasks')}</CardTitle>
            <ListTodo className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTasks.length}</div>
            <p className="text-xs text-muted-foreground">{t('emp_tasks_pending')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('emp_policy_attestations')}</CardTitle>
            <ShieldCheck className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingAttestations.length}</div>
            <p className="text-xs text-muted-foreground">{t('emp_attest_pending')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('emp_my_training')}</CardTitle>
            <GraduationCap className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingTraining.length}</div>
            <p className="text-xs text-muted-foreground">{t('emp_training_upcoming')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/incidents" className="block">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-destructive/10 text-destructive">
                <Siren className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">{t('emp_report_incident')}</p>
                <p className="text-xs text-muted-foreground">{t('emp_report_incident_desc')}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/knowledge-base" className="block">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">{t('emp_knowledge_base')}</p>
                <p className="text-xs text-muted-foreground">{t('emp_knowledge_base_desc')}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Task list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('emp_my_tasks')}</CardTitle>
          <Link to="/tasks" className="text-xs text-primary hover:underline">{t('emp_view_all_tasks')}</Link>
        </CardHeader>
        <CardContent>
          {pendingTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('emp_no_tasks')}</p>
          ) : (
            <div className="space-y-2">
              {pendingTasks.slice(0, 8).map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.domain || '—'}
                      {task.due_date && ` · ${new Date(task.due_date).toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-GB')}`}
                    </p>
                  </div>
                  {task.priority && (
                    <Badge variant={priorityBadge(task.priority)} className="ml-2">
                      {task.priority}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
