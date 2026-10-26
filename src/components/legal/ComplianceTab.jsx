import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Download } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { loadLegal, applicableMeasures, applicableEprMeasures } from '@/lib/legal';
import { LevelBadge, Loading, downloadCsv, useLegalData } from './shared';
import EvidencePanel, { useCustomerEvidence, evidenceSummary } from '@/components/evidence/EvidencePanel';
import { linkKey } from '@/lib/evidence';
import { useLicense, hasModule } from '@/lib/licensing';
import { MEASURE_KINDS } from '@/lib/ai';
import AiDraftDialog from '@/components/ai/AiDraftDialog';
import { Sparkles } from 'lucide-react';

export const CHECKLIST_FRAMEWORK = 'RJC_MEDIDAS_MINIMAS';
const STATUSES = ['pending', 'in_progress', 'done', 'not_applicable'];
const STATUS_STYLE = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
  done: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
  not_applicable: 'bg-muted text-muted-foreground line-through',
};

const EV_BADGE = {
  valid: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
  pending: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
  expired: 'bg-destructive/10 text-destructive border-destructive/30',
  rejected: 'bg-muted text-muted-foreground',
};

function MeasureRow({ m, record, onSave, canEdit, evState, tools = [], customerId, provider, onAi }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ owner: record?.owner || '', due_date: record?.due_date || '', notes: record?.notes || '' });
  // O registo pode chegar depois da primeira renderização (consultas separadas) ou mudar após gravar.
  useEffect(() => {
    setDraft({ owner: record?.owner || '', due_date: record?.due_date || '', notes: record?.notes || '' });
  }, [record?.id, record?.owner, record?.due_date, record?.notes]);
  const status = record?.status || 'pending';
  const code = m.control ? m.control.id : m.code;
  // Título simples: a frase do controlo (Anexo I) ou a área da medida (Anexo IV). O texto completo da medida
  // (Anexo III/IV) fica no detalhe; a «verificação» oficial diz o que guardar como evidência.
  const title = m.control ? m.control.statement : m.area;
  const basis = m.control ? `Reg. 756/2026, Anexo III — ${m.control.id}` : `Reg. 756/2026, Anexo IV — ${m.code}`;
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-start gap-2 flex-wrap">
        <span className="font-mono text-xs font-semibold text-primary">{code}</span>
        {m.level && <LevelBadge level={m.level} />}
        {m.group && <Badge variant="outline" className="text-[11px]">{t('legal_epr_group')} {m.group}</Badge>}
        <p className="text-sm font-medium flex-1 min-w-[12rem]">{title}</p>
        {evState && <Badge variant="outline" className={`text-[10px] ${EV_BADGE[evState]}`}>{t(`ev_badge_${evState}`)}</Badge>}
        {onAi && <Button type="button" size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => onAi(m)} title={t('ai_measure_button')}><Sparkles className="w-3.5 h-3.5 mr-1" />{t('ai_short')}</Button>}
        <Select value={status} onValueChange={(v) => onSave({ status: v })} disabled={!canEdit}>
          <SelectTrigger className={`h-7 w-40 text-xs ${STATUS_STYLE[status]}`}><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`legal_comp_status_${s}`)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {m.verification && <p className="text-xs"><span className="font-medium">{t('x_measure_expected')}:</span> {m.verification}</p>}
      <p className="text-[11px] text-muted-foreground">{basis}</p>
      <button type="button" className="text-xs text-primary hover:underline" onClick={() => setOpen((v) => !v)}>
        {open ? '−' : '+'} {t('x_measure_official')} · {t('legal_comp_owner')} · {t('legal_comp_notes')}
      </button>
      {open && (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{t('x_measure_official')}:</span> {m.measure}</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <Input value={draft.owner} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} placeholder={t('legal_comp_owner')} />
            <Input type="date" value={draft.due_date} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
          </div>
          <Textarea rows={2} value={draft.notes} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder={t('legal_comp_notes')} />
          <div className="flex gap-2">
            {canEdit && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSave(draft)}>{t('common_save')}</Button>}
            {onAi && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAi(m)}><Sparkles className="w-3.5 h-3.5 mr-1" />{t('ai_measure_button')}</Button>}
          </div>
          {tools.length > 0 && (
            <p className="text-xs"><span className="font-medium">{t('tl_covering')}:</span> {tools.map((c) => `${c.product}${c.vendor ? ` (${c.vendor})` : ''}`).join(' · ')}</p>
          )}
          <EvidencePanel customerId={customerId} provider={provider} canUpload={canEdit}
            links={[{ type: 'measure', id: m.key, ref: code, label: `${code}${m.level ? ` · ${m.level}` : ''} — ${title}`.slice(0, 160) }]} />
        </div>
      )}
    </div>
  );
}

