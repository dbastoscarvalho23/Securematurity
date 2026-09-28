import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PackageCheck, Download, Lock, ExternalLink, FileText } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import LoadingState from '@/components/shared/LoadingState';
import { useActiveCustomer } from '@/lib/tenantContext';

const SECTION_LABEL_KEYS = {
  versions: 'audit_package_section_versions',
  controls: 'audit_package_section_controls',
  evidence: 'audit_package_section_evidence',
  decisions: 'audit_package_section_decisions',
};

const STATUS_STYLES = {
  gap: 'bg-destructive/10 text-destructive',
  uncovered: 'bg-chart-4/10 text-chart-4',
  ok: 'bg-chart-2/10 text-chart-2',
  not_applicable: 'bg-muted text-muted-foreground',
};

function downloadJson(pack) {
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${(pack.title || 'audit-package').replace(/[^\w.-]+/g, '_')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export default function AuditPackage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { customerId, isResolving } = useActiveCustomer();
  const [selectedId, setSelectedId] = useState('');

  // FA5 — o percurso do auditor deixa de falhar em silêncio: o erro da leitura
  // é tratado (mensagem + repetição) em vez de conduzir a um ecrã sem conteúdo.
  const packagesQuery = useQuery({
    queryKey: ['audit-packages', customerId],
    queryFn: () => base44.entities.AuditPackage.filter({ customer_id: customerId }, '-generated_at', 50),
    enabled: !!customerId,
  });
  const packages = packagesQuery.data ?? [];
  const isLoading = packagesQuery.isLoading;

  useEffect(() => {
    if (!selectedId && packages.length > 0) setSelectedId(packages[0].id);
    if (selectedId && !packages.some(p => p.id === selectedId)) {
      setSelectedId(packages[0]?.id || '');
    }
  }, [packages, selectedId]);

  const selected = useMemo(
    () => packages.find(p => p.id === selectedId) || null,
    [packages, selectedId],
  );

  const generateMutation = useMutation({
    mutationFn: () => base44.functions.invoke('generateAuditPackage', { action: 'generate', customer_id: customerId }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['audit-packages', customerId] });
      if (result?.package?.id) setSelectedId(result.package.id);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || error?.data?.error || t('audit_package_error'));
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () => base44.functions.invoke('generateAuditPackage', { action: 'finalize', package_id: selected?.id }),
    onSuccess: () => {
      toast.success(t('audit_package_finalize_success'));
      queryClient.invalidateQueries({ queryKey: ['audit-packages', customerId] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || error?.data?.error || t('audit_package_finalize_error'));
    },
  });

  // O contexto ainda pode estar a resolver (delegações a chegar): não se
  // conclui «sem cliente» antes disso, para não mostrar uma lista vazia que na
  // verdade ainda não foi determinada.
  if (!customerId && isResolving) {
    return (
      <div className="space-y-6">
        <PageHeader description={t('audit_package_subtitle')} />
        <Card><CardContent className="p-0"><LoadingState label={t('audit_package_loading')} className="py-16" /></CardContent></Card>
      </div>
    );
  }

  if (!customerId) {
    return (
      <div className="space-y-6">
        <PageHeader description={t('audit_package_subtitle')} />
        <Card>
          <CardContent className="p-0">
            <EmptyState icon={PackageCheck} title={t('audit_package_no_customer')} description={t('audit_package_no_customer_desc')} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = selected?.summary || {};
  const summaryCards = [
    { key: 'audit_package_summary_versions', value: summary.versions },
    { key: 'audit_package_summary_controls', value: summary.controls },
    { key: 'audit_package_summary_gaps', value: summary.controls_not_implemented },
    { key: 'audit_package_summary_evidence', value: summary.evidence },
    { key: 'audit_package_summary_decisions', value: summary.decisions },
    { key: 'audit_package_summary_open_actions', value: summary.open_actions },
  ];

  const scope = selected?.scope || {};

  return (
    <div className="space-y-6">
      <PageHeader
        description={t('audit_package_subtitle')}
        actions={
          <div className="flex items-center gap-2">
            {packages.length > 0 && (
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-64"><SelectValue placeholder={t('audit_package_select')} /></SelectTrigger>
                <SelectContent>
                  {packages.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              className="gap-2"
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
              {generateMutation.isPending ? t('audit_package_generating') : t('audit_package_generate')}
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <Card><CardContent className="p-0"><LoadingState label={t('audit_package_loading')} className="py-16" /></CardContent></Card>
      ) : packagesQuery.isError ? (
        <Card><CardContent className="p-0"><ErrorState variant="inline" onRetry={() => packagesQuery.refetch()} /></CardContent></Card>
      ) : !selected ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState icon={PackageCheck} title={t('audit_package_empty_title')} description={t('audit_package_empty_desc')} />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Package header */}
          <Card>
            <CardContent className="p-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold">{selected.title}</h2>
                  <Badge className={selected.status === 'final' ? 'bg-chart-2/10 text-chart-2' : 'bg-muted text-muted-foreground'}>
                    {selected.status === 'final' ? t('audit_package_status_final') : t('audit_package_status_draft')}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t('audit_package_version')} {selected.package_version}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('audit_package_generated_by')} {selected.generated_by || '—'}
                  {selected.generated_at ? ` · ${t('audit_package_generated_at')} ${new Date(selected.generated_at).toLocaleString()}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => downloadJson(selected)}>
                  <Download className="w-3.5 h-3.5" /> {t('audit_package_download')}
                </Button>
                {selected.status !== 'final' && (
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={finalizeMutation.isPending} onClick={() => finalizeMutation.mutate()}>
                    {finalizeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                    {finalizeMutation.isPending ? t('audit_package_finalizing') : t('audit_package_finalize')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {summaryCards.map(card => (
              <Card key={card.key}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{t(card.key)}</p>
                  <p className="text-2xl font-bold mt-1">{card.value ?? 0}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Scope */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('audit_package_scope')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">{t('audit_package_scope_customer')}:</span> {scope.customer_name || selected.customer_name}</div>
              <div><span className="text-muted-foreground">{t('audit_package_scope_frameworks')}:</span> {(scope.frameworks || selected.frameworks || []).join(', ') || '—'}</div>
              <div><span className="text-muted-foreground">{t('audit_package_scope_standards')}:</span> {(scope.standards || []).join(', ') || '—'}</div>
              <div>
                <span className="text-muted-foreground">{t('audit_package_scope_period')}:</span>{' '}
                {[scope.period_start, scope.period_end].filter(Boolean).join(' → ') || '—'}
              </div>
              <div><span className="text-muted-foreground">{t('audit_package_scope_assessments')}:</span> {scope.assessments_considered ?? 0}</div>
              <div>
                <span className="text-muted-foreground">{t('audit_package_scope_methodology')}:</span>{' '}
                {(scope.methodology_versions || []).map(v => `${v.code} ${v.version || ''}`.trim()).join(', ') || '—'}
              </div>
            </CardContent>
          </Card>

          {/* Index */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('audit_package_index')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(selected.index || []).map(row => (
                <div key={row.key} className="flex items-start justify-between gap-4 text-sm border-b last:border-0 pb-2 last:pb-0">
                  <div>
                    <p className="font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.description}</p>
                  </div>
                  <Badge variant="secondary">{row.count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Sections */}
          {(selected.sections || []).map(section => (
            <Card key={section.key}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {t(SECTION_LABEL_KEYS[section.key]) || section.label}
                  <Badge variant="secondary" className="ml-1">{section.entries?.length || 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!section.entries?.length ? (
                  <p className="px-5 pb-5 text-sm text-muted-foreground">{t('audit_package_no_entries')}</p>
                ) : (
                  <div className="divide-y">
                    {section.entries.map((entry, index) => (
                      <div key={`${section.key}-${index}`} className="px-5 py-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">{entry.label || '—'}</p>
                            {entry.status && (
                              <Badge className={`text-[10px] border-0 ${STATUS_STYLES[entry.status] || 'bg-muted text-muted-foreground'}`}>
                                {entry.status}
                              </Badge>
                            )}
                            {entry.date && (
                              <span className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString()}</span>
                            )}
                          </div>
                          {entry.detail && <p className="text-xs text-muted-foreground mt-0.5">{entry.detail}</p>}
                          {entry.hash && (
                            <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate" title={entry.hash}>
                              {t('audit_package_hash')}: {entry.hash.slice(0, 16)}…
                            </p>
                          )}
                          {entry.ref && <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{entry.ref}</p>}
                        </div>
                        {entry.url && /^https?:\/\//i.test(entry.url) && (
                          <a href={entry.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
