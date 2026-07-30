import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { isAfter, isBefore, parseISO } from 'date-fns';
import { ShieldCheck } from 'lucide-react';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import CustomerGapCard from './CustomerGapCard';

const HORIZON_DAYS = 30;

export default function ComplianceGapsSummary() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const customerId = user?.customer_id;
  const enabled = isAdmin || !!customerId;

  const scoped = (list) => (isAdmin ? list : list.filter(x => x.customer_id === customerId));

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['gap-docs', customerId],
    queryFn: () => base44.entities.SecurityDocument.list('-created_date', 1000),
    enabled,
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ['gap-tasks', customerId],
    queryFn: () => isAdmin
      ? base44.entities.Task.list('-created_date', 1000)
      : base44.entities.Task.filter({ customer_id: customerId }, '-created_date', 1000),
    enabled,
  });
  const { data: risks = [] } = useQuery({
    queryKey: ['gap-risks', customerId],
    queryFn: () => isAdmin
      ? base44.entities.RiskItem.list('-created_date', 1000)
      : base44.entities.RiskItem.filter({ customer_id: customerId }, '-created_date', 1000),
    enabled,
  });
  const { data: vulns = [] } = useQuery({
    queryKey: ['gap-vulns', customerId],
    queryFn: () => isAdmin
      ? base44.entities.Vulnerability.list('-created_date', 1000)
      : base44.entities.Vulnerability.filter({ customer_id: customerId }, '-created_date', 1000),
    enabled,
  });
  const { data: dsrs = [] } = useQuery({
    queryKey: ['gap-dsrs', customerId],
    queryFn: () => isAdmin
      ? base44.entities.DataSubjectRequest.list('-created_date', 1000)
      : base44.entities.DataSubjectRequest.filter({ customer_id: customerId }, '-created_date', 1000),
    enabled,
  });

  const gaps = useMemo(() => {
    const map = new Map();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const horizon = new Date(today); horizon.setDate(horizon.getDate() + HORIZON_DAYS);
    const ensure = (id, name) => {
      if (!map.has(id)) {
        map.set(id, { id, name: name || '—', missingDocs: [], upcomingReviews: [], deadlines: [] });
      }
      return map.get(id);
    };

    scoped(docs).forEach(d => {
      if (!d.customer_id) return;
      const e = ensure(d.customer_id, d.customer_name);
      if (d.status === 'draft' || d.status === 'under_review') {
        e.missingDocs.push({ title: d.title, status: d.status });
      }
      if (d.review_date) {
        const rd = parseISO(d.review_date);
        if (!isBefore(rd, today) && !isAfter(rd, horizon)) {
          e.upcomingReviews.push({ title: d.title, date: d.review_date });
        }
      }
    });

    const addDeadline = (item, route, typeLabel) => {
      if (!item.customer_id || !item.due_date) return;
      const dd = parseISO(item.due_date);
      if (isAfter(dd, horizon)) return;
      const e = ensure(item.customer_id, item.customer_name);
      e.deadlines.push({
        title: item.title || item.data_subject_name || '—',
        date: item.due_date,
        overdue: isBefore(dd, today),
        route,
        typeLabel,
      });
    };
    scoped(tasks).forEach(tk => addDeadline(tk, '/tasks', t('evidence_gap_task')));
    scoped(risks).forEach(r => addDeadline(r, '/risk-assessment', t('evidence_gap_risk')));
    scoped(vulns).forEach(v => addDeadline(v, '/vulnerabilities', t('evidence_gap_vuln')));
    scoped(dsrs).forEach(dsr => addDeadline(dsr, '/dsr', t('evidence_gap_dsr')));

    map.forEach(e => e.deadlines.sort((a, b) => new Date(a.date) - new Date(b.date)));
    return Array.from(map.values()).sort(
      (a, b) => (b.missingDocs.length + b.deadlines.length) - (a.missingDocs.length + a.deadlines.length)
    );
  }, [docs, tasks, risks, vulns, dsrs, isAdmin, customerId, t]);

  if (isLoading) return <LoadingState label={t('common_loading')} className="py-12" />;
  if (gaps.length === 0) return <EmptyState icon={ShieldCheck} title={t('evidence_gap_none')} />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {gaps.map(g => <CustomerGapCard key={g.id} gap={g} />)}
    </div>
  );
}