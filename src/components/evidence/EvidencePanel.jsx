import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paperclip, Upload, Download, Check, X, Loader2, ShieldCheck, Trash2, RefreshCw, Sparkles } from 'lucide-react';
import { useLicense, hasModule } from '@/lib/licensing';
import { aiReview } from '@/lib/ai';
import AiDraftDialog from '@/components/ai/AiDraftDialog';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import {
  uploadEvidence, openEvidence, reviewEvidence, deleteEvidence, evidenceState, linkKey,
  EVIDENCE_ACCEPT, EVIDENCE_TYPES, EVIDENCE_METHODS,
} from '@/lib/evidence';

const STATE_STYLE = {
  valid: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
  pending: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
  expired: 'bg-destructive/10 text-destructive border-destructive/30',
  rejected: 'bg-muted text-muted-foreground line-through',
  superseded: 'bg-muted text-muted-foreground',
};

/** Todas as evidências de um cliente (uma só consulta partilhada pela página). */
export function useCustomerEvidence(customerId) {
  return useQuery({
    queryKey: ['evidence', customerId],
    queryFn: () => base44.entities.Evidence.filter({ customer_id: customerId }, '-created_date', 2000),
    enabled: Boolean(customerId),
  });
}

/** Evidências de um cliente para uma chave de ligação (ex.: asset:<id>); filtro feito no browser. */
export function useEvidence(customerId, key) {
  const q = useCustomerEvidence(customerId);
  const data = key ? (q.data || []).filter((e) => (e.link_keys || []).includes(key)) : (q.data || []);
  return { ...q, data };
}

/** Mapa chave de ligação → estado agregado (valid se existir pelo menos uma evidência aceite e válida). */
export function evidenceSummary(items = []) {
  const rank = { valid: 4, pending: 3, expired: 2, rejected: 1 };
  const out = {};
  for (const ev of items) {
    const st = evidenceState(ev);
    if (st === 'superseded') continue; // só conta a versão mais recente
    for (const k of ev.link_keys || []) if (!out[k] || rank[st] > rank[out[k]]) out[k] = st;
  }
  return out;
}

/**
 * Painel de evidências com ficheiro anexo, para qualquer registo.
 * links: [{ type, id, ref?, label? }] — a primeira ligação define a lista mostrada.
 */
