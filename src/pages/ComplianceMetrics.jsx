import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Bug, Users, Database, ShieldCheck, AlertOctagon, Clock, CheckCircle2, Activity, FileText } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, RadialBarChart, RadialBar } from 'recharts';
import { SEVERITY_STYLES, daysRemaining, hoursRemaining, slaStatus } from '@/lib/complianceUtils';
import { useLanguage } from '@/lib/LanguageContext';

const INC_STATUS_LABELS = { detected: 'inc_status_detected', investigating: 'inc_status_investigating', contained: 'inc_status_contained', resolved: 'inc_status_resolved', closed: 'inc_status_closed' };
const VULN_STATUS_LABELS = { open: 'vuln_status_open', in_progress: 'vuln_status_in_progress', remediated: 'vuln_status_remediated', verified: 'vuln_status_verified', accepted_risk: 'vuln_status_accepted_risk', false_positive: 'vuln_status_false_positive' };
const SEVERITY_LABELS = { critical: 'risk_level_critical', high: 'risk_level_high', medium: 'risk_level_medium', low: 'risk_level_low' };
const DSR_TYPE_LABELS = { access: 'dsr_type_access', rectification: 'dsr_type_rectification', erasure: 'dsr_type_erasure', restriction: 'dsr_type_restriction', portability: 'dsr_type_portability', objection: 'dsr_type_objection' };

const CHART_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];

