import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertOctagon, CheckCircle2, Circle, Clock, Sparkles, Send, ArrowRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import { writeAuditLog } from '@/lib/auditLog';
import { formatDateTime } from '@/lib/complianceUtils';
import { incidentCommunications, incidentPhases, nextIncidentAction, SENT_FIELDS } from '@/lib/incidentPlan';
import AiDraftDialog from '@/components/ai/AiDraftDialog';

const toLocal = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function Countdown({ due, sent, t }) {
  if (sent) return <Badge variant="outline" className="text-[10px] bg-chart-2/10 text-chart-2 border-chart-2/30"><CheckCircle2 className="w-3 h-3 mr-1" />{t('incplan_sent')}</Badge>;
  if (!due) return null;
  const ms = due.getTime() - Date.now();
  if (ms < 0) return <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30"><AlertOctagon className="w-3 h-3 mr-1" />{t('incplan_overdue')}</Badge>;
  const h = Math.floor(ms / 3600000);
  return <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/30"><Clock className="w-3 h-3 mr-1" />{h >= 48 ? `${Math.floor(h / 24)} d` : `${h} h`} {t('common_left')}</Badge>;
}

/**
 * Plano dinâmico e assistido de um incidente: fases da resposta, comunicações oficiais com o prazo legal de cada uma,
 * o conteúdo mínimo, a próxima ação e rascunhos com IA (função aiDraft, só textos oficiais) das notificações ao CNCS.
 * Marcar uma comunicação como enviada grava a hora no incidente e recalcula os prazos seguintes.
 */
