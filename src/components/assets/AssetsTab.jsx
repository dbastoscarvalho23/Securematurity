import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Upload, Download, Globe, Search, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { writeAuditLog } from '@/lib/auditLog';
import { article32Rows, inventoryRows, downloadXlsx } from '@/lib/assets';
import { linkKey } from '@/lib/evidence';
import { useCustomerEvidence, evidenceSummary } from '@/components/evidence/EvidencePanel';
import AssetDialog from './AssetDialog';
import AssetImportDialog from './AssetImportDialog';
import { OPEN_ALERT } from '@/lib/cve';

export const EV_BADGE = {
  valid: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
  pending: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
  expired: 'bg-destructive/10 text-destructive border-destructive/30',
  rejected: 'bg-muted text-muted-foreground',
};
const CRIT_STYLE = {
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
  high: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
  medium: 'bg-chart-1/10 text-chart-1 border-chart-1/30',
  low: 'bg-muted text-muted-foreground',
};

export function useAssets(customerId) {
  return useQuery({
    queryKey: ['assets', customerId],
    queryFn: () => base44.entities.Asset.filter({ customer_id: customerId }, 'asset_code', 5000),
    enabled: Boolean(customerId),
  });
}

export function useComponents(customerId) {
  return useQuery({
    queryKey: ['components', customerId],
    queryFn: () => base44.entities.Component.filter({ customer_id: customerId }, 'category', 1000),
    enabled: Boolean(customerId),
  });
}

