import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Loader2, Search, Plus, X, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import { openFile, FILE_SCHEME } from '@/lib/cloudStorage';
import { EVIDENCE_TYPES, EVIDENCE_METHODS } from '@/lib/evidence';
import { getIntake, acceptIntake, rejectIntake, DOC_LEVEL_TO_KEY, CLASSIFY_FOLDERS, INTAKE_OPEN_STATES } from '@/lib/intake';

const ASSESSMENT_STYLE = {
  covers: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
  partial: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
  does_not_cover: 'bg-destructive/10 text-destructive border-destructive/30',
};

const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—');

function ConfidenceBar({ value, label }) {
  const pct = Math.round((Number(value) || 0) * 100);
  return (
    <div className="flex items-center gap-2 min-w-[120px]" title={`${label}: ${pct}%`}>
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-9 text-right">{pct}%</span>
    </div>
  );
}

function CandidateHead({ c, t }) {
  if (!c) return null;
  return (
    <span className="flex items-baseline gap-2 flex-wrap">
      <span className="font-mono text-xs font-semibold text-primary">{c.code}</span>
      {c.level && c.kind === 'measure' && <Badge variant="outline" className="text-[10px]">{c.level}</Badge>}
      {c.group && <Badge variant="outline" className="text-[10px]">{t('intake_epr_group', { group: c.group })}</Badge>}
      <Badge variant="secondary" className="text-[10px]">{t(`intake_kind_${c.kind}`)}</Badge>
      <span className="text-sm">{c.title}</span>
    </span>
  );
}

/**
 * Revisão de um documento por classificar: a pessoa confirma ou corrige a proposta e indexa-o como evidência
 * «Por rever». Sem proposta da IA (ponto de uso desligado ou sem licença), mostra a pré-seleção e permite indexar à mão.
 */
