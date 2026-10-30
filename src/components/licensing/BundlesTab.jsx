import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Upload, Copy, Archive, ArchiveRestore, Trash2, ChevronRight, ChevronDown, Users } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { callLicensing } from '@/lib/licensing';
import { LIC_KEYS } from './useCatalog';

const CODE = /^[a-z0-9_]{2,60}$/;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const cleanQuotas = (q) => Object.fromEntries(Object.entries(q || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, Number(v)]));

/** Conteúdo publicado do bundle. */
const publishedOf = (tier) => ({ modules: tier.modules || [], excluded: tier.excluded_entitlements || [], quotas: isObj(tier.quotas) ? tier.quotas : {} });
/** Conteúdo em rascunho no servidor (ou o publicado, se não houver rascunho). Rascunhos antigos sem exclusões/quotas herdam as publicadas. */
function serverDraftOf(tier) {
  const pub = publishedOf(tier);
  if (!tier.has_draft) return { ...pub, note: '' };
  return {
    modules: tier.modules_draft || [],
    excluded: Array.isArray(tier.excluded_entitlements_draft) ? tier.excluded_entitlements_draft : pub.excluded,
    quotas: isObj(tier.quotas_draft) ? tier.quotas_draft : pub.quotas,
    note: tier.draft_note || '',
  };
}
const metaOf = (tier) => ({ name: tier.name || '', description: tier.description || '', commercial_value: tier.commercial_value || '', display_order: tier.display_order ?? '' });

/** Diferenças entre o publicado e o rascunho: módulos, funcionalidades (nos módulos que se mantêm) e quotas. */
function diffOf(pub, draft, entitlements) {
  const addMods = draft.modules.filter((c) => !pub.modules.includes(c));
  const delMods = pub.modules.filter((c) => !draft.modules.includes(c));
  const kept = new Set(draft.modules.filter((c) => pub.modules.includes(c)));
  const addEnts = []; const delEnts = [];
  for (const e of entitlements) {
    if (!kept.has(e.module_code)) continue;
    const was = !pub.excluded.includes(e.code); const now = !draft.excluded.includes(e.code);
    if (was && !now) delEnts.push(e); if (!was && now) addEnts.push(e);
  }
  const pq = cleanQuotas(pub.quotas); const dq = cleanQuotas(draft.quotas);
  const quotas = [...new Set([...Object.keys(pq), ...Object.keys(dq)])].filter((k) => pq[k] !== dq[k]).map((k) => ({ k, from: pq[k], to: dq[k] }));
  return { addMods, delMods, addEnts, delEnts, quotas, empty: !addMods.length && !delMods.length && !addEnts.length && !delEnts.length && !quotas.length };
}