function KpiCard({ icon: Icon, label, value, sub, color = 'text-primary' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <Icon className={`w-8 h-8 ${color} opacity-80`} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ComplianceMetrics() {
  const { t } = useLanguage();
  const { data: incidents = [] } = useQuery({ queryKey: ['incidents'], queryFn: () => base44.entities.Incident.list('-updated_date', 200) });
  const { data: vulns = [] } = useQuery({ queryKey: ['vulnerabilities'], queryFn: () => base44.entities.Vulnerability.list('-updated_date', 200) });
  const { data: dsrs = [] } = useQuery({ queryKey: ['dsrs'], queryFn: () => base44.entities.DataSubjectRequest.list('-updated_date', 200) });
  const { data: ropas = [] } = useQuery({ queryKey: ['ropa'], queryFn: () => base44.entities.DataProcessingActivity.list('-updated_date', 200) });

  // ── Incident KPIs ──────────────────────────────────────────────────────
  const openIncidents = incidents.filter(i => i.status !== 'closed' && i.status !== 'resolved');
  const criticalIncidents = incidents.filter(i => i.severity === 'critical' && i.status !== 'closed');
  const nis2Overdue = incidents.filter(i => {
    if (i.status === 'closed') return false;
    const ew = !i.early_warning_sent && hoursRemaining(i.detected_at, 24) < 0;
    const ns = !i.notification_sent && hoursRemaining(i.detected_at, 72) < 0;
    return ew || ns;
  });

  // ── Vulnerability KPIs ─────────────────────────────────────────────────
  const openVulns = vulns.filter(v => v.status === 'open' || v.status === 'in_progress');
  const slaBreachedVulns = openVulns.filter(v => v.due_date && daysRemaining(v.due_date) < 0);
  const vulnsBySeverity = ['critical', 'high', 'medium', 'low'].map(s => ({ name: s, value: openVulns.filter(v => v.severity === s).length }));

  // ── DSR KPIs ───────────────────────────────────────────────────────────
  const openDsrs = dsrs.filter(d => d.status !== 'completed' && d.status !== 'rejected' && d.status !== 'withdrawn');
  const overdueDsrs = openDsrs.filter(d => {
    const due = d.extended_due_date || d.due_date;
    return due && daysRemaining(due) < 0;
  });
  const dsrComplianceRate = dsrs.length > 0
    ? Math.round((dsrs.filter(d => d.status === 'completed' && (!d.extended_due_date || new Date(d.completed_date) <= new Date(d.extended_due_date))).length / dsrs.length) * 100)
    : 100;

  // ── RoPA KPIs ──────────────────────────────────────────────────────────
  const activeRopas = ropas.filter(r => r.status === 'active');
  const ropasNeedingReview = ropas.filter(r => r.next_review && daysRemaining(r.next_review) <= 30 && daysRemaining(r.next_review) >= -365);

  // ── Charts ─────────────────────────────────────────────────────────────
  const incidentStatusData = ['detected', 'investigating', 'contained', 'resolved', 'closed'].map(s => ({
    name: s.replace(/_/g, ' '), count: incidents.filter(i => i.status === s).length,
  }));

  const vulnStatusData = ['open', 'in_progress', 'remediated', 'verified', 'accepted_risk', 'false_positive'].map(s => ({
    name: s.replace(/_/g, ' '), count: vulns.filter(v => v.status === s).length,
  }));

  const dsrTypeData = ['access', 'rectification', 'erasure', 'restriction', 'portability', 'objection'].map(t => ({
    name: t, count: dsrs.filter(d => d.request_type === t).length,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="w-6 h-6" /> Compliance Metrics Dashboard</h1>
        <p className="text-sm text-muted-foreground">Aggregated KPIs for GDPR & NIS2 compliance monitoring</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={AlertTriangle} label="Open Incidents" value={openIncidents.length} sub={`${criticalIncidents.length} critical · ${nis2Overdue.length} NIS2 overdue`} color="text-orange-500" />
        <KpiCard icon={Bug} label="Open Vulnerabilities" value={openVulns.length} sub={`${slaBreachedVulns.length} SLA breached`} color="text-destructive" />
        <KpiCard icon={Users} label="Open DSRs" value={openDsrs.length} sub={`${overdueDsrs.length} overdue · ${dsrComplianceRate}% compliance`} color="text-blue-500" />
        <KpiCard icon={Database} label="Active RoPA Entries" value={activeRopas.length} sub={`${ropasNeedingReview.length} need review`} color="text-chart-2" />
      </div>

      {/* NIS2 Notification Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" /> NIS2 Incident Notification Compliance</CardTitle>
          <CardDescription>Early warning (24h) · Full notification (72h) · Final report (1 month)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-orange-500">{incidents.filter(i => !i.early_warning_sent && hoursRemaining(i.detected_at, 24) < 0 && i.status !== 'closed').length}</p>
              <p className="text-xs text-muted-foreground mt-1">Early Warning Overdue</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-destructive">{incidents.filter(i => !i.notification_sent && hoursRemaining(i.detected_at, 72) < 0 && i.status !== 'closed').length}</p>
              <p className="text-xs text-muted-foreground mt-1">Notification Overdue</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-destructive">{incidents.filter(i => !i.supervisor_authority_notified && i.data_breach && hoursRemaining(i.detected_at, 72) < 0 && i.status !== 'closed').length}</p>
              <p className="text-xs text-muted-foreground mt-1">GDPR Art. 33 Overdue</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-chart-2">{incidents.filter(i => i.early_warning_sent && i.notification_sent).length}</p>
              <p className="text-xs text-muted-foreground mt-1">Fully Notified</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Incidents by Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={incidentStatusData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Open Vulnerabilities by Severity</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={vulnsBySeverity.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {vulnsBySeverity.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-3 mt-2">
              {vulnsBySeverity.map((s, i) => (
                <div key={s.name} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i] }} />
                  <span className="text-xs capitalize">{s.name} ({s.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Vulnerability Status Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={vulnStatusData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">DSR Types Received</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dsrTypeData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Data Retention & SLA Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> SLA & Retention Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bug className="w-4 h-4 text-destructive" />
                <p className="text-sm font-medium">Vulnerability SLA</p>
              </div>
              <p className="text-2xl font-bold">{slaBreachedVulns.length} breached</p>
              <p className="text-xs text-muted-foreground mt-1">out of {openVulns.length} open vulnerabilities</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-500" />
                <p className="text-sm font-medium">DSR SLA (30 days)</p>
              </div>
              <p className="text-2xl font-bold">{overdueDsrs.length} overdue</p>
              <p className="text-xs text-muted-foreground mt-1">out of {openDsrs.length} open requests</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-chart-2" />
                <p className="text-sm font-medium">Data Retention</p>
              </div>
              <p className="text-2xl font-bold">{ropas.filter(r => r.retention_expiry_date && daysRemaining(r.retention_expiry_date) <= 0 && r.status === 'active').length} expired</p>
              <p className="text-xs text-muted-foreground mt-1">{ropas.filter(r => r.retention_expiry_date && daysRemaining(r.retention_expiry_date) > 0 && daysRemaining(r.retention_expiry_date) <= 30 && r.status === 'active').length} expiring within 30 days</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}