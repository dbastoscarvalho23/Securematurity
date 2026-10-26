import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Trash2, ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { writeAuditLog } from '@/lib/auditLog';
import { TOOL_CATALOG, toolById, toolName } from '@/lib/legal/toolCatalog';
import { linkKey } from '@/lib/evidence';
import EvidencePanel, { useCustomerEvidence, evidenceSummary } from '@/components/evidence/EvidencePanel';
import { useAssets, useComponents, EV_BADGE } from './AssetsTab';
import AssetImportDialog from './AssetImportDialog';

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
const EMPTY = { category: '', product: '', vendor: '', version: '', asset_codes: [], owner: '', status: 'active', notes: '', coverage_confirmed: false };

function ToolDialog({ open, onOpenChange, component, customer, assets }) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const editing = Boolean(component?.id);
  const [form, setForm] = useState(EMPTY);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  useEffect(() => { if (open) { setForm({ ...EMPTY, ...(component || {}) }); setQ(''); } }, [open, component]);
  const cat = toolById(form.category);
  const codes = new Set(form.asset_codes || []);
  const list = assets.filter((a) => a.lifecycle !== 'retired' && (!q || `${a.asset_code} ${a.name}`.toLowerCase().includes(q.toLowerCase()))).slice(0, 300);
  const toggle = (code) => set('asset_codes', codes.has(code) ? [...codes].filter((c) => c !== code) : [...codes, code]);

  const save = async () => {
    if (!cat || !form.product.trim()) { toast.error(t('tl_missing')); return; }
    setSaving(true);
    try {
      const payload = {
        customer_id: customer.id, category: cat.id, product: form.product.trim(), vendor: form.vendor.trim(), version: form.version.trim(),
        asset_codes: form.asset_codes, nis2_letters: cat.nis2, regexec_points: cat.regexec, qnrcs_controls: cat.qnrcs,
        owner: form.owner.trim(), status: form.status, notes: form.notes,
      };
      if (isAdmin) payload.coverage_confirmed = Boolean(form.coverage_confirmed);
      const rec = editing ? await base44.entities.Component.update(component.id, payload) : await base44.entities.Component.create(payload);
      await writeAuditLog({ action: editing ? 'component_updated' : 'component_created', entity_type: 'Component', entity_id: rec?.id || component?.id, details: `${cat.pt}: ${payload.product}` });
      toast.success(t('at_saved'));
      qc.invalidateQueries({ queryKey: ['components', customer.id] });
      onOpenChange(false);
    } catch (e) { toast.error(e?.message || t('ev_error')); } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!window.confirm(t('tl_delete_confirm', { name: component.product }))) return;
    try {
      await base44.entities.Component.delete(component.id);
      await writeAuditLog({ action: 'component_deleted', entity_type: 'Component', entity_id: component.id, details: component.product });
      qc.invalidateQueries({ queryKey: ['components', customer.id] });
      toast.success(t('at_deleted'));
      onOpenChange(false);
    } catch (e) { toast.error(e?.message || t('ev_error')); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? component.product : t('tl_new')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('tl_f_category')} *</Label>
            <Select value={form.category || undefined} onValueChange={(v) => set('category', v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{TOOL_CATALOG.map((c) => <SelectItem key={c.id} value={c.id}>{toolName(c, language)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {cat && (
            <div className="rounded-md bg-muted/40 p-2 text-xs space-y-0.5">
              <p><span className="font-medium">{t('tl_nis2')}:</span> {cat.nis2.map((l) => `${l})`).join(', ')} · <span className="font-medium">{t('tl_regexec')}:</span> {cat.regexec} · <span className="font-medium">QNRCS:</span> {cat.qnrcs.join(', ')}</p>
              <p className="text-muted-foreground">{cat.note}</p>
            </div>
          )}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-1"><Label className="text-xs">{t('tl_f_product')} *</Label><Input value={form.product} onChange={(e) => set('product', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">{t('tl_f_vendor')}</Label><Input value={form.vendor} onChange={(e) => set('vendor', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">{t('tl_f_version')}</Label><Input value={form.version} onChange={(e) => set('version', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">{t('tl_f_owner')}</Label><Input value={form.owner} onChange={(e) => set('owner', e.target.value)} /></div>
            <div className="space-y-1">
              <Label className="text-xs">{t('tl_f_status')}</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">{t('tl_status_active')}</SelectItem><SelectItem value="retired">{t('tl_status_retired')}</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('tl_f_assets')} ({codes.size})</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('at_search')} className="h-8" />
            <div className="max-h-40 overflow-y-auto rounded border p-2 grid sm:grid-cols-2 gap-1">
              {list.length === 0 ? <p className="text-xs text-muted-foreground">{t('at_no_assets')}</p> : list.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={codes.has(a.asset_code)} onCheckedChange={() => toggle(a.asset_code)} />
                  <span className="font-mono">{a.asset_code}</span><span className="truncate">{a.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">{t('as_f_notes')}</Label><Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Switch id="tl-conf" checked={!!form.coverage_confirmed} onCheckedChange={(v) => set('coverage_confirmed', v)} />
              <Label htmlFor="tl-conf" className="text-xs">{t('tl_f_confirmed')}</Label>
            </div>
          )}
          {editing && (
            <EvidencePanel customerId={customer.id} provider={customer.storage_provider}
              links={[{ type: 'component', id: component.id, ref: component.category, label: component.product }]} />
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

export default function ToolsTab({ customer }) {
  const { t, language } = useLanguage();
  const { data: components = [], isLoading } = useComponents(customer.id);
  const { data: assets = [] } = useAssets(customer.id);
  const { data: evidence = [] } = useCustomerEvidence(customer.id);
  const evByKey = useMemo(() => evidenceSummary(evidence), [evidence]);
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const active = components.filter((c) => c.status !== 'retired');

  // Cobertura por alínea do art. 21.º, n.º 2, da NIS2: ferramentas registadas e quantas estão evidenciadas.
  const coverage = useMemo(() => Object.fromEntries(LETTERS.map((l) => {
    const tools = active.filter((c) => (c.nis2_letters || []).includes(l));
    return [l, { tools: tools.length, evidenced: tools.filter((c) => evByKey[linkKey('component', c.id)] === 'valid').length }];
  })), [active, evByKey]);
  const catalogLetters = new Set(TOOL_CATALOG.flatMap((c) => c.nis2));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{t('tl_coverage_title')}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {LETTERS.map((l) => {
              const c = coverage[l];
              const tone = !catalogLetters.has(l) ? 'bg-muted/40 text-muted-foreground' : c.evidenced ? 'bg-chart-2/10 text-chart-2 border-chart-2/30' : c.tools ? 'bg-chart-3/10 text-chart-3 border-chart-3/30' : 'bg-destructive/10 text-destructive border-destructive/30';
              return (
                <div key={l} className={`rounded-md border p-2 text-center ${tone}`} title={t(`tl_letter_${l}`)}>
                  <p className="text-sm font-semibold">{l})</p>
                  <p className="text-[10px]">{catalogLetters.has(l) ? `${c.evidenced}/${c.tools}` : '—'}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t('tl_coverage_help')}</p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setEditing({})}><Plus className="w-4 h-4 mr-1" />{t('tl_new')}</Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-1" />{t('at_import')}</Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">{t('common_loading')}</p> : components.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">{t('tl_none')}</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr>
                <th className="text-left p-2">{t('tl_f_category')}</th>
                <th className="text-left p-2">{t('tl_f_product')}</th>
                <th className="text-left p-2">{t('tl_nis2')}</th>
                <th className="text-left p-2">{t('tl_regexec')}</th>
                <th className="text-left p-2">QNRCS</th>
                <th className="text-left p-2">{t('tl_f_assets')}</th>
                <th className="text-left p-2">{t('ev_title')}</th>
              </tr>
            </thead>
            <tbody>
              {components.map((c) => {
                const ev = evByKey[linkKey('component', c.id)];
                return (
                  <tr key={c.id} className={`border-t hover:bg-muted/30 cursor-pointer ${c.status === 'retired' ? 'opacity-60' : ''}`} onClick={() => setEditing(c)}>
                    <td className="p-2 text-xs">{toolName(toolById(c.category), language) || c.category}</td>
                    <td className="p-2">{c.product}{c.vendor ? <span className="text-xs text-muted-foreground"> · {c.vendor}</span> : null}{c.version ? <span className="text-xs text-muted-foreground"> {c.version}</span> : null}</td>
                    <td className="p-2 text-xs">{(c.nis2_letters || []).map((l) => `${l})`).join(', ')}</td>
                    <td className="p-2 text-xs">{c.regexec_points}</td>
                    <td className="p-2 text-xs">{(c.qnrcs_controls || []).join(', ')}</td>
                    <td className="p-2 text-xs">{(c.asset_codes || []).length}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        {ev ? <Badge variant="outline" className={`text-[10px] ${EV_BADGE[ev]}`}>{t(`ev_badge_${ev}`)}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                        {c.coverage_confirmed && <ShieldCheck className="w-3.5 h-3.5 text-chart-2" title={t('tl_f_confirmed')} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ToolDialog open={editing !== null} onOpenChange={(v) => !v && setEditing(null)} component={editing?.id ? editing : null} customer={customer} assets={assets} />
      <AssetImportDialog open={importOpen} onOpenChange={setImportOpen} customer={customer} assets={assets} components={components} />
    </div>
  );
}
