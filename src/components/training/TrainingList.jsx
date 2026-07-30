import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { CalendarPlus, Pencil, Trash2, Users, GraduationCap } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import TrainingFormDialog from './TrainingFormDialog';
import TrainingEnrollmentDialog from './TrainingEnrollmentDialog';

const statusClass = (s) => ({
  scheduled: 'bg-chart-4/15 text-chart-4',
  completed: 'bg-accent/15 text-accent',
  cancelled: 'bg-destructive/15 text-destructive',
}[s] || 'bg-muted text-muted-foreground');

export default function TrainingList({ customer }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [enrollmentTarget, setEnrollmentTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const enabled = !!customer?.id;

  const { data: trainings = [], isLoading } = useQuery({
    queryKey: ['trainings', customer?.id],
    queryFn: () => base44.entities.Training.filter({ customer_id: customer.id }, '-scheduled_date', 1000),
    enabled,
  });
  const { data: enrollments = [] } = useQuery({
    queryKey: ['training-enrollments-all', customer?.id],
    queryFn: () => base44.entities.TrainingEnrollment.filter({ customer_id: customer.id }, '-created_date', 1000),
    enabled,
  });

  const countMap = useMemo(() => {
    const m = {};
    enrollments.forEach(e => { m[e.training_id] = (m[e.training_id] || 0) + 1; });
    return m;
  }, [enrollments]);

  const handleSave = async (data) => {
    if (editing) {
      await base44.entities.Training.update(editing.id, data);
      toast.success(t('training_updated'));
    } else {
      await base44.entities.Training.create(data);
      toast.success(t('training_created'));
    }
    qc.invalidateQueries(['trainings', customer.id]);
  };

  const handleDelete = async () => {
    const id = deleteTarget.id;
    const rel = enrollments.filter(e => e.training_id === id);
    if (rel.length) await base44.entities.TrainingEnrollment.deleteMany({ training_id: id });
    await base44.entities.Training.delete(id);
    qc.invalidateQueries(['trainings', customer.id]);
    qc.invalidateQueries(['training-enrollments-all', customer.id]);
    toast.success(t('training_deleted'));
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('training_tab_trainings')}
        description={t('training_subtitle_trainings')}
        actions={
          <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <CalendarPlus className="w-4 h-4" /> {t('training_add_training')}
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : trainings.length === 0 ? (
        <EmptyState icon={GraduationCap} title={t('training_no_trainings')} description={t('training_no_trainings_hint')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {trainings.map(tr => (
            <Card key={tr.id} className="flex flex-col">
              <CardContent className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold truncate flex-1">{tr.title}</h3>
                  <Badge className={statusClass(tr.status)}>{t(`training_status_${tr.status}`)}</Badge>
                </div>
                <div className="space-y-1.5 text-sm text-muted-foreground flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{t(`training_topic_${tr.topic}`)}</Badge>
                    <Badge variant="outline" className="text-xs">{t(`training_modality_${tr.modality}`)}</Badge>
                  </div>
                  {tr.scheduled_date && (
                    <p className="text-xs">{format(new Date(tr.scheduled_date), 'dd MMM yyyy, HH:mm')}{tr.duration_minutes ? ` · ${tr.duration_minutes} min` : ''}</p>
                  )}
                  {tr.trainer && <p className="text-xs truncate">{tr.trainer}</p>}
                  {tr.location && <p className="text-xs truncate">{tr.location}</p>}
                  <p className="text-xs flex items-center gap-1 pt-1">
                    <Users className="w-3 h-3" /> {countMap[tr.id] || 0} {t('training_col_enrolled').toLowerCase()}
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-3 mt-2 border-t">
                  <Button size="sm" variant="default" className="flex-1 gap-2" onClick={() => setEnrollmentTarget(tr)}>
                    <Users className="w-4 h-4" /> {t('training_open_enrollments')}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(tr); setFormOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(tr)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TrainingFormDialog open={formOpen} onOpenChange={setFormOpen} onSave={handleSave} customer={customer} editing={editing} />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={v => !v && setDeleteTarget(null)}
        title={t('training_delete_training')}
        description={t('training_delete_training_confirm')}
        confirmLabel={t('common_delete')}
        cancelLabel={t('common_cancel')}
        onConfirm={handleDelete}
        destructive
      />
      {enrollmentTarget && (
        <TrainingEnrollmentDialog
          open={!!enrollmentTarget}
          onClose={() => setEnrollmentTarget(null)}
          training={enrollmentTarget}
          customer={customer}
        />
      )}
    </div>
  );
}