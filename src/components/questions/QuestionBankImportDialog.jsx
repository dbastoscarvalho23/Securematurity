import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Upload, FileJson, AlertCircle, Loader2, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { fetchAllRecords, parseQuestionBankPackage, buildImportPlan } from '@/lib/questionBankTransfer';

function formatDate(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale === 'pt' ? 'pt-PT' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function QuestionBankImportDialog({ open, onOpenChange, onImport, importing }) {
  const { t, language } = useLanguage();
  const inputRef = useRef();
  const [fileName, setFileName] = useState('');
  const [pkg, setPkg] = useState(null);
  const [parseError, setParseError] = useState('');
  const [updateExisting, setUpdateExisting] = useState(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ['question-bank-transfer-existing'],
    enabled: open,
    queryFn: async () => ({
      frameworks: await fetchAllRecords(base44.entities.Framework),
      controls: await fetchAllRecords(base44.entities.FrameworkControl),
      questions: await fetchAllRecords(base44.entities.Question, 'order_index'),
    }),
  });

  const plan = useMemo(
    () => (pkg && existing ? buildImportPlan(pkg, existing, { updateExisting }) : null),
    [pkg, existing, updateExisting],
  );

  const reset = () => {
    setFileName('');
    setPkg(null);
    setParseError('');
    setUpdateExisting(false);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    setParseError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        setPkg(parseQuestionBankPackage(event.target.result));
      } catch (err) {
        setPkg(null);
        setParseError(err.message === 'invalid_json' ? t('qb_import_err_json') : t('qb_import_err_package'));
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    handleFile(event.dataTransfer.files?.[0]);
  };

  const rows = pkg ? [
    { key: 'frameworks', label: t('qb_import_frameworks'), inFile: pkg.frameworks.length, create: plan?.frameworks.create.length, update: plan?.frameworks.update.length, skipped: 0 },
    { key: 'controls', label: t('qb_import_controls'), inFile: pkg.controls.length, create: plan?.controls.create.length, update: plan?.controls.update.length, skipped: plan?.controls.skipped },
    { key: 'domains', label: t('qb_import_domains'), inFile: pkg.domains.length, create: null, update: null, skipped: 0 },
    { key: 'questions', label: t('qb_import_questions'), inFile: pkg.questions.length, create: plan?.questions.create.length, update: plan?.questions.update.length, skipped: plan?.questions.skipped },
  ] : [];

  const canImport = !!plan && plan.total > 0 && !importing;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-primary" />
            {t('qb_import_title')}
          </DialogTitle>
        </DialogHeader>

        {!pkg ? (
          <div className="space-y-3">
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">{t('qb_import_drop')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('qb_import_file_types')}</p>
              <input
                ref={inputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={e => handleFile(e.target.files?.[0])}
              />
            </div>
            {parseError && (
              <div className="flex items-center gap-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {parseError}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-lg text-xs">
              <FileJson className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="flex-1 truncate font-medium">{fileName}</span>
              {pkg.source_app && <span className="text-muted-foreground">{t('qb_import_source')}: {pkg.source_app}</span>}
              <span className="text-muted-foreground">{t('qb_import_exported_at')}: {formatDate(pkg.exported_at, language)}</span>
              <button onClick={reset} className="text-muted-foreground hover:text-foreground" title={t('qb_import_change')}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('qb_import_contents')}</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">{t('qb_import_in_file')}</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">{t('qb_import_to_add')}</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">{t('qb_import_to_update')}</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">{t('qb_import_skipped')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.key} className="border-t">
                      <td className="px-3 py-2 font-medium">{row.label}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground">{row.inFile}</td>
                      <td className="px-3 py-2 text-center">
                        {row.create === null ? '—' : <span className="font-semibold text-accent">{row.create}</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.update === null ? '—' : <span className="font-semibold text-chart-3">{row.update}</span>}
                      </td>
                      <td className="px-3 py-2 text-center text-muted-foreground">
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : (row.skipped || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="qb-import-update-existing"
                checked={updateExisting}
                onCheckedChange={v => setUpdateExisting(v === true)}
              />
              <Label htmlFor="qb-import-update-existing" className="text-xs font-normal cursor-pointer">
                {t('qb_import_update_existing')}
              </Label>
            </div>

            {plan && plan.total === 0 && (
              <div className="flex items-center gap-2 p-2.5 bg-muted/40 border border-border rounded-lg text-xs text-muted-foreground">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {t('qb_import_nothing')}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={handleClose} disabled={importing}>{t('common_cancel')}</Button>
          <Button onClick={() => onImport(plan)} disabled={!canImport} className="gap-2">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importing ? t('qb_importing') : t('qb_import_btn')}
            {!importing && pkg && plan?.total > 0 ? <Badge variant="secondary" className="ml-1">{plan.total}</Badge> : null}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
