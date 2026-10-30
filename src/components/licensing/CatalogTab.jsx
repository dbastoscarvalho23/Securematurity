import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Save, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import { callLicensing } from '@/lib/licensing';
import { LIC_KEYS } from './useCatalog';

const CODE = /^[a-z0-9_]{2,60}$/;

function useSaver() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState('');
  const run = async (key, payload, ok) => {
    setBusy(key);
    try { await callLicensing(payload); if (ok) toast.success(ok); LIC_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); return true; } catch (e) { toast.error(e?.message); return false; } finally { setBusy(''); }
  };
  return { busy, run };
}

const modFields = (m) => ({ code: m.code, name: m.name || '', description: m.description || '', display_order: m.display_order ?? '', tier_code: m.tier_code || '', is_active: m.is_active !== false });
const entFields = (e) => ({ code: e.code, name: e.name || '', description: e.description || '', quota_feature: e.quota_feature || '', display_order: e.display_order ?? '', is_active: e.is_active !== false });

function EntitlementRow({ ent }) {
  const { t } = useLanguage();
  const { busy, run } = useSaver();
  const [edit, setEdit] = useState(null);
  const f = edit || entFields(ent);
  const save = async (patch) => { if (await run('s', { action: 'save_entitlement', entitlement: { ...f, ...patch } }, patch ? null : t('lic_feature_saved'))) setEdit(null); };
  return (
    <div className="flex items-center gap-2">
      <Switch checked={ent.is_active !== false} disabled={busy === 's'} onCheckedChange={(v) => save({ ...entFields(ent), is_active: v })} />
      <Input className="h-7 text-xs flex-1 min-w-0" maxLength={120} value={f.name} onChange={(e) => setEdit({ ...f, name: e.target.value })} />
      <span className="font-mono text-[10px] text-muted-foreground w-36 truncate" title={ent.code}>{ent.code}</span>
      <Input className="h-7 text-xs font-mono w-20" value={f.quota_feature} placeholder={t('lic_quota_key')} title={t('lic_quota_key_help')} onChange={(e) => setEdit({ ...f, quota_feature: e.target.value.toLowerCase() })} />
      <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!edit || busy === 's'} onClick={() => save()} title={t('common_save')}>{busy === 's' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}</Button>
    </div>
  );
}

function NewEntitlement({ moduleCode, existing }) {
  const { t } = useLanguage();
  const { busy, run } = useSaver();
  const [f, setF] = useState({ code: '', name: '', quota_feature: '' });
  const add = async () => {
    if (!CODE.test(f.code)) { toast.error(t('lic_code_invalid')); return; }
    if (existing.has(f.code)) { toast.error(t('lic_code_exists')); return; }
    if (await run('n', { action: 'save_entitlement', create: true, entitlement: { ...f, module_code: moduleCode, is_active: true } }, t('lic_feature_created'))) setF({ code: '', name: '', quota_feature: '' });
  };
  return (
    <div className="flex items-center gap-2 pt-1">
      <Input className="h-7 text-xs font-mono w-36" placeholder="codigo_funcionalidade" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toLowerCase() })} />
      <Input className="h-7 text-xs flex-1 min-w-0" maxLength={120} placeholder={t('lic_name')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Input className="h-7 text-xs font-mono w-20" placeholder={t('lic_quota_key')} value={f.quota_feature} onChange={(e) => setF({ ...f, quota_feature: e.target.value.toLowerCase() })} />
      <Button size="sm" variant="outline" className="h-7" disabled={busy === 'n'} onClick={add}><Plus className="w-3.5 h-3.5 mr-1" />{t('lic_add_feature')}</Button>
    </div>
  );
}

