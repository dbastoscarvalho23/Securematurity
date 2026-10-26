import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Trash2, History } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { writeAuditLog } from '@/lib/auditLog';
import { ASSET_TYPES, CRITICALITY, LIFECYCLE, checkAsset, diffAsset } from '@/lib/assets';
import EvidencePanel from '@/components/evidence/EvidencePanel';

const EMPTY = {
  asset_code: '', name: '', asset_type: '', service: '', description: '', manufacturer: '', model_version: '',
  operating_system: '', app_server_software: '', location: '', owner: '', supplier: '', internet_exposed: false,
  ip_address: '', fqdn: '', dependencies: [], confidentiality: '', integrity: '', authenticity: '', availability: '',
  criticality: '', rto_hours: '', rpo_hours: '', lifecycle: 'production', end_of_support: '', logging_required: false,
  last_review: new Date().toISOString().slice(0, 10), notes: '',
};

/** Normaliza o formulário antes de gravar (números, listas, vazios). */
function toRecord(f) {
  const out = {};
  for (const [k, v] of Object.entries(f)) {
    if (['confidentiality', 'integrity', 'authenticity', 'availability', 'rto_hours', 'rpo_hours'].includes(k)) out[k] = v === '' || v == null ? null : Number(v);
    else if (k === 'dependencies') out[k] = Array.isArray(v) ? v : String(v || '').split(/[;,\n]/).map((s) => s.trim()).filter(Boolean);
    else if (typeof v === 'string') out[k] = v.trim();
    else out[k] = v;
  }
  return out;
}

export async function recordAssetHistory({ customerId, asset, action, changes, email }) {
  try {
    await base44.entities.AssetHistory.create({
      customer_id: customerId, asset_id: asset.id, asset_code: asset.asset_code, action,
      changes: JSON.stringify(changes || {}).slice(0, 20000), user_email: email,
    });
  } catch (e) {
    console.warn('AssetHistory write failed', e);
  }
}

