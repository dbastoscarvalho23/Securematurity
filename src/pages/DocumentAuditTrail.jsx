import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, GitBranch, Clock, CheckCircle } from 'lucide-react';
import DocActivityChart from '@/components/documents/DocActivityChart';
import DocCustomerBreakdown from '@/components/documents/DocCustomerBreakdown';
import DocAuditTable from '@/components/documents/DocAuditTable';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';

const RANGE_KEYS = [
  { key: 'doc_audit_range_30', days: 30 },
  { key: 'doc_audit_range_60', days: 60 },
  { key: 'doc_audit_range_90', days: 90 },
  { key: 'doc_audit_range_all', days: null },
];

export default function DocumentAuditTrail() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const isCustomerAdmin = user?.role === 'customer_admin';
  const customerId = user?.customer_id;

  const [rangeDays, setRangeDays] = useState(30);
  const [filterCustomer, setFilterCustomer] = useState('all');

  const { data: allDocs = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['securityDocuments'],
    queryFn: () => base44.entities.SecurityDocument.list('-created_date', 1000),
  });

  const { data: versions = [], isLoading: loadingVersions } = useQuery({
    queryKey: ['documentVersionsAll'],
    queryFn: () => base44.entities.DocumentVersion.list('-created_date', 1000),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: isAdmin,
  });

  // Scope docs to customer for non-admins
  const scopedDocs = useMemo(() => {
    if (isAdmin) return allDocs;
    return allDocs.filter(d => d.customer_id === customerId);
  }, [allDocs, isAdmin, customerId]);

  const cutoff = useMemo(() => {
    if (!rangeDays) return null;
    const d = new Date();
    d.setDate(d.getDate() - rangeDays);
    return d;
  }, [rangeDays]);

  // Apply customer + date filters
  const docs = useMemo(() => {
    let filtered = scopedDocs;
    if (isAdmin && filterCustomer !== 'all') {
      filtered = filtered.filter(d => d.customer_id === filterCustomer);
    }
    if (cutoff) {
      filtered = filtered.filter(d => new Date(d.created_date) >= cutoff);
    }
    return filtered;
  }, [scopedDocs, filterCustomer, cutoff, isAdmin]);

  const filteredVersions = useMemo(() => {
    let vs = versions;
    if (isAdmin && filterCustomer !== 'all') {
      const docIds = new Set(scopedDocs.filter(d => d.customer_id === filterCustomer).map(d => d.id));
      vs = vs.filter(v => docIds.has(v.document_id));
    } else if (!isAdmin) {
      const docIds = new Set(scopedDocs.map(d => d.id));
      vs = vs.filter(v => docIds.has(v.document_id));
    }
    if (cutoff) {
      vs = vs.filter(v => new Date(v.created_date) >= cutoff);
    }
    return vs;
  }, [versions, scopedDocs, filterCustomer, cutoff, isAdmin]);

  const pendingApprovals = scopedDocs.filter(d => d.status === 'under_review').length;
  const approvedDocs = scopedDocs.filter(d => d.status === 'approved').length;
  const totalDocs = scopedDocs.length;
  const totalVersions = versions.filter(v => {
    if (!isAdmin) {
      const docIds = new Set(scopedDocs.map(d => d.id));
      return docIds.has(v.document_id);
    }
    return true;
  }).length;

  const isLoading = loadingDocs || loadingVersions;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <PageHeader
        description={t('doc_audit_subtitle')}
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t('doc_audit_all_customers')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('doc_audit_all_customers')}</SelectItem>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={String(rangeDays)} onValueChange={v => setRangeDays(v === 'null' ? null : Number(v))}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_KEYS.map(r => (
                  <SelectItem key={String(r.days)} value={String(r.days)}>{t(r.key)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={FileText} label={t('doc_audit_kpi_total_docs')} value={totalDocs} color="text-chart-1" bg="bg-chart-1/10" />
        <KpiCard icon={GitBranch} label={t('doc_audit_kpi_versions')} value={totalVersions} color="text-chart-5" bg="bg-chart-5/10" />
        <KpiCard icon={Clock} label={t('doc_audit_kpi_pending')} value={pendingApprovals} color="text-chart-3" bg="bg-chart-3/10" />
        <KpiCard icon={CheckCircle} label={t('doc_audit_kpi_approved')} value={approvedDocs} color="text-chart-2" bg="bg-chart-2/10" />
      </div>

      {/* Activity Chart */}
      <DocActivityChart docs={docs} versions={filteredVersions} rangeDays={rangeDays} isLoading={isLoading} />

      {/* Customer / Department Breakdown */}
      {(isAdmin || isCustomerAdmin) && (
        <DocCustomerBreakdown docs={scopedDocs} customers={customers} isAdmin={isAdmin} user={user} />
      )}

      {/* Recent Activity Table */}
      <DocAuditTable docs={allDocs} versions={versions} scopedDocIds={new Set(scopedDocs.map(d => d.id))} cutoff={cutoff} />
    </div>
  );
}

function KpiCard({ icon: IconComp, label, value, color, bg }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bg}`}>
          <IconComp className={`w-4 h-4 ${color}`} />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}