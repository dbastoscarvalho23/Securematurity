import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertTriangle, CheckCircle2, Download, FileText, Search } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { loadLegal, flattenQnrcs, LEVELS } from '@/lib/legal';
import { linkKey, evidenceState } from '@/lib/evidence';
import { gapSummary, gapState } from '@/lib/legal/isoGuide';
import EvidencePanel, { useCustomerEvidence, evidenceSummary } from '@/components/evidence/EvidencePanel';
import { LevelBadge, Loading, SourceLink, downloadCsv, useLegalData } from './shared';

/**
 * Guia de uma norma ISO de sistema de gestão (ISO/IEC 27001 e ISO/IEC 42001): estrutura da norma com textos próprios
 * da AnkoraOne, acompanhamento por cliente em ComplianceChecklist (framework `config.framework`), Declaração de
 * Aplicabilidade, análise de lacunas e evidências ligadas (tipo `config.linkType`).
 *
 * Práticas seguidas (ver docs/legal/referencias-iso.md): uma Declaração de Aplicabilidade por norma, com aplicabilidade,
 * justificação, método de implementação e estado; análise de lacunas com o sistema de gestão (cláusulas) e os controlos
 * separados; informação documentada obrigatória assinalada; num sistema integrado, as evidências da 27001 servem de
 * base aos requisitos da 42001 que lhes estão ligados.
 */
export const ISO_GUIDES = {
  iso27001: {
    key: 'iso27001', framework: 'ISO27001_2022', standard: 'ISO/IEC 27001:2022', linkType: 'iso27001', related: 'qnrcs',
    file: 'iso27001', banner: 'iso_banner', search: 'iso_search', linked: 'iso_linked_evidence',
  },
  iso42001: {
    key: 'iso42001', framework: 'ISO42001_2023', standard: 'ISO/IEC 42001:2023', linkType: 'iso42001', related: 'iso27001',
    file: 'iso42001', banner: 'iso42_banner', search: 'iso42_search', linked: 'iso42_linked_evidence',
  },
};

const STATUSES = ['pending', 'in_progress', 'done'];
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
const GAP_STYLE = { conformant: 'bg-chart-2', partial: 'bg-chart-3', nonconformant: 'bg-destructive/70', not_applicable: 'bg-muted-foreground/30' };

const groupKey = (g) => `${g.kind}:${g.code}`;
const isClause = (item) => item.kind === 'clause';
const related = (item, cfg) => item[cfg.related] || [];

/** As cláusulas 4 a 10 são sempre aplicáveis; um controlo só deixa de o ser por decisão registada. */
const isApplicable = (item, record) => isClause(item) || (record?.applicable !== false && record?.status !== 'not_applicable');
const effectiveStatus = (item, record) => (isApplicable(item, record) ? (record?.status && record.status !== 'not_applicable' ? record.status : 'pending') : 'not_applicable');

function draftFrom(record) {
  return {
    owner: record?.owner || '', due_date: record?.due_date || '', notes: record?.notes || '',
    applicable: record ? record.applicable !== false && record.status !== 'not_applicable' : true,
    justification: record?.justification || '', implementation_method: record?.implementation_method || '',
  };
}

function QnrcsVerification({ ids, qmap }) {
  const { t } = useLanguage();
  if (!ids.length) return <p className="text-xs text-muted-foreground">{t('iso_no_qnrcs')}</p>;
  return (
    <div className="space-y-2">
      {ids.map((id) => {
        const c = qmap[id];
        if (!c) return <p key={id} className="text-xs font-mono text-muted-foreground">{id}</p>;
        const levels = LEVELS.filter((lv) => c.measures?.[lv]);
        return (
          <div key={id} className="rounded-md border bg-muted/30 p-2.5 space-y-1.5">
            <p className="text-xs"><span className="font-mono font-semibold text-primary mr-2">{id}</span>{c.statement}</p>
            {levels.length === 0 && <p className="text-xs text-muted-foreground">{t('iso_qnrcs_no_measure')}</p>}
            {levels.map((lv) => (
              <div key={lv} className="flex items-start gap-2">
                <LevelBadge level={lv} className="flex-shrink-0" />
                <p className="text-xs text-muted-foreground">{c.measures[lv].verification}</p>
              </div>
            ))}
          </div>
        );
      })}
      <p className="text-[11px] text-muted-foreground">{t('iso_verification_source')}</p>
    </div>
  );
}

