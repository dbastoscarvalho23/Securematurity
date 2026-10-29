import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, ShieldCheck, AlertTriangle, Database } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { callLicensing, subscriptionState, STATE_STYLE } from '@/lib/licensing';
import { invokeFn } from '@/lib/invokeFn';
import { useLicenseCatalog } from './useCatalog';
import SubscriptionDialog from './SubscriptionDialog';
import BundlesTab from './BundlesTab';
import CatalogTab from './CatalogTab';
import SeedDialog from './SeedDialog';

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
  const [seedOpen, setSeedOpen] = useState(false);
  if (catalog.loading) return <p className="text-sm text-muted-foreground">{t('common_loading')}</p>;
  const seedDialog = <SeedDialog open={seedOpen} onOpenChange={setSeedOpen} />;
  if (!catalog.modules.length || !catalog.tiers.length) {
    return (
      <Card><CardContent className="p-6 space-y-3 text-sm">
        <p className="font-medium">{t('lic_empty_title')}</p>
        <p className="text-muted-foreground">{t('lic_empty')}</p>
        <Button onClick={() => setSeedOpen(true)}><Database className="w-4 h-4 mr-2" />{t('lic_seed')}</Button>
        {seedDialog}
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
      <TabsContent value="catalog" className="mt-4">
        <CatalogTab catalog={catalog} />
        <div className="mt-3 flex items-center gap-2"><Button size="sm" variant="ghost" onClick={() => setSeedOpen(true)}><Database className="w-3.5 h-3.5 mr-1" />{t('lic_seed_missing')}</Button></div>
      </TabsContent>
      <TabsContent value="history" className="mt-4"><HistoryTab /></TabsContent>
      {seedDialog}
    </Tabs>
  );
}
