import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Send, UserPlus, Trash2, Mail, Loader2, Info } from 'lucide-react';
import { format } from 'date-fns';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { escapeHtml } from '@/lib/escapeHtml';

const ATTENDANCE = ['invited', 'confirmed', 'attended', 'absent'];

const statusClass = (s) => ({
  invited: 'bg-muted text-muted-foreground',
  confirmed: 'bg-chart-4/15 text-chart-4',
  attended: 'bg-accent/15 text-accent',
  absent: 'bg-destructive/15 text-destructive',
}[s] || 'bg-muted text-muted-foreground');

function buildSummonEmail({ training, customer, isPt }) {
  const title = escapeHtml(training.title || '');
  const customerName = escapeHtml(customer?.name || '');
  const topic = training.topic === 'other' ? (training.topic_other || '') : training.topic;
  const topicLabel = escapeHtml(topic || '');
  const date = training.scheduled_date ? format(new Date(training.scheduled_date), 'dd/MM/yyyy HH:mm') : '—';
  const modality = training.modality || '';
  const location = escapeHtml(training.location || '—');
  const trainer = escapeHtml(training.trainer || '—');
  const description = escapeHtml(training.description || '');
  const duration = training.duration_minutes ? `${training.duration_minutes} min` : '—';

  const greeting = isPt ? 'Caro/a colaborador/a,' : 'Dear collaborator,';
  const intro = isPt
    ? `É comeste e-mail que o/a convocamos para a sessão de formação em cibersegurança abaixo, no âmbito do programa de <strong>${customerName}</strong>.`
    : `You are hereby summoned to the cybersecurity training session below, as part of the <strong>${customerName}</strong> training program.`;
  const rows = [
    [isPt ? 'Formação' : 'Training', title],
    [isPt ? 'Tema' : 'Topic', topicLabel],
    [isPt ? 'Data e Hora' : 'Date & Time', date],
    [isPt ? 'Modalidade' : 'Modality', isPt ? ({ presential: 'Presencial', online: 'Online', hybrid: 'Híbrido' }[modality] || '—') : modality || '—'],
    [isPt ? 'Duração' : 'Duration', duration],
    [isPt ? 'Local / Ligação' : 'Location / Link', location],
    [isPt ? 'Formador' : 'Trainer', trainer],
  ];
  const detailRows = rows.map(([k, v]) => `
    <tr>
      <td style="padding:8px 12px;font-size:12px;color:#64748b;font-weight:600;width:35%;border-bottom:1px solid #e2e8f0;">${k}</td>
      <td style="padding:8px 12px;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0;">${v}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#1e3a5f;padding:24px 28px;">
          <div style="color:#ffffff;font-size:18px;font-weight:700;">${isPt ? 'Convocatória de Formação' : 'Training Summon'} — ${customerName}</div>
        </td></tr>
        <tr><td style="padding:24px 28px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0 0 8px;font-size:14px;color:#334155;">${greeting}</p>
          <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${intro}</p>
        </td></tr>
        <tr><td style="padding:0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${detailRows}</table>
        </td></tr>
        ${description ? `<tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;"><p style="margin:0;font-size:13px;color:#334155;line-height:1.6;">${description}</p></td></tr>` : ''}
        <tr><td style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#64748b;">${isPt ? 'Agradecemos a sua presença.' : 'We look forward to your attendance.'}<br><strong>${customerName}</strong></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export default function TrainingEnrollmentDialog({ open, onClose, training, customer }) {
  const { t, language } = useLanguage();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState([]);
  const [summoning, setSummoning] = useState(false);

  const enabled = !!training?.id;

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['training-enrollments', training?.id],
    queryFn: () => base44.entities.TrainingEnrollment.filter({ training_id: training.id }, '-created_date', 1000),
    enabled,
  });
  const { data: users = [] } = useQuery({
    queryKey: ['training-users', customer?.id],
    queryFn: () => base44.entities.TrainingUser.filter({ customer_id: customer.id }, '-created_date', 1000),
    enabled,
  });

  const enrolledUserIds = useMemo(() => new Set(enrollments.map(e => e.training_user_id)), [enrollments]);
  const available = users.filter(u => !enrolledUserIds.has(u.id) && u.status === 'active');

  const invalidate = () => {
    qc.invalidateQueries(['training-enrollments', training?.id]);
    qc.invalidateQueries(['training-enrollments-all', customer?.id]);
  };

  const handleAddSelected = async () => {
    if (selected.length === 0) return;
    const picks = users.filter(u => selected.includes(u.id));
    const payload = picks.map(u => ({
      training_id: training.id,
      training_title: training.title,
      training_user_id: u.id,
      customer_id: customer.id,
      customer_name: customer.name,
      user_name: u.full_name,
      user_email: u.email,
      user_position: u.position,
      user_department: u.department,
      attendance_status: 'invited',
      summoned: false,
    }));
    await base44.entities.TrainingEnrollment.bulkCreate(payload);
    invalidate();
    toast.success(t('training_enrollment_added', { count: payload.length }));
    setSelected([]);
    setShowAdd(false);
  };

  const handleRemove = async (enr) => {
    await base44.entities.TrainingEnrollment.delete(enr.id);
    invalidate();
  };

  const handleAttendance = async (enr, status) => {
    await base44.entities.TrainingEnrollment.update(enr.id, { attendance_status: status });
    invalidate();
  };

  const handleSummon = async () => {
    setSummoning(true);
    const isPt = language === 'pt';
    const html = buildSummonEmail({ training, customer, isPt });
    const subject = t('training_email_subject', { title: training.title });
    const targets = enrollments.filter(e => e.user_email);
    const results = await Promise.allSettled(targets.map(e =>
      base44.integrations.Core.SendEmail({ to: e.user_email, subject, body: html })
    ));
    let sent = 0;
    const sentIds = [];
    results.forEach((r, i) => { if (r.status === 'fulfilled') { sent++; sentIds.push(targets[i].id); } });
    if (sentIds.length) {
      await base44.entities.TrainingEnrollment.bulkUpdate(
        sentIds.map(id => ({ id, summoned: true, summoned_at: new Date().toISOString() }))
      );
    }
    invalidate();
    if (sent === targets.length) {
      toast.success(t('training_enrollment_summon_success', { count: sent }));
    } else if (sent > 0) {
      toast.warning(t('training_enrollment_summon_partial', { sent, total: targets.length }));
    } else {
      toast.error(t('training_enrollment_summon_error'));
    }
    setSummoning(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            {t('training_enrollment_title')}
          </DialogTitle>
          <DialogDescription>
            {training?.title} — {t('training_enrollment_subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 p-2.5 bg-primary/5 border border-primary/20 rounded-lg text-xs text-primary">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{t('training_email_note_registered')}</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 py-2">
          {isLoading ? (
            <LoadingState />
          ) : enrollments.length === 0 ? (
            <EmptyState icon={UserPlus} title={t('training_enrollment_empty')} />
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('training_form_name')}</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('training_col_department')}</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('training_enrollment_col_attendance')}</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">{t('training_enrollment_col_summoned')}</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map(enr => (
                    <tr key={enr.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <div className="font-medium truncate max-w-[180px]">{enr.user_name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[180px]">{enr.user_email}</div>
                      </td>
                      <td className="px-3 py-2 text-xs truncate max-w-[120px]">{enr.user_department || enr.user_position || '—'}</td>
                      <td className="px-3 py-2">
                        <Select value={enr.attendance_status} onValueChange={v => handleAttendance(enr, v)}>
                          <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ATTENDANCE.map(a => <SelectItem key={a} value={a}>{t(`training_enrollment_attendance_${a}`)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge className={enr.summoned ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'}>
                          {enr.summoned ? t('training_enrollment_summoned_yes') : t('training_enrollment_summoned_no')}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleRemove(enr)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showAdd && (
            <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground">{t('training_enrollment_select_users')}</p>
              {available.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('training_enrollment_no_roster')}</p>
              ) : (
                <>
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {available.map(u => (
                      <label key={u.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 cursor-pointer">
                        <Checkbox
                          checked={selected.includes(u.id)}
                          onCheckedChange={v => setSelected(s => v ? [...s, u.id] : s.filter(id => id !== u.id))}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{u.full_name}</div>
                          <div className="text-xs text-muted-foreground truncate">{u.position || ''}{u.department ? ` · ${u.department}` : ''} · {u.email}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => { setShowAdd(false); setSelected([]); }}>{t('common_cancel')}</Button>
                    <Button size="sm" onClick={handleAddSelected} disabled={selected.length === 0}>
                      {t('training_enrollment_add_selected')} ({selected.length})
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {!showAdd && (
            <Button variant="outline" className="gap-2 mr-auto" onClick={() => setShowAdd(true)}>
              <UserPlus className="w-4 h-4" /> {t('training_enrollment_add')}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>{t('common_cancel')}</Button>
          <Button onClick={handleSummon} disabled={summoning || enrollments.length === 0} className="gap-2">
            {summoning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {summoning ? t('training_enrollment_summoning') : t('training_enrollment_summon')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}