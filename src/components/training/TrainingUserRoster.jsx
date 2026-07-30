import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Upload, Pencil, Trash2, Users, FileText } from 'lucide-react';
import { exportTrainingReportPdf } from '@/lib/exportTrainingReportPdf';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import TrainingUserFormDialog from './TrainingUserFormDialog';
import TrainingUserExcelImportDialog from './TrainingUserExcelImportDialog';

export default function TrainingUserRoster({ customer }) {
  const { t, language } = useLanguage();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);

  const enabled = !!customer?.id;

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['training-users', customer?.id],
    queryFn: () => base44.entities.TrainingUser.filter({ customer_id: customer.id }, '-created_date', 1000),
    enabled,
  });
  const { data: enrollments = [] } = useQuery({
    queryKey: ['training-enrollments-all', customer?.id],
    queryFn: () => base44.entities.TrainingEnrollment.filter({ customer_id: customer.id }, '-created_date', 1000),
    enabled,
  });

  const { data: trainings = [] } = useQuery({
    queryKey: ['trainings', customer?.id],
    queryFn: () => base44.entities.Training.filter({ customer_id: customer.id }, '-scheduled_date', 1000),
    enabled,
  });

  const handleReport = (u) => {
    setGeneratingId(u.id);
    try {
      const userEnr = enrollments.filter(e => e.training_user_id === u.id);
      exportTrainingReportPdf(u, userEnr, trainings, customer, t, language);
    } finally {
      setGeneratingId(null);
    }
  };

  const countMap = useMemo(() => {
    const m = {};
    enrollments.forEach(e => { m[e.training_user_id] = (m[e.training_user_id] || 0) + 1; });
    return m;
  }, [enrollments]);

  const filtered = users.filter(u => !search ||
    `${u.full_name} ${u.position || ''} ${u.department || ''} ${u.email || ''}`.toLowerCase().includes(search.toLowerCase()));

  const handleSave = async (data) => {
    if (editing) {
      await base44.entities.TrainingUser.update(editing.id, data);
    } else {
      await base44.entities.TrainingUser.create(data);
    }
    qc.invalidateQueries(['training-users', customer.id]);
    qc.invalidateQueries(['training-enrollments-all', customer.id]);
    toast.success(t('training_user_saved'));
  };

  const handleImport = async (rows) => {
    const payload = rows.map(r => ({ ...r, customer_id: customer.id, customer_name: customer.name }));
    await base44.entities.TrainingUser.bulkCreate(payload);
    qc.invalidateQueries(['training-users', customer.id]);
    toast.success(t('training_import_success', { count: payload.length }));
  };

  const handleDelete = async () => {
    await base44.entities.TrainingUser.delete(deleteTarget.id);
    qc.invalidateQueries(['training-users', customer.id]);
    qc.invalidateQueries(['training-enrollments-all', customer.id]);
    toast.success(t('training_user_deleted'));
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('training_tab_users')}
        description={t('training_subtitle_users')}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4" /> {t('training_import_users')}
            </Button>
            <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <UserPlus className="w-4 h-4" /> {t('training_add_user')}
            </Button>
          </div>
        }
      />

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('training_form_name')} className="pl-9" />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title={t('training_no_users')} description={t('training_no_users_hint')} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('training_form_name')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('training_col_position')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('training_col_department')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('training_form_email')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('training_form_phone')}</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">{t('training_col_trainings')}</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium truncate max-w-[180px]">{u.full_name}</td>
                      <td className="px-4 py-3 truncate max-w-[140px]">{u.position || '—'}</td>
                      <td className="px-4 py-3 truncate max-w-[140px]">{u.department || '—'}</td>
                      <td className="px-4 py-3 truncate max-w-[180px]">{u.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{u.phone || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary">{countMap[u.id] || 0}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" title={t('training_report_generate')} onClick={() => handleReport(u)} disabled={generatingId === u.id}>
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(u); setFormOpen(true); }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(u)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <TrainingUserFormDialog open={formOpen} onOpenChange={setFormOpen} onSave={handleSave} customer={customer} editing={editing} />
      <TrainingUserExcelImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={handleImport} />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={v => !v && setDeleteTarget(null)}
        title={t('training_delete_user')}
        description={t('training_delete_user_confirm')}
        confirmLabel={t('common_delete')}
        cancelLabel={t('common_cancel')}
        onConfirm={handleDelete}
        destructive
      />
    </div>
  );
}