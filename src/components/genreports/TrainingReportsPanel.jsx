import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import TrainingReportEditDialog from '@/components/genreports/TrainingReportEditDialog';
import { Search, Download, Pencil, Trash2, FileText, GraduationCap } from 'lucide-react';
import { writeAuditLog } from '@/lib/auditLog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_KEY = {
  draft: 'genreports_status_draft',
  under_review: 'genreports_status_under_review',
  approved: 'genreports_status_approved',
  deprecated: 'genreports_status_deprecated',
};

const STATUS_CLASS = {
  draft: 'bg-muted text-muted-foreground border-border',
  under_review: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  approved: 'bg-accent/10 text-accent border-accent/20',
  deprecated: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function TrainingReportsPanel() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['training-reports'],
    queryFn: () => base44.entities.TrainingReport.list('-created_date', 200),
  });

  const filtered = reports.filter(r => {
    const ms = !search || `${r.user_name || ''} ${r.customer_name || ''} ${r.title || ''}`.toLowerCase().includes(search.toLowerCase());
    const st = statusFilter === 'all' || r.status === statusFilter;
    return ms && st;
  });

  const updateMut = useMutation({
    mutationFn: async ({ report, data }) => {
      await base44.entities.TrainingReport.update(report.id, data);
      await writeAuditLog({ action: 'document_updated', entity_type: 'TrainingReport', entity_id: report.id, details: `Edited training report: ${data.title}` });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training-reports'] });
      toast.success(t('treports_saved'));
      setEditing(null);
    },
    onError: (e) => toast.error(e?.message || 'Error'),
  });

  const deleteMut = useMutation({
    mutationFn: async (report) => {
      await base44.entities.TrainingReport.delete(report.id);
      await writeAuditLog({ action: 'data_deleted', entity_type: 'TrainingReport', entity_id: report.id, details: `Deleted training report: ${report.title}` });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training-reports'] });
      toast.success(t('treports_deleted'));
      setDeleting(null);
    },
    onError: (e) => toast.error(e?.message || 'Error'),
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-muted-foreground" />
              {t('settings_tab_reports')}
              <Badge variant="secondary" className="ml-1">{filtered.length}</Badge>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder={t('treports_search_placeholder')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-56"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('treports_filter_all')}</SelectItem>
                  <SelectItem value="draft">{t('genreports_status_draft')}</SelectItem>
                  <SelectItem value="under_review">{t('genreports_status_under_review')}</SelectItem>
                  <SelectItem value="approved">{t('genreports_status_approved')}</SelectItem>
                  <SelectItem value="deprecated">{t('genreports_status_deprecated')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState label={t('treports_loading')} className="h-40" />
          ) : filtered.length === 0 ? (
            <EmptyState compact icon={GraduationCap} title={t('treports_empty')} className="h-40" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('treports_col_user')}</TableHead>
                  <TableHead>{t('treports_col_customer')}</TableHead>
                  <TableHead>{t('treports_col_completion')}</TableHead>
                  <TableHead>{t('treports_col_status')}</TableHead>
                  <TableHead>{t('treports_col_generated')}</TableHead>
                  <TableHead className="text-right">{t('treports_col_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{r.user_name || r.title}</p>
                          {r.user_position && <p className="text-xs text-muted-foreground">{r.user_position}{r.user_department ? ` · ${r.user_department}` : ''}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.customer_name ? <Badge variant="outline" className="text-xs">{r.customer_name}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{r.completion_rate ?? 0}%</span>
                        <span className="text-xs text-muted-foreground">({r.completed_trainings ?? 0}/{r.total_trainings ?? 0})</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', STATUS_CLASS[r.status] || STATUS_CLASS.approved)}>
                        {t(STATUS_KEY[r.status] || 'genreports_status_approved')}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.created_date ? format(new Date(r.created_date), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" asChild title={t('treports_download_again')}>
                          <a href={r.file_url} target="_blank" rel="noopener noreferrer" download={r.file_name || undefined}><Download className="w-4 h-4" /></a>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(r)} title={t('treports_edit')}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleting(r)} title={t('treports_delete')}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TrainingReportEditDialog
        report={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={(report, data) => updateMut.mutate({ report, data })}
        saving={updateMut.isPending}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title={t('treports_delete_title')}
        description={<>{t('treports_delete_desc')} <strong>{deleting?.user_name || deleting?.title}</strong>? {t('treports_delete_undo')}</>}
        confirmLabel={t('common_delete')}
        cancelLabel={t('common_cancel')}
        onConfirm={() => deleteMut.mutate(deleting)}
        loading={deleteMut.isPending}
      />
    </>
  );
}