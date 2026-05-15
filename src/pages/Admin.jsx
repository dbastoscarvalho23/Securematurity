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
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import {
  ShieldCheck, Building2, BarChart3, Users, AlertTriangle, ClipboardList,
  ChevronRight, X, Search, TrendingUp, TrendingDown, CheckCircle2, Clock,
  FileText,
} from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { format } from 'date-fns';

const COLORS = ['hsl(217,91%,60%)', 'hsl(173,58%,39%)', 'hsl(43,74%,66%)', 'hsl(27,87%,67%)', 'hsl(262,52%,56%)', 'hsl(0,84%,60%)'];

const PRIORITY_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  onboarding: 'bg-blue-100 text-blue-700',
  inactive: 'bg-gray-100 text-gray-500',
  open: 'bg-orange-100 text-orange-700',
  in_treatment: 'bg-blue-100 text-blue-700',
  accepted: 'bg-purple-100 text-purple-700',
  closed: 'bg-gray-100 text-gray-500',
  completed: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-500',
  in_progress: 'bg-blue-100 text-blue-700',
};

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
          <Badge key={s} variant="outline" className={`${STATUS_COLORS[s] || ''} capitalize`}>{s.replace(/_/g, ' ')}: {n}</Badge>
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
                <Badge className={`${STATUS_COLORS[c.status] || ''} capitalize text-xs`}>{c.status?.replace(/_/g, ' ') || '-'}</Badge>
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
              <TableCell className="text-sm">{customerMap[u.customer_id] || (u.role === 'admin' ? t('settings_na_admin') : '—')}</TableCell>
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
                <Badge className={`${STATUS_COLORS[a.status] || ''} capitalize text-xs`}>{a.status?.replace(/_/g, ' ')}</Badge>
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
                  <span className={`font-bold ${score >= 20 ? 'text-red-600' : score >= 12 ? 'text-orange-500' : score >= 6 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {score}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge className={`${STATUS_COLORS[r.status] || ''} capitalize text-xs`}>{r.status?.replace(/_/g, ' ') || '-'}</Badge>
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
                  <Badge variant="outline" className={`${PRIORITY_COLORS[tk.priority] || ''} text-xs capitalize`}>{tk.priority}</Badge>
                )}
              </TableCell>
              <TableCell>
                <Badge className={`${STATUS_COLORS[tk.status] || ''} capitalize text-xs`}>{tk.status?.replace(/_/g, ' ') || '-'}</Badge>
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

  const { data: customers = [] } = useQuery({
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

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center space-y-2">
        <ShieldCheck className="w-10 h-10 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground">{t('common_no_permission')}</p>
      </div>
    );
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

  // Benchmark: avg score per sector
  const sectorBenchmark = {};
  completed.forEach(a => {
    const customer = customers.find(c => c.id === a.customer_id);
    if (!customer) return;
    const sector = customer.sector || 'unknown';
    if (!sectorBenchmark[sector]) sectorBenchmark[sector] = { scores: [], count: 0 };
    sectorBenchmark[sector].scores.push(a.overall_score || 0);
    sectorBenchmark[sector].count++;
  });

  const benchmarkData = Object.entries(sectorBenchmark).map(([sector, data]) => ({
    sector: sector.replace(/_/g, ' '),
    avg_score: Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10,
    count: data.count,
  })).sort((a, b) => b.avg_score - a.avg_score);

  // Framework usage
  const frameworkUsage = {};
  assessments.forEach(a => {
    (a.frameworks || []).forEach(f => {
      frameworkUsage[f] = (frameworkUsage[f] || 0) + 1;
    });
  });
  const frameworkData = Object.entries(frameworkUsage)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Customer status pie
  const customerStatusData = [
    { name: t('customers_status_active'), value: activeCustomers },
    { name: t('customers_status_onboarding'), value: onboardingCustomers },
    { name: t('customers_status_inactive'), value: customers.filter(c => c.status === 'inactive').length },
  ].filter(d => d.value > 0);

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
      <div>
        <p className="text-muted-foreground text-sm">{t('admin_subtitle')}</p>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="cursor-pointer" onClick={() => setDrillDown('customers')}>
          <StatCard
            title={t('admin_total_customers')}
            value={customers.length}
            subtitle={`${activeCustomers} ${t('customers_status_active').toLowerCase()}, ${onboardingCustomers} ${t('customers_status_onboarding').toLowerCase()}`}
            icon={Building2}
          />
        </div>
        <div className="cursor-pointer" onClick={() => setDrillDown('users')}>
          <StatCard title={t('admin_total_users')} value={users.length} icon={Users} />
        </div>
        <div className="cursor-pointer" onClick={() => setDrillDown('assessments')}>
          <StatCard
            title={t('admin_completed_assessments')}
            value={completed.length}
            subtitle={`${inProgress.length} ${t('assessments_status_in_progress').toLowerCase()}`}
            icon={ShieldCheck}
          />
        </div>
        <StatCard
          title={t('admin_avg_maturity')}
          value={avgMaturity ?? '—'}
          icon={BarChart3}
        />
        <div className="cursor-pointer" onClick={() => setDrillDown('risks')}>
          <StatCard
            title={t('admin_open_risks')}
            value={openRisks.length}
            subtitle={`${criticalRisks.length} ${t('risk_level_critical').toLowerCase()}`}
            icon={AlertTriangle}
          />
        </div>
        <div className="cursor-pointer" onClick={() => setDrillDown('tasks')}>
          <StatCard
            title={t('admin_open_tasks')}
            value={openTasks.length}
            subtitle={overdueTasks.length > 0 ? `${overdueTasks.length} ${t('admin_overdue')}` : undefined}
            icon={ClipboardList}
          />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sector Benchmark */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('admin_maturity_by_sector')}</CardTitle>
          </CardHeader>
          <CardContent>
            {benchmarkData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={benchmarkData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="sector" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(val, name) => [val, t('admin_avg_maturity')]}
                  />
                  <Bar dataKey="avg_score" radius={[4, 4, 0, 0]}>
                    {benchmarkData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t('admin_no_benchmark')}</p>
            )}
          </CardContent>
        </Card>

        {/* Customer Status Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('admin_customer_status')}</CardTitle>
          </CardHeader>
          <CardContent>
            {customerStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={customerStatusData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {customerStatusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t('common_no_data')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Framework usage + Risk status row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Framework usage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('admin_framework_usage')}</CardTitle>
          </CardHeader>
          <CardContent>
            {frameworkData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={frameworkData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={80} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {frameworkData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t('common_no_data')}</p>
            )}
          </CardContent>
        </Card>

        {/* Risk status breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('admin_risk_breakdown')}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setDrillDown('risks')} className="text-xs gap-1">
                {t('dashboard_view_all')} <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {risks.length > 0 ? (() => {
              const riskStatusData = [
                { name: t('risk_status_open'), value: risks.filter(r => r.status === 'open').length, color: COLORS[0] },
                { name: t('risk_status_in_treatment'), value: risks.filter(r => r.status === 'in_treatment').length, color: COLORS[1] },
                { name: t('risk_status_accepted'), value: risks.filter(r => r.status === 'accepted').length, color: COLORS[4] },
                { name: t('risk_status_closed'), value: risks.filter(r => r.status === 'closed').length, color: COLORS[2] },
              ].filter(d => d.value > 0);
              return (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={riskStatusData} cx="50%" cy="45%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {riskStatusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              );
            })() : (
              <p className="text-sm text-muted-foreground text-center py-8">{t('common_no_data')}</p>
            )}
          </CardContent>
        </Card>
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
                      <span className={`font-bold ${c.latestScore >= 3.5 ? 'text-green-600' : c.latestScore >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {c.latestScore.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.openRisks > 0 ? (
                      <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">{c.openRisks}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.openTasks > 0 ? (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">{c.openTasks}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${STATUS_COLORS[c.status] || ''} capitalize text-xs`}>{c.status?.replace(/_/g, ' ') || '-'}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {customerRankings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">{t('common_no_data')}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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