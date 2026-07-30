import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Paperclip, Download, FileText, ExternalLink, FolderOpen } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/lib/LanguageContext';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ComplianceGapsSummary from '@/components/evidence/ComplianceGapsSummary';

function fileIcon(name = '') {
  const ext = name.split('.').pop()?.toLowerCase();
  return <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
}

function fileSizeLabel(url) {
  return null; // URLs don't carry size info without fetching
}

export default function EvidenceOverview() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const customerId = user?.customer_id;

  const [search, setSearch] = useState('');
  const [filterAssessment, setFilterAssessment] = useState('all');
  const [filterFramework, setFilterFramework] = useState('all');
  const [filterDomain, setFilterDomain] = useState('all');

  // Fetch assessments
  const { data: assessments = [] } = useQuery({
    queryKey: ['assessments-evidence', customerId],
    queryFn: () => isAdmin
      ? base44.entities.Assessment.list('-created_date')
      : base44.entities.Assessment.filter({ customer_id: customerId }, '-created_date'),
    enabled: isAdmin || !!customerId,
  });

  // Fetch all responses with attachments
  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['responses-evidence', customerId],
    queryFn: async () => {
      const all = isAdmin
        ? await base44.entities.AssessmentResponse.list('-created_date', 2000)
        : await base44.entities.AssessmentResponse.filter({ customer_id: customerId }, '-created_date', 2000);
      return all.filter(r => r.attachments?.length > 0);
    },
    enabled: isAdmin || !!customerId,
  });

  // Build assessment lookup map
  const assessmentMap = useMemo(() => {
    const m = {};
    assessments.forEach(a => { m[a.id] = a; });
    return m;
  }, [assessments]);

  // Flatten all attachments into rows
  const allFiles = useMemo(() => {
    const rows = [];
    responses.forEach(resp => {
      (resp.attachments || []).forEach(att => {
        rows.push({
          ...att,
          responseId: resp.id,
          assessmentId: resp.assessment_id,
          assessment: assessmentMap[resp.assessment_id],
          framework_code: resp.framework_code,
          domain: resp.domain,
          control_id: resp.control_id,
          evidence_notes: resp.evidence_notes,
        });
      });
    });
    return rows;
  }, [responses, assessmentMap]);

  // Unique filter options
  const frameworks = useMemo(() => [...new Set(allFiles.map(f => f.framework_code).filter(Boolean))], [allFiles]);
  const domains = useMemo(() => [...new Set(allFiles.map(f => f.domain).filter(Boolean))], [allFiles]);

  // Apply filters
  const filtered = useMemo(() => allFiles.filter(f => {
    const matchSearch = !search ||
      f.name?.toLowerCase().includes(search.toLowerCase()) ||
      f.domain?.toLowerCase().includes(search.toLowerCase()) ||
      f.framework_code?.toLowerCase().includes(search.toLowerCase()) ||
      f.evidence_notes?.toLowerCase().includes(search.toLowerCase());
    const matchAssessment = filterAssessment === 'all' || f.assessmentId === filterAssessment;
    const matchFramework = filterFramework === 'all' || f.framework_code === filterFramework;
    const matchDomain = filterDomain === 'all' || f.domain === filterDomain;
    return matchSearch && matchAssessment && matchFramework && matchDomain;
  }), [allFiles, search, filterAssessment, filterFramework, filterDomain]);

  // Group by assessment for display
  const groupedByAssessment = useMemo(() => {
    const groups = {};
    filtered.forEach(f => {
      const key = f.assessmentId || 'unknown';
      if (!groups[key]) groups[key] = { assessment: f.assessment, files: [] };
      groups[key].files.push(f);
    });
    return Object.values(groups);
  }, [filtered]);

  // Bulk download for a specific assessment group
  const handleBulkDownload = (files) => {
    files.forEach((f, i) => {
      if (!f.url) return;
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = f.url;
        a.target = '_blank';
        a.download = f.name || 'evidence';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 300);
    });
  };

  return (
    <div className="space-y-6">
      {/* Compliance Gaps Summary */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t('evidence_gaps_title')}</h2>
          <p className="text-sm text-muted-foreground">{t('evidence_gaps_subtitle')}</p>
        </div>
        <ComplianceGapsSummary />
      </div>

      {/* Header stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('evidence_total_files')}</p>
            <p className="text-2xl font-bold mt-1">{allFiles.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('evidence_assessments_with')}</p>
            <p className="text-2xl font-bold mt-1">
              {new Set(allFiles.map(f => f.assessmentId)).size}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('evidence_frameworks_covered')}</p>
            <p className="text-2xl font-bold mt-1">{frameworks.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('evidence_search_placeholder')}
            className="pl-9"
          />
        </div>
        <Select value={filterAssessment} onValueChange={setFilterAssessment}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Assessment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('evidence_all_assessments')}</SelectItem>
            {assessments.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {frameworks.length > 0 && (
          <Select value={filterFramework} onValueChange={setFilterFramework}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Framework" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('evidence_all_frameworks')}</SelectItem>
              {frameworks.map(fw => <SelectItem key={fw} value={fw}>{fw}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {domains.length > 0 && (
          <Select value={filterDomain} onValueChange={setFilterDomain}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Domain" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('evidence_all_domains')}</SelectItem>
              {domains.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <Card><CardContent className="p-0"><LoadingState label={t('evidence_loading')} className="py-16" /></CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-0">
          <EmptyState icon={Paperclip} title={t('evidence_empty')} description={t('evidence_empty_desc')} />
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {groupedByAssessment.map(({ assessment, files }) => (
            <Card key={assessment?.id || 'unknown'}>
              <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/20">
                <div className="flex items-center gap-3">
                  <FolderOpen className="w-4 h-4 text-primary" />
                  <div>
                    <p className="font-semibold text-sm">{assessment?.title || t('evidence_unknown_assessment')}</p>
                    <p className="text-xs text-muted-foreground">
                      {assessment?.customer_name} · {assessment?.period} · {files.length} file{files.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={() => handleBulkDownload(files)}
                >
                  <Download className="w-3.5 h-3.5" />
                  {t('evidence_download_all')} ({files.length})
                </Button>
              </div>
              <CardContent className="p-0">
                <div className="divide-y">
                  {files.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                      {fileIcon(f.name)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.name || t('evidence_unnamed_file')}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          {f.framework_code && (
                            <Badge variant="outline" className="text-xs">{f.framework_code}</Badge>
                          )}
                          {f.domain && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{f.domain}</span>
                          )}
                          {f.control_id && (
                            <span className="text-xs text-muted-foreground font-mono">{f.control_id}</span>
                          )}
                        </div>
                        {f.evidence_notes && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{f.evidence_notes}</p>
                        )}
                      </div>
                      {f.url && (
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-shrink-0"
                        >
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}