import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Search, Plus, Upload, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { callLicensing, subscriptionState, STATE_STYLE } from '@/lib/licensing';
import { invokeFn } from '@/lib/invokeFn';
import { useLicenseCatalog, LIC_KEYS } from './useCatalog';
import SubscriptionDialog from './SubscriptionDialog';

function useRefreshAll() {
  const qc = useQueryClient();
  return () => LIC_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

function SubscriptionsTab({ catalog }) {
  const { t } = useLanguage();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const { data: customers = [] } = useQuery({ queryKey: ['lic-customers'], queryFn: () => base44.entities.Customer.list('name', 1000) });
  const { data: subs = [] } = useQuery({ queryKey: ['lic-subs'], queryFn: () => base44.entities.TenantSubscription.list('-updated_date', 2000) });
  const { data: users = [] } = useQuery({ queryKey: ['lic-users'], queryFn: async () => (await invokeFn('listUsers', {})).users || [] });
  const month = new Date().toISOString().slice(0, 7);
  const { data: usage = [] } = useQuery({ queryKey: ['lic-usage', month], queryFn: () => base44.entities.LicenseUsageRecord.filter({ month, feature: 'ai' }, '-usage_count', 2000) });
  const subByCustomer = useMemo(() => { const o = {}; for (const s of subs) if (!o[s.customer_id] || s.status !== 'closed') o[s.customer_id] = s; return o; }, [subs]);
  const seats = users.reduce((acc, u) => { const cid = u.customer_id || u.data?.customer_id; if (cid) acc[cid] = (acc[cid] || 0) + 1; return acc; }, {});
  const ai = Object.fromEntries(usage.map((u) => [u.customer_id, u.usage_count]));
  const tierName = Object.fromEntries(catalog.tiers.map((x) => [x.code, x.name]));
  const legacy = customers.filter((c) => !subByCustomer[c.id]).length;
  const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const shown = customers.filter((c) => !q || `${c.name} ${c.nif || ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-3">
      {legacy > 0 && <p className="text-xs rounded-md border border-chart-3/30 bg-chart-3/10 text-chart-3 p-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{t('lic_legacy_banner', { n: legacy })}</p>}
      <div className="relative max-w-sm"><Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" /><Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('at_search')} /></div>
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs"><tr>
            <th className="text-left p-2">{t('common_customer')}</th><th className="text-left p-2">{t('lic_tier')}</th><th className="text-left p-2">{t('lic_status')}</th>
            <th className="text-left p-2">{t('lic_expires')}</th><th className="text-left p-2">{t('lic_seats')}</th><th className="text-left p-2">{t('lic_ai_month')}</th>
          </tr></thead>
          <tbody>
            {shown.map((c) => {
              const s = subByCustomer[c.id];
              const st = subscriptionState(s);
              const end = s?.status === 'trial' ? s?.trial_ends_at : s?.expires_date;
              const used = seats[c.id] || 0;
              const limit = s?.seat_limit ?? c.user_seat_limit;
              return (
                <tr key={c.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setEditing(c)}>
                  <td className="p-2">{c.name}</td>
                  <td className="p-2 text-xs">{s ? tierName[s.tier_code] || s.tier_code : '—'}{s?.addon_codes?.length ? ` +${s.addon_codes.length}` : ''}</td>
                  <td className="p-2"><Badge variant="outline" className={`text-[10px] ${STATE_STYLE[st]}`}>{t(`lic_state_${st}`)}</Badge></td>
                  <td className={`p-2 text-xs ${end && end <= soon ? 'text-chart-3 font-medium' : ''}`}>{end || '—'}</td>
                  <td className={`p-2 text-xs ${limit != null && used > limit ? 'text-destructive font-medium' : ''}`}>{used}/{limit ?? '—'}</td>
                  <td className="p-2 text-xs">{ai[c.id] || 0}{s?.ai_quota_monthly != null ? `/${s.ai_quota_monthly}` : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <SubscriptionDialog open={editing !== null} onOpenChange={(v) => !v && setEditing(null)} customer={editing} subscription={editing ? subByCustomer[editing.id] : null} catalog={catalog} />
    </div>
  );
}

function BundlesTab({ catalog }) {
  const { t } = useLanguage();
  const refresh = useRefreshAll();
  const { data: subs = [] } = useQuery({ queryKey: ['lic-subs'], queryFn: () => base44.entities.TenantSubscription.list('-updated_date', 2000) });
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState('');
  const [newCode, setNewCode] = useState('');
  const draftOf = (tier) => drafts[tier.code] || { ...tier, modules_draft: tier.has_draft ? tier.modules_draft || [] : tier.modules || [] };
  const edit = (tier, patch) => setDrafts((d) => ({ ...d, [tier.code]: { ...draftOf(tier), ...patch } }));
  const save = async (tier) => {
    setBusy(`s-${tier.code}`);
    try { await callLicensing({ action: 'save_tier', tier: draftOf(tier) }); toast.success(t('lic_draft_saved')); setDrafts((d) => { const n = { ...d }; delete n[tier.code]; return n; }); refresh(); } catch (e) { toast.error(e?.message); } finally { setBusy(''); }
  };
  const publish = async (tier) => {
    const affected = subs.filter((s) => s.tier_code === tier.code && s.status !== 'closed').length;
    if (!window.confirm(t('lic_publish_confirm', { name: tier.name, n: affected }))) return;
    setBusy(`p-${tier.code}`);
    try { await callLicensing({ action: 'publish_tier', code: tier.code }); toast.success(t('lic_published')); refresh(); } catch (e) { toast.error(e?.message); } finally { setBusy(''); }
  };
  const create = async () => {
    if (!/^[a-z0-9_]{2,60}$/.test(newCode)) { toast.error(t('lic_code_invalid')); return; }
    try { await callLicensing({ action: 'save_tier', tier: { code: newCode, name: newCode, modules_draft: [] } }); setNewCode(''); refresh(); } catch (e) { toast.error(e?.message); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t('lic_bundles_help')}</p>
      <div className="grid lg:grid-cols-3 gap-4">
        {catalog.tiers.map((tier) => {
          const d = draftOf(tier);
          const pending = Boolean(tier.has_draft);
          return (
            <Card key={tier.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 flex-wrap">{tier.name}<span className="font-mono text-[11px] text-muted-foreground">{tier.code}</span>
                  <Badge variant="outline" className="text-[10px]">v{tier.version || 0}</Badge>{pending && <Badge variant="outline" className="text-[10px] bg-chart-3/10 text-chart-3">{t('lic_draft_pending')}</Badge>}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-[11px]">{t('lic_name')}</Label><Input className="h-8" value={d.name || ''} onChange={(e) => edit(tier, { name: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-[11px]">{t('lic_value')}</Label><Input className="h-8" value={d.commercial_value || ''} onChange={(e) => edit(tier, { commercial_value: e.target.value })} /></div>
                </div>
                <Textarea rows={2} value={d.description || ''} onChange={(e) => edit(tier, { description: e.target.value })} placeholder={t('ev_field_description')} />
                <div className="rounded border p-2 space-y-1">
                  {catalog.modules.map((m) => {
                    const on = (d.modules_draft || []).includes(m.code);
                    const was = (tier.modules || []).includes(m.code);
                    return (
                      <label key={m.code} className="flex items-center gap-2">
                        <Checkbox checked={on} onCheckedChange={(v) => edit(tier, { modules_draft: v ? [...(d.modules_draft || []), m.code] : (d.modules_draft || []).filter((c) => c !== m.code) })} />
                        <span className={on !== was ? 'font-medium text-chart-3' : ''}>{m.name}</span>{m.is_active === false && <span className="text-muted-foreground">· {t('lic_module_off')}</span>}
                      </label>
                    );
                  })}
                </div>
                <Input className="h-8" value={d.draft_note || ''} onChange={(e) => edit(tier, { draft_note: e.target.value })} placeholder={t('lic_draft_note')} />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => save(tier)} disabled={busy === `s-${tier.code}`}>{t('lic_save_draft')}</Button>
                  <Button size="sm" onClick={() => publish(tier)} disabled={!pending || Boolean(drafts[tier.code]) || busy === `p-${tier.code}`}><Upload className="w-3.5 h-3.5 mr-1" />{t('lic_publish')}</Button>
                </div>
                {tier.published_at && <p className="text-[11px] text-muted-foreground">{t('lic_published_by', { date: tier.published_at.slice(0, 10), who: tier.published_by_email || '—' })}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="flex gap-2 max-w-sm"><Input className="h-8" value={newCode} onChange={(e) => setNewCode(e.target.value.toLowerCase())} placeholder={t('lic_new_tier_code')} /><Button size="sm" variant="outline" onClick={create}><Plus className="w-3.5 h-3.5 mr-1" />{t('lic_new_tier')}</Button></div>
    </div>
  );
}

function CatalogTab({ catalog }) {
  const { t } = useLanguage();
  const refresh = useRefreshAll();
  const [newMod, setNewMod] = useState({ code: '', name: '' });
  const saveModule = async (m, patch) => { try { await callLicensing({ action: 'save_module', module: { ...m, ...patch } }); refresh(); } catch (e) { toast.error(e?.message); } };
  const saveStd = async (s, patch) => { try { await callLicensing({ action: 'save_standard', standard: { ...s, ...patch } }); refresh(); } catch (e) { toast.error(e?.message); } };
  const ents = catalog.entitlements.reduce((acc, e) => { (acc[e.module_code] ||= []).push(e.name); return acc; }, {});
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{t('lic_modules')}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs">
          {catalog.modules.map((m) => (
            <div key={m.id} className="flex items-start gap-2 border-b pb-2">
              <Switch checked={m.is_active !== false} onCheckedChange={(v) => saveModule(m, { is_active: v })} />
              <div className="min-w-0">
                <p className="font-medium">{m.name} <span className="font-mono text-muted-foreground">{m.code}</span></p>
                <p className="text-muted-foreground">{m.description}</p>
                {ents[m.code] && <p className="text-[11px]">{ents[m.code].join(' · ')}</p>}
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">{t('lic_module_off_help')}</p>
          <div className="flex gap-2">
            <Input className="h-8 font-mono" placeholder="codigo_modulo" value={newMod.code} onChange={(e) => setNewMod({ ...newMod, code: e.target.value.toLowerCase() })} />
            <Input className="h-8" placeholder={t('lic_name')} value={newMod.name} onChange={(e) => setNewMod({ ...newMod, name: e.target.value })} />
            <Button size="sm" variant="outline" onClick={() => saveModule({ is_active: true }, newMod).then(() => setNewMod({ code: '', name: '' }))}><Plus className="w-3.5 h-3.5" /></Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{t('lic_standards')}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs">
          {catalog.standards.map((s) => (
            <div key={s.id} className="flex items-center gap-2 border-b pb-2">
              <Switch checked={s.offered !== false} onCheckedChange={(v) => saveStd(s, { offered: v })} />
              <span className="font-medium">{s.name}</span><span className="font-mono text-muted-foreground">{s.code}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryTab() {
  const { t } = useLanguage();
  const { data: log = [] } = useQuery({ queryKey: ['lic-log'], queryFn: () => base44.entities.LicenseChangeLog.list('-created_date', 300) });
  const [jws, setJws] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const verify = async () => {
    setBusy(true);
    try {
      let token = jws.trim();
      try { const j = JSON.parse(token); token = j.jws || token; } catch { /* JWS em texto */ }
      setResult(await callLicensing({ action: 'verify', jws: token }));
    } catch (e) { toast.error(e?.message); } finally { setBusy(false); }
  };
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-md border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50"><tr><th className="text-left p-2">{t('lic_when')}</th><th className="text-left p-2">{t('common_customer')}</th><th className="text-left p-2">{t('lic_action')}</th><th className="text-left p-2">{t('lic_changes')}</th><th className="text-left p-2">{t('lic_who')}</th></tr></thead>
          <tbody>
            {log.map((l) => (
              <tr key={l.id} className="border-t align-top">
                <td className="p-2 whitespace-nowrap">{(l.created_date || '').replace('T', ' ').slice(0, 16)}</td>
                <td className="p-2">{l.customer_name || '—'}</td>
                <td className="p-2">{t(`lic_act_${l.action}`) !== `lic_act_${l.action}` ? t(`lic_act_${l.action}`) : l.action}</td>
                <td className="p-2">{(l.changed_fields || []).join(', ')}{l.reason ? <span className="block text-muted-foreground">{l.reason}</span> : null}</td>
                <td className="p-2">{l.actor_email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" />{t('lic_verify')}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs">
          <Textarea rows={6} className="font-mono text-[11px]" value={jws} onChange={(e) => setJws(e.target.value)} placeholder={t('lic_verify_ph')} />
          <Button size="sm" onClick={verify} disabled={busy || !jws.trim()}>{busy && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}{t('lic_verify')}</Button>
          {result && (result.valid ? (
            <div className="rounded-md border p-2 space-y-0.5">
              <p className={result.status === 'active' && !result.expired ? 'text-chart-2 font-medium' : 'text-chart-3 font-medium'}>{t('lic_sig_ok')} · {t(`lic_cert_${result.status}`)}{result.expired ? ` · ${t('lic_state_expired')}` : ''}</p>
              <p>{result.payload.customer?.name} · {result.payload.tier?.name} · {result.payload.valid_from} → {result.payload.valid_until || '∞'}</p>
              <p className="font-mono">{result.payload.serial}</p>
            </div>
          ) : <p className="text-destructive font-medium">{t('lic_sig_bad')}: {result.reason}</p>)}
        </CardContent>
      </Card>
    </div>
  );
}

/** Backoffice → Licenciamento. */
export default function LicensingPanel() {
  const { t } = useLanguage();
  const catalog = useLicenseCatalog();
  const refresh = useRefreshAll();
  const [seeding, setSeeding] = useState(false);
  const seed = async () => {
    setSeeding(true);
    try { const r = await callLicensing({ action: 'seed' }); toast.success(t('lic_seeded', r.created)); refresh(); } catch (e) { toast.error(e?.message); } finally { setSeeding(false); }
  };
  if (catalog.loading) return <p className="text-sm text-muted-foreground">{t('common_loading')}</p>;
  if (!catalog.modules.length || !catalog.tiers.length) {
    return (
      <Card><CardContent className="p-6 space-y-3 text-sm">
        <p>{t('lic_empty')}</p>
        <Button onClick={seed} disabled={seeding}>{seeding && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{t('lic_seed')}</Button>
      </CardContent></Card>
    );
  }
  return (
    <Tabs defaultValue="subs">
      <TabsList>
        <TabsTrigger value="subs">{t('lic_tab_subs')}</TabsTrigger>
        <TabsTrigger value="bundles">{t('lic_tab_bundles')}</TabsTrigger>
        <TabsTrigger value="catalog">{t('lic_tab_catalog')}</TabsTrigger>
        <TabsTrigger value="history">{t('lic_tab_history')}</TabsTrigger>
      </TabsList>
      <TabsContent value="subs" className="mt-4"><SubscriptionsTab catalog={catalog} /></TabsContent>
      <TabsContent value="bundles" className="mt-4"><BundlesTab catalog={catalog} /></TabsContent>
      <TabsContent value="catalog" className="mt-4"><CatalogTab catalog={catalog} /><div className="mt-3"><Button size="sm" variant="ghost" onClick={seed} disabled={seeding}>{t('lic_seed_missing')}</Button></div></TabsContent>
      <TabsContent value="history" className="mt-4"><HistoryTab /></TabsContent>
    </Tabs>
  );
}
