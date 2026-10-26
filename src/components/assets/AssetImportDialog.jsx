import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, Loader2, FileSpreadsheet, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import { readWorkbook, parseAssetRows, parseToolRows } from '@/lib/assets';
import { importAssets } from '@/lib/assetsApi';
import { TOOL_CATALOG } from '@/lib/legal/toolCatalog';

export const TEMPLATE_URL = '/templates/AnkoraOne_Modelo_Inventario_Ativos_e_Ferramentas.xlsx';
export const TEMPLATE_CSV_URL = '/templates/AnkoraOne_Modelo_Inventario_Ativos.csv';
const MAX_ROWS = 5000;

export default function AssetImportDialog({ open, onOpenChange, customer, assets = [] }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [reading, setReading] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const reset = () => { setFile(null); setParsed(null); setProgress(0); if (fileRef.current) fileRef.current.value = ''; };
  const close = (v) => { if (!running) { if (!v) reset(); onOpenChange(v); } };

  const onFile = async (f) => {
    if (!f) return;
    setFile(f); setReading(true); setParsed(null);
    try {
      const wb = await readWorkbook(f);
      if (wb.assets.length > MAX_ROWS + 3) throw new Error(t('at_import_too_many', { max: MAX_ROWS }));
      const byCode = new Set(assets.map((a) => a.asset_code));
      const a = parseAssetRows(wb.assets, byCode);
      const known = new Set([...byCode, ...a.items.map((x) => x.data.asset_code).filter(Boolean)]);
      const tl = wb.tools.length ? parseToolRows(wb.tools, TOOL_CATALOG, known) : { items: [], missingHeaders: [] };
      setParsed({ assets: a, tools: tl });
    } catch (e) {
      toast.error(e?.message || t('at_import_read_error'));
      reset();
    } finally {
      setReading(false);
    }
  };

  const validAssets = parsed ? parsed.assets.items.filter((x) => !x.errors.length) : [];
  const validTools = parsed ? parsed.tools.items.filter((x) => !x.errors.length && x.data) : [];
  const total = validAssets.length + validTools.length;

  const run = async () => {
    if (!total) return;
    setRunning(true); setProgress(0);
    try {
      const r = await importAssets(customer.id, validAssets.map((x) => x.data), validTools.map((x) => x.data), (f) => setProgress(f * total));
      const msg = t('at_import_done', { created: r.created, updated: r.updated, tools: r.tools, failed: r.failed.length });
      r.failed.length ? toast.warning(`${msg} — ${r.failed.slice(0, 3).map((f) => `${f.code || f.tool}: ${f.error}`).join('; ')}`) : toast.success(msg);
      qc.invalidateQueries({ queryKey: ['assets', customer.id] });
      qc.invalidateQueries({ queryKey: ['components', customer.id] });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.message || t('ev_error'));
    } finally {
      setRunning(false);
    }
  };

  const issues = parsed ? [...parsed.assets.items.map((x) => ({ ...x, sheet: t('at_tab_assets') })), ...parsed.tools.items.map((x) => ({ ...x, sheet: t('at_tab_tools') }))]
    .filter((x) => x.errors.length || x.warnings.length) : [];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('at_import_title')}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground text-xs">{t('at_import_help')}</p>
          <div className="flex flex-wrap gap-2">
            <a href={TEMPLATE_URL} download><Button variant="outline" size="sm" type="button"><Download className="w-4 h-4 mr-1" />{t('at_template_xlsx')}</Button></a>
            <a href={TEMPLATE_CSV_URL} download><Button variant="outline" size="sm" type="button"><Download className="w-4 h-4 mr-1" />{t('at_template_csv')}</Button></a>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.ods,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button type="button" onClick={() => fileRef.current?.click()} disabled={reading || running}>
            {reading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}{t('at_import_choose')}
          </Button>
          {file && <p className="text-xs flex items-center gap-1"><FileSpreadsheet className="w-4 h-4" />{file.name}</p>}

          {parsed && (
            <div className="space-y-2">
              {parsed.assets.missingHeaders.length > 0 && (
                <p className="text-xs text-destructive">{t('at_import_missing_headers')}: {parsed.assets.missingHeaders.join(', ')}</p>
              )}
              {parsed.assets.unknownHeaders.length > 0 && (
                <p className="text-xs text-muted-foreground">{t('at_import_unknown_headers')}: {parsed.assets.unknownHeaders.join(', ')}</p>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{t('at_import_assets_valid', { n: validAssets.length, total: parsed.assets.items.length })}</Badge>
                <Badge variant="outline">{t('at_import_assets_update', { n: validAssets.filter((x) => x.update).length })}</Badge>
                {parsed.tools.items.length > 0 && <Badge variant="outline">{t('at_import_tools_valid', { n: validTools.length, total: parsed.tools.items.length })}</Badge>}
              </div>
              {issues.length > 0 && (
                <div className="max-h-64 overflow-y-auto rounded border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0"><tr><th className="text-left p-1.5">{t('at_import_sheet')}</th><th className="text-left p-1.5">{t('at_import_row')}</th><th className="text-left p-1.5">{t('at_import_issues')}</th></tr></thead>
                    <tbody>
                      {issues.slice(0, 300).map((x) => (
                        <tr key={`${x.sheet}-${x.row}`} className="border-t align-top">
                          <td className="p-1.5 whitespace-nowrap">{x.sheet}</td>
                          <td className="p-1.5">{x.row}</td>
                          <td className="p-1.5">
                            {x.errors.map((e) => <div key={e} className="text-destructive">{e}</div>)}
                            {x.warnings.map((w) => <div key={w} className="text-chart-3">{w}</div>)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">{t('at_import_only_valid')}</p>
            </div>
          )}
          {running && <Progress value={total ? (progress / total) * 100 : 0} className="h-2" />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={running}>{t('common_cancel')}</Button>
          <Button onClick={run} disabled={!total || running || (parsed?.assets.missingHeaders.length > 0 && !validTools.length)}>
            {running && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{t('at_import_run', { n: total })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