export default function AssetDialog({ open, onOpenChange, asset, customer, assets = [] }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [deps, setDeps] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = Boolean(asset?.id);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    const base = { ...EMPTY, ...(asset || {}) };
    for (const k of Object.keys(EMPTY)) if (base[k] == null) base[k] = EMPTY[k];
    setForm(base);
    setDeps((base.dependencies || []).join('; '));
  }, [open, asset]);

  const { data: history = [] } = useQuery({
    queryKey: ['asset-history', asset?.id],
    queryFn: () => base44.entities.AssetHistory.filter({ asset_id: asset.id }, '-created_date', 50),
    enabled: open && editing,
  });

  const otherCodes = useMemo(() => new Set(assets.filter((a) => a.id !== asset?.id).map((a) => a.asset_code)), [assets, asset?.id]);
  const record = toRecord({ ...form, dependencies: deps });
  const { errors, warnings } = checkAsset(record, otherCodes);

  const refresh = () => qc.invalidateQueries({ queryKey: ['assets', customer.id] });

  const save = async () => {
    if (errors.length) { toast.error(errors[0]); return; }
    setSaving(true);
    try {
      const payload = { ...record, customer_id: customer.id };
      for (const k of ['id', 'created_date', 'updated_date', 'created_by', 'created_by_id', 'is_sample']) delete payload[k];
      if (editing) {
        const changes = diffAsset(asset, payload);
        await base44.entities.Asset.update(asset.id, payload);
        await recordAssetHistory({ customerId: customer.id, asset: { ...asset, ...payload }, action: 'update', changes, email: user?.email });
        await writeAuditLog({ action: 'asset_updated', entity_type: 'Asset', entity_id: asset.id, details: `Ativo ${payload.asset_code} atualizado (${Object.keys(changes).length} campo(s))` });
      } else {
        const created = await base44.entities.Asset.create(payload);
        await recordAssetHistory({ customerId: customer.id, asset: created, action: 'create', changes: diffAsset({}, payload), email: user?.email });
        await writeAuditLog({ action: 'asset_created', entity_type: 'Asset', entity_id: created.id, details: `Ativo ${payload.asset_code} criado` });
      }
      toast.success(t('at_saved'));
      refresh();
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.message || t('ev_error'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t('at_delete_confirm', { code: asset.asset_code }))) return;
    try {
      await recordAssetHistory({ customerId: customer.id, asset, action: 'delete', changes: diffAsset(asset, {}), email: user?.email });
      await base44.entities.Asset.delete(asset.id);
      await writeAuditLog({ action: 'asset_deleted', entity_type: 'Asset', entity_id: asset.id, details: `Ativo ${asset.asset_code} eliminado` });
      toast.success(t('at_deleted'));
      refresh();
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.message || t('ev_error'));
    }
  };

  const text = (k, props = {}) => (
    <div className="space-y-1">
      <Label className="text-xs">{t(`as_f_${k}`)}{props.req ? ' *' : ''}</Label>
      <Input value={form[k] ?? ''} type={props.type || 'text'} onChange={(e) => set(k, e.target.value)} placeholder={props.placeholder} />
    </div>
  );
  const pick = (k, options, req) => (
    <div className="space-y-1">
      <Label className="text-xs">{t(`as_f_${k}`)}{req ? ' *' : ''}</Label>
      <Select value={form[k] === '' || form[k] == null ? undefined : String(form[k])} onValueChange={(v) => set(k, v)}>
        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>{options.map(([v, label]) => <SelectItem key={v} value={String(v)}>{label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
  const scale = [1, 2, 3, 4].map((n) => [n, `${n} — ${t(`as_scale_${n}`)}`]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? `${asset.asset_code} — ${asset.name}` : t('at_new_asset')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <section className="grid sm:grid-cols-2 gap-3">
            {text('asset_code', { req: true, placeholder: 'ATV-001' })}
            {text('name', { req: true })}
            {pick('asset_type', Object.keys(ASSET_TYPES).map((k) => [k, t(`as_type_${k}`)]), true)}
            {text('service', { req: true })}
            {text('owner', { req: true })}
            {text('location')}
            {text('manufacturer')}
            {text('model_version')}
            {text('operating_system')}
            {text('app_server_software')}
            {text('supplier')}
            <div className="space-y-1">
              <Label className="text-xs">{t('as_f_dependencies')}</Label>
              <Input value={deps} onChange={(e) => setDeps(e.target.value)} placeholder="ATV-002; ATV-007" />
            </div>
          </section>
          <div className="space-y-1">
            <Label className="text-xs">{t('as_f_description')}</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          <section className="rounded-md border p-3 space-y-3">
            <div className="flex items-center gap-3">
              <Switch checked={!!form.internet_exposed} onCheckedChange={(v) => set('internet_exposed', v)} id="as-internet" />
              <Label htmlFor="as-internet" className="text-sm">{t('as_f_internet_exposed')} *</Label>
            </div>
            {form.internet_exposed && (
              <>
                <p className="text-xs text-muted-foreground">{t('at_art32_hint')}</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {text('ip_address', { placeholder: '203.0.113.10' })}
                  {text('fqdn', { placeholder: 'portal.exemplo.pt' })}
                </div>
              </>
            )}
          </section>

          <section className="grid sm:grid-cols-4 gap-3">
            {pick('confidentiality', scale, true)}
            {pick('integrity', scale, true)}
            {pick('authenticity', scale, true)}
            {pick('availability', scale, true)}
            {pick('criticality', Object.keys(CRITICALITY).map((k) => [k, t(`as_crit_${k}`)]), true)}
            {text('rto_hours', { type: 'number' })}
            {text('rpo_hours', { type: 'number' })}
            {pick('lifecycle', Object.keys(LIFECYCLE).map((k) => [k, t(`as_life_${k}`)]), true)}
            {text('end_of_support', { type: 'date' })}
            {text('last_review', { type: 'date', req: true })}
            <div className="flex items-center gap-2 sm:col-span-2 pt-5">
              <Switch checked={!!form.logging_required} onCheckedChange={(v) => set('logging_required', v)} id="as-log" />
              <Label htmlFor="as-log" className="text-xs">{t('as_f_logging_required')}</Label>
            </div>
          </section>
          <div className="space-y-1">
            <Label className="text-xs">{t('as_f_notes')}</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          {(errors.length > 0 || warnings.length > 0) && (
            <ul className="text-xs space-y-0.5">
              {errors.map((e) => <li key={e} className="text-destructive">• {e}</li>)}
              {warnings.map((w) => <li key={w} className="text-chart-3">• {w}</li>)}
            </ul>
          )}

          {editing && (
            <>
              <EvidencePanel customerId={customer.id} provider={customer.storage_provider}
                links={[{ type: 'asset', id: asset.id, ref: asset.asset_code, label: `${asset.asset_code} — ${asset.name}` }]} />
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium"><History className="w-4 h-4 text-primary" />{t('at_history')}</div>
                {history.length === 0 ? <p className="text-xs text-muted-foreground">{t('at_history_none')}</p> : (
                  <ul className="space-y-1 text-xs">
                    {history.map((h) => {
                      let fields = [];
                      try { fields = Object.keys(JSON.parse(h.changes || '{}')); } catch { /* registo antigo */ }
                      return (
                        <li key={h.id} className="flex gap-2 flex-wrap">
                          <span className="text-muted-foreground">{(h.created_date || '').replace('T', ' ').slice(0, 16)}</span>
                          <span className="font-medium">{t(`as_act_${h.action}`)}</span>
                          <span>{h.user_email}</span>
                          {fields.length > 0 && <span className="text-muted-foreground">· {fields.map((f) => t(`as_f_${f}`)).join(', ')}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          {editing && <Button variant="ghost" className="text-destructive mr-auto" onClick={remove}><Trash2 className="w-4 h-4 mr-1" />{t('ev_delete')}</Button>}
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common_cancel')}</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{t('common_save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