export default function IncidentPlanDialog({ incident, open, onOpenChange, canUseAi, canEdit }) {
  const { t, language } = useLanguage();
  const qc = useQueryClient();
  const [inc, setInc] = useState(incident);
  const [sentAt, setSentAt] = useState({});
  const [aiKind, setAiKind] = useState(null);
  const [other, setOther] = useState({ authority: '', sent_at: '', reference: '' });
  React.useEffect(() => { setInc(incident); setSentAt({}); }, [incident]);

  const comms = useMemo(() => incidentCommunications(inc), [inc]);
  const phases = useMemo(() => incidentPhases(inc, comms), [inc, comms]);
  const next = useMemo(() => nextIncidentAction(inc), [inc]);
  const locale = language === 'pt' ? 'pt-PT' : 'en-GB';
  if (!inc) return null;

  const save = async (patch, auditText) => {
    try {
      const rec = await base44.entities.Incident.update(inc.id, patch);
      setInc(rec || { ...inc, ...patch });
      qc.invalidateQueries({ queryKey: ['incidents'] });
      await writeAuditLog({ action: 'incident_updated', entity_type: 'Incident', entity_id: inc.id, customer_id: inc.customer_id, details: auditText }).catch(() => null);
      toast.success(t('incplan_saved'));
    } catch (e) {
      toast.error(e?.message || t('common_save_failed'));
    }
  };

  const markSent = (c) => {
    const [flag, at] = SENT_FIELDS[c.id];
    const when = sentAt[c.id] ? new Date(sentAt[c.id]).toISOString() : new Date().toISOString();
    save({ [flag]: true, [at]: when }, `Plano do incidente: «${t(c.labelKey)}» marcada como enviada (${when})`);
  };
  const addOther = () => {
    if (!other.authority.trim()) return;
    const rec = { authority: other.authority.trim().slice(0, 120), sent_at: other.sent_at ? new Date(other.sent_at).toISOString() : new Date().toISOString(), reference: other.reference.trim().slice(0, 200) };
    save({ other_notifications: [...(inc.other_notifications || []), rec] }, `Plano do incidente: notificação a ${rec.authority} registada`);
    setOther({ authority: '', sent_at: '', reference: '' });
  };

  const nextText = next.type === 'communication'
    ? t(next.overdue ? 'incplan_next_overdue' : 'incplan_next_comm', { what: t(next.labelKey), when: formatDateTime(next.due.toISOString(), locale) })
    : next.type === 'record' ? t('incplan_next_record', { field: t(`incplan_field_${next.field}`), what: t(next.labelKey) })
      : next.type === 'phase' ? t('incplan_next_phase', { phase: t(`incplan_phase_${next.id}`) }) : t('incplan_next_done');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('incplan_title')} · {inc.title}</DialogTitle></DialogHeader>

        <div className={`rounded-lg border p-3 flex gap-2 text-sm ${next.overdue ? 'border-destructive/40 bg-destructive/10' : 'border-primary/30 bg-primary/5'}`}>
          <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
          <div><p className="font-semibold">{t('incplan_next')}</p><p>{nextText}</p>{next.ref && <p className="text-xs text-muted-foreground">{next.ref}</p>}</div>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t('incplan_phases')}</h3>
          <ol className="grid sm:grid-cols-3 gap-2">
            {phases.map((p, i) => (
              <li key={p.id} className={`rounded-md border p-2.5 text-xs space-y-1 ${p.current ? 'border-primary bg-primary/5' : ''}`}>
                <p className="flex items-center gap-1.5 font-medium">
                  {p.done ? <CheckCircle2 className="w-3.5 h-3.5 text-chart-2" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
                  {i + 1}. {t(`incplan_phase_${p.id}`)}
                </p>
                <p className="text-muted-foreground">{t(`incplan_phase_${p.id}_hint`)}</p>
                {p.ref && <p className="text-[10px] text-muted-foreground">{p.ref}</p>}
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t('incplan_comms')}</h3>
          {comms.map((c) => (
            <div key={c.id} className={`rounded-md border p-3 space-y-2 ${c.sent ? 'opacity-80' : ''}`}>
              <div className="flex items-start gap-2 flex-wrap">
                <div className="flex-1 min-w-[14rem]">
                  <p className="text-sm font-medium">{t(c.labelKey)} <span className="text-xs text-muted-foreground font-normal">→ {c.to}</span></p>
                  <p className="text-xs text-muted-foreground">
                    {c.ref}{c.mandatory ? '' : ` · ${c.onRequest ? t('incplan_on_request') : t('incplan_conditional')}`}
                    {c.due && ` · ${t('incplan_due')}: ${formatDateTime(c.due.toISOString(), locale)}`}
                    {!c.due && c.withoutDelay && ` · ${t('incplan_without_delay')}`}
                    {!c.due && c.waitingFor && ` · ${t('incplan_waiting', { field: t(`incplan_field_${c.waitingFor}`) })}`}
                    {c.sent && c.sentAt && ` · ${t('incplan_sent_at')}: ${formatDateTime(c.sentAt, locale)}`}
                  </p>
                  {c.conditionKey && <p className="text-xs text-muted-foreground italic">{t(c.conditionKey)}</p>}
                </div>
                <Countdown due={c.due} sent={c.sent} t={t} />
              </div>
              {c.content.length > 0 && !c.sent && (
                <ul className="text-xs list-disc pl-5 text-muted-foreground space-y-0.5">{c.content.map((x) => <li key={x}>{x}</li>)}</ul>
              )}
              {c.id === 'other_authorities' && (c.records || []).length > 0 && (
                <ul className="text-xs pl-5 list-disc">{c.records.map((r, i) => <li key={i}>{r.authority} · {formatDateTime(r.sent_at, locale)}{r.reference ? ` · ${r.reference}` : ''}</li>)}</ul>
              )}
              {canEdit && (
                <div className="flex items-center gap-2 flex-wrap">
                  {c.draftKind && canUseAi && !c.sent && (
                    <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setAiKind(c.draftKind)}><Sparkles className="w-3.5 h-3.5" />{t('incplan_draft')}</Button>
                  )}
                  {SENT_FIELDS[c.id] && !c.sent && (
                    <>
                      <Input type="datetime-local" className="h-7 w-48 text-xs" aria-label={t('incplan_sent_at')} value={sentAt[c.id] || ''} onChange={(e) => setSentAt((s) => ({ ...s, [c.id]: e.target.value }))} placeholder={toLocal(new Date())} />
                      <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => markSent(c)}><Send className="w-3.5 h-3.5" />{t('incplan_mark_sent')}</Button>
                    </>
                  )}
                  {c.id === 'other_authorities' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input className="h-7 w-40 text-xs" placeholder={t('incplan_other_authority')} value={other.authority} onChange={(e) => setOther((o) => ({ ...o, authority: e.target.value }))} />
                      <Input type="datetime-local" className="h-7 w-48 text-xs" aria-label={t('incplan_sent_at')} value={other.sent_at} onChange={(e) => setOther((o) => ({ ...o, sent_at: e.target.value }))} />
                      <Input className="h-7 w-36 text-xs" placeholder={t('incplan_other_reference')} value={other.reference} onChange={(e) => setOther((o) => ({ ...o, reference: e.target.value }))} />
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addOther} disabled={!other.authority.trim()}><Plus className="w-3.5 h-3.5" />{t('incplan_other_add')}</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">{t('incplan_note')}</p>
        </section>

        <AiDraftDialog open={aiKind !== null} onOpenChange={(v) => !v && setAiKind(null)} customerId={inc.customer_id}
          target={{ type: 'incident', id: inc.id }} kinds={aiKind ? [aiKind] : []} title={inc.title} />
      </DialogContent>
    </Dialog>
  );
}
