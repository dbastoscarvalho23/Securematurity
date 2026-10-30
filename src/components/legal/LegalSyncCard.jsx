import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Upload, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { writeAuditLog } from '@/lib/auditLog';
import { syncLegalLibrary, importCisXlsx } from '@/lib/legal/sync';

/** Administração: sincronizar referenciais/controlos/perguntas com a Biblioteca Legal e importar os CIS Controls. */
export default function LegalSyncCard() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const refresh = () => ['frameworks', 'questions', 'framework-controls'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const sync = async () => {
    setRunning(true);
    try {
      const stats = await syncLegalLibrary(base44, { onProgress: setStep });
      await writeAuditLog({ action: 'settings_changed', entity_type: 'Framework', details: `Biblioteca Legal sincronizada: ${JSON.stringify(stats)}` });
      toast.success(t('legal_sync_done', stats));
      refresh();
    } catch (e) {
      toast.error(e?.message || t('x_error_generic'));
    } finally {
      setRunning(false);
      setStep('');
    }
  };

  const importCis = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const r = await importCisXlsx(base44, file);
      await writeAuditLog({ action: 'settings_changed', entity_type: 'Framework', details: `CIS Controls importados: ${r.safeguards} salvaguardas` });
      toast.success(t('legal_cis_imported', { count: r.safeguards }));
      refresh();
    } catch (err) {
      toast.error(err?.message || t('x_error_generic'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Scale className="w-4 h-4" /> {t('legal_title')}</CardTitle>
        <CardDescription>{t('legal_sync_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={sync} disabled={running} className="gap-2">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {running ? t('legal_sync_running') : t('legal_sync')}
          </Button>
          {running && step && <span className="text-xs text-muted-foreground">{step}</span>}
        </div>
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-xs text-muted-foreground">{t('legal_cis_import_desc')}</p>
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={importCis} />
          <Button variant="outline" size="sm" className="gap-2" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {t('legal_cis_import')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