function useRefresh() {
  const qc = useQueryClient();
  return () => LIC_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

function QuotaLabel({ value, t }) {
  return value == null ? <span className="text-muted-foreground">{t('lic_no_bundle_quota')}</span> : <span>{value}</span>;
}

function PublishDialog({ tier, diff, affected, moduleNames, onClose, onDone }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await callLicensing({ action: 'publish_tier', code: tier.code }); toast.success(t('lic_published')); onDone(); } catch (e) { toast.error(e?.message); } finally { setBusy(false); }
  };
  const row = (sign, cls, label) => <li key={`${sign}${label}`} className={cls}><span className="font-mono mr-1">{sign}</span>{label}</li>;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('lic_publish_title', { name: tier.name })}</DialogTitle>
          <DialogDescription>{t('lic_publish_affected', { n: affected, v: (tier.version || 0) + 1 })}</DialogDescription>
        </DialogHeader>
        <div className="text-xs space-y-3 max-h-[50vh] overflow-y-auto">
          {diff.empty && <p className="text-muted-foreground">{t('lic_diff_none')}</p>}
          {(diff.addMods.length > 0 || diff.delMods.length > 0) && (
            <section><p className="font-medium mb-1">{t('lic_modules')}</p><ul className="space-y-0.5">
              {diff.addMods.map((c) => row('+', 'text-chart-2', `${t('lic_diff_add')} ${moduleNames[c] || c}`))}
              {diff.delMods.map((c) => row('−', 'text-destructive', `${t('lic_diff_remove')} ${moduleNames[c] || c}`))}
            </ul></section>
          )}
          {(diff.addEnts.length > 0 || diff.delEnts.length > 0) && (
            <section><p className="font-medium mb-1">{t('lic_features')}</p><ul className="space-y-0.5">
              {diff.addEnts.map((e) => row('+', 'text-chart-2', `${t('lic_diff_add')} ${e.name || e.code}`))}
              {diff.delEnts.map((e) => row('−', 'text-destructive', `${t('lic_diff_remove')} ${e.name || e.code}`))}
            </ul></section>
          )}
          {diff.quotas.length > 0 && (
            <section><p className="font-medium mb-1">{t('lic_quotas')}</p><ul className="space-y-0.5">
              {diff.quotas.map((q) => <li key={q.k}><span className="font-mono">{q.k}</span>: <QuotaLabel value={q.from} t={t} /> → <QuotaLabel value={q.to} t={t} /></li>)}
            </ul></section>
          )}
          {tier.draft_note && <p className="text-muted-foreground">{t('lic_draft_note')}: {tier.draft_note}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common_cancel')}</Button>
          <Button onClick={go} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}{t('lic_publish')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateDialog({ tier, onClose, onDone }) {
  const { t } = useLanguage();
  const [code, setCode] = useState(`${tier.code}_2`.slice(0, 60));
  const [name, setName] = useState(`${tier.name} (${t('lic_copy_suffix')})`);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!CODE.test(code)) { toast.error(t('lic_code_invalid')); return; }
    setBusy(true);
    try { await callLicensing({ action: 'duplicate_tier', code: tier.code, new_code: code, name }); toast.success(t('lic_duplicated', { code })); onDone(); } catch (e) { toast.error(e?.message); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t('lic_duplicate_title', { name: tier.name })}</DialogTitle><DialogDescription>{t('lic_duplicate_desc')}</DialogDescription></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1"><Label className="text-xs">{t('lic_code')}</Label><Input className="font-mono" value={code} onChange={(e) => setCode(e.target.value.toLowerCase())} /></div>
          <div className="space-y-1"><Label className="text-xs">{t('lic_name')}</Label><Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common_cancel')}</Button>
          <Button onClick={go} disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{t('lic_duplicate')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({ title, body, confirmLabel, destructive, onClose, onConfirm }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{body}</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common_cancel')}</Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={go} disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BundleCard({ tier, catalog, usage, onDialog }) {
  const { t } = useLanguage();
  const refresh = useRefresh();
  const [meta, setMeta] = useState(null); // null = igual ao servidor
  const [content, setContent] = useState(null);
  const [open, setOpen] = useState(() => new Set());
  const [busy, setBusy] = useState('');
  const m = meta || metaOf(tier);
  const pub = publishedOf(tier);
  const d = content || serverDraftOf(tier);
  const archived = Boolean(tier.archived_at);
  const entsByModule = useMemo(() => catalog.entitlements.reduce((acc, e) => { (acc[e.module_code] ||= []).push(e); return acc; }, {}), [catalog.entitlements]);
  const editMeta = (patch) => setMeta({ ...m, ...patch });
  const editContent = (patch) => setContent({ ...d, ...patch });
  const toggle = (code) => setOpen((s) => { const n = new Set(s); if (n.has(code)) n.delete(code); else n.add(code); return n; });

  const run = async (key, payload, ok, after) => {
    setBusy(key);
    try { await callLicensing(payload); if (ok) toast.success(ok); after?.(); refresh(); } catch (e) { toast.error(e?.message); } finally { setBusy(''); }
  };
  const saveMeta = () => run('meta', { action: 'update_tier', tier: { code: tier.code, ...m, is_active: tier.is_active !== false } }, t('lic_tier_saved'), () => setMeta(null));
  const setActive = (v) => run('active', { action: 'update_tier', tier: { code: tier.code, ...metaOf(tier), is_active: v } }, v ? t('lic_tier_activated') : t('lic_tier_deactivated'));
  const saveDraft = () => run('draft', { action: 'save_tier', tier: { code: tier.code, modules_draft: d.modules, excluded_entitlements_draft: d.excluded, quotas_draft: cleanQuotas(d.quotas), draft_note: d.note } }, t('lic_draft_saved'), () => setContent(null));

  const serverDiff = diffOf(pub, serverDraftOf(tier), catalog.entitlements);
  const quotaShown = new Set();

  return (
    <Card className={archived ? 'opacity-70' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 flex-wrap">{tier.name}<span className="font-mono text-[11px] text-muted-foreground">{tier.code}</span>
          <Badge variant="outline" className="text-[10px]">v{tier.version || 0}</Badge>
          {tier.has_draft && <Badge variant="outline" className="text-[10px] bg-chart-3/10 text-chart-3">{t('lic_draft_pending')}</Badge>}
          {archived ? <Badge variant="outline" className="text-[10px]">{t('lic_archived')}</Badge> : tier.is_active === false && <Badge variant="outline" className="text-[10px] text-muted-foreground">{t('lic_inactive')}</Badge>}
          <span className="ml-auto flex items-center gap-1 text-[11px] font-normal text-muted-foreground" title={t('lic_in_use_help')}><Users className="w-3.5 h-3.5" />{t('lic_in_use', { n: usage.active })}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {/* Dados do bundle: aplicam-se já */}
        <section className="space-y-2">
          <div className="grid grid-cols-6 gap-2">
            <div className="col-span-3 space-y-1"><Label className="text-[11px]">{t('lic_name')}</Label><Input className="h-8" maxLength={120} value={m.name} disabled={archived} onChange={(e) => editMeta({ name: e.target.value })} /></div>
            <div className="col-span-2 space-y-1"><Label className="text-[11px]">{t('lic_value')}</Label><Input className="h-8" maxLength={200} value={m.commercial_value} disabled={archived} onChange={(e) => editMeta({ commercial_value: e.target.value })} /></div>
            <div className="col-span-1 space-y-1"><Label className="text-[11px]">{t('lic_order')}</Label><Input className="h-8" type="number" min={0} max={9999} value={m.display_order} disabled={archived} onChange={(e) => editMeta({ display_order: e.target.value })} /></div>
          </div>
          <Textarea rows={2} maxLength={1000} value={m.description} disabled={archived} onChange={(e) => editMeta({ description: e.target.value })} placeholder={t('lic_description')} />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2"><Switch checked={tier.is_active !== false} disabled={archived || busy === 'active'} onCheckedChange={setActive} />{t('lic_tier_active')}</label>
            <Button size="sm" variant="outline" className="ml-auto h-7" onClick={saveMeta} disabled={!meta || busy === 'meta'}>{busy === 'meta' && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}{t('lic_save_details')}</Button>
          </div>
          {tier.is_active === false && !archived && <p className="text-[11px] text-muted-foreground">{t('lic_inactive_help')}</p>}
        </section>

        {/* Conteúdo: rascunho → publicar */}
        <section className="space-y-2 border-t pt-2">
          <p className="text-[11px] font-medium">{t('lic_content_draft')}</p>
          <div className="rounded border divide-y">
            {catalog.modules.map((mod) => {
              const on = d.modules.includes(mod.code);
              const was = pub.modules.includes(mod.code);
              const ents = entsByModule[mod.code] || [];
              const isOpen = open.has(mod.code);
              const excludedHere = ents.filter((e) => d.excluded.includes(e.code)).length;
              return (
                <div key={mod.code} className="p-1.5">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={on} disabled={archived} onCheckedChange={(v) => editContent({ modules: v ? [...d.modules, mod.code] : d.modules.filter((c) => c !== mod.code) })} />
                    <span className={on !== was ? 'font-medium text-chart-3' : ''}>{on !== was && (on ? '+ ' : '− ')}{mod.name}</span>
                    {mod.is_active === false && <span className="text-muted-foreground">· {t('lic_module_off')}</span>}
                    {ents.length > 0 && (
                      <button type="button" className="ml-auto flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => toggle(mod.code)}>
                        {t('lic_features_count', { n: ents.length - excludedHere, total: ents.length })}{isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  {isOpen && (
                    <div className="mt-1 ml-6 space-y-1">
                      {ents.map((e) => {
                        const inc = !d.excluded.includes(e.code);
                        const incPub = !pub.excluded.includes(e.code);
                        const showQuota = e.quota_feature && !quotaShown.has(e.quota_feature);
                        if (showQuota) quotaShown.add(e.quota_feature);
                        const qv = d.quotas?.[e.quota_feature];
                        const qChanged = showQuota && (cleanQuotas(d.quotas)[e.quota_feature] ?? null) !== (cleanQuotas(pub.quotas)[e.quota_feature] ?? null);
                        return (
                          <div key={e.code} className="flex items-center gap-2">
                            <Checkbox checked={on && inc} disabled={!on || archived || e.is_active === false}
                              onCheckedChange={(v) => editContent({ excluded: v ? d.excluded.filter((c) => c !== e.code) : [...d.excluded, e.code] })} />
                            <span className={`${on && was && inc !== incPub ? 'font-medium text-chart-3' : ''} ${e.is_active === false ? 'text-muted-foreground line-through' : ''}`}>{e.name || e.code}</span>
                            {e.is_active === false && <span className="text-muted-foreground">· {t('lic_feature_off')}</span>}
                            {showQuota && (
                              <span className="ml-auto flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground font-mono">{e.quota_feature}/{t('lic_month')}</span>
                                <Input className={`h-7 w-20 text-xs ${qChanged ? 'border-chart-3' : ''}`} type="number" min={0} disabled={!on || !inc || archived}
                                  value={qv ?? ''} placeholder={t('lic_unlimited')} onChange={(ev) => editContent({ quotas: { ...d.quotas, [e.quota_feature]: ev.target.value } })} />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Input className="h-8" maxLength={500} value={d.note} disabled={archived} onChange={(e) => editContent({ note: e.target.value })} placeholder={t('lic_draft_note')} />
          {tier.has_draft && !content && !serverDiff.empty && (
            <p className="text-[11px] text-chart-3">{t('lic_diff_summary', { add: serverDiff.addMods.length + serverDiff.addEnts.length, del: serverDiff.delMods.length + serverDiff.delEnts.length, q: serverDiff.quotas.length })}</p>
          )}
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={saveDraft} disabled={!content || archived || busy === 'draft'}>{busy === 'draft' && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}{t('lic_save_draft')}</Button>
            <Button size="sm" onClick={() => onDialog({ kind: 'publish', tier, diff: serverDiff, affected: usage.active })} disabled={!tier.has_draft || Boolean(content) || archived}><Upload className="w-3.5 h-3.5 mr-1" />{t('lic_review_publish')}</Button>
          </div>
          {content && <p className="text-[11px] text-muted-foreground text-right">{t('lic_save_before_publish')}</p>}
        </section>

        <div className="flex items-center gap-1 border-t pt-2 flex-wrap">
          {tier.published_at && <span className="text-[11px] text-muted-foreground">{t('lic_published_by', { date: tier.published_at.slice(0, 10), who: tier.published_by_email || '—' })}</span>}
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" className="h-7" onClick={() => onDialog({ kind: 'duplicate', tier })}><Copy className="w-3.5 h-3.5 mr-1" />{t('lic_duplicate')}</Button>
            {archived
              ? <Button size="sm" variant="ghost" className="h-7" onClick={() => onDialog({ kind: 'restore', tier })}><ArchiveRestore className="w-3.5 h-3.5 mr-1" />{t('lic_restore')}</Button>
              : <Button size="sm" variant="ghost" className="h-7" onClick={() => onDialog({ kind: 'archive', tier, usage })}><Archive className="w-3.5 h-3.5 mr-1" />{t('lic_archive')}</Button>}
            {usage.total === 0 && <Button size="sm" variant="ghost" className="h-7 text-destructive" title={t('lic_delete')} onClick={() => onDialog({ kind: 'delete', tier })}><Trash2 className="w-3.5 h-3.5" /></Button>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BundlesTab({ catalog }) {
  const { t } = useLanguage();
  const refresh = useRefresh();
  const { data: subs = [] } = useQuery({ queryKey: ['lic-subs'], queryFn: () => base44.entities.TenantSubscription.list('-updated_date', 2000) });
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const usage = useMemo(() => {
    const o = {};
    for (const s of subs) { const u = (o[s.tier_code] ||= { total: 0, active: 0 }); u.total += 1; if (s.status !== 'closed') u.active += 1; }
    return o;
  }, [subs]);
  const archivedCount = catalog.tiers.filter((x) => x.archived_at).length;
  const tiers = catalog.tiers.filter((x) => showArchived || !x.archived_at);
  const close = () => setDialog(null);
  const done = () => { setDialog(null); refresh(); };

  const create = async () => {
    if (!CODE.test(newCode)) { toast.error(t('lic_code_invalid')); return; }
    if (catalog.tiers.some((x) => x.code === newCode)) { toast.error(t('lic_code_exists')); return; }
    try { await callLicensing({ action: 'save_tier', tier: { code: newCode, name: newName.trim() || newCode, modules_draft: [] } }); toast.success(t('lic_tier_created')); setNewCode(''); setNewName(''); refresh(); } catch (e) { toast.error(e?.message); }
  };
  const simple = (action, ok) => async () => {
    try { await callLicensing({ action, code: dialog.tier.code }); toast.success(ok); done(); } catch (e) { toast.error(e?.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4 flex-wrap">
        <p className="text-xs text-muted-foreground flex-1 min-w-[16rem]">{t('lic_bundles_help')}</p>
        {archivedCount > 0 && <label className="flex items-center gap-2 text-xs"><Switch checked={showArchived} onCheckedChange={setShowArchived} />{t('lic_show_archived', { n: archivedCount })}</label>}
      </div>
      <div className="grid lg:grid-cols-2 2xl:grid-cols-3 gap-4">
        {tiers.map((tier) => <BundleCard key={tier.id} tier={tier} catalog={catalog} usage={usage[tier.code] || { total: 0, active: 0 }} onDialog={setDialog} />)}
      </div>
      <div className="flex gap-2 max-w-xl flex-wrap">
        <Input className="h-8 font-mono w-48" value={newCode} onChange={(e) => setNewCode(e.target.value.toLowerCase())} placeholder={t('lic_new_tier_code')} />
        <Input className="h-8 w-48" value={newName} maxLength={120} onChange={(e) => setNewName(e.target.value)} placeholder={t('lic_name')} />
        <Button size="sm" variant="outline" onClick={create}><Plus className="w-3.5 h-3.5 mr-1" />{t('lic_new_tier')}</Button>
      </div>

      {dialog?.kind === 'publish' && <PublishDialog tier={dialog.tier} diff={dialog.diff} affected={dialog.affected} moduleNames={catalog.moduleNames} onClose={close} onDone={done} />}
      {dialog?.kind === 'duplicate' && <DuplicateDialog tier={dialog.tier} onClose={close} onDone={done} />}
      {dialog?.kind === 'archive' && <ConfirmDialog title={t('lic_archive_title', { name: dialog.tier.name })} body={t('lic_archive_body', { n: dialog.usage.active })} confirmLabel={t('lic_archive')} onClose={close} onConfirm={simple('archive_tier', t('lic_tier_archived'))} />}
      {dialog?.kind === 'restore' && <ConfirmDialog title={t('lic_restore_title', { name: dialog.tier.name })} body={t('lic_restore_body')} confirmLabel={t('lic_restore')} onClose={close} onConfirm={simple('restore_tier', t('lic_tier_restored'))} />}
      {dialog?.kind === 'delete' && <ConfirmDialog destructive title={t('lic_delete_title', { name: dialog.tier.name })} body={t('lic_delete_body')} confirmLabel={t('lic_delete')} onClose={close} onConfirm={simple('delete_tier', t('lic_tier_deleted'))} />}
    </div>
  );
}