function ModuleRow({ mod, ents, allEntCodes }) {
  const { t } = useLanguage();
  const { busy, run } = useSaver();
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(false);
  const f = edit || modFields(mod);
  const save = async (patch) => { if (await run('s', { action: 'save_module', module: { ...f, ...patch } }, patch ? null : t('lic_module_saved'))) setEdit(null); };
  const activeEnts = ents.filter((e) => e.is_active !== false).length;
  return (
    <div className="border-b pb-2 space-y-1.5">
      <div className="flex items-start gap-2">
        <Switch className="mt-1.5" checked={mod.is_active !== false} disabled={busy === 's'} onCheckedChange={(v) => save({ ...modFields(mod), is_active: v })} />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Input className="h-7 text-xs font-medium flex-1 min-w-0" maxLength={120} value={f.name} onChange={(e) => setEdit({ ...f, name: e.target.value })} />
            <Input className="h-7 text-xs w-16" type="number" min={0} max={9999} title={t('lic_order')} value={f.display_order} onChange={(e) => setEdit({ ...f, display_order: e.target.value })} />
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!edit || busy === 's'} onClick={() => save()} title={t('common_save')}>{busy === 's' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}</Button>
          </div>
          <Input className="h-7 text-xs" maxLength={500} placeholder={t('lic_description')} value={f.description} onChange={(e) => setEdit({ ...f, description: e.target.value })} />
          <button type="button" className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span className="font-mono">{mod.code}</span> · {t('lic_features_count', { n: activeEnts, total: ents.length })}
          </button>
        </div>
      </div>
      {open && (
        <div className="ml-11 space-y-1">
          {ents.map((e) => <EntitlementRow key={e.id} ent={e} />)}
          <NewEntitlement moduleCode={mod.code} existing={allEntCodes} />
        </div>
      )}
    </div>
  );
}

export default function CatalogTab({ catalog }) {
  const { t } = useLanguage();
  const { busy, run } = useSaver();
  const [newMod, setNewMod] = useState({ code: '', name: '' });
  const ents = useMemo(() => catalog.entitlements.slice().sort((a, b) => (a.display_order ?? 99) - (b.display_order ?? 99) || String(a.name).localeCompare(String(b.name)))
    .reduce((acc, e) => { (acc[e.module_code] ||= []).push(e); return acc; }, {}), [catalog.entitlements]);
  const allEntCodes = useMemo(() => new Set(catalog.entitlements.map((e) => e.code)), [catalog.entitlements]);
  const addModule = async () => {
    if (!CODE.test(newMod.code)) { toast.error(t('lic_code_invalid')); return; }
    if (catalog.modules.some((m) => m.code === newMod.code)) { toast.error(t('lic_code_exists')); return; }
    if (await run('m', { action: 'save_module', create: true, module: { ...newMod, is_active: true } }, t('lic_module_created'))) setNewMod({ code: '', name: '' });
  };
  const saveStd = (s, patch) => run(`std-${s.code}`, { action: 'save_standard', standard: { code: s.code, name: s.name, description: s.description || '', offered: s.offered !== false, is_active: s.is_active !== false, ...patch } });

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-sm">{t('lic_modules_features')}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs">
          <p className="text-[11px] text-muted-foreground">{t('lic_catalog_help')}</p>
          {catalog.modules.map((m) => <ModuleRow key={m.id} mod={m} ents={ents[m.code] || []} allEntCodes={allEntCodes} />)}
          <p className="text-[11px] text-muted-foreground">{t('lic_module_off_help')}</p>
          <div className="flex gap-2">
            <Input className="h-8 font-mono" placeholder="codigo_modulo" value={newMod.code} onChange={(e) => setNewMod({ ...newMod, code: e.target.value.toLowerCase() })} />
            <Input className="h-8" maxLength={120} placeholder={t('lic_name')} value={newMod.name} onChange={(e) => setNewMod({ ...newMod, name: e.target.value })} />
            <Button size="sm" variant="outline" disabled={busy === 'm'} onClick={addModule}><Plus className="w-3.5 h-3.5 mr-1" />{t('lic_add_module')}</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{t('lic_standards')}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs">
          {catalog.standards.map((s) => (
            <div key={s.id} className="flex items-center gap-2 border-b pb-2">
              <Switch checked={s.offered !== false} disabled={busy === `std-${s.code}`} onCheckedChange={(v) => saveStd(s, { offered: v })} />
              <span className="font-medium">{s.name}</span><span className="font-mono text-muted-foreground">{s.code}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
