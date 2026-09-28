import React, { useState, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollText, X, Loader2, ChevronDown, FileDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';
import { canView, normalizeRole } from '@/lib/rbac';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import LoadingState from '@/components/shared/LoadingState';

const formatLocalTimestamp = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
};

const actionColors = {
  // Assessments
  assessment_created: 'bg-chart-1/10 text-chart-1',
  assessment_completed: 'bg-accent/10 text-accent',
  assessment_deleted: 'bg-destructive/10 text-destructive',
  // Customers
  customer_created: 'bg-chart-2/10 text-chart-2',
  customer_updated: 'bg-chart-3/10 text-chart-3',
  customer_deleted: 'bg-destructive/10 text-destructive',
  // Recommendations
  recommendation_generated: 'bg-chart-5/10 text-chart-5',
  recommendation_created: 'bg-chart-5/10 text-chart-5',
  recommendation_updated: 'bg-chart-3/10 text-chart-3',
  recommendation_deleted: 'bg-destructive/10 text-destructive',
  // Questions
  question_generated: 'bg-chart-1/10 text-chart-1',
  question_created: 'bg-chart-1/10 text-chart-1',
  question_updated: 'bg-chart-3/10 text-chart-3',
  question_deleted: 'bg-destructive/10 text-destructive',
  questions_translated: 'bg-chart-5/10 text-chart-5',
  questions_deduplicated: 'bg-chart-4/10 text-chart-4',
  // Tasks
  task_created: 'bg-primary/10 text-primary',
  task_updated: 'bg-chart-3/10 text-chart-3',
  task_deleted: 'bg-destructive/10 text-destructive',
  task_status_changed: 'bg-chart-4/10 text-chart-4',
  // Documents
  document_created: 'bg-chart-2/10 text-chart-2',
  document_updated: 'bg-chart-3/10 text-chart-3',
  document_deleted: 'bg-destructive/10 text-destructive',
  document_approved: 'bg-accent/10 text-accent',
  document_version_reverted: 'bg-chart-4/10 text-chart-4',
  // Risks
  risk_created: 'bg-destructive/10 text-destructive',
  risk_updated: 'bg-chart-4/10 text-chart-4',
  risk_deleted: 'bg-destructive/10 text-destructive',
  // System
  email_sent: 'bg-chart-5/10 text-chart-5',
  framework_created: 'bg-chart-1/10 text-chart-1',
  framework_status_changed: 'bg-chart-3/10 text-chart-3',
  report_exported: 'bg-muted text-muted-foreground',
  user_login: 'bg-muted text-muted-foreground',
  settings_changed: 'bg-chart-4/10 text-chart-4',
};

const CSV_COLUMNS = ['created_date', 'action', 'user_email', 'entity_type', 'entity_id', 'customer_id', 'details'];
const EXPORT_LIMIT = 1000;

function toCsv(rows) {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [
    CSV_COLUMNS.join(','),
    ...rows.map((row) => CSV_COLUMNS.map((column) => escape(row[column])).join(',')),
  ].join('\n');
}

