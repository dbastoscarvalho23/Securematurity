import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, Search, BellRing, ExternalLink, Bug, Check, X, Flame, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { suggestCpe, saveWatch, deleteWatch, checkNow, setAlertStatus, convertAlert, manufacturersOf, guessCpeVendor, nvdUrl, OPEN_ALERT } from '@/lib/cve';
import { useAssets } from './AssetsTab';

const SEV_STYLE = {
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
  high: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
};

export function useCveWatches(customerId) {
  return useQuery({ queryKey: ['cve-watches', customerId], queryFn: () => base44.entities.CveWatch.filter({ customer_id: customerId }, 'manufacturer', 500), enabled: Boolean(customerId) });
}
export function useCveAlerts(customerId) {
  return useQuery({ queryKey: ['cve-alerts', customerId], queryFn: () => base44.entities.CveAlert.filter({ customer_id: customerId }, '-published', 2000), enabled: Boolean(customerId) });
}

function WatchDialog({ open, onOpenChange, customer, assets, watch, manufacturer }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const editing = Boolean(watch?.id);
  const [form, setForm] = useState({});
  const [keyword, setKeyword] = useState('');
  const [sugg, setSugg] = useState(null);
  const [busy, setBusy] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    const name = watch?.manufacturer || manufacturer?.name || '';
    setForm({
      manufacturer: name, cpe_vendor: watch?.cpe_vendor || guessCpeVendor(name), cpe_product: watch?.cpe_product || '',
      min_severity: watch?.min_severity || 'critical', enabled: watch?.enabled !== false, notify_email: watch?.notify_email !== false,
      asset_codes: watch?.asset_codes || (manufacturer?.assets || []).map((a) => a.asset_code),
    });
    setKeyword(name); setSugg(null);
  }, [open, watch, manufacturer]);

  const codes = new Set(form.asset_codes || []);
  const toggle = (c) => set('asset_codes', codes.has(c) ? [...codes].filter((x) => x !== c) : [...codes, c]);
  const sameMaker = (a) => String(a.manufacturer || '').trim().toLowerCase() === String(form.manufacturer || '').trim().toLowerCase();
  const list = assets.filter((a) => a.lifecycle !== 'retired').sort((a, b) => Number(sameMaker(b)) - Number(sameMaker(a)));

  const search = async () => {
    setBusy('search');
    try { setSugg(await suggestCpe(keyword)); } catch (e) { toast.error(e?.message || t('ev_error')); } finally { setBusy(''); }
  };
  const save = async () => {
    if (!form.cpe_vendor) { toast.error(t('cve_vendor_required')); return; }
    setBusy('save');
    try {
      await saveWatch(customer.id, form, watch?.id);
      toast.success(t('at_saved'));
      qc.invalidateQueries({ queryKey: ['cve-watches', customer.id] });
      onOpenChange(false);
    } catch (e) { toast.error(e?.message || t('ev_error')); } finally { setBusy(''); }
  };
  const remove = async () => {
    if (!window.confirm(t('cve_watch_delete_confirm', { name: watch.manufacturer }))) return;
    try { await deleteWatch(watch.id); qc.invalidateQueries({ queryKey: ['cve-watches', customer.id] }); onOpenChange(false); } catch (e) { toast.error(e?.message || t('ev_error')); }
  };
  const products = (sugg?.items || []).filter((i) => i.cpe_vendor === form.cpe_vendor);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? `${t('cve_watch')} — ${watch.manufacturer}` : t('cve_watch_new')}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1"><Label className="text-xs">{t('cve_manufacturer')}</Label><Input value={form.manufacturer || ''} onChange={(e) => set('manufacturer', e.target.value)} /></div>
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-xs text-muted-foreground">{t('cve_cpe_help')}</p>
            <div className="flex gap-2">
              <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Fortinet" className="h-8" />
              <Button type="button" size="sm" variant="outline" onClick={search} disabled={busy === 'search' || keyword.trim().length < 2}>
                {busy === 'search' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Search className="w-3.5 h-3.5 mr-1" />}{t('cve_search_nvd')}
              </Button>
            </div>
            {sugg && (sugg.vendors.length === 0 ? <p className="text-xs text-chart-3">{t('cve_no_cpe')}</p> : (
              <div className="flex flex-wrap gap-1">
                {sugg.vendors.map((v) => (
                  <Button key={v} type="button" size="sm" variant={form.cpe_vendor === v ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => { set('cpe_vendor', v); set('cpe_product', ''); }}>{v}</Button>
                ))}
              </div>
            ))}
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">{t('cve_cpe_vendor')} *</Label><Input className="h-8 font-mono" value={form.cpe_vendor || ''} onChange={(e) => set('cpe_vendor', e.target.value.toLowerCase())} /></div>
              <div className="space-y-1">
                <Label className="text-xs">{t('cve_cpe_product')}</Label>
                {products.length ? (
                  <Select value={form.cpe_product || '__all'} onValueChange={(v) => set('cpe_product', v === '__all' ? '' : v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">{t('cve_all_products')}</SelectItem>
                      {products.map((p) => <SelectItem key={p.cpe_product} value={p.cpe_product}>{p.cpe_product}{p.title ? ` — ${p.title.slice(0, 50)}` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : <Input className="h-8 font-mono" value={form.cpe_product || ''} onChange={(e) => set('cpe_product', e.target.value.toLowerCase())} placeholder={t('cve_all_products')} />}
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t('cve_min_severity')}</Label>
              <Select value={form.min_severity || 'critical'} onValueChange={(v) => set('min_severity', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">{t('cve_sev_opt_critical')}</SelectItem>
                  <SelectItem value="high">{t('cve_sev_opt_high')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 pt-5">
              <label className="flex items-center gap-2 text-xs"><Switch checked={!!form.enabled} onCheckedChange={(v) => set('enabled', v)} />{t('cve_enabled')}</label>
              <label className="flex items-center gap-2 text-xs"><Switch checked={!!form.notify_email} onCheckedChange={(v) => set('notify_email', v)} />{t('cve_notify_email')}</label>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('tl_f_assets')} ({codes.size})</Label>
            <div className="max-h-44 overflow-y-auto rounded border p-2 grid sm:grid-cols-2 gap-1">
              {list.length === 0 ? <p className="text-xs text-muted-foreground">{t('at_no_assets')}</p> : list.map((a) => (
                <label key={a.id} className={`flex items-center gap-2 text-xs cursor-pointer ${sameMaker(a) ? '' : 'text-muted-foreground'}`}>
                  <Checkbox checked={codes.has(a.asset_code)} onCheckedChange={() => toggle(a.asset_code)} />
                  <span className="font-mono">{a.asset_code}</span><span className="truncate">{a.name}{a.model_version ? ` · ${a.model_version}` : ''}</span>
                </label>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">{t('cve_privacy_note')}</p>
        </div>
        <DialogFooter className="gap-2">
          {editing && <Button variant="ghost" className="text-destructive mr-auto" onClick={remove}><Trash2 className="w-4 h-4 mr-1" />{t('ev_delete')}</Button>}
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common_cancel')}</Button>
          <Button onClick={save} disabled={busy === 'save'}>{busy === 'save' && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{t('common_save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Monitorização de CVE críticos/elevados por fabricante do inventário. */
export default function CveTab({ customer }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const { data: assets = [] } = useAssets(customer.id);
  const { data: watches = [] } = useCveWatches(customer.id);
  const { data: alerts = [], isLoading } = useCveAlerts(customer.id);
  const [dialog, setDialog] = useState(null);
  const [status, setStatus] = useState('open');
  const [checking, setChecking] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const makers = useMemo(() => manufacturersOf(assets), [assets]);
  const watchedNames = new Set(watches.map((w) => String(w.manufacturer || '').toLowerCase()));
  const byCode = Object.fromEntries(assets.map((a) => [a.asset_code, a]));
  const shown = alerts.filter((a) => (status === 'all' ? true : status === 'open' ? OPEN_ALERT.includes(a.status) : a.status === status));
  const lastCheck = watches.map((w) => w.last_checked_at).filter(Boolean).sort().pop();
  const refresh = () => { qc.invalidateQueries({ queryKey: ['cve-alerts', customer.id] }); qc.invalidateQueries({ queryKey: ['cve-watches', customer.id] }); };

  const runCheck = async () => {
    setChecking(true);
    try {
      const r = await checkNow(customer.id);
      toast.success(t('cve_check_done', { n: r.alerts }) + (r.pending_groups ? ` ${t('cve_check_pending', { n: r.pending_groups })}` : ''));
      if (r.errors) toast.warning(t('cve_check_errors', { n: r.errors }));
      refresh();
    } catch (e) { toast.error(e?.message || t('ev_error')); } finally { setChecking(false); }
  };
  const act = async (a, fn, ok) => {
    setBusyId(a.id);
    try { await fn(); if (ok) toast.success(ok); refresh(); qc.invalidateQueries({ queryKey: ['vulnerabilities'] }); } catch (e) { toast.error(e?.message || t('ev_error')); } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-2"><BellRing className="w-4 h-4 text-primary" />{t('cve_watches_title')}</CardTitle>
            <div className="flex gap-2 items-center">
              {lastCheck && <span className="text-[11px] text-muted-foreground">{t('cve_last_check')}: {lastCheck.replace('T', ' ').slice(0, 16)}</span>}
              <Button size="sm" variant="outline" onClick={runCheck} disabled={checking || !watches.some((w) => w.enabled)}>
                {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}{t('cve_check_now')}
              </Button>
              <Button size="sm" onClick={() => setDialog({ manufacturer: null, watch: null })}>{t('cve_watch_new')}</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('cve_watches_help')}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {watches.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {watches.map((w) => (
                <button key={w.id} type="button" onClick={() => setDialog({ watch: w })} className={`rounded-md border px-2 py-1 text-xs text-left hover:bg-muted/40 ${w.enabled ? '' : 'opacity-50'}`}>
                  <span className="font-medium">{w.manufacturer}</span>
                  <span className="font-mono text-muted-foreground"> {w.cpe_vendor}:{w.cpe_product || '*'}</span>
                  <Badge variant="outline" className={`ml-1 text-[10px] ${SEV_STYLE[w.min_severity]}`}>≥ {w.min_severity === 'high' ? '7,0' : '9,0'}</Badge>
                  <span className="text-muted-foreground"> · {(w.asset_codes || []).length} {t('cve_assets_short')}</span>
                  {w.last_error && <span className="block text-destructive">{w.last_error}</span>}
                </button>
              ))}
            </div>
          )}
          {makers.filter((m) => !watchedNames.has(m.name.toLowerCase())).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium">{t('cve_unwatched')}</p>
              <div className="flex flex-wrap gap-1">
                {makers.filter((m) => !watchedNames.has(m.name.toLowerCase())).map((m) => (
                  <Button key={m.name} size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDialog({ manufacturer: m })}>+ {m.name} ({m.assets.length})</Button>
                ))}
              </div>
            </div>
          )}
          {makers.length === 0 && <p className="text-xs text-muted-foreground">{t('cve_no_manufacturers')}</p>}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-semibold">{t('cve_alerts_title')}</h3>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['open', 'new', 'acknowledged', 'converted', 'dismissed', 'all'].map((s) => <SelectItem key={s} value={s}>{t(`cve_status_${s}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{t('cve_source')}</span>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">{t('common_loading')}</p> : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">{t('cve_no_alerts')}</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr>
                <th className="text-left p-2">CVE</th>
                <th className="text-left p-2">{t('cve_col_severity')}</th>
                <th className="text-left p-2">{t('cve_col_published')}</th>
                <th className="text-left p-2">{t('cve_manufacturer')}</th>
                <th className="text-left p-2">{t('tl_f_assets')}</th>
                <th className="text-left p-2">{t('cve_col_status')}</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => (
                <React.Fragment key={a.id}>
                  <tr className="border-t align-top">
                    <td className="p-2">
                      <a href={nvdUrl(a.cve_id)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1">{a.cve_id}<ExternalLink className="w-3 h-3" /></a>
                      {a.kev && <Badge variant="outline" className="ml-1 text-[10px] bg-destructive/10 text-destructive border-destructive/30" title={t('cve_kev_help')}><Flame className="w-3 h-3 mr-0.5" />KEV</Badge>}
                      <button type="button" className="block text-[11px] text-muted-foreground hover:underline" onClick={() => setExpanded(expanded === a.id ? null : a.id)}>{expanded === a.id ? '−' : '+'} {t('ev_field_description')}</button>
                    </td>
                    <td className="p-2"><Badge variant="outline" className={`text-[10px] ${SEV_STYLE[a.severity]}`}>{t(`cve_sev_${a.severity}`)} {a.cvss_score}</Badge><span className="block text-[10px] text-muted-foreground">CVSS {a.cvss_version}</span></td>
                    <td className="p-2 text-xs">{(a.published || '').slice(0, 10)}</td>
                    <td className="p-2 text-xs">{a.manufacturer}<span className="block font-mono text-[10px] text-muted-foreground">{a.cpe_vendor}:{a.cpe_product || '*'}</span></td>
                    <td className="p-2 text-xs">{(a.asset_codes || []).slice(0, 4).map((c) => <span key={c} className="block">{c}{byCode[c] ? ` ${byCode[c].name}${byCode[c].model_version ? ` (${byCode[c].model_version})` : ''}` : ''}</span>)}{(a.asset_codes || []).length > 4 && <span className="text-muted-foreground">+{a.asset_codes.length - 4}</span>}</td>
                    <td className="p-2 text-xs">{t(`cve_status_${a.status}`)}</td>
                    <td className="p-2">
                      <div className="flex gap-1 justify-end">
                        {busyId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                          <>
                            {a.status !== 'converted' && <Button size="sm" variant="outline" className="h-7 text-xs" title={t('cve_convert_help')} onClick={() => act(a, () => convertAlert(a.id), t('cve_converted'))}><Bug className="w-3.5 h-3.5 mr-1" />{t('cve_convert')}</Button>}
                            {a.status === 'new' && <Button size="icon" variant="ghost" className="h-7 w-7" title={t('cve_ack')} onClick={() => act(a, () => setAlertStatus(a.id, 'acknowledged'))}><Check className="w-3.5 h-3.5" /></Button>}
                            {OPEN_ALERT.includes(a.status) && <Button size="icon" variant="ghost" className="h-7 w-7" title={t('cve_dismiss')} onClick={() => act(a, () => setAlertStatus(a.id, 'dismissed'))}><X className="w-3.5 h-3.5" /></Button>}
                            {a.status === 'dismissed' && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => act(a, () => setAlertStatus(a.id, 'new'))}>{t('cve_reopen')}</Button>}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded === a.id && (
                    <tr className="bg-muted/20"><td colSpan={7} className="p-2 text-xs whitespace-pre-wrap">{a.description}<p className="mt-1 text-muted-foreground">{t('cve_version_note')}</p></td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <WatchDialog open={dialog !== null} onOpenChange={(v) => !v && setDialog(null)} customer={customer} assets={assets} watch={dialog?.watch || null} manufacturer={dialog?.manufacturer || null} />
    </div>
  );
}
