import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Building2, BarChart3, Users, AlertTriangle, ClipboardList, Search,
} from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import SeatManagementPanel from '@/components/customers/SeatManagementPanel';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
import { isPlatformOwner } from '@/lib/rbac';


function DrillDownDialog({ title, children, open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CustomerDrillDown({ customers, t }) {
  const [search, setSearch] = useState('');
  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.sector?.toLowerCase().includes(search.toLowerCase())
  );
  const statusCount = customers.reduce((acc, c) => { acc[c.status || 'unknown'] = (acc[c.status || 'unknown'] || 0) + 1; return acc; }, {});

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {Object.entries(statusCount).map(([s, n]) => (
          <StatusBadge key={s} status={s} label={`${s.replace(/_/g, ' ')}: ${n}`} />
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={t('common_search')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('admin_col_customer')}</TableHead>
            <TableHead>{t('admin_col_sector')}</TableHead>
            <TableHead>{t('admin_col_employees')}</TableHead>
            <TableHead>{t('common_status')}</TableHead>
            <TableHead>{t('admin_contact')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(c => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="capitalize text-sm">{c.sector?.replace(/_/g, ' ') || '-'}</TableCell>
              <TableCell className="text-sm">{c.num_employees || '-'}</TableCell>
              <TableCell>
                <StatusBadge status={c.status} label={c.status?.replace(/_/g, ' ') || '-'} />
              </TableCell>
              <TableCell className="text-sm">{c.contact_email || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function UserDrillDown({ users, customers, t }) {
  const [search, setSearch] = useState('');
  const filtered = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );
  const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={t('common_search')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('settings_col_name')}</TableHead>
            <TableHead>{t('settings_col_email')}</TableHead>
            <TableHead>{t('settings_col_role')}</TableHead>
            <TableHead>{t('settings_col_customer')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(u => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.full_name || '—'}</TableCell>
              <TableCell className="text-sm">{u.email}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize text-xs">{u.role?.replace(/_/g, ' ') || 'user'}</Badge>
              </TableCell>
              <TableCell className="text-sm">{customerMap[u.customer_id] || (isPlatformOwner(u.role) ? t('settings_na_admin') : '—')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AssessmentsDrillDown({ assessments, customers, t }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('completed');
  const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));

  const filtered = assessments
    .filter(a => filterStatus === 'all' || a.status === filterStatus)
    .filter(a =>
      (a.title?.toLowerCase().includes(search.toLowerCase())) ||
      (customerMap[a.customer_id]?.toLowerCase().includes(search.toLowerCase()))
    );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={t('assessments_search_placeholder')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common_all')}</SelectItem>
            <SelectItem value="completed">{t('assessments_status_completed')}</SelectItem>
            <SelectItem value="in_progress">{t('assessments_status_in_progress')}</SelectItem>
            <SelectItem value="draft">{t('assessments_status_draft')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} {t('admin_col_assessments').toLowerCase()}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('assessments_col_assessment')}</TableHead>
            <TableHead>{t('admin_col_customer')}</TableHead>
            <TableHead>{t('assessments_col_period')}</TableHead>
            <TableHead>{t('assessments_col_frameworks')}</TableHead>
            <TableHead>{t('admin_col_score')}</TableHead>
            <TableHead>{t('common_status')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(a => (
            <TableRow key={a.id}>
              <TableCell className="font-medium text-sm">{a.title}</TableCell>
              <TableCell className="text-sm">{customerMap[a.customer_id] || '—'}</TableCell>
              <TableCell className="text-sm font-mono">{a.period || '-'}</TableCell>
              <TableCell className="text-xs">{(a.frameworks || []).join(', ')}</TableCell>
              <TableCell className="font-bold">{a.overall_score != null ? a.overall_score.toFixed(1) : '—'}</TableCell>
              <TableCell>
                <StatusBadge status={a.status} label={a.status?.replace(/_/g, ' ')} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RisksDrillDown({ risks, customers, t }) {
  const [search, setSearch] = useState('');
  const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
  const filtered = risks.filter(r =>
    r.title?.toLowerCase().includes(search.toLowerCase()) ||
    customerMap[r.customer_id]?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={t('risk_search_placeholder')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common_name')}</TableHead>
            <TableHead>{t('admin_col_customer')}</TableHead>
            <TableHead>{t('risk_impact')}</TableHead>
            <TableHead>{t('risk_likelihood')}</TableHead>
            <TableHead>{t('admin_col_score')}</TableHead>
            <TableHead>{t('common_status')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(r => {
            const score = (r.impact || 0) * (r.likelihood || 0);
            return (
              <TableRow key={r.id}>
                <TableCell className="font-medium text-sm">{r.title}</TableCell>
                <TableCell className="text-sm">{customerMap[r.customer_id] || '—'}</TableCell>
                <TableCell className="text-sm">{r.impact ?? '—'}</TableCell>
                <TableCell className="text-sm">{r.likelihood ?? '—'}</TableCell>
                <TableCell>
                  <span className={`font-bold ${score >= 20 ? 'ankora-risk-critical' : score >= 12 ? 'ankora-risk-high' : score >= 6 ? 'ankora-risk-medium' : 'ankora-risk-low'}`}>
                    {score}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} label={r.status?.replace(/_/g, ' ') || '-'} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function TasksDrillDown({ tasks, customers, t }) {
  const [search, setSearch] = useState('');
  const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
  const filtered = tasks.filter(tk =>
    tk.title?.toLowerCase().includes(search.toLowerCase()) ||
    customerMap[tk.customer_id]?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={t('tasks_search_placeholder')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common_name')}</TableHead>
            <TableHead>{t('admin_col_customer')}</TableHead>
            <TableHead>{t('common_priority')}</TableHead>
            <TableHead>{t('common_status')}</TableHead>
            <TableHead>{t('admin_due_date')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(tk => (
            <TableRow key={tk.id}>
              <TableCell className="font-medium text-sm">{tk.title}</TableCell>
              <TableCell className="text-sm">{customerMap[tk.customer_id] || '—'}</TableCell>
              <TableCell>
                {tk.priority && (
                  <StatusBadge variant="severity" status={tk.priority} label={tk.priority} />
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={tk.status} label={tk.status?.replace(/_/g, ' ') || '-'} />
              </TableCell>
              <TableCell className="text-sm">{tk.due_date ? format(new Date(tk.due_date), 'dd MMM yyyy') : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [filterSector, setFilterSector] = useState('all');
  const [drillDown, setDrillDown] = useState(null); // 'customers' | 'users' | 'assessments' | 'risks' | 'tasks'

  const { data: customers = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ['assessments'],
    queryFn: () => base44.entities.Assessment.list('-created_date', 200),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: risks = [] } = useQuery({
    queryKey: ['admin-risks'],
    queryFn: () => base44.entities.RiskItem.list('-created_date', 500),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['admin-tasks'],
    queryFn: () => base44.entities.Task.list('-created_date', 500),
  });

  if (!isPlatformOwner(user?.role)) {
    return <EmptyState icon={ShieldCheck} title={t('common_no_permission')} className="h-64" />;
  }

  const completed = assessments.filter(a => a.status === 'completed');
  const inProgress = assessments.filter(a => a.status === 'in_progress');

  // Customer status breakdown
  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const onboardingCustomers = customers.filter(c => c.status === 'onboarding').length;

  // Risk stats
  const openRisks = risks.filter(r => r.status === 'open' || r.status === 'in_treatment');
  const criticalRisks = risks.filter(r => (r.impact || 0) * (r.likelihood || 0) >= 20);

  // Task stats
  const openTasks = tasks.filter(tk => tk.status !== 'done');
  const overdueTasks = tasks.filter(tk =>
    tk.status !== 'done' && tk.due_date && new Date(tk.due_date) < new Date()
  );

  const filteredCustomers = filterSector === 'all'
    ? customers
    : customers.filter(c => c.sector === filterSector);

  // Customer rankings
  const customerRankings = filteredCustomers.map(c => {
    const customerAssessments = completed.filter(a => a.customer_id === c.id);
    const latest = customerAssessments.sort((a, b) => new Date(b.completed_date || b.created_date) - new Date(a.completed_date || a.created_date))[0];
    const customerRisks = risks.filter(r => r.customer_id === c.id);
    const customerTasks = tasks.filter(tk => tk.customer_id === c.id);
    return {
      ...c,
      latestScore: latest?.overall_score || null,
      assessmentCount: customerAssessments.length,
      latestPeriod: latest?.period || '-',
      openRisks: customerRisks.filter(r => r.status === 'open' || r.status === 'in_treatment').length,
      openTasks: customerTasks.filter(tk => tk.status !== 'done').length,
    };
  }).sort((a, b) => (b.latestScore || 0) - (a.latestScore || 0));

  const sectors = [...new Set(customers.map(c => c.sector).filter(Boolean))];

  const avgMaturity = completed.length > 0
    ? (completed.reduce((s, a) => s + (a.overall_score || 0), 0) / completed.length).toFixed(1)
    : null;

  const drillDownTitles = {
    customers: t('admin_total_customers'),
    users: t('admin_total_users'),
    assessments: t('admin_completed_assessments'),
    risks: t('admin_open_risks'),
    tasks: t('admin_open_tasks'),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description={t('admin_subtitle')}
        actions={
          // FB6 — consola única de indicadores é o dashboard de plataforma; esta
          // página é a área de operações administrativas (drill-downs e ranking).
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/">
              <BarChart3 className="w-3.5 h-3.5" />
              {t('admin_open_dashboard')}
            </Link>
          </Button>
        }
      />

      {/* Platform Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title={t('admin_total_customers')}
          value={customers.length}
          subtitle={`${activeCustomers} ${t('customers_status_active').toLowerCase()}, ${onboardingCustomers} ${t('customers_status_onboarding').toLowerCase()}`}
          icon={Building2}
          onClick={() => setDrillDown('customers')}
          clickable
        />
        <StatCard
          title={t('admin_total_users')}
          value={users.length}
          icon={Users}
          onClick={() => setDrillDown('users')}
          clickable
        />
        <StatCard
          title={t('admin_completed_assessments')}
          value={completed.length}
          subtitle={`${inProgress.length} ${t('assessments_status_in_progress').toLowerCase()}`}
          icon={ShieldCheck}
          onClick={() => setDrillDown('assessments')}
          clickable
        />
        <StatCard
          title={t('admin_avg_maturity')}
          value={avgMaturity ?? '—'}
          icon={BarChart3}
        />
        <StatCard
          title={t('admin_open_risks')}
          value={openRisks.length}
          subtitle={`${criticalRisks.length} ${t('risk_level_critical').toLowerCase()}`}
          icon={AlertTriangle}
          onClick={() => setDrillDown('risks')}
          clickable
        />
        <StatCard
          title={t('admin_open_tasks')}
          value={openTasks.length}
          subtitle={overdueTasks.length > 0 ? `${overdueTasks.length} ${t('admin_overdue')}` : undefined}
          icon={ClipboardList}
          onClick={() => setDrillDown('tasks')}
          clickable
        />
      </div>

      {/* Customer Rankings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">{t('admin_customer_rankings')}</CardTitle>
            <Select value={filterSector} onValueChange={setFilterSector}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin_all_sectors')}</SelectItem>
                {sectors.map(s => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>{t('admin_col_customer')}</TableHead>
                <TableHead>{t('admin_col_sector')}</TableHead>
                <TableHead>{t('admin_col_employees')}</TableHead>
                <TableHead>{t('admin_col_assessments')}</TableHead>
                <TableHead>{t('admin_col_latest_period')}</TableHead>
                <TableHead>{t('admin_col_score')}</TableHead>
                <TableHead>{t('admin_open_risks')}</TableHead>
                <TableHead>{t('admin_open_tasks')}</TableHead>
                <TableHead>{t('common_status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerRankings.map((c, i) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-mono text-muted-foreground text-xs">{i + 1}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="capitalize text-sm">{c.sector?.replace(/_/g, ' ') || '—'}</TableCell>
                  <TableCell className="text-sm">{c.num_employees || '-'}</TableCell>
                  <TableCell className="text-sm">{c.assessmentCount}</TableCell>
                  <TableCell className="text-sm font-mono">{c.latestPeriod}</TableCell>
                  <TableCell>
                    {c.latestScore != null ? (
                      <span className={`font-bold ${c.latestScore >= 3.5 ? 'ankora-risk-low' : c.latestScore >= 2 ? 'ankora-risk-medium' : 'ankora-risk-critical'}`}>
                        {c.latestScore.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.openRisks > 0 ? (
                      <Badge variant="outline" className="text-xs bg-chart-3/10 text-chart-3 border-chart-3/20">{c.openRisks}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.openTasks > 0 ? (
                      <Badge variant="outline" className="text-xs bg-chart-1/10 text-chart-1 border-chart-1/20">{c.openTasks}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} label={c.status?.replace(/_/g, ' ') || '-'} />
                  </TableCell>
                </TableRow>
              ))}
              {isError ? (
                <TableRow>
                  <TableCell colSpan={10}><ErrorState variant="inline" onRetry={() => refetch()} /></TableCell>
                </TableRow>
              ) : isLoading ? (
                <TableRow>
                  <TableCell colSpan={10}><LoadingState variant="skeleton" rows={4} label={t('common_loading')} /></TableCell>
                </TableRow>
              ) : customerRankings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10}><EmptyState compact icon={Building2} title={t('common_no_data')} /></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Seat Management */}
      <SeatManagementPanel />

      {/* Drill-down dialogs */}
      <DrillDownDialog title={drillDownTitles[drillDown] || ''} open={!!drillDown} onClose={() => setDrillDown(null)}>
        {drillDown === 'customers' && <CustomerDrillDown customers={customers} t={t} />}
        {drillDown === 'users' && <UserDrillDown users={users} customers={customers} t={t} />}
        {drillDown === 'assessments' && <AssessmentsDrillDown assessments={assessments} customers={customers} t={t} />}
        {drillDown === 'risks' && <RisksDrillDown risks={risks} customers={customers} t={t} />}
        {drillDown === 'tasks' && <TasksDrillDown tasks={tasks} customers={customers} t={t} />}
      </DrillDownDialog>
    </div>
  );
}