export default function EvidencePanel({ customerId, provider: providerProp, links, canUpload = true, className = '' }) {
  // O repositório é o do cliente; se não for passado, lê-se do registo do cliente.
  const { data: cust } = useQuery({
    queryKey: ['evidence-customer', customerId],
    queryFn: () => base44.entities.Customer.get(customerId),
    enabled: Boolean(customerId) && !providerProp,
    staleTime: 5 * 60 * 1000,
  });
  const provider = providerProp || cust?.storage_provider || 'base44';
  const { t } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const key = links?.[0] ? linkKey(links[0].type, links[0].id) : null;
  const { data: items = [], isLoading } = useEvidence(customerId, key);
  const fileRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [replacing, setReplacing] = useState(null); // evidência de que se carrega uma nova versão
  const { data: license } = useLicense(isAdmin ? customerId : undefined);
  const aiAllowed = (isAdmin || user?.role === 'customer_admin') && hasModule(license, user, 'ai_assistant');
  const [review, setReview] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const runReview = async (ev) => {
    setReviewing(ev.id);
    try { const r = await aiReview(customerId, ev.id); setReview(r.draft); } catch (e) { toast.error(e?.message || t('ev_error')); } finally { setReviewing(null); }
  };
  const [form, setForm] = useState({ title: '', description: '', evidence_type: 'other', method: 'examine', collected_at: new Date().toISOString().slice(0, 10), valid_until: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const refresh = () => qc.invalidateQueries({ queryKey: ['evidence', customerId] });

  const submit = async () => {
    if (!file || !form.title.trim()) { toast.error(t('ev_missing')); return; }
    setBusy(true);
    try {
      await uploadEvidence({ file, customerId, meta: { ...form, links, ...(replacing ? { supersedes_id: replacing.id } : {}) } });
      toast.success(t('ev_uploaded'));
      setOpen(false); setFile(null); setReplacing(null); setForm((f) => ({ ...f, title: '', description: '', valid_until: '' }));
      refresh();
    } catch (e) {
      toast.error(e?.message || t('ev_error'));
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn, okMsg) => {
    try { await fn(); if (okMsg) toast.success(okMsg); refresh(); } catch (e) { toast.error(e?.message || t('ev_error')); }
  };

  if (!customerId || !key) return null;

  return (
    <div className={`rounded-md border p-3 space-y-2 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <Paperclip className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">{t('ev_title')}</span>
        <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
        <span className="text-[11px] text-muted-foreground">{t(`ev_repo_${provider || 'base44'}`)}</span>
        {canUpload && (
          <Button type="button" size="sm" variant="outline" className="ml-auto h-7 text-xs gap-1" onClick={() => setOpen((v) => !v)}>
            <Upload className="w-3.5 h-3.5" /> {t('ev_add')}
          </Button>
        )}
      </div>

      {open && (
        <div className="grid sm:grid-cols-2 gap-2 rounded-md bg-muted/40 p-2">
          {replacing && <p className="sm:col-span-2 text-xs font-medium">{t('ev_new_version_of', { title: replacing.title, v: (replacing.version || 1) + 1 })}</p>}
          <div className="sm:col-span-2 flex items-center gap-2">
            <input ref={fileRef} type="file" accept={EVIDENCE_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; setFile(f || null); if (f && !form.title) set('title', f.name.replace(/\.[^.]+$/, '')); }} />
            <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>{t('ev_choose_file')}</Button>
            <span className="text-xs truncate">{file ? `${file.name} (${Math.ceil(file.size / 1024)} KB)` : t('ev_no_file')}</span>
          </div>
          <div className="space-y-1"><Label className="text-xs">{t('ev_field_title')} *</Label><Input value={form.title} onChange={(e) => set('title', e.target.value)} /></div>
          <div className="space-y-1">
            <Label className="text-xs">{t('ev_field_type')}</Label>
            <Select value={form.evidence_type} onValueChange={(v) => set('evidence_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EVIDENCE_TYPES.map((x) => <SelectItem key={x} value={x}>{t(`ev_type_${x}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('ev_field_method')}</Label>
            <Select value={form.method} onValueChange={(v) => set('method', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EVIDENCE_METHODS.map((x) => <SelectItem key={x} value={x}>{t(`ev_method_${x}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">{t('ev_field_collected')}</Label><Input type="date" value={form.collected_at} onChange={(e) => set('collected_at', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">{t('ev_field_valid_until')}</Label><Input type="date" value={form.valid_until} onChange={(e) => set('valid_until', e.target.value)} /></div>
          </div>
          <div className="sm:col-span-2 space-y-1"><Label className="text-xs">{t('ev_field_description')}</Label><Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} /></div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => { setOpen(false); setReplacing(null); }}>{t('common_cancel')}</Button>
            <Button type="button" size="sm" onClick={submit} disabled={busy} className="gap-1">{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{t('ev_submit')}</Button>
          </div>
          <p className="sm:col-span-2 text-[11px] text-muted-foreground">{t('ev_privacy_note')}</p>
        </div>
      )}

      {isLoading ? <p className="text-xs text-muted-foreground">{t('common_loading')}</p> : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('ev_none')}</p>
      ) : (
        <ul className="divide-y">
          {items.map((ev) => {
            const st = evidenceState(ev);
            return (
              <li key={ev.id} className={`py-2 flex flex-wrap items-center gap-2 text-xs ${st === 'superseded' ? 'opacity-60' : ''}`}>
                <Badge variant="outline" className={`text-[10px] ${STATE_STYLE[st]}`}>{t(`ev_state_${st}`)}</Badge>
                <span className="font-medium">{ev.title}</span>
                {ev.version > 1 && <span className="text-muted-foreground">v{ev.version}</span>}
                <span className="text-muted-foreground">{t(`ev_type_${ev.evidence_type || 'other'}`)} · {ev.collected_at}{ev.valid_until ? ` → ${ev.valid_until}` : ''}</span>
                <span className="text-muted-foreground font-mono" title={ev.sha256}>SHA-256 {ev.sha256?.slice(0, 10)}…</span>
                <div className="ml-auto flex gap-1">
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title={t('ev_open')} onClick={() => act(() => openEvidence(ev))}><Download className="w-3.5 h-3.5" /></Button>
                  {aiAllowed && !ev.restricted && (ev.link_keys || []).some((k) => k.startsWith('measure:')) && /^(application\/pdf|image\/|text\/)/.test(ev.mime_type || '') && (
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title={t('ai_review_button')} disabled={reviewing === ev.id} onClick={() => runReview(ev)}>
                      {reviewing === ev.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                  {canUpload && st !== 'superseded' && <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title={t('ev_new_version')} onClick={() => { setReplacing(ev); setForm((f) => ({ ...f, title: ev.title, evidence_type: ev.evidence_type || 'other', method: ev.method || 'examine', description: ev.description || '' })); setOpen(true); }}><RefreshCw className="w-3.5 h-3.5" /></Button>}
                  {isAdmin && ev.status !== 'accepted' && <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title={t('ev_accept')} onClick={() => act(() => reviewEvidence(ev, 'accepted', ''), t('ev_reviewed'))}><Check className="w-3.5 h-3.5 text-chart-2" /></Button>}
                  {isAdmin && ev.status !== 'rejected' && <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title={t('ev_reject')} onClick={() => act(() => reviewEvidence(ev, 'rejected', ''), t('ev_reviewed'))}><X className="w-3.5 h-3.5 text-destructive" /></Button>}
                  {isAdmin && <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title={t('ev_delete')} onClick={() => { if (window.confirm(t('ev_delete_confirm'))) act(() => deleteEvidence(ev), t('ev_deleted')); }}><Trash2 className="w-3.5 h-3.5" /></Button>}
                </div>
                {ev.reviewer_email && <span className="w-full text-[11px] text-muted-foreground flex items-center gap-1"><ShieldCheck className="w-3 h-3" />{t('ev_reviewed_by', { who: ev.reviewer_email })}</span>}
              </li>
            );
          })}
        </ul>
      )}
      <AiDraftDialog open={review !== null} onOpenChange={(v) => !v && setReview(null)} customerId={customerId} initialDraft={review} title={t('ai_review_title')} />
    </div>
  );
}
