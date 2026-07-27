import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, Search, ClipboardCheck, MoreHorizontal, Trash2, Eye, Play, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import NewAssessmentDialog from '@/components/assessments/NewAssessmentDialog';
import BulkActionBar from '@/components/shared/BulkActionBar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { exportReportPdf } from '@/lib/exportReportPdf';
import { toast } from 'sonner';
import { writeAuditLog } from '@/lib/auditLog';

const statusStyles = {
  draft: 'bg-muted text-muted-foreground',
  in_progress: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  completed: 'bg-accent/10 text-accent border-accent/20',
  archived: 'bg-muted text-muted-foreground',
};

const assessmentStatusOptions = [
  { value: 'draft', labelKey: 'assessments_status_draft' },
  { value: 'in_progress', labelKey: 'assessments_status_in_progress' },
  { value: 'completed', labelKey: 'assessments_status_completed' },
  { value: 'archived', labelKey: 'assessments_status_archived' },
];

export default function Assessments() {
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [exportingId, setExportingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkStatusConfirm, setBulkStatusConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [isBulkAction, setIsBulkAction] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const canBulkAction = user?.role === 'admin' || user?.role === 'customer_admin';
  const customerId = user?.customer_id;

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ['assessments', user?.email, customerId],
    queryFn: () => isAdmin
      ? base44.entities.Assessment.list('-created_date')
      : base44.entities.Assessment.filter({ customer_id: customerId }, '-created_date'),
    enabled: isAdmin || !!customerId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Assessment.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assessments'] }),
  });

  const handleExport = async (a) => {
    setExportingId(a.id);
    const [recs, tasks] = await Promise.all([
      base44.entities.Recommendation.filter({ assessment_id: a.id }, '-created_date', 200),
      base44.entities.Task.filter({ customer_id: a.customer_id }, '-created_date', 200),
    ]);
    exportReportPdf(a, recs, tasks);
    setExportingId(null);
  };

  const filtered = assessments.filter(a =>
    a.title?.toLowerCase().includes(search.toLowerCase()) ||
    a.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const allFilteredSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const toggleSelectAll = () =>
    setSelectedIds(allFilteredSelected ? [] : filtered.map(a => a.id));

  const handleBulkStatus = (status) => {
    setPendingStatus(status);
    setBulkStatusConfirm(true);
  };

  const executeBulkStatus = async () => {
    setIsBulkAction(true);
    try {
      await base44.entities.Assessment.bulkUpdate(selectedIds.map(id => ({ id, status: pendingStatus })));
      await writeAuditLog({ action: 'assessment_completed', entity_type: 'Assessment', details: `Bulk updated ${selectedIds.length} assessments → status: ${pendingStatus}` });
      toast.success(`${selectedIds.length} ${t('bulk_updated')}`);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
    } catch {
      toast.error(t('bulk_error'));
    }
    setIsBulkAction(false);
    setBulkStatusConfirm(false);
    setPendingStatus(null);
  };

  const handleBulkDelete = async () => {
    setIsBulkAction(true);
    try {
      for (const id of selectedIds) {
        await base44.entities.Assessment.delete(id);
      }
      await writeAuditLog({ action: 'assessment_deleted', entity_type: 'Assessment', details: `Bulk deleted ${selectedIds.length} assessments` });
      toast.success(`${selectedIds.length} ${t('bulk_deleted')}`);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
    } catch {
      toast.error(t('bulk_error'));
    }
    setIsBulkAction(false);
    setBulkDeleteConfirm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{t('assessments_subtitle')}</p>
        {isAdmin && (
          <Button onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="w-4 h-4" /> {t('assessments_new')}
          </Button>
        )}
      </div>

      {isAdmin && <NewAssessmentDialog open={showNew} onOpenChange={setShowNew} />}

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b space-y-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('assessments_search_placeholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {canBulkAction && (
            <BulkActionBar
              selectedCount={selectedIds.length}
              statusOptions={assessmentStatusOptions}
              onBulkStatus={handleBulkStatus}
              onBulkDelete={isAdmin ? () => setBulkDeleteConfirm(true) : undefined}
              onClear={() => setSelectedIds([])}
              isProcessing={isBulkAction}
            />
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  {canBulkAction && (
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label={t('bulk_select_all')}
                  />
                  )}
                </TableHead>
                <TableHead>{t('assessments_col_assessment')}</TableHead>
                <TableHead>{t('assessments_col_customer')}</TableHead>
                <TableHead>{t('assessments_col_period')}</TableHead>
                <TableHead>{t('assessments_col_frameworks')}</TableHead>
                <TableHead>{t('assessments_col_score')}</TableHead>
                <TableHead>{t('assessments_col_status')}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t('common_loading')}</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {search ? t('assessments_no_results') : t('assessments_empty')}
                  </TableCell>
                </TableRow>
              ) : filtered.map(a => (
                <TableRow key={a.id} className="group cursor-pointer hover:bg-muted/30">
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {canBulkAction && (
                    <Checkbox
                      checked={selectedIds.includes(a.id)}
                      onCheckedChange={() => toggleSelect(a.id)}
                      aria-label="select"
                    />
                    )}
                  </TableCell>
                  <TableCell>
                    <Link to={`/assessments/${a.id}`} className="font-medium text-sm hover:text-primary transition-colors">
                      {a.title}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.created_date ? format(new Date(a.created_date), 'MMM d, yyyy') : ''}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{a.customer_name}</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">{a.period}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(a.frameworks || []).map(f => (
                        <Badge key={f} variant="outline" className="text-xs">{f.replace(/_/g, ' ')}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {a.overall_score != null ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm">{a.overall_score.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">/5</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs border", statusStyles[a.status])}>
                      {t('assessments_status_' + a.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/assessments/${a.id}`}>
                            {a.status === 'completed' ? <Eye className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                            {a.status === 'completed' ? t('assessments_view_results') : t('assessments_continue')}
                          </Link>
                        </DropdownMenuItem>
                        {a.status === 'completed' && (
                          <DropdownMenuItem
                            onClick={() => handleExport(a)}
                            disabled={exportingId === a.id}
                          >
                            {exportingId === a.id
                              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              : <FileDown className="w-4 h-4 mr-2" />}
                            {t('assessments_export_pdf')}
                          </DropdownMenuItem>
                        )}
                        {isAdmin && (
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(a.id)}>
                            <Trash2 className="w-4 h-4 mr-2" /> {t('common_delete')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={bulkDeleteConfirm} onOpenChange={(open) => !isBulkAction && setBulkDeleteConfirm(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('bulk_confirm_delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('bulk_confirm_delete_desc')} {selectedIds.length}? {t('bulk_cannot_undo')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel disabled={isBulkAction}>{t('common_cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={isBulkAction} className="gap-1.5">
              {isBulkAction && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('common_confirm')}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkStatusConfirm} onOpenChange={(open) => !isBulkAction && setBulkStatusConfirm(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('bulk_confirm_status_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('bulk_confirm_status_desc')} {selectedIds.length} {t('bulk_selected')} → {t('assessments_status_' + pendingStatus)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel disabled={isBulkAction}>{t('common_cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={executeBulkStatus} disabled={isBulkAction} className="gap-1.5">
              {isBulkAction && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('common_confirm')}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}