import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, FileBadge, FileJson, FileText, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { callLicensing, subscriptionState, STATE_STYLE, downloadCertificateJson, downloadCertificatePdf } from '@/lib/licensing';
import { LIC_KEYS } from './useCatalog';

const STATUSES = ['trial', 'active', 'suspended', 'closed'];
const NONE = [];

export default function SubscriptionDialog({ open, onOpenChange, customer, subscription, catalog }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [form, setForm] = useState({});
  const [standards, setStandards] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const { data: tenantStandards = NONE, isFetched: stdLoaded } = useQuery({ queryKey: ['lic-tstd', customer?.id], queryFn: () => base44.entities.TenantStandard.filter({ customer_id: customer.id, status: 'active' }), enabled: open && Boolean(customer) });
  const { data: manual = NONE, isFetched: manualLoaded } = useQuery({ queryKey: ['lic-tmanual', customer?.id], queryFn: () => base44.entities.TenantModule.filter({ customer_id: customer.id, source: 'manual' }), enabled: open && Boolean(customer) });
  const { data: certs = NONE } = useQuery({ queryKey: ['lic-certs', customer?.id], queryFn: () => base44.entities.LicenseCertificate.filter({ customer_id: customer.id }, '-issued_at', 50), enabled: open && Boolean(customer) });

  useEffect(() => {
    if (!open || !customer) return;
    const s = subscription || {};
    setForm({
      tier_code: s.tier_code || catalog.tiers.find((x) => x.is_active !== false && !x.archived_at && x.version)?.code || '', addon_codes: s.addon_codes || [], status: s.status || 'active',
      started_date: s.started_date || new Date().toISOString().slice(0, 10), expires_date: s.expires_date || '', trial_ends_at: s.trial_ends_at || '',
      grace_until: s.grace_until || '', seat_limit: s.seat_limit ?? ((customer.user_seat_limit ?? 5) + (customer.user_seat_addon_count ?? 0)), ai_quota_monthly: s.ai_quota_monthly ?? '',
      quota_warn_pct: s.quota_warn_pct ?? 80, notes: s.notes || '', closed_reason: s.closed_reason || '',
    });
    setReason('');
  }, [open, customer?.id, subscription?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Preenche uma vez por abertura, quando as consultas terminam (não volta a apagar as edições).
  useEffect(() => {
    if (open && stdLoaded) setStandards(tenantStandards.length ? tenantStandards.map((x) => x.standard_code) : (customer?.allowed_frameworks || []));
  }, [open, stdLoaded, customer?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open && manualLoaded) setOverrides(manual.map((m) => ({ module_code: m.module_code, status: m.status, expires_at: m.expires_at || '', reason: m.reason || '' })));
  }, [open, manualLoaded, customer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const tier = catalog.tiers.find((x) => x.code === form.tier_code);
  const tierModules = new Set(tier?.modules || []);
  const effective = useMemo(() => {
    const s = new Set([...(tier?.modules || []), ...(form.addon_codes || [])]);
    for (const o of overrides) if (!o.expires_at || o.expires_at >= new Date().toISOString().slice(0, 10)) { if (o.status === 'active') s.add(o.module_code); else s.delete(o.module_code); }
    const activeCodes = new Set(catalog.modules.filter((m) => m.is_active !== false).map((m) => m.code));
    return [...s].filter((c) => activeCodes.has(c));
  }, [tier, form.addon_codes, overrides, catalog.modules]);
  const state = subscriptionState({ ...form, expires_date: form.expires_date || null, trial_ends_at: form.trial_ends_at || null, grace_until: form.grace_until || null });

  const refresh = () => LIC_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const save = async () => {
    setBusy('save');
    try {
      await callLicensing({ action: 'set_subscription', customer_id: customer.id, subscription: form, standards, overrides, reason });
      toast.success(t('lic_saved'));
      refresh();
      ['lic-tstd', 'lic-tmanual'].forEach((k) => qc.invalidateQueries({ queryKey: [k, customer.id] }));
    } catch (e) { toast.error(e?.message || t('ev_error')); } finally { setBusy(''); }
  };
  const issue = async () => {
    setBusy('issue');
    try {
      const { certificate } = await callLicensing({ action: 'issue_certificate', customer_id: customer.id });
      toast.success(t('lic_cert_issued', { serial: certificate.serial }));
      qc.invalidateQueries({ queryKey: ['lic-certs', customer.id] });
    } catch (e) { toast.error(e?.message || t('ev_error')); } finally { setBusy(''); }
  };
  const revoke = async (c) => {
    const why = window.prompt(t('lic_revoke_reason'));
    if (why === null) return;
    try { await callLicensing({ action: 'revoke_certificate', id: c.id, reason: why }); qc.invalidateQueries({ queryKey: ['lic-certs', customer.id] }); } catch (e) { toast.error(e?.message || t('ev_error')); }
  };

  if (!customer) return null;
  const date = (k, label) => <div className="space-y-1"><Label className="text-xs">{label}</Label><Input type="date" value={form[k] || ''} onChange={(e) => set(k, e.target.value)} /></div>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{t('lic_sub_title', { name: customer.name })}<Badge variant="outline" className={`text-[10px] ${STATE_STYLE[state]}`}>{t(`lic_state_${state}`)}</Badge></DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t('lic_tier')}</Label>
              <Select value={form.tier_code || undefined} onValueChange={(v) => set('tier_code', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{catalog.tiers.filter((x) => x.code === subscription?.tier_code || (x.is_active !== false && !x.archived_at && x.version)).map((x) => <SelectItem key={x.code} value={x.code}>{x.name}{x.version ? ` (v${x.version})` : ''}{x.is_active === false || x.archived_at ? ` · ${t('lic_inactive')}` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('lic_status')}</Label>
              <Select value={form.status || 'active'} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`lic_status_${s}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">{t('lic_seats')}</Label><Input type="number" min={5} value={form.seat_limit ?? ''} onChange={(e) => set('seat_limit', e.target.value)} /></div>
            {date('started_date', t('lic_started'))}
            {date('expires_date', t('lic_expires'))}
            {date('grace_until', t('lic_grace'))}
            {form.status === 'trial' && date('trial_ends_at', t('lic_trial_ends'))}
            <div className="space-y-1"><Label className="text-xs">{t('lic_ai_quota')}</Label><Input type="number" min={0} value={form.ai_quota_monthly ?? ''} onChange={(e) => set('ai_quota_monthly', e.target.value)} placeholder={tier?.quotas?.ai != null ? t('lic_bundle_quota', { n: tier.quotas.ai }) : t('lic_unlimited')} /></div>
            <div className="space-y-1"><Label className="text-xs">{t('lic_warn_pct')}</Label><Input type="number" min={1} max={100} value={form.quota_warn_pct ?? ''} onChange={(e) => set('quota_warn_pct', e.target.value)} /></div>
          </div>
          {form.status === 'closed' && <div className="space-y-1"><Label className="text-xs">{t('lic_closed_reason')}</Label><Input value={form.closed_reason || ''} onChange={(e) => set('closed_reason', e.target.value)} /></div>}

          <section className="space-y-1">
            <Label className="text-xs">{t('lic_addons')}</Label>
            <div className="grid sm:grid-cols-2 gap-1 rounded border p-2">
              {catalog.modules.map((m) => {
                const inTier = tierModules.has(m.code);
                return (
                  <label key={m.code} className={`flex items-center gap-2 text-xs ${inTier ? 'text-muted-foreground' : ''}`}>
                    <Checkbox checked={inTier || (form.addon_codes || []).includes(m.code)} disabled={inTier}
                      onCheckedChange={(v) => set('addon_codes', v ? [...(form.addon_codes || []), m.code] : (form.addon_codes || []).filter((c) => c !== m.code))} />
                    {m.name}{inTier ? ` · ${t('lic_in_tier')}` : ''}{m.is_active === false ? ` · ${t('lic_module_off')}` : ''}
                  </label>
                );
              })}
            </div>
          </section>

          <section className="space-y-1">
            <div className="flex items-center justify-between"><Label className="text-xs">{t('lic_overrides')}</Label>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOverrides((o) => [...o, { module_code: catalog.modules[0]?.code, status: 'active', expires_at: '', reason: '' }])}><Plus className="w-3.5 h-3.5 mr-1" />{t('lic_add_override')}</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">{t('lic_overrides_help')}</p>
            {overrides.map((o, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4"><Select value={o.module_code} onValueChange={(v) => setOverrides((l) => l.map((x, j) => (j === i ? { ...x, module_code: v } : x)))}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{catalog.modules.map((m) => <SelectItem key={m.code} value={m.code}>{m.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="col-span-2"><Select value={o.status} onValueChange={(v) => setOverrides((l) => l.map((x, j) => (j === i ? { ...x, status: v } : x)))}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">{t('lic_on')}</SelectItem><SelectItem value="inactive">{t('lic_off')}</SelectItem></SelectContent></Select></div>
                <Input className="col-span-2 h-8 text-xs" type="date" value={o.expires_at} onChange={(e) => setOverrides((l) => l.map((x, j) => (j === i ? { ...x, expires_at: e.target.value } : x)))} title={t('lic_override_until')} />
                <Input className="col-span-3 h-8 text-xs" value={o.reason} placeholder={t('lic_reason')} onChange={(e) => setOverrides((l) => l.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))} />
                <Button size="icon" variant="ghost" className="col-span-1 h-8 w-8" onClick={() => setOverrides((l) => l.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            ))}
          </section>

          <section className="space-y-1">
            <Label className="text-xs">{t('lic_standards')}</Label>
            <div className="grid sm:grid-cols-2 gap-1 rounded border p-2">
              {catalog.standards.filter((s) => s.is_active !== false).map((s) => (
                <label key={s.code} className="flex items-center gap-2 text-xs">
                  <Checkbox checked={standards.includes(s.code)} onCheckedChange={(v) => setStandards((l) => (v ? [...l, s.code] : l.filter((c) => c !== s.code)))} />{s.name}
                </label>
              ))}
            </div>
          </section>

          <div className="rounded-md bg-muted/40 p-2 text-xs">
            <span className="font-medium">{t('lic_effective')} ({effective.length}):</span> {effective.map((c) => catalog.moduleNames[c] || c).join(' · ') || '—'}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">{t('as_f_notes')}</Label><Textarea rows={2} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">{t('lic_change_reason')}</Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          </div>

          <section className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2"><FileBadge className="w-4 h-4 text-primary" />{t('lic_certs')}</span>
              <Button size="sm" variant="outline" onClick={issue} disabled={busy === 'issue' || !subscription}>{busy === 'issue' && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}{t('lic_issue')}</Button>
            </div>
            {!subscription && <p className="text-xs text-muted-foreground">{t('lic_issue_save_first')}</p>}
            {certs.length === 0 ? <p className="text-xs text-muted-foreground">{t('lic_no_certs')}</p> : (
              <ul className="divide-y text-xs">
                {certs.map((c) => (
                  <li key={c.id} className="py-1.5 flex items-center gap-2 flex-wrap">
                    <span className="font-mono">{c.serial}</span>
                    <Badge variant="outline" className="text-[10px]">{t(`lic_cert_${c.status}`)}</Badge>
                    <span className="text-muted-foreground">{c.valid_from} → {c.valid_until || '∞'} · {c.issued_by}</span>
                    <div className="ml-auto flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="JSON" onClick={() => downloadCertificateJson(c)}><FileJson className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="PDF" onClick={() => downloadCertificatePdf(c, catalog.moduleNames)}><FileText className="w-3.5 h-3.5" /></Button>
                      {c.status === 'active' && <Button size="icon" variant="ghost" className="h-7 w-7" title={t('lic_revoke')} onClick={() => revoke(c)}><Ban className="w-3.5 h-3.5 text-destructive" /></Button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common_close')}</Button>
          <Button onClick={save} disabled={busy === 'save' || !form.tier_code}>{busy === 'save' && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{t('common_save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
