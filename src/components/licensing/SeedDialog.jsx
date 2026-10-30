import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import { callLicensing } from '@/lib/licensing';
import { LIC_KEYS } from './useCatalog';

const KINDS = ['modules', 'entitlements', 'tiers', 'standards'];

/** Confirmação de «Carregar catálogo inicial»: mostra o que vai ser criado (e o que já existe) antes de correr o seed. */
export default function SeedDialog({ open, onOpenChange }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['lic-seed-preview'], queryFn: () => callLicensing({ action: 'seed_preview' }), enabled: open, staleTime: 0, gcTime: 0,
  });
  useEffect(() => { if (open) setResult(null); }, [open]);
  const preview = data?.preview;
  const missing = preview ? KINDS.reduce((n, k) => n + (preview[k]?.missing.length || 0), 0) : 0;

  const run = async () => {
    setBusy(true);
    try {
      const r = await callLicensing({ action: 'seed' });
      setResult(r.created);
      toast.success(t('lic_seeded', r.created));
      LIC_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      qc.invalidateQueries({ queryKey: ['lic-seed-preview'] });
    } catch (e) { toast.error(e?.message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('lic_seed')}</DialogTitle>
          <DialogDescription>{t('lic_seed_desc')}</DialogDescription>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('common_loading')}</p>}
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        {preview && !result && (
          <div className="space-y-2 text-xs">
            <div className="rounded-md border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50"><tr><th className="text-left p-2">{t('lic_seed_kind')}</th><th className="text-right p-2">{t('lic_seed_to_create')}</th><th className="text-right p-2">{t('lic_seed_present')}</th></tr></thead>
                <tbody>
                  {KINDS.map((k) => (
                    <tr key={k} className="border-t align-top">
                      <td className="p-2">
                        <span className="font-medium">{t(`lic_kind_${k}`)}</span>
                        {preview[k].missing.length > 0 && <span className="block font-mono text-[10px] text-muted-foreground break-all">{preview[k].missing.join(', ')}</span>}
                      </td>
                      <td className={`p-2 text-right ${preview[k].missing.length ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{preview[k].missing.length}</td>
                      <td className="p-2 text-right text-muted-foreground">{preview[k].present.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground">{missing ? t('lic_seed_never_overwrite') : t('lic_seed_nothing')}</p>
          </div>
        )}
        {result && (
          <div className="rounded-md border p-3 text-xs space-y-1">
            <p className="font-medium">{t('lic_seed_done')}</p>
            {KINDS.map((k) => <p key={k}>{t(`lic_kind_${k}`)}: <span className="font-medium">{result[k] || 0}</span></p>)}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common_close')}</Button>
          {!result && <Button onClick={run} disabled={busy || !preview || !missing}>{busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{t('lic_seed_confirm', { n: missing })}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