function downloadCsv(rows) {
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `trilha-auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Trilha de auditoria (FB5).
 *
 * Os filtros passam a ser do servidor (`listAuditLog`), aplicados antes da
 * paginação e com intervalo de datas; as opções dos seletores vêm das facetas
 * do âmbito inteiro e não da página carregada; a pesquisa livre é um
 * refinamento local do resultado já filtrado; e o resultado filtrado exporta-se
 * em CSV — o recorte temporal deixa de depender do que está à vista.
 */
export default function AuditLog() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [filterAction, setFilterAction] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const PAGE_SIZE = 100;

  // Filtros de servidor (os valores "all" não são enviados).
  const serverFilters = useMemo(() => ({
    action: filterAction === 'all' ? '' : filterAction,
    user_email: filterUser === 'all' ? '' : filterUser,
    entity_type: filterEntity === 'all' ? '' : filterEntity,
    from: dateFrom,
    to: dateTo,
  }), [filterAction, filterUser, filterEntity, dateFrom, dateTo]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['auditLogs', serverFilters],
    queryFn: ({ pageParam = 0 }) =>
      base44.functions.invoke('listAuditLog', { ...serverFilters, cursor: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? undefined,
  });

  const pages = data?.pages || [];
  const logs = useMemo(() => pages.flatMap((page) => page?.entries || []), [pages]);
  const facets = pages[0]?.filters || { actions: [], users: [], entities: [] };
  const total = pages[0]?.total ?? logs.length;
  const truncated = pages[0]?.truncated;

  // A pesquisa livre refina o resultado já filtrado pelo servidor (FB5).
  const filtered = useMemo(() => {
    if (!filterSearch) return logs;
    const q = filterSearch.toLowerCase();
    return logs.filter(log =>
      log.details?.toLowerCase().includes(q) ||
      log.user_email?.toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q) ||
      log.entity_type?.toLowerCase().includes(q)
    );
  }, [logs, filterSearch]);

  const hasFilters = filterAction !== 'all' || filterUser !== 'all' || filterEntity !== 'all' || !!dateFrom || !!dateTo || !!filterSearch;

  const clearFilters = () => {
    setFilterAction('all');
    setFilterUser('all');
    setFilterEntity('all');
    setDateFrom('');
    setDateTo('');
    setFilterSearch('');
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await base44.functions.invoke('listAuditLog', { ...serverFilters, cursor: 0, limit: EXPORT_LIMIT });
      const rows = result?.entries || [];
      if (rows.length === 0) {
        toast.warning(t('audit_export_empty'));
        return;
      }
      downloadCsv(rows);
      toast.success(`${rows.length} ${t('audit_exported')}`);
    } catch {
      toast.error(t('audit_export_error'));
    } finally {
      setIsExporting(false);
    }
  };

  const role = normalizeRole(user?.role);

  if (!canView(role, 'audit_log')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center space-y-2">
        <ScrollText className="w-10 h-10 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground">{t('common_no_permission')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description={
          <>
            {t('audit_subtitle')} · <span className="text-foreground font-medium">{logs.length}</span> {t('audit_of')}{' '}
            <span className="text-foreground font-medium">{total}</span> {t('audit_entries')}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
                <X className="w-3.5 h-3.5" /> {t('audit_clear_filters')}
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={isExporting}>
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              {t('audit_export_csv')}
            </Button>
          </div>
        }
      />

      {/* Filtros — aplicados no servidor, antes da paginação */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="audit-from" className="text-xs text-muted-foreground">{t('audit_date_from')}</Label>
          <Input id="audit-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-to" className="text-xs text-muted-foreground">{t('audit_date_to')}</Label>
          <Input id="audit-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t('audit_all_actions')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('audit_all_actions')}</SelectItem>
            {facets.actions.map(a => (
              <SelectItem key={a} value={a}>{a.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t('audit_all_users')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('audit_all_users')}</SelectItem>
            {facets.users.map(u => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t('audit_all_entities')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('audit_all_entities')}</SelectItem>
            {facets.entities.map(e => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder={t('audit_search_placeholder')}
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          className="w-56"
        />
      </div>

      {truncated && (
        <p className="text-xs text-muted-foreground">{t('audit_truncated')}</p>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('audit_col_timestamp')}</TableHead>
                <TableHead>{t('audit_col_action')}</TableHead>
                <TableHead>{t('audit_col_user')}</TableHead>
                <TableHead>{t('audit_col_entity')}</TableHead>
                <TableHead>{t('audit_col_details')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5}><LoadingState variant="skeleton" rows={6} /></TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5}><ErrorState variant="inline" onRetry={() => refetch()} /></TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}><EmptyState compact icon={ScrollText} title={hasFilters ? t('audit_no_match') : t('audit_empty')} /></TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}><EmptyState compact title={t('audit_no_match')} /></TableCell>
                </TableRow>
              ) : filtered.map(log => (
                <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {formatLocalTimestamp(log.created_date)}
                  </TableCell>
                  <TableCell>
                    <Badge className={actionColors[log.action] || 'bg-muted text-muted-foreground'}>
                      {log.action?.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.user_email}</TableCell>
                  <TableCell className="text-sm">{log.entity_type}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{log.details}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="gap-2">
            {isFetchingNextPage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
            {t('audit_load_more')}
          </Button>
        </div>
      )}

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="capitalize">{selectedLog?.action?.replace(/_/g, ' ') || t('audit_col_details')}</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge className={actionColors[selectedLog.action] || 'bg-muted text-muted-foreground'}>
                  {selectedLog.action?.replace(/_/g, ' ')}
                </Badge>
                <span className="text-xs font-mono text-muted-foreground">{formatLocalTimestamp(selectedLog.created_date)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-muted-foreground">{t('audit_col_user')}</div>
                <div className="col-span-2 font-medium break-all">{selectedLog.user_email || '—'}</div>
                <div className="text-muted-foreground">{t('audit_col_entity')}</div>
                <div className="col-span-2 font-medium">{selectedLog.entity_type || '—'}</div>
                <div className="text-muted-foreground">ID</div>
                <div className="col-span-2 font-mono text-xs break-all">{selectedLog.entity_id || '—'}</div>
                <div className="text-muted-foreground">{t('common_customer')}</div>
                <div className="col-span-2 font-mono text-xs break-all">{selectedLog.customer_id || '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">{t('audit_col_details')}</div>
                <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap break-words">{selectedLog.details || '—'}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
