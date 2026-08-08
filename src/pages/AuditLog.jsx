import React, { useState, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollText, X, Loader2, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
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

export default function AuditLog() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [filterAction, setFilterAction] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const PAGE_SIZE = 500;

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['auditLogs'],
    queryFn: ({ pageParam = 0 }) => base44.entities.AuditLog.list('-created_date', PAGE_SIZE, pageParam),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
  });

  const logs = useMemo(() => data?.pages.flat() || [], [data]);

  const uniqueActions = useMemo(() => [...new Set(logs.map(l => l.action).filter(Boolean))].sort(), [logs]);
  const uniqueUsers = useMemo(() => [...new Set(logs.map(l => l.user_email).filter(Boolean))].sort(), [logs]);
  const uniqueEntities = useMemo(() => [...new Set(logs.map(l => l.entity_type).filter(Boolean))].sort(), [logs]);

  const filtered = useMemo(() => logs.filter(log => {
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    if (filterUser !== 'all' && log.user_email !== filterUser) return false;
    if (filterEntity !== 'all' && log.entity_type !== filterEntity) return false;
    if (filterSearch && !log.details?.toLowerCase().includes(filterSearch.toLowerCase()) &&
        !log.user_email?.toLowerCase().includes(filterSearch.toLowerCase()) &&
        !log.action?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  }), [logs, filterAction, filterUser, filterEntity, filterSearch]);

  const hasFilters = filterAction !== 'all' || filterUser !== 'all' || filterEntity !== 'all' || filterSearch;

  const clearFilters = () => {
    setFilterAction('all');
    setFilterUser('all');
    setFilterEntity('all');
    setFilterSearch('');
  };

  if (user?.role !== 'admin') {
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
        description={<>{t('audit_subtitle')} · <span className="text-foreground font-medium">{filtered.length}</span> {t('audit_of')} {logs.length} {t('audit_entries')}</>}
        actions={hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
            <X className="w-3.5 h-3.5" /> {t('audit_clear_filters')}
          </Button>
        )}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder={t('audit_search_placeholder')}
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          className="w-56"
        />
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t('audit_all_actions')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('audit_all_actions')}</SelectItem>
            {uniqueActions.map(a => (
              <SelectItem key={a} value={a}>{a.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t('audit_all_users')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('audit_all_users')}</SelectItem>
            {uniqueUsers.map(u => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t('audit_all_entities')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('audit_all_entities')}</SelectItem>
            {uniqueEntities.map(e => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
                  <TableCell colSpan={5}><LoadingState label={t('common_loading')} /></TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}><EmptyState compact icon={ScrollText} title={t('audit_empty')} /></TableCell>
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
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="capitalize">{selectedLog?.action?.replace(/_/g, ' ') || 'Audit log entry'}</DialogTitle>
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
                <div className="text-muted-foreground">User</div>
                <div className="col-span-2 font-medium break-all">{selectedLog.user_email || '—'}</div>
                <div className="text-muted-foreground">Entity type</div>
                <div className="col-span-2 font-medium">{selectedLog.entity_type || '—'}</div>
                <div className="text-muted-foreground">Entity ID</div>
                <div className="col-span-2 font-mono text-xs break-all">{selectedLog.entity_id || '—'}</div>
                <div className="text-muted-foreground">Customer ID</div>
                <div className="col-span-2 font-mono text-xs break-all">{selectedLog.customer_id || '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Details</div>
                <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap break-words">{selectedLog.details || '—'}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}