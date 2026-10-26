import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, Download, Loader2, Scale, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { writeAuditLog } from '@/lib/auditLog';
import { uploadEvidence } from '@/lib/evidence';
import { loadLegal, getInstrument, LEVELS } from '@/lib/legal';
import {
  qualify, annexRows, entityTypeFlags, rjcSizeCategory, reg756SizeClass, sizeThresholds,
  buildJourneyRecords, journeyUpdates, findScopeItem, PUBLIC_KINDS,
} from '@/lib/legal/qualification';
import { JOURNEY_FRAMEWORK, JOURNEY_TEMPLATE_PT, JOURNEY_TEMPLATE_EN } from '@/lib/legal/journeyTemplate';
import { onboardingPt } from '@/lib/translations-onboarding';
import { legalPt } from '@/lib/translations-legal';

/**
 * Assistente de enquadramento (RJC / Reg. 756/2026).
 * Passos: atividade → tipo de entidade e estabelecimento → dimensão → casos especiais → entidade pública →
 * prazos e CNCS → resultado. Ao confirmar: atualiza no cliente apenas os campos determinados (só o admin pode
 * alterar o cliente), prepara/atualiza a jornada RJC_2026 e guarda o relatório em PDF como evidência.
 */

const STEPS = ['activity', 'entity', 'size', 'special', 'public', 'cncs', 'summary'];
const STEP_LABEL = { activity: 'qw_step_activity', entity: 'qw_step_entity', size: 'qw_step_size', special: 'qw_step_special', public: 'qw_step_public', cncs: 'qw_step_cncs', summary: 'qw_step_summary' };
const NONE = '__none__';
const QUALS = ['essencial', 'importante', 'publica_relevante', 'nao_abrangida'];
const SIZE_KEYS = { grande: 'qw_cat_grande', media: 'qw_cat_media', pequena: 'qw_cat_pequena', micro: 'qw_cat_micro' };

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso || '—');
const fmtNum = (v) => (typeof v === 'number' ? v.toLocaleString('pt-PT') : v);
const interpolate = (str, params) => (params ? String(str).replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`)) : String(str));

/** Formata os parâmetros de uma razão ou ponto em aberto (números, datas e qualificações). */
function fmtParams(params, label) {
  if (!params) return params;
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    if (k === 'computed') out[k] = label(`legal_q_${v}`);
    else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) out[k] = fmtDate(v);
    else out[k] = fmtNum(v);
  }
  return out;
}
const msg = (tr, item) => tr(item.key, fmtParams({ ...(item.params || {}), ...(item.value && typeof item.value === 'string' ? { value: item.value } : {}) }, tr));

function initialAnswers(c = {}) {
  const notified = Boolean(c.cncs_qualification_date) && QUALS.includes(c.rjc_qualification);
  return {
    annex: c.rjc_annex || '', sector: c.rjc_sector || '', subsector: c.rjc_subsector || null, entity_type: c.rjc_entity_type || '',
    other_activities: false,
    establishment: 'pt', main_establishment_pt: null, representative_pt: null, provides_in_pt: null,
    employees: '', turnover: '', balance: '', in_group: false,
    qualified_trust: null, cer_critical: false, sole_provider: false, public_safety: false, systemic_risk: false, national_critical: false,
    excluded_art37: false, higher_education: c.sector === 'education' ? null : false,
    is_public: c.sector === 'public_administration', public_kind: '', ict_mission: false, high_digital: false, education_assessment: false,
    already_active: true, activity_start: '', platform_date: '', self_identified_date: c.cncs_self_identification_date || '',
    cncs_qualification: notified ? c.rjc_qualification : '', cncs_epr_group: notified ? (c.epr_group || '') : '',
    cncs_level: notified ? (c.conformity_level || '') : '', cncs_date: c.cncs_qualification_date || '',
  };
}

/** Campos do cliente a atualizar: só o que o assistente determinou (e as datas indicadas). */
export function customerPatch(result, answers) {
  const p = {};
  for (const f of result.determined) p[f] = result[f] ?? '';
  if (result.determined.includes('rjc_qualification')) {
    if (result.rjc_qualification !== 'publica_relevante') p.epr_group = '';
    if (!['essencial', 'importante'].includes(result.rjc_qualification)) p.conformity_level = '';
  }
  if (answers.self_identified_date) p.cncs_self_identification_date = answers.self_identified_date;
  if (answers.cncs_qualification && answers.cncs_date) p.cncs_qualification_date = answers.cncs_date;
  const n = Number(answers.employees);
  if (answers.employees !== '' && Number.isFinite(n)) p.num_employees = n <= 50 ? '1-50' : n <= 250 ? '51-250' : n <= 1000 ? '251-1000' : n <= 5000 ? '1001-5000' : '5000+';
  return p;
}

/** Pares pergunta → resposta para o relatório (apenas o que foi respondido). */
function answerLines(a, tr) {
  const yn = (v) => (v === true ? tr('qw_yes') : v === false ? tr('qw_no') : tr('qw_unknown'));
  const L = [];
  if (a.annex === 'none') L.push([tr('qw_step_activity'), tr('qw_none_activity')]);
  else if (a.annex) {
    L.push([tr('qw_step_activity'), `Anexo ${a.annex} — ${a.sector}${a.subsector ? ` › ${a.subsector}` : ''}`]);
    L.push([tr('qw_entity_selected'), a.entity_type]);
    const f = entityTypeFlags(a.entity_type);
    L.push([tr('qw_establishment'), tr({ pt: 'qw_est_pt', ue_outro: 'qw_est_ue', fora_ue: 'qw_est_fora' }[a.establishment] || 'qw_unknown')]);
    if (f.mainEstablishment && a.establishment !== 'fora_ue') L.push([tr('qw_main_est'), yn(a.main_establishment_pt)]);
    if (f.mainEstablishment && a.establishment === 'fora_ue') L.push([tr('qw_representative'), yn(a.representative_pt)]);
    if (f.comms) L.push([tr('qw_provides_pt'), yn(a.provides_in_pt)]);
    L.push([tr('qw_other_activities'), yn(a.other_activities)]);
    if (f.trust) L.push([tr('qw_qualified_trust'), yn(a.qualified_trust)]);
  }
  L.push([tr('qw_employees'), a.employees === '' ? '—' : fmtNum(Number(a.employees))]);
  L.push([tr('qw_turnover'), a.turnover === '' ? '—' : fmtNum(Number(a.turnover))]);
  L.push([tr('qw_balance'), a.balance === '' ? '—' : fmtNum(Number(a.balance))]);
  L.push([tr('qw_in_group'), yn(a.in_group)]);
  for (const k of ['cer', 'sole_provider', 'public_safety', 'systemic', 'national_critical', 'excluded37', 'higher_ed']) {
    const field = { cer: 'cer_critical', systemic: 'systemic_risk', excluded37: 'excluded_art37', higher_ed: 'higher_education' }[k] || k;
    L.push([tr(`qw_${k}`), yn(a[field])]);
  }
  L.push([tr('qw_is_public'), yn(a.is_public)]);
  if (a.is_public) {
    L.push([tr('qw_public_kind'), a.public_kind ? tr(`qw_pk_${a.public_kind}`) : '—']);
    for (const k of ['ict_mission', 'high_digital', 'education_assessment']) L.push([tr(`qw_${k}`), yn(a[k])]);
  }
  L.push([tr('qw_already_active', { date: fmtDate(getInstrument('dl125')?.valid_from) }), yn(a.already_active)]);
  if (a.already_active === false) L.push([tr('qw_activity_start'), fmtDate(a.activity_start)]);
  else L.push([tr('qw_platform_date'), fmtDate(a.platform_date)]);
  if (a.self_identified_date) L.push([tr('qw_self_id_date'), fmtDate(a.self_identified_date)]);
  if (a.cncs_qualification) {
    L.push([tr('qw_cncs_qualification'), tr(`legal_q_${a.cncs_qualification}`)]);
    if (a.cncs_epr_group) L.push([tr('qw_cncs_group'), a.cncs_epr_group]);
    if (a.cncs_level) L.push([tr('qw_cncs_level'), tr(`legal_level_${a.cncs_level}`)]);
    if (a.cncs_date) L.push([tr('qw_cncs_date'), fmtDate(a.cncs_date)]);
  }
  return L;
}

// Os tipos de letra base do jsPDF usam a codificação WinAnsi: substituir os poucos símbolos fora dela.
const pdfText = (s) => String(s ?? '').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/→/g, '->').replace(/[  ]/g, ' ');

/** Relatório de enquadramento em PDF (sempre em português — documento para o processo junto do CNCS). */
export function buildQualificationPdf({ customer, answers, result, author, date }) {
  const tr = (key, params) => interpolate(onboardingPt[key] ?? legalPt[key] ?? key, params);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 18; const W = 210 - 2 * M; let y = 0;
  const ensure = (h) => { if (y + h > 280) { doc.addPage(); y = 20; } };
  const text = (s, { size = 10, bold = false, color = [30, 35, 50], indent = 0, gap = 1.5 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    for (const line of doc.splitTextToSize(pdfText(s), W - indent)) { ensure(size * 0.45); doc.text(line, M + indent, y); y += size * 0.45; }
    y += gap;
  };
  const heading = (s) => { y += 3; ensure(10); doc.setDrawColor(220, 225, 235); doc.line(M, y, M + W, y); y += 6; text(s, { size: 12, bold: true, color: [20, 30, 60] }); };

  doc.setFillColor(20, 30, 60); doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(pdfText(tr('qw_pdf_title')), M, 14);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(pdfText(tr('qw_pdf_subtitle')), M, 21);
  y = 40;
  text(`${tr('qw_pdf_org')}: ${customer?.name || '—'}`, { bold: true, size: 11 });
  text(`${tr('qw_pdf_nif')}: ${customer?.nif || '—'}    ${tr('qw_pdf_date')}: ${fmtDate(date)}    ${tr('qw_pdf_author')}: ${author || '—'}`);

  heading(tr('qw_result'));
  text(`${tr('legal_profile_qualification')}: ${tr(`legal_q_${result.rjc_qualification}`)}`, { bold: true, size: 11 });
  if (result.epr_group) text(`${tr('legal_epr_group')}: ${result.epr_group}`);
  if (['essencial', 'importante'].includes(result.rjc_qualification)) text(result.conformity_level ? `${tr('legal_conformity_level')}: ${tr(`legal_level_${result.conformity_level}`)}` : tr('qw_level_pending'));
  if (result.rjc_annex) text(`Anexo ${result.rjc_annex} — ${result.rjc_sector}${result.rjc_subsector ? ` › ${result.rjc_subsector}` : ''}: ${result.rjc_entity_type}`);
  if (result.rjc_size) text(`${tr('qw_size_rjc_label')}: ${tr(SIZE_KEYS[result.rjc_size])}`);
  if (result.entity_size) text(`${tr('qw_size_756_label')}: ${tr(SIZE_KEYS[result.entity_size])}`);
  text(`${tr('qw_deadline')}: ${result.deadline ? msg(tr, { key: result.deadline.key, params: { date: result.deadline.date, from: result.deadline.from } }) + ` [${result.deadline.basis}]` : tr('qw_no_deadline')}`);

  heading(tr('qw_reasons'));
  for (const r of result.reasons) { text(`• ${msg(tr, r)}`, { gap: 0.5 }); text(`${tr('qw_basis')}: ${r.basis}`, { size: 8.5, color: [100, 110, 130], indent: 4 }); }

  if (result.open_points.length) {
    heading(tr('qw_open_points'));
    text(tr('qw_open_points_help'), { size: 9, color: [100, 110, 130] });
    for (const o of result.open_points) { text(`• ${msg(tr, o)}`, { gap: 0.5 }); text(`${tr('qw_basis')}: ${o.basis}`, { size: 8.5, color: [100, 110, 130], indent: 4 }); }
  }

  heading(tr('qw_pdf_answers'));
  for (const [q, a] of answerLines(answers, tr)) { text(q, { size: 9, color: [100, 110, 130], gap: 0.3 }); text(a || '—', { indent: 4 }); }

  y += 4; text(tr('qw_disclaimer'), { size: 8.5, color: [100, 110, 130] });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(140, 145, 160);
    doc.text(pdfText(`${customer?.name || ''} · ${tr('qw_pdf_title')} · ${fmtDate(date)}`), M, 290);
    doc.text(pdfText(tr('qw_pdf_page', { n: i, total: pages })), 210 - M, 290, { align: 'right' });
  }
  return doc.output('blob');
}

function YesNo({ value, onChange, allowUnknown = true }) {
  const { t } = useLanguage();
  const opts = [[true, 'qw_yes'], [false, 'qw_no'], ...(allowUnknown ? [[null, 'qw_unknown']] : [])];
  return (
    <div className="flex gap-1.5 shrink-0">
      {opts.map(([v, k]) => (
        <Button key={k} type="button" size="sm" variant={value === v ? 'default' : 'outline'} className="h-7 px-2.5 text-xs" onClick={() => onChange(v)}>{t(k)}</Button>
      ))}
    </div>
  );
}

function Question({ label, basis, children, help }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 rounded-md border p-3">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm">{label}</p>
        {help && <p className="text-xs text-muted-foreground">{help}</p>}
        {basis && <p className="text-[11px] text-muted-foreground font-mono">{basis}</p>}
      </div>
      {children}
    </div>
  );
}

function CheckLine({ checked, onChange, label, basis }) {
  return (
    <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30">
      <Checkbox checked={Boolean(checked)} onCheckedChange={(v) => onChange(Boolean(v))} className="mt-0.5" />
      <span className="space-y-0.5">
        <span className="block text-sm">{label}</span>
        {basis && <span className="block text-[11px] text-muted-foreground font-mono">{basis}</span>}
      </span>
    </label>
  );
}

export default function QualificationWizard({ open, onOpenChange, customer, onDone }) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [rjc, setRjc] = useState(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(() => initialAnswers(customer));
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!open) return;
    setStep(0); setDone(null); setSearch(''); setAnswers(initialAnswers(customer));
    loadLegal('rjc').then(setRjc).catch(() => setRjc(null));
  }, [open, customer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setAnswers((p) => ({ ...p, [k]: v }));
  const rows = useMemo(() => (rjc ? annexRows(rjc) : []), [rjc]);
  const th = useMemo(() => (rjc ? sizeThresholds(rjc) : null), [rjc]);
  const result = useMemo(() => (rjc ? qualify(answers, { rjc }) : null), [rjc, answers]);
  const flags = entityTypeFlags(answers.annex && answers.annex !== 'none' ? answers.entity_type : '');
  const entryIntoForce = fmtDate(getInstrument('dl125')?.valid_from);

  const filteredRows = useMemo(() => {
    const q = norm(search).trim();
    return rows.filter((r) => !q || norm(`${r.setor} ${r.subsetor || ''} ${r.tipo_entidade}`).includes(q));
  }, [rows, search]);

  const isSelected = (r) => answers.annex === r.annex && answers.sector === r.setor && (answers.subsector || null) === r.subsetor && answers.entity_type === r.tipo_entidade;
  const pickRow = (r) => setAnswers((p) => ({ ...p, annex: r.annex, sector: r.setor, subsector: r.subsetor, entity_type: r.tipo_entidade, qualified_trust: null, main_establishment_pt: null, representative_pt: null, provides_in_pt: null }));
  const pickNone = () => setAnswers((p) => ({ ...p, annex: 'none', sector: '', subsector: null, entity_type: '' }));

  const canNext = STEPS[step] !== 'activity' || Boolean(answers.annex);

  const save = async () => {
    if (!result) return;
    setSaving(true);
    const warnings = []; const status = {};
    const date = today();
    const author = user?.full_name || user?.email || '';
    const qualLabel = t(`legal_q_${result.rjc_qualification}`) + (result.epr_group ? ` — ${t('legal_epr_group')} ${result.epr_group}` : '');

    // 1. Cliente — RLS: só o admin da plataforma altera o registo do cliente.
    if (isAdmin) {
      try {
        const patch = customerPatch(result, answers);
        if (Object.keys(patch).length) await base44.entities.Customer.update(customer.id, patch);
        status.customer = 'ok';
        await writeAuditLog({ action: 'customer_qualified', entity_type: 'Customer', entity_id: customer.id, customer_id: customer.id, details: `Enquadramento RJC: ${result.rjc_qualification}${result.epr_group ? ` (Grupo ${result.epr_group})` : ''}` }).catch(() => {});
      } catch (e) { warnings.push(t('qw_warn_customer', { error: e?.message || '—' })); }
    } else status.customer = 'skipped';

    // 2. Jornada RJC_2026 — criada se ainda não existir; depois, atualização das tarefas da secção A.
    let scopeItem = null;
    try {
      const fetchItems = () => base44.entities.ComplianceChecklist.filter({ customer_id: customer.id, framework: JOURNEY_FRAMEWORK }, 'section_order', 500);
      let items = await fetchItems();
      if (!items.length) {
        const template = language === 'pt' ? JOURNEY_TEMPLATE_PT : JOURNEY_TEMPLATE_EN;
        await base44.entities.ComplianceChecklist.bulkCreate(buildJourneyRecords(template, { customerId: customer.id, customerName: customer.name || '', framework: JOURNEY_FRAMEWORK }));
        items = await fetchItems();
      }
      const note = t('qw_journey_note', { date: fmtDate(date), result: qualLabel });
      for (const u of journeyUpdates(items, result, { note, selfIdentifiedDate: answers.self_identified_date || null, cncsNotified: Boolean(answers.cncs_qualification) })) {
        await base44.entities.ComplianceChecklist.update(u.id, u.data);
      }
      scopeItem = findScopeItem(items);
      status.journey = 'ok';
    } catch (e) { warnings.push(t('qw_warn_journey', { error: e?.message || '—' })); }

    // 3. Relatório em PDF → evidência privada (módulo documents_evidence).
    let pdf = null;
    try {
      pdf = buildQualificationPdf({ customer, answers, result, author, date });
      const slug = norm(customer.name || 'cliente').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'cliente';
      const file = new File([pdf], `relatorio-enquadramento-${slug}-${date}.pdf`, { type: 'application/pdf' });
      await uploadEvidence({
        file, customerId: customer.id,
        meta: {
          title: t('qw_evidence_title', { date: fmtDate(date) }),
          description: `${t('qw_evidence_desc')} ${qualLabel}.`,
          evidence_type: 'test_audit_report', method: 'interview', collected_at: date,
          links: scopeItem ? [{ type: 'checklist', id: scopeItem.id, ref: 'RJC, arts. 3.º a 8.º', label: (scopeItem.task_text || '').slice(0, 120) }] : [],
        },
      });
      status.evidence = 'ok';
    } catch (e) { warnings.push(t('qw_warn_evidence', { error: e?.message || '—' })); }

    qc.invalidateQueries({ queryKey: ['customers'] });
    qc.invalidateQueries({ queryKey: ['qw-customer', customer.id] });
    qc.invalidateQueries({ queryKey: ['compliance-checklist', customer.id] });
    qc.invalidateQueries({ queryKey: ['evidence', customer.id] });
    setDone({ status, warnings, pdf, date });
    setSaving(false);
    onDone?.(result);
  };

  const downloadPdf = () => {
    if (!done?.pdf) return;
    const url = URL.createObjectURL(done.pdf);
    const a = document.createElement('a');
    a.href = url; a.download = `relatorio-enquadramento-${done.date}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const sizeCat = th ? rjcSizeCategory(answers, th) : null;
  const sizeCls = th ? reg756SizeClass(answers, th, answers.is_public) : null;
  const willUpdate = result ? Object.keys(customerPatch(result, answers)) : [];

  const renderStep = () => {
    switch (STEPS[step]) {
      case 'activity':
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('qw_activity_help')}</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('qw_search')} className="pl-9" />
            </div>
            <button type="button" onClick={pickNone} className={cn('w-full text-left rounded-md border p-3 transition-colors', answers.annex === 'none' ? 'border-primary bg-primary/5' : 'hover:bg-muted/30')}>
              <p className="text-sm font-medium">{t('qw_none_activity')}</p>
              <p className="text-xs text-muted-foreground">{t('qw_none_activity_desc')}</p>
            </button>
            <div className="max-h-[42vh] overflow-y-auto space-y-3 pr-1">
              {['I', 'II'].map((ax) => {
                const list = filteredRows.filter((r) => r.annex === ax);
                if (!list.length) return null;
                return (
                  <div key={ax} className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky top-0 bg-background py-1">{t(`qw_annex_${ax}`)} <span className="font-mono normal-case">· RJC, anexo {ax}</span></p>
                    {list.map((r) => (
                      <button key={`${r.setor}|${r.subsetor}|${r.tipo_entidade}`} type="button" onClick={() => pickRow(r)}
                        className={cn('w-full text-left rounded-md border p-2.5 transition-colors', isSelected(r) ? 'border-primary bg-primary/5' : 'hover:bg-muted/30')}>
                        <p className="text-[11px] text-muted-foreground">{r.setor}{r.subsetor ? ` › ${r.subsetor}` : ''}</p>
                        <p className="text-sm leading-snug">{r.tipo_entidade}</p>
                      </button>
                    ))}
                  </div>
                );
              })}
              {!filteredRows.length && <p className="text-sm text-muted-foreground py-4 text-center">{t('qw_no_results')}</p>}
            </div>
          </div>
        );
      case 'entity':
        if (answers.annex === 'none') return <p className="text-sm text-muted-foreground">{t('qw_entity_none')}</p>;
        return (
          <div className="space-y-3">
            <div className="rounded-md bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{t('qw_entity_selected')} · <span className="font-mono">RJC, anexo {answers.annex}</span></p>
              <p className="text-[11px] text-muted-foreground mt-1">{answers.sector}{answers.subsector ? ` › ${answers.subsector}` : ''}</p>
              <p className="text-sm">{answers.entity_type}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t('qw_establishment')}</Label>
              <p className="text-[11px] text-muted-foreground font-mono">RJC, art. 4.º, n.º 1</p>
              <div className="flex flex-wrap gap-1.5">
                {[['pt', 'qw_est_pt'], ['ue_outro', 'qw_est_ue'], ['fora_ue', 'qw_est_fora']].map(([v, k]) => (
                  <Button key={v} type="button" size="sm" variant={answers.establishment === v ? 'default' : 'outline'} onClick={() => set('establishment', v)}>{t(k)}</Button>
                ))}
              </div>
            </div>
            {flags.mainEstablishment && answers.establishment !== 'fora_ue' && (
              <Question label={t('qw_main_est')} help={t('qw_main_est_help')} basis="RJC, art. 4.º, n.º 1, c), i), e n.º 2">
                <YesNo value={answers.main_establishment_pt} onChange={(v) => set('main_establishment_pt', v)} />
              </Question>
            )}
            {flags.mainEstablishment && answers.establishment === 'fora_ue' && (
              <Question label={t('qw_representative')} basis="RJC, art. 4.º, n.º 1, c), ii)">
                <YesNo value={answers.representative_pt} onChange={(v) => set('representative_pt', v)} />
              </Question>
            )}
            {flags.comms && (
              <Question label={t('qw_provides_pt')} basis="RJC, art. 4.º, n.º 1, b)">
                <YesNo value={answers.provides_in_pt} onChange={(v) => set('provides_in_pt', v)} />
              </Question>
            )}
            <CheckLine checked={answers.other_activities} onChange={(v) => set('other_activities', v)} label={t('qw_other_activities')} basis="RJC, art. 9.º, n.º 1; Reg. 756/2026, art. 30.º, n.º 4" />
          </div>
        );
      case 'size':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t('qw_employees')}</Label>
                <Input type="number" min={0} value={answers.employees} onChange={(e) => set('employees', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('qw_turnover')}</Label>
                <Input type="number" min={0} step="any" value={answers.turnover} onChange={(e) => set('turnover', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('qw_balance')}</Label>
                <Input type="number" min={0} step="any" value={answers.balance} onChange={(e) => set('balance', e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('qw_employees_help')}</p>
            <CheckLine checked={answers.in_group} onChange={(v) => set('in_group', v)} label={t('qw_in_group')} basis="RJC, art. 3.º, n.º 1, a) (Recomendação 2003/361/CE)" />
            <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-xs">
              <p className="font-semibold">{t('qw_size_rule_title')}</p>
              <p>{t('qw_size_rule_rjc')}</p>
              <p>{t('qw_size_rule_756')}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-muted-foreground">{t('qw_size_now')}:</span>
                <Badge variant="outline">{t('qw_size_rjc_label')}: {sizeCat ? t(SIZE_KEYS[sizeCat]) : t('qw_size_undetermined')}</Badge>
                <Badge variant="outline">{t('qw_size_756_label')}: {sizeCls ? t(SIZE_KEYS[sizeCls]) : t('qw_size_undetermined')}</Badge>
              </div>
            </div>
          </div>
        );
      case 'special':
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('qw_special_help')}</p>
            {flags.trust && (
              <Question label={t('qw_qualified_trust')} basis="RJC, art. 6.º, n.º 1, b); art. 2.º, alínea z)">
                <YesNo value={answers.qualified_trust} onChange={(v) => set('qualified_trust', v)} />
              </Question>
            )}
            <CheckLine checked={answers.cer_critical} onChange={(v) => set('cer_critical', v)} label={t('qw_cer')} basis="RJC, art. 3.º, n.º 5; art. 6.º, n.º 1, e)" />
            {answers.annex && answers.annex !== 'none' && (
              <>
                <CheckLine checked={answers.sole_provider} onChange={(v) => set('sole_provider', v)} label={t('qw_sole_provider')} basis="RJC, art. 3.º, n.º 2, b)" />
                <CheckLine checked={answers.public_safety} onChange={(v) => set('public_safety', v)} label={t('qw_public_safety')} basis="RJC, art. 3.º, n.º 2, c)" />
                <CheckLine checked={answers.systemic_risk} onChange={(v) => set('systemic_risk', v)} label={t('qw_systemic')} basis="RJC, art. 3.º, n.º 2, d)" />
                <CheckLine checked={answers.national_critical} onChange={(v) => set('national_critical', v)} label={t('qw_national_critical')} basis="RJC, art. 3.º, n.º 2, e)" />
              </>
            )}
            <CheckLine checked={answers.higher_education} onChange={(v) => set('higher_education', v)} label={t('qw_higher_ed')} basis="RJC, art. 3.º, n.º 6" />
            <CheckLine checked={answers.excluded_art37} onChange={(v) => set('excluded_art37', v)} label={t('qw_excluded37')} basis="RJC, art. 3.º, n.º 7" />
          </div>
        );
      case 'public':
        return (
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={Boolean(answers.is_public)} onCheckedChange={(v) => set('is_public', v)} /> {t('qw_is_public')}
              <span className="text-[11px] text-muted-foreground font-mono">RJC, art. 3.º, n.os 3 e 4</span>
            </label>
            {!answers.is_public ? <p className="text-sm text-muted-foreground">{t('qw_private_skip')}</p> : (
              <>
                <div className="space-y-1.5">
                  <Label>{t('qw_public_kind')}</Label>
                  <Select value={answers.public_kind || NONE} onValueChange={(v) => set('public_kind', v === NONE ? '' : v)}>
                    <SelectTrigger className="h-auto min-h-9 text-left whitespace-normal"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-w-[min(40rem,90vw)]">
                      <SelectItem value={NONE}>—</SelectItem>
                      {PUBLIC_KINDS.map((k) => <SelectItem key={k} value={k} className="whitespace-normal">{t(`qw_pk_${k}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('qw_public_staff_note')} <span className="font-mono">RJC, art. 7.º</span></p>
                </div>
                <CheckLine checked={answers.ict_mission} onChange={(v) => set('ict_mission', v)} label={t('qw_ict_mission')} basis="RJC, art. 6.º, n.º 1, d)" />
                <CheckLine checked={answers.high_digital} onChange={(v) => set('high_digital', v)} label={t('qw_high_digital')} basis="RJC, art. 6.º, n.º 1, d)" />
                <CheckLine checked={answers.education_assessment} onChange={(v) => set('education_assessment', v)} label={t('qw_education_assessment')} basis="RJC, art. 6.º, n.º 1, d)" />
              </>
            )}
          </div>
        );
      case 'cncs':
        return (
          <div className="space-y-3">
            <Question label={t('qw_already_active', { date: entryIntoForce })} basis="RJC, art. 8.º, n.º 1">
              <YesNo value={answers.already_active} onChange={(v) => set('already_active', v)} allowUnknown={false} />
            </Question>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {answers.already_active === false ? (
                <div className="space-y-1.5">
                  <Label>{t('qw_activity_start')}</Label>
                  <Input type="date" value={answers.activity_start} onChange={(e) => set('activity_start', e.target.value)} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>{t('qw_platform_date')}</Label>
                  <Input type="date" value={answers.platform_date} onChange={(e) => set('platform_date', e.target.value)} />
                  <p className="text-[11px] text-muted-foreground">{t('qw_platform_help')}</p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>{t('qw_self_id_date')}</Label>
                <Input type="date" value={answers.self_identified_date} onChange={(e) => set('self_identified_date', e.target.value)} />
              </div>
            </div>
            <fieldset className="rounded-md border p-3 space-y-3">
              <legend className="px-1 text-sm font-medium">{t('qw_cncs_notified_title')} <span className="text-[11px] text-muted-foreground font-mono">RJC, art. 8.º, n.º 5; Reg. 756/2026, art. 9.º</span></legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('qw_cncs_qualification')}</Label>
                  <Select value={answers.cncs_qualification || NONE} onValueChange={(v) => set('cncs_qualification', v === NONE ? '' : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t('qw_not_notified')}</SelectItem>
                      {QUALS.map((q) => <SelectItem key={q} value={q}>{t(`legal_q_${q}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('qw_cncs_date')}</Label>
                  <Input type="date" value={answers.cncs_date} disabled={!answers.cncs_qualification} onChange={(e) => set('cncs_date', e.target.value)} />
                </div>
                {answers.cncs_qualification === 'publica_relevante' && (
                  <div className="space-y-1.5">
                    <Label>{t('qw_cncs_group')}</Label>
                    <Select value={answers.cncs_epr_group || NONE} onValueChange={(v) => set('cncs_epr_group', v === NONE ? '' : v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        <SelectItem value="A">{t('legal_epr_group')} A</SelectItem>
                        <SelectItem value="B">{t('legal_epr_group')} B</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {['essencial', 'importante'].includes(answers.cncs_qualification) && (
                  <div className="space-y-1.5">
                    <Label>{t('qw_cncs_level')}</Label>
                    <Select value={answers.cncs_level || NONE} onValueChange={(v) => set('cncs_level', v === NONE ? '' : v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {LEVELS.map((lv) => <SelectItem key={lv} value={lv}>{t(`legal_level_${lv}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </fieldset>
          </div>
        );
      case 'summary':
        if (!result) return null;
        return (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-1.5">
              <p className="text-xs text-muted-foreground">{t('qw_result')}</p>
              <p className="text-lg font-semibold">{t(`legal_q_${result.rjc_qualification}`)}{result.epr_group ? ` — ${t('legal_epr_group')} ${result.epr_group}` : ''}</p>
              {['essencial', 'importante'].includes(result.rjc_qualification) && (
                <p className="text-sm">{result.conformity_level ? `${t('legal_conformity_level')}: ${t(`legal_level_${result.conformity_level}`)}` : t('qw_level_pending')}</p>
              )}
              {result.rjc_annex && <p className="text-xs text-muted-foreground">Anexo {result.rjc_annex} — {result.rjc_sector}{result.rjc_subsector ? ` › ${result.rjc_subsector}` : ''}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {result.rjc_size && <Badge variant="outline">{t('qw_size_rjc_label')}: {t(SIZE_KEYS[result.rjc_size])}</Badge>}
                {result.entity_size && <Badge variant="outline">{t('qw_size_756_label')}: {t(SIZE_KEYS[result.entity_size])}</Badge>}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-semibold">{t('qw_deadline')}</p>
              {result.deadline ? (
                <p className="text-sm">{msg(t, { key: result.deadline.key, params: { date: result.deadline.date, from: result.deadline.from } })} <span className="text-[11px] text-muted-foreground font-mono">{result.deadline.basis}</span></p>
              ) : <p className="text-sm text-muted-foreground">{t('qw_no_deadline')}</p>}
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-semibold">{t('qw_reasons')}</p>
              <ul className="space-y-1.5">
                {result.reasons.map((r, i) => (
                  <li key={i} className="text-sm flex gap-2"><CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <span>{msg(t, r)} <span className="block text-[11px] text-muted-foreground font-mono">{r.basis}</span></span>
                  </li>
                ))}
              </ul>
            </div>

            {result.open_points.length > 0 && (
              <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> {t('qw_open_points')}</p>
                <p className="text-xs text-muted-foreground">{t('qw_open_points_help')}</p>
                <ul className="space-y-1.5">
                  {result.open_points.map((o, i) => (
                    <li key={i} className="text-sm">{msg(t, o)} <span className="block text-[11px] text-muted-foreground font-mono">{o.basis}</span></li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              {isAdmin ? (
                <p>{t('qw_will_update')}: {willUpdate.length ? <span className="font-mono">{willUpdate.join(', ')}</span> : t('qw_will_update_none')}</p>
              ) : <p>{t('qw_customer_admin_note')}</p>}
              <p>{t('qw_disclaimer')}</p>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange?.(v); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Scale className="w-5 h-5 text-primary" /> {t('qw_title')}</DialogTitle>
          <DialogDescription>{customer?.name ? <strong className="text-foreground">{customer.name}</strong> : null} {done ? '' : t('qw_subtitle')}</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-3">
            <p className="font-semibold flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-accent" /> {t('qw_done_title')}</p>
            <ul className="text-sm space-y-1">
              {done.status.customer === 'ok' && <li>{t('qw_done_customer')}</li>}
              {done.status.customer === 'skipped' && <li>{t('qw_done_customer_skipped')}</li>}
              {done.status.journey === 'ok' && <li>{t('qw_done_journey')}</li>}
              {done.status.evidence === 'ok' && <li>{t('qw_done_evidence')}</li>}
            </ul>
            {done.warnings.map((w, i) => (
              <div key={i} className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm"><AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" /> {w}</div>
            ))}
            <DialogFooter className="gap-2">
              {done.pdf && <Button variant="outline" className="gap-2" onClick={downloadPdf}><Download className="w-4 h-4" /> {t('qw_download_pdf')}</Button>}
              <Button onClick={() => onOpenChange?.(false)}>{t('qw_close')}</Button>
            </DialogFooter>
          </div>
        ) : !rjc ? (
          <div className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> {t('qw_loading_law')}</div>
        ) : (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{t(STEP_LABEL[STEPS[step]])}</span>
                <span>{t('qw_step_of', { n: step + 1, total: STEPS.length })}</span>
              </div>
              <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />
            </div>
            <div className="min-h-[16rem]">{renderStep()}</div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => onOpenChange?.(false)} disabled={saving}>{t('qw_skip')}</Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || saving}>{t('qw_back')}</Button>
                {step < STEPS.length - 1 ? (
                  <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>{t('qw_next')}</Button>
                ) : (
                  <Button type="button" onClick={save} disabled={saving} className="gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}{saving ? t('qw_saving') : t('qw_confirm')}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