export default function ComplianceTab() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const canEdit = user?.role === 'admin' || user?.role === 'customer_admin';
  const [selected, setSelected] = useState(null);
  const customerId = isAdmin ? selected : user?.customer_id;

  const { data: customers = [] } = useQuery({
    queryKey: ['legal-customers'],
    queryFn: () => base44.entities.Customer.list('name', 500),
    enabled: isAdmin,
  });
  const { data: customer } = useQuery({
    queryKey: ['legal-customer', customerId],
    queryFn: () => base44.entities.Customer.get(customerId),
    enabled: Boolean(customerId),
  });
  const { data: records = [] } = useQuery({
    queryKey: ['legal-checklist', customerId],
    queryFn: () => base44.entities.ComplianceChecklist.filter({ customer_id: customerId, framework: CHECKLIST_FRAMEWORK }, 'task_order', 2000),
    enabled: Boolean(customerId),
  });
  const { data: evidence = [] } = useCustomerEvidence(customerId);
  const { data: license } = useLicense(isAdmin ? customerId : undefined);
  const aiAllowed = canEdit && hasModule(license, user, 'ai_assistant');
  const [aiMeasure, setAiMeasure] = useState(null);
  const evByKey = useMemo(() => evidenceSummary(evidence), [evidence]);
  const { data: components = [] } = useQuery({
    queryKey: ['components', customerId],
    queryFn: () => base44.entities.Component.filter({ customer_id: customerId }, 'category', 500),
    enabled: Boolean(customerId) && canEdit,
  });
  const toolsByControl = useMemo(() => {
    const out = {};
    for (const c of components) if (c.status !== 'retired') for (const id of c.qnrcs_controls || []) (out[id] ||= []).push(c);
    return out;
  }, [components]);
  const { data: qnrcs, loading: l1 } = useLegalData(loadLegal, 'qnrcs');
  const { data: epr, loading: l2 } = useLegalData(loadLegal, 'epr');

  const measures = useMemo(() => {
    if (!customer) return [];
    if (['essencial', 'importante'].includes(customer.rjc_qualification) && customer.conformity_level) return applicableMeasures(qnrcs, customer.conformity_level);
    if (customer.rjc_qualification === 'publica_relevante' && customer.epr_group) return applicableEprMeasures(epr, customer.epr_group);
    return [];
  }, [customer, qnrcs, epr]);

  const byKey = useMemo(() => Object.fromEntries(records.map((r) => [r.requirement_id, r])), [records]);
  const applicable = measures.filter((m) => byKey[m.key]?.status !== 'not_applicable');
  const done = applicable.filter((m) => byKey[m.key]?.status === 'done').length;
  const pct = applicable.length ? Math.round((done / applicable.length) * 100) : 0;

  const byObjective = useMemo(() => {
    if (!measures[0]?.control) return [];
    const groups = {};
    for (const m of measures) {
      const o = m.control.objective;
      groups[o.code] ||= { code: o.code, name: o.name, total: 0, done: 0 };
      if (byKey[m.key]?.status === 'not_applicable') continue;
      groups[o.code].total += 1;
      if (byKey[m.key]?.status === 'done') groups[o.code].done += 1;
    }
    return Object.values(groups);
  }, [measures, byKey]);

  const save = async (m, index, patch) => {
    const existing = byKey[m.key];
    try {
      if (existing) {
        await base44.entities.ComplianceChecklist.update(existing.id, patch);
      } else {
        await base44.entities.ComplianceChecklist.create({
          customer_id: customer.id, customer_name: customer.name, framework: CHECKLIST_FRAMEWORK,
          section: m.control ? `${m.control.objective.code} — ${m.control.objective.name}` : `${t('legal_epr_group')} ${m.group}`,
          section_order: m.control ? m.control.objective.number : (m.group === 'B' ? 1 : 2),
          task_text: m.control ? m.control.statement : m.area, task_order: index, requirement_id: m.key,
          requirement_ref: m.control ? `Reg. 756/2026, Anexo III — ${m.control.id}` : `Reg. 756/2026, Anexo IV — ${m.code}`,
          level: m.level || `grupo_${m.group}`, status: 'pending', ...patch,
        });
      }
      qc.invalidateQueries({ queryKey: ['legal-checklist', customerId] });
      toast.success(t('legal_comp_saved'));
    } catch (e) {
      toast.error(e?.message || 'Erro');
    }
  };

  const exportCsv = () => downloadCsv(`conformidade-${customer?.name || 'cliente'}.csv`,
    ['Código', 'Nível/Grupo', t('legal_measure'), t('legal_verification'), 'Estado', t('legal_comp_owner'), t('legal_comp_due'), t('legal_comp_notes')],
    measures.map((m) => {
      const r = byKey[m.key] || {};
      return [m.control ? m.control.id : m.code, m.level ? t(`legal_level_${m.level}`) : `Grupo ${m.group}`, m.measure, m.verification,
        t(`legal_comp_status_${r.status || 'pending'}`), r.owner || '', r.due_date || '', r.notes || ''];
    }));

  if (l1 || l2) return <Loading />;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <Select value={selected || ''} onValueChange={setSelected}>
          <SelectTrigger className="sm:w-80"><SelectValue placeholder={t('legal_comp_select_customer')} /></SelectTrigger>
          <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      )}

      {customer && (
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <p className="font-semibold">{customer.name}</p>
            <Badge variant="outline">{t(`legal_q_${customer.rjc_qualification || 'por_determinar'}`)}</Badge>
            {customer.conformity_level && <LevelBadge level={customer.conformity_level} />}
            {customer.epr_group && <Badge variant="outline">{t('legal_epr_group')} {customer.epr_group}</Badge>}
            {customer.dora_applicable && <Badge variant="outline">DORA</Badge>}
            {customer.tisax_applicable && <Badge variant="outline">TISAX</Badge>}
            {isAdmin && <Link to="/customers" className="ml-auto text-xs text-primary hover:underline">{t('legal_comp_edit_customer')}</Link>}
          </CardContent>
        </Card>
      )}

      {customer && customer.rjc_qualification === 'nao_abrangida' && (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">{t('legal_comp_out_of_scope')}</CardContent></Card>
      )}
      {customer && measures.length === 0 && customer.rjc_qualification !== 'nao_abrangida' && (
        <Card><CardContent className="p-4 text-sm flex gap-2"><AlertTriangle className="w-4 h-4 text-chart-3 flex-shrink-0 mt-0.5" />{t('legal_comp_not_qualified')}</CardContent></Card>
      )}

      {measures.length > 0 && (
        <>
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-base">{t('legal_comp_progress')}: {pct}%</CardTitle>
              <Button size="sm" variant="outline" className="gap-2" onClick={exportCsv}><Download className="w-4 h-4" /> {t('legal_export_csv')}</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={pct} />
              <p className="text-xs text-muted-foreground">{done} / {applicable.length} · {t('legal_measures_total', { count: measures.length })}</p>
              {byObjective.length > 0 && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                  {byObjective.map((g) => (
                    <div key={g.code} className="space-y-1">
                      <div className="flex justify-between text-xs"><span>{g.code} — {g.name}</span><span>{g.done}/{g.total}</span></div>
                      <Progress value={g.total ? (g.done / g.total) * 100 : 0} className="h-1.5" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="space-y-2">
            {measures.map((m, i) => (
              <MeasureRow key={m.key} m={m} record={byKey[m.key]} canEdit={canEdit} onSave={(patch) => save(m, i, patch)}
                evState={evByKey[linkKey('measure', m.key)]} tools={m.control ? toolsByControl[m.control.id] || [] : []}
                customerId={customerId} provider={customer?.storage_provider} onAi={aiAllowed ? setAiMeasure : undefined} />
            ))}
          </div>
        </>
      )}
      <AiDraftDialog open={aiMeasure !== null} onOpenChange={(v) => !v && setAiMeasure(null)} customerId={customerId}
        target={aiMeasure ? { type: 'measure', key: aiMeasure.key } : null} kinds={MEASURE_KINDS}
        title={aiMeasure ? `${t('ai_title')} — ${aiMeasure.control ? aiMeasure.control.id : aiMeasure.code}` : ''} />
    </div>
  );
}
