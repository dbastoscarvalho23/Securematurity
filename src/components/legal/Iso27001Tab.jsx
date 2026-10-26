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
import { AlertTriangle, Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { loadLegal, flattenQnrcs, LEVELS } from '@/lib/legal';
import { linkKey, evidenceState } from '@/lib/evidence';
import EvidencePanel, { useCustomerEvidence, evidenceSummary } from '@/components/evidence/EvidencePanel';
import { LevelBadge, Loading, SourceLink, downloadCsv, useLegalData } from './shared';

/** Registos do guia ISO/IEC 27001 na entidade ComplianceChecklist. */
export const ISO_FRAMEWORK = 'ISO27001_2022';
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

const groupKey = (g) => `${g.kind}:${g.code}`;
const isClause = (item) => item.kind === 'clause';
/** Secção gravada no registo (texto fixo em português, como nas outras checklists). */
const sectionLabel = (item) => (isClause(item) ? `Cláusula ${item.group} — ${item.group_name}` : `Anexo A, ${item.group} — ${item.group_name}`);
const requirementRef = (item) => `ISO/IEC 27001:2022, ${isClause(item) ? 'cláusula ' : 'Anexo A, '}${item.ref}`;

/** As cláusulas 4 a 10 são sempre aplicáveis; um controlo só deixa de o ser por decisão registada. */
const isApplicable = (item, record) => isClause(item) || (record?.applicable !== false && record?.status !== 'not_applicable');
const effectiveStatus = (item, record) => (isApplicable(item, record) ? (record?.status && record.status !== 'not_applicable' ? record.status : 'pending') : 'not_applicable');

function draftFrom(record) {
  return {
    owner: record?.owner || '', due_date: record?.due_date || '', notes: record?.notes || '',
    applicable: record ? record.applicable !== false && record.status !== 'not_applicable' : true,
    justification: record?.justification || '',
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

function ItemRow({ item, record, tracking, canEdit, onSave, evState, ownCount, linkedCount, qmap, customerId, provider, onQnrcs }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => draftFrom(record));
  // O registo pode chegar depois da primeira renderização ou mudar após gravar.
  useEffect(() => {
    setDraft(draftFrom(record));
  }, [record?.id, record?.owner, record?.due_date, record?.notes, record?.applicable, record?.status, record?.justification]);
  const applicable = isApplicable(item, record);
  const status = effectiveStatus(item, record);
  const clause = isClause(item);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className={`rounded-md border p-3 space-y-2 bg-card ${applicable ? '' : 'opacity-75'}`}>
      <div className="flex items-start gap-2 flex-wrap">
        <span className="font-mono text-xs font-semibold text-primary">{item.id}</span>
        <p className="text-sm font-semibold flex-1 min-w-[12rem]">{item.title}</p>
        {tracking && evState && <Badge variant="outline" className={`text-[10px] ${EV_BADGE[evState]}`}>{t(`ev_badge_${evState}`)}</Badge>}
        {tracking && linkedCount > 0 && (
          <Badge variant="outline" className="text-[10px]">{t('iso_linked_evidence', { count: linkedCount })}</Badge>
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
      {item.qnrcs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="text-muted-foreground mr-1">{t('iso_qnrcs_links')}:</span>
          {item.qnrcs.map((id) => (
            <button key={id} type="button" onClick={() => onQnrcs(id)} title={qmap[id]?.statement || id}
              className="font-mono px-1.5 py-0.5 rounded bg-muted text-foreground/80 hover:bg-primary/10 hover:text-primary">{id}</button>
          ))}
        </div>
      )}
      {!applicable && record?.justification && (
        <p className="text-xs"><span className="font-medium">{t('iso_justification')}:</span> {record.justification}</p>
      )}
      <button type="button" className="text-xs text-primary hover:underline" onClick={() => setOpen((v) => !v)}>
        {open ? '−' : '+'} {t('iso_official_verification')}{tracking ? ` · ${t('iso_tracking')}` : ''}
      </button>
      {open && (
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold">{t('iso_official_verification')}</p>
            <QnrcsVerification ids={item.qnrcs} qmap={qmap} />
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
                links={[{ type: 'iso27001', id: item.id, ref: item.id, label: `${item.id} — ${item.title}`.slice(0, 160) }]} />
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

export default function Iso27001Tab() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [, setParams] = useSearchParams();
  const isAdmin = user?.role === 'admin';
  const canEdit = isAdmin || user?.role === 'customer_admin';
  const [selected, setSelected] = useState(null);
  const customerId = isAdmin ? selected : user?.customer_id;
  const tracking = Boolean(customerId);

  const { data: iso, loading: l1 } = useLegalData(loadLegal, 'iso27001');
  const { data: qnrcs, loading: l2 } = useLegalData(loadLegal, 'qnrcs');
  const qmap = useMemo(() => Object.fromEntries(flattenQnrcs(qnrcs).map((k) => [k.id, k])), [qnrcs]);

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
    queryKey: ['iso27001-checklist', customerId],
    queryFn: () => base44.entities.ComplianceChecklist.filter({ customer_id: customerId, framework: ISO_FRAMEWORK }, 'task_order', 500),
    enabled: tracking,
  });
  const { data: evidence = [] } = useCustomerEvidence(customerId);
  const evByKey = useMemo(() => evidenceSummary(evidence), [evidence]);

  // Reaproveitamento: evidências do cliente ligadas a medidas (measure:<controlo>@<nível>) ou controlos
  // (control:<controlo>) do QNRCS. Não contam versões substituídas nem evidências rejeitadas.
  const evIndex = useMemo(() => {
    const byQnrcs = {};
    const own = {};
    for (const ev of evidence) {
      const st = evidenceState(ev);
      if (st === 'superseded' || st === 'rejected') continue;
      for (const k of ev.link_keys || []) {
        const m = /^(measure|control):([^@]+)/.exec(k);
        if (m) (byQnrcs[m[2]] ||= new Set()).add(ev.id);
        if (k.startsWith('iso27001:')) (own[k.slice('iso27001:'.length)] ||= new Set()).add(ev.id);
      }
    }
    return { byQnrcs, own };
  }, [evidence]);
  const linkedCount = (item) => {
    const ids = new Set();
    for (const q of item.qnrcs) for (const id of evIndex.byQnrcs[q] || []) ids.add(id);
    return ids.size;
  };
  const ownCount = (item) => evIndex.own[item.id]?.size || 0;

  const byId = useMemo(() => Object.fromEntries(records.map((r) => [r.requirement_id, r])), [records]);

  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [applicability, setApplicability] = useState('all');

  const items = iso?.items || [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (group !== 'all' && groupKey(it) !== group) return false;
      const rec = byId[it.id];
      if (statusFilter !== 'all' && effectiveStatus(it, rec) !== statusFilter) return false;
      if (applicability === 'applicable' && !isApplicable(it, rec)) return false;
      if (applicability === 'not_applicable' && isApplicable(it, rec)) return false;
      if (!q) return true;
      return [it.id, it.ref, it.title, it.description, it.evidence, it.qnrcs.join(' ')].some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, byId, search, group, statusFilter, applicability]);

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
        await base44.entities.ComplianceChecklist.create({
          customer_id: customer?.id || customerId, customer_name: customer?.name || '', framework: ISO_FRAMEWORK,
          section: sectionLabel(item), section_order: Number(item.group), task_text: item.title, task_order: item.order,
          requirement_id: item.id, requirement_ref: requirementRef(item), level: item.kind, status: 'pending', applicable: true, ...p,
        });
      }
      qc.invalidateQueries({ queryKey: ['iso27001-checklist', customerId] });
      toast.success(t('legal_comp_saved'));
    } catch (e) {
      toast.error(e?.message || 'Erro');
    }
  };

  const openQnrcs = (id) => setParams({ tab: 'qnrcs', q: id });
  const fileBase = (customer?.name || 'cliente').replace(/[^\p{L}\p{N}_-]+/gu, '-');
  const statusLabel = (it, rec) => t(`iso_status_${effectiveStatus(it, rec)}`);

  const exportSoa = () => downloadCsv(`declaracao-aplicabilidade-${fileBase}.csv`,
    [t('iso_csv_control'), t('iso_csv_title'), t('iso_csv_applicable'), t('iso_justification'), t('iso_csv_status'), t('iso_owner'), t('iso_due'), t('iso_qnrcs_links'), t('iso_csv_evidence_count')],
    items.filter((it) => !isClause(it)).map((it) => {
      const r = byId[it.id] || {};
      return [it.id, it.title, isApplicable(it, r) ? t('iso_yes') : t('iso_no'), r.justification || '', statusLabel(it, r),
        r.owner || '', r.due_date || '', it.qnrcs.join(', '), ownCount(it)];
    }));
  const exportClauses = () => downloadCsv(`requisitos-iso27001-${fileBase}.csv`,
    [t('iso_csv_requirement'), t('iso_csv_title'), t('iso_csv_status'), t('iso_owner'), t('iso_due'), t('iso_notes'), t('iso_qnrcs_links'), t('iso_csv_evidence_count')],
    items.filter(isClause).map((it) => {
      const r = byId[it.id] || {};
      return [it.ref, it.title, statusLabel(it, r), r.owner || '', r.due_date || '', r.notes || '', it.qnrcs.join(', '), ownCount(it)];
    }));

  if (l1 || l2) return <Loading />;
  if (!iso) return null;

  const sections = [
    ['clause', t('iso_section_clauses')],
    ['control', t('iso_section_controls')],
  ];
  const groupTitle = (g) => (g.kind === 'clause' ? `${g.code} — ${g.name}` : `A.${g.code} — ${g.name}`);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-1.5">
        <p className="text-sm flex gap-2"><AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />{t('iso_banner')}</p>
        {iso.source.validation === 'por_validar' && <p className="text-xs font-medium text-amber-700 dark:text-amber-400 pl-6">{t('iso_validation_pending')}</p>}
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
        </CardContent>
      </Card>

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
              <Button size="sm" variant="ghost" className="gap-2" onClick={exportClauses}><Download className="w-4 h-4" /> {t('iso_export_clauses')}</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={pct} />
            <p className="text-xs text-muted-foreground">{t('iso_progress_line', { done: stats.done, total: stats.total, na: stats.na })}</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
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
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('iso_search')} className="pl-9" />
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
      <p className="text-xs text-muted-foreground">{t('iso_items_count', { count: filtered.length })}</p>

      {sections.map(([kind, label]) => {
        const groups = iso.groups.filter((g) => g.kind === kind)
          .map((g) => ({ ...g, items: filtered.filter((it) => groupKey(it) === groupKey(g)) }))
          .filter((g) => g.items.length);
        if (!groups.length) return null;
        return (
          <section key={kind} className="space-y-2">
            <h3 className="text-sm font-semibold">{label}</h3>
            <Accordion type="multiple" className="space-y-2">
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
                      <ItemRow key={it.id} item={it} record={byId[it.id]} tracking={tracking} canEdit={canEdit && Boolean(customer)}
                        onSave={(patch) => save(it, patch)} evState={evByKey[linkKey('iso27001', it.id)]}
                        ownCount={tracking ? ownCount(it) : 0} linkedCount={tracking ? linkedCount(it) : 0} qmap={qmap}
                        customerId={customerId} provider={customer?.storage_provider} onQnrcs={openQnrcs} />
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