/** Requisitos da ISO/IEC 27001 que servem de base a um requisito da 42001 (sistema integrado). */
function Iso27001Basis({ ids, iso27 }) {
  const { t } = useLanguage();
  if (!ids.length) return <p className="text-xs text-muted-foreground">{t('iso42_no_basis')}</p>;
  return (
    <div className="space-y-1.5">
      {ids.map((id) => {
        const c = iso27[id];
        return (
          <div key={id} className="rounded-md border bg-muted/30 p-2.5 space-y-1">
            <p className="text-xs"><span className="font-mono font-semibold text-primary mr-2">{id}</span>{c?.title || ''}</p>
            {c?.evidence && <p className="text-xs text-muted-foreground">{t('iso_evidence_to_keep')}: {c.evidence}</p>}
          </div>
        );
      })}
      <p className="text-[11px] text-muted-foreground">{t('iso42_basis_note')}</p>
    </div>
  );
}

function ItemRow({ cfg, item, record, tracking, canEdit, onSave, evState, ownCount, linkedCount, qmap, iso27, customerId, provider, onRelated }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => draftFrom(record));
  // O registo pode chegar depois da primeira renderização ou mudar após gravar.
  useEffect(() => {
    setDraft(draftFrom(record));
  }, [record?.id, record?.owner, record?.due_date, record?.notes, record?.applicable, record?.status, record?.justification, record?.implementation_method]);
  const applicable = isApplicable(item, record);
  const status = effectiveStatus(item, record);
  const clause = isClause(item);
  const rel = related(item, cfg);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const relLabel = cfg.related === 'qnrcs' ? t('iso_qnrcs_links') : t('iso42_basis_links');
  const relTitle = (id) => (cfg.related === 'qnrcs' ? qmap[id]?.statement : iso27[id]?.title) || id;

  return (
    <div className={`rounded-md border p-3 space-y-2 bg-card ${applicable ? '' : 'opacity-75'}`}>
      <div className="flex items-start gap-2 flex-wrap">
        <span className="font-mono text-xs font-semibold text-primary">{item.id}</span>
        <p className="text-sm font-semibold flex-1 min-w-[12rem]">{item.title}</p>
        {item.documented && (
          <Badge variant="outline" className="text-[10px] gap-1" title={t('iso_documented_hint')}><FileText className="w-3 h-3" />{t('iso_documented')}</Badge>
        )}
        {tracking && evState && <Badge variant="outline" className={`text-[10px] ${EV_BADGE[evState]}`}>{t(`ev_badge_${evState}`)}</Badge>}
        {tracking && linkedCount > 0 && (
          <Badge variant="outline" className="text-[10px]">{t(cfg.linked, { count: linkedCount })}</Badge>
        )}
        {tracking && (applicable ? (
          <Select value={status} onValueChange={(v) => onSave({ status: v })} disabled={!canEdit}>
            <SelectTrigger className={`h-7 w-36 text-xs ${STATUS_STYLE[status]}`}><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`iso_status_${s}`)}</SelectItem>)}</SelectContent>
          </Select>
        ) : (
          <Badge variant="outline" className={`text-xs ${STATUS_STYLE.not_applicable}`}>{t('iso_status_not_applicable')}</Badge>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{item.description}</p>
      <p className="text-xs"><span className="font-medium">{t('iso_evidence_to_keep')}:</span> {item.evidence}</p>
      {rel.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="text-muted-foreground mr-1">{relLabel}:</span>
          {rel.map((id) => (
            <button key={id} type="button" onClick={() => onRelated(id)} title={relTitle(id)}
              className="font-mono px-1.5 py-0.5 rounded bg-muted text-foreground/80 hover:bg-primary/10 hover:text-primary">{id}</button>
          ))}
        </div>
      ) : cfg.related === 'iso27001' && (
        <p className="text-xs text-muted-foreground">{t('iso42_ai_only')}</p>
      )}
      {!applicable && record?.justification && (
        <p className="text-xs"><span className="font-medium">{t('iso_justification')}:</span> {record.justification}</p>
      )}
      <button type="button" className="text-xs text-primary hover:underline" onClick={() => setOpen((v) => !v)}>
        {open ? '−' : '+'} {cfg.related === 'qnrcs' ? t('iso_official_verification') : t('iso42_basis_title')}{tracking ? ` · ${t('iso_tracking')}` : ''}
      </button>
      {open && (
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold">{cfg.related === 'qnrcs' ? t('iso_official_verification') : t('iso42_basis_title')}</p>
            {cfg.related === 'qnrcs' ? <QnrcsVerification ids={rel} qmap={qmap} /> : <Iso27001Basis ids={rel} iso27={iso27} />}
          </div>
          {tracking && (
            <div className="space-y-2 border-t pt-3">
              {clause ? (
                <p className="text-xs text-muted-foreground">{t('iso_clause_mandatory')}</p>
              ) : (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={draft.applicable} disabled={!canEdit} onCheckedChange={(v) => set('applicable', v)} />
                    {draft.applicable ? t('iso_applicable') : t('iso_not_applicable')}
                  </label>
                  <Textarea rows={2} value={draft.justification} disabled={!canEdit} onChange={(e) => set('justification', e.target.value)}
                    placeholder={draft.applicable ? t('iso_justification_include') : t('iso_justification_exclude')} />
                  {draft.applicable && (
                    <Textarea rows={2} value={draft.implementation_method} disabled={!canEdit} onChange={(e) => set('implementation_method', e.target.value)}
                      placeholder={t('iso_implementation_method_hint')} />
                  )}
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-2">
                <Input value={draft.owner} disabled={!canEdit} onChange={(e) => set('owner', e.target.value)} placeholder={t('iso_owner')} />
                <Input type="date" value={draft.due_date} disabled={!canEdit} onChange={(e) => set('due_date', e.target.value)} title={t('iso_due')} />
              </div>
              <Textarea rows={2} value={draft.notes} disabled={!canEdit} onChange={(e) => set('notes', e.target.value)} placeholder={t('iso_notes')} />
              {canEdit && (
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => onSave(clause ? { owner: draft.owner, due_date: draft.due_date, notes: draft.notes } : draft)}>
                  {t('common_save')}
                </Button>
              )}
              {ownCount > 0 && <p className="text-[11px] text-muted-foreground">{t('iso_own_evidence', { count: ownCount })}</p>}
              <EvidencePanel customerId={customerId} provider={provider} canUpload={canEdit}
                links={[{ type: cfg.linkType, id: item.id, ref: item.id, label: `${cfg.standard} ${item.id} — ${item.title}`.slice(0, 160) }]} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupProgress({ stats }) {
  if (!stats) return null;
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground font-normal">
      <Progress value={pct} className="h-1.5 w-20" />
      {stats.done}/{stats.total}
    </span>
  );
}

/** Barra da análise de lacunas: conforme, parcialmente conforme, não conforme e (só controlos) não aplicável. */
function GapBar({ label, s }) {
  const { t } = useLanguage();
  const keys = ['conformant', 'partial', 'nonconformant', 'not_applicable'].filter((k) => s[k] || k !== 'not_applicable');
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-2 text-xs"><span className="font-medium">{label}</span><span className="text-muted-foreground">{s.total}</span></div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img"
        aria-label={keys.map((k) => `${t(`iso_gap_${k}`)} ${s.pct[k]}%`).join(', ')}>
        {keys.map((k) => s[k] > 0 && <div key={k} className={GAP_STYLE[k]} style={{ width: `${(s[k] / (s.total || 1)) * 100}%` }} />)}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        {keys.map((k) => (
          <span key={k} className="flex items-center gap-1"><span className={`inline-block w-2 h-2 rounded-sm ${GAP_STYLE[k]}`} />{t(`iso_gap_${k}`)} {s[k]} ({s.pct[k]}%)</span>
        ))}
      </div>
    </div>
  );
}

const VERDICT_STYLE = {
  referencia_normativa: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
  atual: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
  atual_com_reservas: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
  uso_limitado: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
  erros_detetados: 'bg-destructive/10 text-destructive border-destructive/30',
  desatualizado: 'bg-muted text-muted-foreground',
  fora_de_ambito: 'bg-muted text-muted-foreground',
};

/** Fontes usadas para conferir o guia (só administrador da plataforma). Metadados; nenhum documento está alojado. */
function SourcesChecked({ standardKey }) {
  const { t } = useLanguage();
  const { data } = useLegalData(loadLegal, 'isoReferences');
  const num = standardKey === 'iso42001' ? '42001' : '27001';
  const docs = (data?.documents || []).filter((d) => `${d.covers} ${d.title}`.includes(num));
  if (!docs.length) return null;
  return (
    <Accordion type="single" collapsible className="border rounded-lg px-3">
      <AccordionItem value="sources" className="border-0">
        <AccordionTrigger className="hover:no-underline text-sm font-semibold">{t('iso_sources_title', { count: docs.length })}</AccordionTrigger>
        <AccordionContent className="space-y-2">
          <p className="text-xs text-muted-foreground">{t('iso_sources_note')}</p>
          {docs.map((d) => (
            <div key={d.id} className="rounded-md border p-2.5 space-y-1">
              <div className="flex items-start gap-2 flex-wrap">
                <p className="text-xs font-medium flex-1 min-w-[12rem]">{d.title}</p>
                <Badge variant="outline" className={`text-[10px] ${VERDICT_STYLE[d.verdict] || ''}`}>{t(`iso_verdict_${d.verdict}`)}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">{d.publisher} · {d.year} · {d.covers}</p>
              <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-0.5">{d.findings.map((f) => <li key={f}>{f}</li>)}</ul>
              <p className="text-[11px]"><span className="font-medium">{t('iso_sources_used_for')}:</span> {d.used_for}</p>
            </div>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

/** Objetivos e fontes de risco de referência (Anexo C da ISO/IEC 42001, informativo). */
function AnnexC({ data }) {
  const { t } = useLanguage();
  if (!data?.objectives?.length) return null;
  return (
    <Accordion type="single" collapsible className="border rounded-lg px-3">
      <AccordionItem value="annex-c" className="border-0">
        <AccordionTrigger className="hover:no-underline text-sm font-semibold">{t('iso42_annex_c')}</AccordionTrigger>
        <AccordionContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('iso42_annex_c_note')}</p>
          <div className="grid md:grid-cols-2 gap-4">
            {[['objectives', t('iso42_objectives')], ['risk_sources', t('iso42_risk_sources')]].map(([k, label]) => (
              <div key={k} className="space-y-1.5">
                <p className="text-xs font-semibold">{label}</p>
                <ul className="space-y-1">
                  {data[k].map((o) => (
                    <li key={o.id} className="text-xs"><span className="font-mono text-primary mr-1.5">{o.id}</span><span className="font-medium">{o.title}</span> — <span className="text-muted-foreground">{o.description}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export default function IsoGuideTab({ guide = 'iso27001' }) {
  const cfg = ISO_GUIDES[guide];
  const { t } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const isAdmin = user?.role === 'admin';
  const canEdit = isAdmin || user?.role === 'customer_admin';
  const [selected, setSelected] = useState(null);
  const customerId = isAdmin ? selected : user?.customer_id;
  const tracking = Boolean(customerId);

  const { data: iso, loading: l1 } = useLegalData(loadLegal, cfg.file);
  const { data: qnrcs, loading: l2 } = useLegalData(loadLegal, 'qnrcs');
  // A 42001 mostra os requisitos da 27001 que lhe servem de base.
  const { data: iso27data, loading: l3 } = useLegalData(loadLegal, 'iso27001');
  const qmap = useMemo(() => Object.fromEntries(flattenQnrcs(qnrcs).map((k) => [k.id, k])), [qnrcs]);
  const iso27 = useMemo(() => Object.fromEntries((iso27data?.items || []).map((i) => [i.id, i])), [iso27data]);

  const { data: customers = [] } = useQuery({
    queryKey: ['legal-customers'],
    queryFn: () => base44.entities.Customer.list('name', 500),
    enabled: isAdmin,
  });
  const { data: customer } = useQuery({
    queryKey: ['legal-customer', customerId],
    queryFn: () => base44.entities.Customer.get(customerId),
    enabled: tracking,
  });
  const { data: records = [] } = useQuery({
    queryKey: [`${cfg.key}-checklist`, customerId],
    queryFn: () => base44.entities.ComplianceChecklist.filter({ customer_id: customerId, framework: cfg.framework }, 'task_order', 500),
    enabled: tracking,
  });
  const { data: evidence = [] } = useCustomerEvidence(customerId);
  const evByKey = useMemo(() => evidenceSummary(evidence), [evidence]);

  // Reaproveitamento de evidências do cliente: na 27001, as ligadas a medidas (measure:<controlo>@<nível>) ou controlos
  // (control:<controlo>) do QNRCS; na 42001, as ligadas aos requisitos da 27001 que servem de base. Não contam versões
  // substituídas nem evidências rejeitadas.
  const evIndex = useMemo(() => {
    const byRelated = {};
    const own = {};
    const ownPrefix = `${cfg.linkType}:`;
    for (const ev of evidence) {
      const st = evidenceState(ev);
      if (st === 'superseded' || st === 'rejected') continue;
      for (const k of ev.link_keys || []) {
        if (cfg.related === 'qnrcs') {
          const m = /^(measure|control):([^@]+)/.exec(k);
          if (m) (byRelated[m[2]] ||= new Set()).add(ev.id);
        } else if (k.startsWith('iso27001:')) {
          (byRelated[k.slice('iso27001:'.length)] ||= new Set()).add(ev.id);
        }
        if (k.startsWith(ownPrefix)) (own[k.slice(ownPrefix.length)] ||= new Set()).add(ev.id);
      }
    }
    return { byRelated, own };
  }, [evidence, cfg]);
  const linkedCount = (item) => {
    const ids = new Set();
    for (const q of related(item, cfg)) for (const id of evIndex.byRelated[q] || []) ids.add(id);
    return ids.size;
  };
  const ownCount = (item) => evIndex.own[item.id]?.size || 0;

  const byId = useMemo(() => Object.fromEntries(records.map((r) => [r.requirement_id, r])), [records]);

  const [search, setSearch] = useState(() => params.get('q') || '');
  const [group, setGroup] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [applicability, setApplicability] = useState('all');
  const [onlyDocumented, setOnlyDocumented] = useState(false);

  const items = iso?.items || [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (group !== 'all' && groupKey(it) !== group) return false;
      if (onlyDocumented && !it.documented) return false;
      const rec = byId[it.id];
      if (statusFilter !== 'all' && effectiveStatus(it, rec) !== statusFilter) return false;
      if (applicability === 'applicable' && !isApplicable(it, rec)) return false;
      if (applicability === 'not_applicable' && isApplicable(it, rec)) return false;
      if (!q) return true;
      return [it.id, it.ref, it.title, it.description, it.evidence, related(it, cfg).join(' ')].some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, byId, search, group, statusFilter, applicability, onlyDocumented, cfg]);

  const stats = useMemo(() => {
    const out = { total: 0, done: 0, na: 0, groups: {} };
    for (const it of items) {
      const rec = byId[it.id];
      const g = (out.groups[groupKey(it)] ||= { total: 0, done: 0, na: 0 });
      if (!isApplicable(it, rec)) { out.na += 1; g.na += 1; continue; }
      out.total += 1; g.total += 1;
      if (effectiveStatus(it, rec) === 'done') { out.done += 1; g.done += 1; }
    }
    return out;
  }, [items, byId]);
  const gaps = useMemo(() => gapSummary(items, (it) => effectiveStatus(it, byId[it.id])), [items, byId]);
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  const save = async (item, patch) => {
    const existing = byId[item.id];
    const p = { ...patch };
    if (isClause(item)) {
      p.applicable = true; // a norma não permite excluir as cláusulas 4 a 10
    } else if ('applicable' in p) {
      if (p.applicable === false && !String(p.justification || '').trim()) { toast.error(t('iso_justification_required')); return; }
      if (p.applicable === false) p.status = 'not_applicable';
      else if (existing?.status === 'not_applicable') p.status = 'pending';
    }
    try {
      if (existing) {
        await base44.entities.ComplianceChecklist.update(existing.id, p);
      } else {
        const section = isClause(item) ? `Cláusula ${item.group} — ${item.group_name}` : `Anexo A, ${item.group} — ${item.group_name}`;
        await base44.entities.ComplianceChecklist.create({
          customer_id: customer?.id || customerId, customer_name: customer?.name || '', framework: cfg.framework,
          section, section_order: Number(item.group), task_text: item.title, task_order: item.order,
          requirement_id: item.id, requirement_ref: `${cfg.standard}, ${isClause(item) ? 'cláusula ' : 'Anexo A, '}${item.ref}`,
          level: item.kind, status: 'pending', applicable: true, ...p,
        });
      }
      qc.invalidateQueries({ queryKey: [`${cfg.key}-checklist`, customerId] });
      toast.success(t('legal_comp_saved'));
    } catch (e) {
      toast.error(e?.message || 'Erro');
    }
  };

  const openRelated = (id) => setParams(cfg.related === 'qnrcs' ? { tab: 'qnrcs', q: id } : { tab: 'iso27001', q: id });
  const fileBase = (customer?.name || 'cliente').replace(/[^\p{L}\p{N}_-]+/gu, '-');
  const statusLabel = (it, rec) => t(`iso_status_${effectiveStatus(it, rec)}`);
  const relHeader = cfg.related === 'qnrcs' ? t('iso_qnrcs_links') : t('iso42_basis_links');

  const exportSoa = () => downloadCsv(`declaracao-aplicabilidade-${cfg.key}-${fileBase}.csv`,
    [t('iso_csv_control'), t('iso_csv_title'), t('iso_csv_applicable'), t('iso_justification'), t('iso_implementation_method'), t('iso_csv_status'), t('iso_owner'), t('iso_due'), relHeader, t('iso_csv_evidence_count')],
    items.filter((it) => !isClause(it)).map((it) => {
      const r = byId[it.id] || {};
      return [it.id, it.title, isApplicable(it, r) ? t('iso_yes') : t('iso_no'), r.justification || '', r.implementation_method || '', statusLabel(it, r),
        r.owner || '', r.due_date || '', related(it, cfg).join(', '), ownCount(it)];
    }));
  const exportClauses = () => downloadCsv(`requisitos-${cfg.key}-${fileBase}.csv`,
    [t('iso_csv_requirement'), t('iso_csv_title'), t('iso_documented'), t('iso_csv_status'), t('iso_owner'), t('iso_due'), t('iso_notes'), relHeader, t('iso_csv_evidence_count')],
    items.filter(isClause).map((it) => {
      const r = byId[it.id] || {};
      return [it.ref, it.title, it.documented ? t('iso_yes') : t('iso_no'), statusLabel(it, r), r.owner || '', r.due_date || '', r.notes || '', related(it, cfg).join(', '), ownCount(it)];
    }));
  const exportGaps = () => downloadCsv(`analise-lacunas-${cfg.key}-${fileBase}.csv`,
    [t('iso_gap_csv_area'), t('iso_csv_requirement'), t('iso_csv_title'), t('iso_gap_csv_state'), t('iso_documented'), t('iso_owner'), t('iso_due'), t('iso_notes'), t('iso_csv_evidence_count')],
    items.map((it) => {
      const r = byId[it.id] || {};
      return [isClause(it) ? t('iso_gap_clauses') : t('iso_gap_controls'), it.id, it.title, t(`iso_gap_${gapState(effectiveStatus(it, r))}`),
        it.documented ? t('iso_yes') : '', r.owner || '', r.due_date || '', r.notes || '', ownCount(it)];
    }));

  if (l1 || l2 || l3) return <Loading />;
  if (!iso) return null;

  const sections = [
    ['clause', t('iso_section_clauses')],
    ['control', t('iso_section_controls')],
  ];
  const groupTitle = (g) => (g.kind === 'clause' ? `${g.code} — ${g.name}` : `A.${g.code} — ${g.name}`);
  const validated = iso.source.validation && iso.source.validation !== 'por_validar';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-1.5">
        <p className="text-sm flex gap-2"><AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />{t(cfg.banner)}</p>
        {!validated && <p className="text-xs font-medium text-amber-700 dark:text-amber-400 pl-6">{t('iso_validation_pending')}</p>}
      </div>

      <Card>
        <CardContent className="p-4 space-y-1">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold">{iso.source.title}</p>
              <p className="text-xs text-muted-foreground">{iso.source.edition}</p>
            </div>
            <SourceLink url={iso.source.url} label={t('iso_standard_page')} />
          </div>
          <p className="text-xs text-muted-foreground">{iso.source.links_ref}</p>
          {validated && (
            <p className="text-xs text-muted-foreground flex gap-1.5 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-chart-2 flex-shrink-0 mt-0.5" />
              {t('iso_validated_on', { date: iso.source.validated_on || '' })} {iso.source.validation_note}
            </p>
          )}
        </CardContent>
      </Card>

      {guide === 'iso42001' && <AnnexC data={iso} />}
      {isAdmin && <SourcesChecked standardKey={guide} />}

      {isAdmin && (
        <Select value={selected || ''} onValueChange={setSelected}>
          <SelectTrigger className="sm:w-80"><SelectValue placeholder={t('legal_comp_select_customer')} /></SelectTrigger>
          <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      )}

      {tracking && (
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">{customer?.name ? `${customer.name} · ` : ''}{t('legal_comp_progress')}: {pct}%</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="gap-2" onClick={exportSoa}><Download className="w-4 h-4" /> {t('iso_export_soa')}</Button>
              <Button size="sm" variant="ghost" className="gap-2" onClick={exportGaps}><Download className="w-4 h-4" /> {t('iso_export_gaps')}</Button>
              <Button size="sm" variant="ghost" className="gap-2" onClick={exportClauses}><Download className="w-4 h-4" /> {t('iso_export_clauses')}</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Progress value={pct} />
              <p className="text-xs text-muted-foreground">{t('iso_progress_line', { done: stats.done, total: stats.total, na: stats.na })}</p>
            </div>
            <div className="grid md:grid-cols-2 gap-4 rounded-md border p-3">
              <p className="md:col-span-2 text-xs font-semibold">{t('iso_gap_title')}</p>
              <GapBar label={t('iso_gap_clauses')} s={gaps.clauses} />
              <GapBar label={t('iso_gap_controls')} s={gaps.controls} />
              <p className="md:col-span-2 text-[11px] text-muted-foreground">{t('iso_gap_note')}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {iso.groups.map((g) => {
                const s = stats.groups[groupKey(g)] || { total: 0, done: 0, na: 0 };
                return (
                  <div key={groupKey(g)} className="space-y-1">
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="truncate">{groupTitle(g)}</span>
                      <span className="flex-shrink-0">{s.done}/{s.total}{s.na ? ` · ${t('iso_na_short', { count: s.na })}` : ''}</span>
                    </div>
                    <Progress value={s.total ? (s.done / s.total) * 100 : 0} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col lg:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t(cfg.search)} className="pl-9" />
        </div>
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="lg:w-60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('iso_all_groups')}</SelectItem>
            {iso.groups.map((g) => <SelectItem key={groupKey(g)} value={groupKey(g)}>{g.kind === 'clause' ? `${t('iso_clause')} ${groupTitle(g)}` : groupTitle(g)}</SelectItem>)}
          </SelectContent>
        </Select>
        {tracking && (
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="lg:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('iso_all_status')}</SelectItem>
                {[...STATUSES, 'not_applicable'].map((s) => <SelectItem key={s} value={s}>{t(`iso_status_${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={applicability} onValueChange={setApplicability}>
              <SelectTrigger className="lg:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('iso_all_applicability')}</SelectItem>
                <SelectItem value="applicable">{t('iso_applicable')}</SelectItem>
                <SelectItem value="not_applicable">{t('iso_not_applicable')}</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">{t('iso_items_count', { count: filtered.length })}</p>
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={onlyDocumented} onCheckedChange={setOnlyDocumented} />{t('iso_only_documented')}
        </label>
      </div>

      {sections.map(([kind, label]) => {
        const groups = iso.groups.filter((g) => g.kind === kind)
          .map((g) => ({ ...g, items: filtered.filter((it) => groupKey(it) === groupKey(g)) }))
          .filter((g) => g.items.length);
        if (!groups.length) return null;
        return (
          <section key={kind} className="space-y-2">
            <h3 className="text-sm font-semibold">{label}</h3>
            <Accordion type="multiple" className="space-y-2" defaultValue={search ? groups.map((g) => groupKey(g)) : undefined}>
              {groups.map((g) => (
                <AccordionItem key={groupKey(g)} value={groupKey(g)} className="border rounded-lg px-3">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-1 items-center justify-between gap-3 pr-2 text-left flex-wrap">
                      <span className="font-semibold">{groupTitle(g)} <span className="text-xs text-muted-foreground font-normal">({g.items.length})</span></span>
                      {tracking && <GroupProgress stats={stats.groups[groupKey(g)]} />}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {g.items.map((it) => (
                      <ItemRow key={it.id} cfg={cfg} item={it} record={byId[it.id]} tracking={tracking} canEdit={canEdit && Boolean(customer)}
                        onSave={(patch) => save(it, patch)} evState={evByKey[linkKey(cfg.linkType, it.id)]}
                        ownCount={tracking ? ownCount(it) : 0} linkedCount={tracking ? linkedCount(it) : 0} qmap={qmap} iso27={iso27}
                        customerId={customerId} provider={customer?.storage_provider} onRelated={openRelated} />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        );
      })}
      {filtered.length === 0 && <Card><CardContent className="p-4 text-sm text-muted-foreground">{t('iso_no_results')}</CardContent></Card>}
    </div>
  );
}