export default function AssetsTab({ customer }) {
  const { t } = useLanguage();
  const { data: assets = [], isLoading } = useAssets(customer.id);
  const { data: components = [] } = useComponents(customer.id);
  const { data: evidence = [] } = useCustomerEvidence(customer.id);
  const evByKey = useMemo(() => evidenceSummary(evidence), [evidence]);
  const { data: cveAlerts = [] } = useQuery({
    queryKey: ['cve-alerts', customer.id],
    queryFn: () => base44.entities.CveAlert.filter({ customer_id: customer.id }, '-published', 2000),
  });
  // Alertas CVE em aberto por ativo (o mais grave primeiro).
  const cveByAsset = useMemo(() => {
    const out = {};
    for (const a of cveAlerts) {
      if (!OPEN_ALERT.includes(a.status)) continue;
      for (const c of a.asset_codes || []) {
        const cur = (out[c] ||= { n: 0, critical: 0, kev: 0 });
        cur.n += 1; if (a.severity === 'critical') cur.critical += 1; if (a.kev) cur.kev += 1;
      }
    }
    return out;
  }, [cveAlerts]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return assets.filter((a) => {
      if (filter === 'internet' && !a.internet_exposed) return false;
      if (filter === 'critical' && !['critical', 'high'].includes(a.criticality)) return false;
      if (filter === 'no_evidence' && evByKey[linkKey('asset', a.id)] === 'valid') return false;
      if (filter === 'cve' && !cveByAsset[a.asset_code]) return false;
      if (filter === 'retired' ? a.lifecycle !== 'retired' : (filter !== 'all' && a.lifecycle === 'retired')) return false;
      if (!s) return true;
      return [a.asset_code, a.name, a.service, a.owner, a.fqdn, a.ip_address, a.manufacturer].some((v) => String(v || '').toLowerCase().includes(s));
    });
  }, [assets, q, filter, evByKey, cveByAsset]);

  const exposed = assets.filter((a) => a.internet_exposed && a.lifecycle !== 'retired');
  const today = new Date().toISOString().slice(0, 10);
  const overdue = assets.filter((a) => a.lifecycle !== 'retired' && a.last_review && a.last_review < new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)).length;
  const eos = assets.filter((a) => a.lifecycle !== 'retired' && a.end_of_support && a.end_of_support < today).length;

  const exportArt32 = async () => {
    if (!window.confirm(t('at_art32_confirm'))) return;
    const date = today;
    await downloadXlsx(`Art32_ativos_Internet_${(customer.name || 'cliente').replace(/[^\w-]+/g, '_')}_${date}.xlsx`, 'Art. 32.º', article32Rows(assets),
      `RESERVADO — Lista de ativos diretamente acessíveis pela Internet (Regulamento do CNCS n.º 756/2026, art. 32.º). ${customer.name} · ${date}`);
    await writeAuditLog({ action: 'asset_list_exported', entity_type: 'Asset', entity_id: customer.id, details: `Exportação da lista do art. 32.º (${exposed.length} ativo(s)) — classificação «reservado»` });
    toast.success(t('at_exported'));
  };
  const exportAll = async () => {
    await downloadXlsx(`Inventario_ativos_${(customer.name || 'cliente').replace(/[^\w-]+/g, '_')}_${today}.xlsx`, 'Ativos', inventoryRows(assets));
    await writeAuditLog({ action: 'asset_inventory_exported', entity_type: 'Asset', entity_id: customer.id, details: `Exportação do inventário (${assets.length} ativo(s))` });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          [t('at_kpi_total'), assets.filter((a) => a.lifecycle !== 'retired').length],
          [t('at_kpi_internet'), exposed.length],
          [t('at_kpi_review_overdue'), overdue],
          [t('at_kpi_eos'), eos],
          [t('cve_kpi_assets'), Object.keys(cveByAsset).length],
        ].map(([label, n]) => (
          <Card key={label}><CardContent className="p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{n}</p></CardContent></Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('at_search')} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['all', 'internet', 'critical', 'no_evidence', 'cve', 'retired'].map((f) => <SelectItem key={f} value={f}>{t(`at_filter_${f}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setEditing({})}><Plus className="w-4 h-4 mr-1" />{t('at_new_asset')}</Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-1" />{t('at_import')}</Button>
        <Button variant="outline" onClick={exportAll} disabled={!assets.length}><Download className="w-4 h-4 mr-1" />{t('at_export_all')}</Button>
        <Button variant="outline" onClick={exportArt32} disabled={!exposed.length}><Lock className="w-4 h-4 mr-1" />{t('at_export_art32')}</Button>
      </div>
      <p className="text-xs text-muted-foreground flex items-start gap-1"><Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{t('at_reserved_note')}</p>

      {isLoading ? <p className="text-sm text-muted-foreground">{t('common_loading')}</p> : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">{assets.length ? t('at_no_match') : t('at_no_assets')}</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr>
                {['asset_code', 'name', 'asset_type', 'service', 'criticality', 'internet_exposed', 'lifecycle', 'last_review'].map((f) => <th key={f} className="text-left p-2 font-medium">{t(`as_f_${f}`)}</th>)}
                <th className="text-left p-2 font-medium">{t('ev_title')}</th>
                <th className="text-left p-2 font-medium">CVE</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => {
                const ev = evByKey[linkKey('asset', a.id)];
                return (
                  <tr key={a.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setEditing(a)}>
                    <td className="p-2 font-mono text-xs">{a.asset_code}</td>
                    <td className="p-2">{a.name}</td>
                    <td className="p-2 text-xs">{a.asset_type ? t(`as_type_${a.asset_type}`) : '—'}</td>
                    <td className="p-2 text-xs">{a.service}</td>
                    <td className="p-2">{a.criticality && <Badge variant="outline" className={`text-[10px] ${CRIT_STYLE[a.criticality]}`}>{t(`as_crit_${a.criticality}`)}</Badge>}</td>
                    <td className="p-2">{a.internet_exposed ? <span className="inline-flex items-center gap-1 text-xs"><Globe className="w-3.5 h-3.5 text-chart-3" />{a.fqdn || a.ip_address || t('common_yes')}</span> : <span className="text-xs text-muted-foreground">{t('common_no')}</span>}</td>
                    <td className="p-2 text-xs">{a.lifecycle ? t(`as_life_${a.lifecycle}`) : '—'}</td>
                    <td className="p-2 text-xs">{a.last_review || '—'}</td>
                    <td className="p-2">{ev ? <Badge variant="outline" className={`text-[10px] ${EV_BADGE[ev]}`}>{t(`ev_badge_${ev}`)}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="p-2">{cveByAsset[a.asset_code] ? (
                      <Badge variant="outline" className={`text-[10px] ${cveByAsset[a.asset_code].critical ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-chart-3/10 text-chart-3 border-chart-3/30'}`} title={t('cve_asset_badge_help')}>
                        {cveByAsset[a.asset_code].n}{cveByAsset[a.asset_code].kev ? ' · KEV' : ''}
                      </Badge>
                    ) : <span className="text-xs text-muted-foreground">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AssetDialog open={editing !== null} onOpenChange={(v) => !v && setEditing(null)} asset={editing?.id ? editing : null} customer={customer} assets={assets} />
      <AssetImportDialog open={importOpen} onOpenChange={setImportOpen} customer={customer} assets={assets} components={components} />
    </div>
  );
}
