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
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import GeneratedReportEditDialog from '@/components/genreports/GeneratedReportEditDialog';
import { FileText, Download, Pencil, Trash2, Search, FileBarChart } from 'lucide-react';
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

function periodOf(report) {
  const tag = (report.tags || []).find(tg => tg.startsWith('monthly_snapshot_'));
  if (tag) return tag.replace('monthly_snapshot_', '');
  return report.created_date ? format(new Date(report.created_date), 'yyyy-MM') : '—';
}

export default function GeneratedReports() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['generated-reports'],
    queryFn: () => base44.entities.SecurityDocument.filter(
      { tags: { $in: ['monthly_snapshot', 'annual_report', 'automated'] } },
      '-created_date', 200
    ),
  });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });

  const filtered = reports.filter(r => {
    const ms = !search || (r.title || '').toLowerCase().includes(search.toLowerCase());
    const st = statusFilter === 'all' || r.status === statusFilter;
    return ms && st;
  });

  const updateMut = useMutation({
    mutationFn: async ({ report, data }) => {
      await base44.entities.SecurityDocument.update(report.id, data);
      await writeAuditLog({ action: 'document_updated', entity_type: 'SecurityDocument', entity_id: report.id, details: `Edited generated report: ${data.title}` });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['generated-reports'] });
      toast.success(t('genreports_saved'));
      setEditing(null);
    },
    onError: (e) => toast.error(e?.message || 'Error'),
  });

  const deleteMut = useMutation({
    mutationFn: async (report) => {
      await base44.entities.SecurityDocument.delete(report.id);
      await writeAuditLog({ action: 'data_deleted', entity_type: 'SecurityDocument', entity_id: report.id, details: `Deleted generated report: ${report.title}` });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['generated-reports'] });
      toast.success(t('genreports_deleted'));
      setDeleting(null);
    },
    onError: (e) => toast.error(e?.message || 'Error'),
  });

  return (
    <div className="space-y-6">
      <PageHeader description={t('genreports_subtitle')} />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileBarChart className="w-4 h-4 text-muted-foreground" />
              {t('nav_generated_reports')}
              <Badge variant="secondary" className="ml-1">{filtered.length}</Badge>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder={t('genreports_search_placeholder')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-56"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('genreports_filter_all')}</SelectItem>
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
            <LoadingState label={t('genreports_loading')} className="h-40" />
          ) : filtered.length === 0 ? (
            <EmptyState compact icon={FileBarChart} title={t('genreports_empty')} className="h-40" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('genreports_col_title')}</TableHead>
                  <TableHead>{t('genreports_col_customer')}</TableHead>
                  <TableHead>{t('genreports_col_period')}</TableHead>
                  <TableHead>{t('genreports_col_status')}</TableHead>
                  <TableHead>{t('genreports_col_generated')}</TableHead>
                  <TableHead className="text-right">{t('genreports_col_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{r.title}</p>
                          {r.description && <p className="text-xs text-muted-foreground line-clamp-1">{r.description}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.customer_name
                        ? <Badge variant="outline" className="text-xs">{r.customer_name}</Badge>
                        : <span className="text-xs text-muted-foreground italic">{t('genreports_no_customer')}</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{periodOf(r)}</TableCell>
                    <TableCell>
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', STATUS_CLASS[r.status] || STATUS_CLASS.draft)}>
                        {t(STATUS_KEY[r.status] || 'genreports_status_draft')}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.created_date ? format(new Date(r.created_date), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" asChild title={t('genreports_view')}>
                          <a href={r.file_url} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4" /></a>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(r)} title={t('genreports_edit')}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleting(r)} title={t('genreports_delete')}>
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

      <GeneratedReportEditDialog
        report={editing}
        customers={customers}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={(report, data) => updateMut.mutate({ report, data })}
        saving={updateMut.isPending}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title={t('genreports_delete_title')}
        description={<>{t('genreports_delete_desc')} <strong>{deleting?.title}</strong>? {t('genreports_delete_undo')}</>}
        confirmLabel={t('common_delete')}
        cancelLabel={t('common_cancel')}
        onConfirm={() => deleteMut.mutate(deleting)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}