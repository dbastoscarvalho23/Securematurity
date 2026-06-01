import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Mail, Send, AlertCircle, CheckCircle2, Clock, Search, TrendingUp, Users, FileText, ShieldAlert } from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

const EMAIL_TYPE_CONFIG = {
  Task: { label: 'Task', icon: CheckCircle2, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  RiskItem: { label: 'Risk', icon: ShieldAlert, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  SecurityDocument: { label: 'Document', icon: FileText, color: 'bg-green-100 text-green-700 border-green-200' },
  default: { label: 'System', icon: Mail, color: 'bg-slate-100 text-slate-700 border-slate-200' },
};

function detectEmailType(details = '') {
  const d = details.toLowerCase();
  if (d.includes('assignment')) return 'assigned';
  if (d.includes('status change') || d.includes('status changed')) return 'status_changed';
  if (d.includes('due date') || d.includes('due in')) return 'due_date_reminder';
  if (d.includes('review')) return 'document_review';
  if (d.includes('approval') || d.includes('approved')) return 'document_approved';
  return 'other';
}

const EMAIL_SUBTYPE_LABELS = {
  assigned: 'Assignment',
  status_changed: 'Status Change',
  due_date_reminder: 'Due Date Reminder',
  document_review: 'Document Review',
  document_approved: 'Document Approved',
  other: 'Other',
};

export default function EmailReport() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isCustomerAdmin = user?.role === 'customer_admin';

  const [search, setSearch] = useState('');
  const [rangeFilter, setRangeFilter] = useState('14');
  const [entityFilter, setEntityFilter] = useState('all');

  const { data: rawLogs = [], isLoading } = useQuery({
    queryKey: ['email-audit-logs'],
    queryFn: () => base44.entities.AuditLog.filter({ action: 'email_sent' }, '-created_date', 500),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-email-report'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: isAdmin,
  });

  // Filter by customer for customer_admin
  const logs = rawLogs.filter(log => {
    if (isCustomerAdmin) {
      return log.data?.customer_id === user?.customer_id;
    }
    return true;
  });

  // Apply date range filter
  const cutoffDate = rangeFilter !== 'all' ? subDays(new Date(), parseInt(rangeFilter)) : null;
  const filteredLogs = logs.filter(log => {
    const afterCutoff = cutoffDate ? isAfter(new Date(log.created_date), cutoffDate) : true;
    const matchesEntity = entityFilter === 'all' || log.data?.entity_type === entityFilter;
    const matchesSearch = !search || (log.data?.details || '').toLowerCase().includes(search.toLowerCase())
      || (log.data?.user_email || '').toLowerCase().includes(search.toLowerCase());
    return afterCutoff && matchesEntity && matchesSearch;
  });

  // Last 2 weeks specifically for the summary header
  const last14 = logs.filter(l => isAfter(new Date(l.created_date), subDays(new Date(), 14)));
  const last14ByType = last14.reduce((acc, l) => {
    const t = l.data?.entity_type || 'default';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  // Build daily chart data for last 14 days
  const dailyData = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    const dateStr = format(date, 'MMM d');
    const dayLogs = logs.filter(l => format(new Date(l.created_date), 'MMM d') === dateStr);
    return {
      date: dateStr,
      tasks: dayLogs.filter(l => l.data?.entity_type === 'Task').length,
      risks: dayLogs.filter(l => l.data?.entity_type === 'RiskItem').length,
      documents: dayLogs.filter(l => l.data?.entity_type === 'SecurityDocument').length,
    };
  });

  // Subtype breakdown for filtered logs
  const subtypeBreakdown = filteredLogs.reduce((acc, l) => {
    const st = detectEmailType(l.data?.details);
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});

  if (!isAdmin && !isCustomerAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-muted-foreground">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Email Notification Report</h1>
        <p className="text-muted-foreground text-sm mt-1">Monitor all email notifications sent by the platform</p>
      </div>

      {/* Last 14 days KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={Send}
          label="Emails Last 14 Days"
          value={last14.length}
          sub="all types"
          iconClass="text-primary bg-primary/10"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Task Emails"
          value={last14ByType['Task'] || 0}
          sub="assignments & status"
          iconClass="text-blue-600 bg-blue-100"
        />
        <KpiCard
          icon={ShieldAlert}
          label="Risk Emails"
          value={last14ByType['RiskItem'] || 0}
          sub="assignments & reminders"
          iconClass="text-orange-600 bg-orange-100"
        />
        <KpiCard
          icon={FileText}
          label="Document Emails"
          value={last14ByType['SecurityDocument'] || 0}
          sub="reviews & approvals"
          iconClass="text-green-600 bg-green-100"
        />
      </div>

      {/* Daily activity chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            Email Activity — Last 14 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
              />
              <Bar dataKey="tasks" name="Tasks" fill="hsl(var(--chart-1))" radius={[3,3,0,0]} />
              <Bar dataKey="risks" name="Risks" fill="hsl(var(--chart-4))" radius={[3,3,0,0]} />
              <Bar dataKey="documents" name="Documents" fill="hsl(var(--chart-2))" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 justify-center">
            {[['Tasks', 'chart-1'], ['Risks', 'chart-4'], ['Documents', 'chart-2']].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className={`w-2.5 h-2.5 rounded-sm bg-${color}`} />
                {label}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters + table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              Email Log
              <Badge variant="secondary" className="ml-1">{filteredLogs.length}</Badge>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search recipient, details..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-52"
                />
              </div>
              <Select value={rangeFilter} onValueChange={setRangeFilter}>
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="14">Last 14 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="60">Last 60 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="Task">Tasks</SelectItem>
                  <SelectItem value="RiskItem">Risks</SelectItem>
                  <SelectItem value="SecurityDocument">Documents</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subtype pills */}
          {Object.keys(subtypeBreakdown).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(subtypeBreakdown).map(([st, count]) => (
                <span key={st} className="text-xs bg-muted rounded-full px-2.5 py-0.5 text-muted-foreground">
                  {EMAIL_SUBTYPE_LABELS[st] || st}: <strong className="text-foreground">{count}</strong>
                </span>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              <Clock className="w-4 h-4 animate-spin mr-2" /> Loading email logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
              <Mail className="w-6 h-6 opacity-30" />
              No email records found for the selected filters.
            </div>
          ) : (
            <div className="divide-y">
              {filteredLogs.map(log => (
                <EmailLogRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, iconClass }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', iconClass)}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">{value}</p>
            <p className="text-xs font-medium text-foreground mt-1">{label}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmailLogRow({ log }) {
  const entityType = log.data?.entity_type || 'default';
  const config = EMAIL_TYPE_CONFIG[entityType] || EMAIL_TYPE_CONFIG.default;
  const Icon = config.icon;
  const subtype = detectEmailType(log.data?.details);
  const subtypeLabel = EMAIL_SUBTYPE_LABELS[subtype] || 'Other';

  // Extract recipient from details
  const details = log.data?.details || '';
  const recipientMatch = details.match(/sent to ([^\s,]+(?:,\s*[^\s,]+)*)/i);
  const recipient = recipientMatch ? recipientMatch[1] : '—';

  return (
    <div className="flex items-start gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className={cn('w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 border', config.color)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold">{config.label}</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">{subtypeLabel}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{details}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" /> {recipient}
          </span>
          <span className="text-[10px] text-muted-foreground">
            by {log.data?.user_email || 'system'}
          </span>
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground flex-shrink-0 text-right">
        {log.created_date ? format(new Date(log.created_date), 'dd MMM yyyy') : '—'}
        <br />
        {log.created_date ? format(new Date(log.created_date), 'HH:mm') : ''}
      </div>
    </div>
  );
}