export default function IntakeReviewDialog({ intakeId, open, onOpenChange, onDone }) {
  const { t } = useLanguage();
  const { data, isLoading, error } = useQuery({
    queryKey: ['intake', intakeId],
    queryFn: () => getIntake(intakeId),
    enabled: Boolean(open && intakeId),
  });
  const intake = data?.intake;
  const cls = intake?.classification || null;
  const editable = intake && INTAKE_OPEN_STATES.includes(intake.status);

  const byId = useMemo(() => {
    const m = {};
    (data?.catalog || []).forEach((c) => { m[c.id] = c; });
    (data?.candidates || []).forEach((c) => { m[c.id] = { ...m[c.id], ...c }; });
    return m;
  }, [data]);

  const [selected, setSelected] = useState({});
  const [manual, setManual] = useState([]);
  const [title, setTitle] = useState('');
  const [evidenceType, setEvidenceType] = useState('other');
  const [method, setMethod] = useState('examine');
  const [validUntil, setValidUntil] = useState('');
  const [folderKey, setFolderKey] = useState('evidence');
  const [createDoc, setCreateDoc] = useState(false);
  const [docLevel, setDocLevel] = useState('L1');
  const [docTitle, setDocTitle] = useState('');
  const [search, setSearch] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');

  // Valores iniciais a partir da proposta (ou do nome do ficheiro, sem proposta).
  useEffect(() => {
    if (!intake) return;
    const sel = {};
    (cls?.links || []).forEach((l) => { sel[l.candidate_id] = l.assessment !== 'does_not_cover' && l.confidence >= 0.5; });
    setSelected(sel);
    setManual([]);
    setTitle(cls?.title || intake.file_name.replace(/\.[^.]+$/, ''));
    setEvidenceType(cls?.evidence_type || 'other');
    setMethod(cls?.method || 'examine');
    setValidUntil(cls?.valid_until || '');
    setFolderKey(CLASSIFY_FOLDERS.includes(cls?.folder_key) ? cls.folder_key : 'evidence');
    setCreateDoc(false);
    setDocLevel(cls?.security_doc_level || 'L1');
    setDocTitle(cls?.title || '');
    setRejecting(false);
    setReason('');
    setSearch('');
  }, [intake?.id, intake?.updated_date]); // eslint-disable-line react-hooks/exhaustive-deps

  const proposedIds = new Set((cls?.links || []).map((l) => l.candidate_id));
  // Sem proposta: a pré-seleção (sem IA) aparece como sugestão, por marcar.
  const suggestions = cls ? [] : (data?.candidates || []).filter((c) => c.kind !== 'doc_level');
  const chosen = [...new Set([...Object.keys(selected).filter((k) => selected[k]), ...manual])];

  const results = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (s.length < 2) return [];
    const taken = new Set([...proposedIds, ...manual, ...suggestions.map((c) => c.id)]);
    return (data?.catalog || [])
      .filter((c) => !taken.has(c.id) && `${c.code} ${c.title}`.toLowerCase().includes(s))
      .slice(0, 8);
  }, [search, data?.catalog, manual, cls]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDoc = async () => {
    try { await openFile(`${FILE_SCHEME}${intake.stored_file_id}`, intake.file_name); } catch (e) { toast.error(e?.message || t('repo_open_error')); }
  };

  const accept = async () => {
    setBusy('accept');
    try {
      const res = await acceptIntake(intake.id, {
        links: chosen, title, evidence_type: evidenceType, method, folder_key: folderKey,
        ...(validUntil ? { valid_until: validUntil } : {}),
        ...(createDoc ? { create_security_document: { level: docLevel, title: docTitle || title } } : {}),
      });
      toast.success(res?.security_document ? t('intake_indexed_with_doc') : t('intake_indexed'));
      if (res?.skipped?.length) toast.message(t('intake_skipped', { n: res.skipped.length }));
      onDone?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.message || t('intake_error'));
    } finally {
      setBusy('');
    }
  };

  const reject = async () => {
    setBusy('reject');
    try {
      await rejectIntake(intake.id, reason);
      toast.success(t('intake_rejected_ok'));
      onDone?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.message || t('intake_error'));
    } finally {
      setBusy('');
    }
  };

  const linkRow = (c, extra = {}) => {
    const id = c?.id || extra.candidate_id;
    const disabled = !editable || (c && !c.linkable);
    const isManual = manual.includes(id);
    const checked = isManual || Boolean(selected[id]);
    return (
      <div key={id} className="rounded-md border p-3 space-y-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id={`lk-${id}`} checked={checked} disabled={disabled} className="mt-0.5"
            onCheckedChange={(v) => (isManual ? setManual((m) => m.filter((x) => x !== id)) : setSelected((s) => ({ ...s, [id]: Boolean(v) })))}
            aria-label={c ? `${c.code} — ${c.title}` : id}
          />
          <label htmlFor={`lk-${id}`} className="flex-1 min-w-0 space-y-1 cursor-pointer">
            {c ? <CandidateHead c={c} t={t} /> : <span className="font-mono text-xs">{id}</span>}
            {c?.check && <span className="block text-xs text-muted-foreground"><span className="font-medium">{t('x_measure_expected')}:</span> {c.check}</span>}
          </label>
          {isManual && editable && (
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setManual((m) => m.filter((x) => x !== id))} aria-label={t('intake_remove')}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        {c && !c.linkable && <p className="text-xs text-amber-700 dark:text-amber-400">{t('intake_journey_missing')}</p>}
        {extra.candidate_id && (
          <div className="pl-7 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <ConfidenceBar value={extra.confidence} label={t('intake_confidence')} />
              <Badge variant="outline" className={`text-[10px] ${ASSESSMENT_STYLE[extra.assessment] || ''}`}>{t(`intake_assess_${extra.assessment}`)}</Badge>
            </div>
            {extra.excerpt && (
              <blockquote className="border-l-2 pl-3 text-xs italic text-muted-foreground">
                «{extra.excerpt}»
                {extra.excerpt_unverified && <Badge variant="outline" className="ml-2 text-[10px] not-italic">{t('intake_excerpt_unverified')}</Badge>}
              </blockquote>
            )}
            {extra.excerpt_dropped && <p className="text-xs text-muted-foreground">{t('intake_excerpt_dropped')}</p>}
            {extra.missing && <p className="text-xs"><span className="font-medium">{t('intake_missing')}:</span> {extra.missing}</p>}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('intake_review_title')}</DialogTitle>
          <DialogDescription>{t('intake_review_note')}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <p className="text-sm text-destructive">{error.message}</p>
        ) : intake && (
          <div className="space-y-5">
            <section className="rounded-lg border p-4 space-y-2" aria-label={t('intake_document')}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {cls?.document_kind && <Badge variant="secondary">{t(`intake_doc_kind_${cls.document_kind}`)}</Badge>}
                    {cls?.security_doc_level && <Badge variant="outline">{t(`docs_dlg_level_${DOC_LEVEL_TO_KEY[cls.security_doc_level]}`)}</Badge>}
                    <Badge variant="outline">{t(`intake_status_${intake.status}`)}</Badge>
                  </div>
                  <p className="font-medium break-words">{cls?.title || intake.file_name}</p>
                  <p className="text-xs text-muted-foreground break-all">{intake.file_name}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={openDoc}><ExternalLink className="w-4 h-4" />{t('repo_open')}</Button>
              </div>
              {cls && (
                <>
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div><dt className="text-muted-foreground">{t('intake_issued')}</dt><dd>{fmtDate(cls.issued_date)}</dd></div>
                    <div><dt className="text-muted-foreground">{t('intake_valid_until')}</dt><dd>{fmtDate(cls.valid_until)}</dd></div>
                    <div><dt className="text-muted-foreground">{t('intake_review_date')}</dt><dd>{fmtDate(cls.review_date)}</dd></div>
                    <div><dt className="text-muted-foreground">{t('intake_approver')}</dt><dd className="break-words">{cls.approver_detected || '—'}</dd></div>
                  </dl>
                  {cls.summary && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{cls.summary}</p>}
                  <p className="text-[11px] text-muted-foreground">{t('intake_engine', { provider: cls.provider || '—', model: cls.model || '—' })}</p>
                  {cls.warnings?.length > 0 && (
                    <ul className="text-[11px] text-muted-foreground list-disc pl-4">{cls.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                  )}
                </>
              )}
              {!cls && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />{t('intake_no_proposal')}</p>}
              {intake.status === 'error' && intake.error_message && <p className="text-xs text-destructive">{intake.error_message}</p>}
              {intake.status === 'rejected' && intake.rejection_reason && <p className="text-xs">{t('intake_reason')}: {intake.rejection_reason}</p>}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{cls ? t('intake_proposed_links') : t('intake_suggestions')}</h3>
              {cls && (cls.links || []).length === 0 && <p className="text-xs text-muted-foreground">{t('intake_no_links')}</p>}
              {(cls?.links || []).map((l) => linkRow(byId[l.candidate_id], l))}
              {suggestions.map((c) => linkRow(byId[c.id] || c))}
              {manual.filter((id) => !proposedIds.has(id) && !suggestions.some((s) => s.id === id)).map((id) => linkRow(byId[id], {}))}
              {editable && (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="intake-search" className="text-xs">{t('intake_add_manual')}</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="intake-search" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('intake_search_placeholder')} />
                  </div>
                  {results.length > 0 && (
                    <ul className="rounded-md border divide-y">
                      {results.map((c) => (
                        <li key={c.id}>
                          <button type="button" disabled={!c.linkable} className="w-full text-left px-3 py-2 hover:bg-muted/50 disabled:opacity-50 flex items-start gap-2"
                            onClick={() => { setManual((m) => [...m, c.id]); setSearch(''); }}>
                            <Plus className="w-4 h-4 mt-0.5 flex-shrink-0" /><CandidateHead c={c} t={t} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            {editable && (
              <section className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="intake-title">{t('intake_ev_title')}</Label>
                  <Input id="intake-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('intake_ev_type')}</Label>
                  <Select value={evidenceType} onValueChange={setEvidenceType}>
                    <SelectTrigger aria-label={t('intake_ev_type')}><SelectValue /></SelectTrigger>
                    <SelectContent>{EVIDENCE_TYPES.map((x) => <SelectItem key={x} value={x}>{t(`ev_type_${x}`)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('intake_ev_method')}</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger aria-label={t('intake_ev_method')}><SelectValue /></SelectTrigger>
                    <SelectContent>{EVIDENCE_METHODS.map((x) => <SelectItem key={x} value={x}>{t(`ev_method_${x}`)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="intake-valid">{t('intake_valid_until')}</Label>
                  <Input id="intake-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('intake_folder')}</Label>
                  <Select value={folderKey} onValueChange={setFolderKey}>
                    <SelectTrigger aria-label={t('intake_folder')}><SelectValue /></SelectTrigger>
                    <SelectContent>{CLASSIFY_FOLDERS.map((k) => <SelectItem key={k} value={k}>{t(`repo_folder_${k}`)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="intake-create-doc" checked={createDoc} onCheckedChange={(v) => setCreateDoc(Boolean(v))} />
                    <Label htmlFor="intake-create-doc" className="font-normal">{t('intake_create_doc', { level: docLevel })}</Label>
                  </div>
                  {createDoc && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Select value={docLevel} onValueChange={setDocLevel}>
                        <SelectTrigger aria-label={t('docs_dlg_level')}><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(DOC_LEVEL_TO_KEY).map(([lv, key]) => <SelectItem key={lv} value={lv}>{t(`docs_dlg_level_${key}`)}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input className="sm:col-span-2" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder={t('intake_doc_title')} aria-label={t('intake_doc_title')} maxLength={200} />
                    </div>
                  )}
                </div>
              </section>
            )}

            {rejecting && (
              <div className="space-y-1.5">
                <Label htmlFor="intake-reason">{t('intake_reason')}</Label>
                <Textarea id="intake-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
              </div>
            )}

            <p className="text-xs text-muted-foreground">{t('intake_decision_note')}</p>
          </div>
        )}

        {editable && (
          <DialogFooter className="gap-2">
            {rejecting ? (
              <>
                <Button variant="ghost" onClick={() => setRejecting(false)} disabled={Boolean(busy)}>{t('common_cancel')}</Button>
                <Button variant="destructive" onClick={reject} disabled={Boolean(busy)}>
                  {busy === 'reject' && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}{t('intake_reject_confirm')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setRejecting(true)} disabled={Boolean(busy)}>{t('intake_reject')}</Button>
                <Button onClick={accept} disabled={Boolean(busy) || chosen.length === 0 || title.trim().length < 3}>
                  {busy === 'accept' && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}{t('intake_index', { n: chosen.length })}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
