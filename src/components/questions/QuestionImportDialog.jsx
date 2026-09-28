import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { sha256File } from '@/lib/fileHash';
import {
  Import as ImportIcon,
  FileJson,
  Loader2,
  Upload,
  CheckCircle2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/lib/LanguageContext';
import { cn } from '@/lib/utils';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
import QuestionImportItemsTable from '@/components/questions/QuestionImportItemsTable';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import {
  IMPORT_FIELDS,
  IMPORT_STATE_META,
  IMPORT_STATE_ORDER,
  detectMapping,
  errorKeyFor,
  fileTypeOf,
  needsAiExtraction,
  parseSheet,
  readFileAsText,
  rowsToQuestions,
} from '@/lib/questionImport';

/**
 * QuestionImportDialog — importação de bases de perguntas.
 *
 * Assistente em três passos (ficheiro → mapeamento → validação/revisão) que
 * termina na área de revisão do lote. O browser só lê o ficheiro e apresenta; a
 * classificação (`validate`) e a escrita (`create_draft` / `review` / `publish`)
 * são do `manageQuestionImport`. O catálogo só é tocado na publicação — até lá
 * o lote é um rascunho e pode ser descartado sem deixar rasto.
 *
 * Ficheiros JSON/Excel/CSV são lidos no browser (o projeto já usa o `xlsx`);
 * PDF/DOCX são carregados para o armazenamento da aplicação e extraídos por IA
 * em `extractQuestionBank`, regressando ao mesmo pacote normalizado.
 */

const ACCEPTED = '.json,.csv,.xlsx,.xls,.pdf,.docx';

const STATUS_META = {
  draft: { labelKey: 'qimp_status_draft', className: 'bg-status-info/10 text-status-info border-status-info/20' },
  published: { labelKey: 'qimp_status_published', className: 'bg-status-success/10 text-status-success border-status-success/20' },
  discarded: { labelKey: 'qimp_status_discarded', className: 'text-muted-foreground border-border' },
  reverted: { labelKey: 'qimp_status_reverted', className: 'bg-status-warning/10 text-status-warning border-status-warning/20' },
};

const EDIT_FIELDS = {
  question: ['framework_code', 'control_id', 'domain', 'question_text', 'question_text_pt', 'guidance', 'weight', 'order_index'],
  control: ['framework_code', 'control_id', 'domain', 'title', 'description'],
  framework: ['framework_code', 'framework_name', 'framework_version', 'framework_status'],
};

/** Editor de uma linha do lote (o item, nunca a entidade do catálogo). */
function ItemEditDialog({ item, open, onOpenChange, onSave, saving }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!item) return;
    const fields = EDIT_FIELDS[item.item_type] || EDIT_FIELDS.question;
    const next = {};
    for (const field of fields) next[field] = item[field] ?? '';
    setForm(next);
  }, [item]);

  if (!item) return null;
  const fields = EDIT_FIELDS[item.item_type] || EDIT_FIELDS.question;
  const labelKeyFor = (field) => IMPORT_FIELDS.find(f => f.key === field)?.labelKey || `qimp_field_${field}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('qimp_edit_item')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {fields.map(field => (
            <div key={field} className="space-y-1.5">
              <Label>{t(labelKeyFor(field))}</Label>
              {['question_text', 'question_text_pt', 'guidance', 'description', 'title'].includes(field) ? (
                <Textarea
                  rows={2}
                  value={form[field] ?? ''}
                  onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                />
              ) : (
                <Input
                  value={form[field] ?? ''}
                  onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{t('qimp_review_hint')}</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common_cancel')}</Button>
          <Button disabled={saving} onClick={() => onSave(form)}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common_save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Cartão de um lote (rascunho ou histórico) na entrada do assistente. */
function BatchCard({ batch, onOpen }) {
  const { t } = useLanguage();
  const statusMeta = STATUS_META[batch.status] || STATUS_META.draft;
  return (
    <Card>
      <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium flex items-center gap-2 flex-wrap">
            <FileJson className="w-4 h-4 text-muted-foreground" />
            {batch.source_file_name}
            <Badge variant="outline" className={cn('text-xs', statusMeta.className)}>
              {t(statusMeta.labelKey)}
            </Badge>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('qimp_counts', {
              items: batch.item_count || 0,
              valid: batch.valid_count || 0,
              warning: batch.warning_count || 0,
              duplicate: batch.duplicate_count || 0,
              error: batch.error_count || 0,
            })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onOpen(batch)}>{t('qimp_open')}</Button>
      </CardContent>
    </Card>
  );
}

export default function QuestionImportDialog({ open, onOpenChange, onImported }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('file');
  const [drafts, setDrafts] = useState([]);
  const [history, setHistory] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [mapping, setMapping] = useState({});
  const [bundle, setBundle] = useState(null);
  const [batch, setBatch] = useState(null);
  const [items, setItems] = useState([]);
  const [fileMeta, setFileMeta] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [frameworkFilter, setFrameworkFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirming, setConfirming] = useState(null);

  const reviewing = !!batch;

  const call = async (payload) => {
    const response = await base44.functions.invoke('manageQuestionImport', payload);
    const data = response?.data || response;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const messageFor = (code) => t(errorKeyFor(code));

  // Rascunhos por publicar e histórico (publicados, revertidos, descartados) —
  // é por aqui que se volta a um lote publicado para o reverter.
  const loadBatches = async () => {
    try {
      const data = await call({ action: 'list' });
      const all = data?.batches || [];
      setDrafts(all.filter(batch => batch.status === 'draft'));
      setHistory(all.filter(batch => batch.status !== 'draft').slice(0, 10));
    } catch {
      setDrafts([]);
      setHistory([]);
    }
  };

  useEffect(() => {
    if (!open) return;
    setStep('file');
    setSheet(null);
    setMapping({});
    setBundle(null);
    setBatch(null);
    setItems([]);
    setFileMeta(null);
    setError('');
    setBusy(null);
    setStateFilter('all');
    setFrameworkFilter('all');
    setEditing(null);
    setConfirming(null);
    loadBatches();
  }, [open]);

  const validateBundle = async (nextBundle) => {
    setBusy('validating');
    const result = await call({ action: 'validate', bundle: nextBundle });
    setBundle(nextBundle);
    setItems(result.items || []);
    setStep('review');
  };

  const handleFile = async (file) => {
    setError('');
    const type = fileTypeOf(file.name);
    try {
      setBusy('reading');
      const hash = await sha256File(file);
      setFileMeta({ name: file.name, type, hash });

      if (type === 'json') {
        const text = await readFileAsText(file);
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error('parse_failed');
        }
        await validateBundle(parsed);
      } else if (type === 'csv' || type === 'xlsx') {
        const parsedSheet = await parseSheet(file);
        if (!parsedSheet.headers.length) throw new Error('empty_file');
        setSheet(parsedSheet);
        setMapping(detectMapping(parsedSheet.headers));
        setStep('mapping');
      } else if (needsAiExtraction(type)) {
        setBusy('uploading');
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setBusy('extracting');
        const response = await base44.functions.invoke('extractQuestionBank', {
          file_urls: [file_url],
          file_name: file.name,
        });
        const data = response?.data || response;
        if (data?.error) throw new Error(data.error);
        if (!(data?.bundle?.questions || []).length) throw new Error('empty_bundle');
        await validateBundle(data.bundle);
      } else {
        throw new Error('parse_failed');
      }
    } catch (err) {
      const code = err?.message || 'parse_failed';
      setError(code === 'parse_failed' ? t('qimp_parse_error') : messageFor(code));
    } finally {
      setBusy(null);
    }
  };

  const handleMappingContinue = async () => {
    setError('');
    const missing = IMPORT_FIELDS.filter(field => field.required && !mapping[field.key]);
    if (missing.length > 0) {
      setError(t('qimp_mapping_required_missing', { fields: missing.map(f => t(f.labelKey)).join(', ') }));
      return;
    }
    try {
      const questions = rowsToQuestions(sheet.headers, sheet.rows, mapping);
      if (questions.length === 0) throw new Error('empty_bundle');
      await validateBundle({ questions });
    } catch (err) {
      setError(messageFor(err?.message || 'parse_failed'));
    } finally {
      setBusy(null);
    }
  };

  const handleCreateDraft = async () => {
    setError('');
    try {
      setBusy('creating');
      const result = await call({ action: 'create_draft', bundle, file: fileMeta });
      setBatch(result.batch);
      setItems(result.items || []);
      toast.success(t('qimp_draft_created', { count: result.summary?.item_count ?? (result.items || []).length }));
      loadBatches();
    } catch (err) {
      setError(messageFor(err?.message || 'generic'));
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  const openBatch = async (target) => {
    setError('');
    try {
      setBusy('loading');
      const data = await call({ action: 'get', batch_id: target.id });
      setBatch(data.batch);
      setItems(data.items || []);
      setFileMeta({
        name: data.batch?.source_file_name,
        type: data.batch?.source_file_type,
        hash: data.batch?.source_file_hash,
      });
      setStep('review');
    } catch (err) {
      setError(messageFor(err?.message || 'generic'));
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  const refreshDetail = async () => {
    const data = await call({ action: 'get', batch_id: batch.id });
    setBatch(data.batch);
    setItems(data.items || []);
  };

  const reviewItem = async (item, reviewState, patch) => {
    setError('');
    try {
      const result = await call({ action: 'review', batch_id: batch.id, item_id: item.id, review_state: reviewState, patch });
      const updated = result.items?.[0];
      if (updated) setItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    } catch (err) {
      setError(messageFor(err?.message || 'generic'));
    }
  };

  const reviewAll = async (reviewState, onlyState) => {
    setError('');
    try {
      const result = await call({ action: 'review', batch_id: batch.id, review_state: reviewState, only_state: onlyState });
      const byId = new Map((result.items || []).map(item => [item.id, item]));
      setItems(prev => prev.map(item => byId.get(item.id) || item));
    } catch (err) {
      setError(messageFor(err?.message || 'generic'));
    }
  };

  const handlePublish = async () => {
    const approved = items.filter(item => item.review_state === 'approved').length;
    if (approved === 0) {
      setError(t('qimp_error_no_approved_items'));
      return;
    }
    setError('');
    try {
      setBusy('publishing');
      const result = await call({ action: 'publish', batch_id: batch.id });
      await refreshDetail();
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      onImported?.();
      toast.success(t('qimp_published', { created: result.created, updated: result.updated, skipped: result.skipped }));
    } catch (err) {
      setError(messageFor(err?.message || 'generic'));
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  const handleDiscard = async () => {
    setError('');
    try {
      setBusy('discarding');
      const result = await call({ action: 'discard', batch_id: batch.id });
      setBatch(result.batch);
      toast.success(t('qimp_discarded'));
      loadBatches();
    } catch (err) {
      setError(messageFor(err?.message || 'generic'));
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  const handleRevert = async () => {
    setError('');
    try {
      setBusy('reverting');
      const result = await call({ action: 'revert', batch_id: batch.id });
      await refreshDetail();
      loadBatches();
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      onImported?.();
      toast.success(t('qimp_reverted', { removed: result.removed, restored: result.restored }));
    } catch (err) {
      setError(messageFor(err?.message || 'generic'));
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  const frameworks = useMemo(
    () => [...new Set(items.map(item => item.framework_code).filter(Boolean))].sort(),
    [items],
  );

  const visibleItems = useMemo(
    () => items.filter(item =>
      (stateFilter === 'all' || item.state === stateFilter) &&
      (frameworkFilter === 'all' || item.framework_code === frameworkFilter)),
    [items, stateFilter, frameworkFilter],
  );

  const counts = useMemo(() => {
    const result = { total: items.length, valid: 0, warning: 0, duplicate: 0, error: 0, applied: 0, approved: 0, excluded: 0 };
    for (const item of items) {
      if (result[item.state] !== undefined) result[item.state] += 1;
      if (item.review_state === 'approved') result.approved += 1;
      if (item.review_state === 'excluded') result.excluded += 1;
    }
    return result;
  }, [items]);

  // Num lote já criado, as contagens da classificação vêm do próprio lote (os
  // itens passam a "publicada" depois de publicar); antes do rascunho, dos itens.
  const breakdown = batch
    ? {
        items: batch.item_count || 0,
        valid: batch.valid_count || 0,
        warning: batch.warning_count || 0,
        duplicate: batch.duplicate_count || 0,
        error: batch.error_count || 0,
      }
    : {
        items: counts.total,
        valid: counts.valid,
        warning: counts.warning,
        duplicate: counts.duplicate,
        error: counts.error,
      };

  const busyLabel = {
    reading: t('qimp_reading'),
    uploading: t('qimp_uploading'),
    extracting: t('qimp_extracting'),
    validating: t('qimp_preview_title'),
    loading: t('common_loading'),
  }[busy];

  const steps = ['file', 'mapping', 'review'].filter(s => s !== 'mapping' || !!sheet);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ImportIcon className="w-5 h-5 text-primary" />
            {t('qimp_title')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-shrink-0">
          {steps.map((value, index) => (
            <div key={value} className="flex items-center gap-2">
              <span className={cn(
                'text-xs font-medium px-2 py-1 rounded-md',
                step === value ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
              )}>
                {index + 1}. {t(`qimp_step_${value}`)}
              </span>
              {index < steps.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
            </div>
          ))}
        </div>

        {error && (
          <div className="flex-shrink-0">
            <ErrorState variant="inline" className="py-3" description={error} />
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {busy && busyLabel && (
            <LoadingState label={busyLabel} className="py-10" />
          )}

          {!busy && step === 'file' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const dropped = e.dataTransfer?.files?.[0];
                  if (dropped) handleFile(dropped);
                }}
                className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-primary/40 transition-colors"
              >
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">{t('qimp_drop_title')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('qimp_drop_hint')}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={ACCEPTED}
                  onChange={e => {
                    const selected = e.target.files?.[0];
                    if (selected) handleFile(selected);
                    e.target.value = '';
                  }}
                />
              </div>

              <div>
                <p className="text-sm font-medium mb-2">{t('qimp_open_drafts')}</p>
                {drafts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('qimp_no_drafts')}</p>
                ) : (
                  <div className="space-y-2">
                    {drafts.map(draft => <BatchCard key={draft.id} batch={draft} onOpen={openBatch} />)}
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-medium mb-2">{t('qimp_history')}</p>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('qimp_history_empty')}</p>
                ) : (
                  <div className="space-y-2">
                    {history.map(batchItem => <BatchCard key={batchItem.id} batch={batchItem} onOpen={openBatch} />)}
                  </div>
                )}
              </div>
            </div>
          )}

          {!busy && step === 'mapping' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">{t('qimp_mapping_title')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('qimp_mapping_hint')}</p>
              </div>
              <div className="space-y-2">
                {IMPORT_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-3">
                    <span className="text-sm w-48">
                      {t(field.labelKey)}
                      {field.required && <span className="text-status-danger"> *</span>}
                    </span>
                    <Select
                      value={mapping[field.key] || '__none__'}
                      onValueChange={value => setMapping(prev => {
                        const next = { ...prev };
                        if (value === '__none__') delete next[field.key];
                        else next[field.key] = value;
                        return next;
                      })}
                    >
                      <SelectTrigger className="max-w-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t('qimp_mapping_ignored')}</SelectItem>
                        {sheet.headers.map(header => (
                          <SelectItem key={header} value={header}>{header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep('file')}>{t('qimp_back')}</Button>
                <Button onClick={handleMappingContinue}>{t('qimp_next')}</Button>
              </div>
            </div>
          )}

          {!busy && step === 'review' && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn('text-xs', (STATUS_META[batch?.status] || STATUS_META.draft).className)}>
                      {t((STATUS_META[batch?.status] || STATUS_META.draft).labelKey)}
                    </Badge>
                    <span className="text-sm font-medium">{fileMeta?.name}</span>
                    {fileMeta?.type && <Badge variant="outline" className="text-xs">{fileMeta.type}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{t('qimp_provenance')}:</span>{' '}
                    {t('qimp_created_by')} {batch?.imported_by || '—'}
                    {batch?.published_by ? ` · ${t('qimp_status_published')} ${batch.published_by}` : ''}
                    {fileMeta?.hash ? ` · ${t('qimp_hash')} ${String(fileMeta.hash).slice(0, 16)}…` : ''}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                    <span>{t('qimp_counts', breakdown)}</span>
                    <span>{t('qimp_approved')}: <strong className="text-foreground">{counts.approved}</strong></span>
                    {counts.applied > 0 && <span>{t('qimp_state_applied')}: {counts.applied}</span>}
                    {counts.excluded > 0 && <span>{t('qimp_excluded')}: {counts.excluded}</span>}
                  </div>
                  {!reviewing && (
                    <p className="text-xs text-muted-foreground">{t('qimp_preview_hint')}</p>
                  )}
                  {reviewing && (
                    <p className="text-xs text-muted-foreground">{t('qimp_review_hint')}</p>
                  )}
                </CardContent>
              </Card>

              <div className="flex items-center gap-3 flex-wrap">
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder={t('qimp_filter_state')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('qimp_filter_all')}</SelectItem>
                    {IMPORT_STATE_ORDER.map(state => (
                      <SelectItem key={state} value={state}>{t(IMPORT_STATE_META[state].labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {frameworks.length > 0 && (
                  <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue placeholder={t('qimp_filter_framework')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('qimp_filter_all')}</SelectItem>
                      {frameworks.map(code => <SelectItem key={code} value={code}>{code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {reviewing && batch?.status === 'draft' && (
                  <>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => reviewAll('approved', 'valid')}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> {t('qimp_approve_valid')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => reviewAll('excluded', 'error')}>
                      {t('qimp_exclude_errors')}
                    </Button>
                  </>
                )}
              </div>

              {visibleItems.length === 0 ? (
                <EmptyState
                  icon={ImportIcon}
                  title={t('qimp_nothing_to_import')}
                  description={steps.length === 0 ? undefined : t('qimp_preview_hint')}
                />
              ) : (
                <Card>
                  <CardContent className="p-0 overflow-x-auto">
                    <QuestionImportItemsTable
                      items={visibleItems}
                      reviewing={reviewing}
                      canEdit={reviewing && batch?.status === 'draft'}
                      onApprove={item => reviewItem(item, 'approved')}
                      onExclude={item => reviewItem(item, 'excluded')}
                      onEdit={item => setEditing(item)}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex justify-between gap-2 pt-3 border-t">
          <div>
            {step === 'review' && !reviewing && (
              <Button variant="outline" onClick={() => setStep(sheet ? 'mapping' : 'file')}>
                {t('qimp_back')}
              </Button>
            )}
            {reviewing && batch?.status === 'draft' && (
              <Button variant="outline" className="text-status-danger" onClick={() => setConfirming('discard')} disabled={!!busy}>
                {t('qimp_discard')}
              </Button>
            )}
            {reviewing && batch?.status === 'published' && (
              <Button variant="outline" onClick={() => setConfirming('revert')} disabled={!!busy}>
                {t('qimp_revert')}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('qimp_close')}</Button>
            {step === 'review' && !reviewing && (
              <Button onClick={handleCreateDraft} disabled={!!busy || items.length === 0}>
                {t('qimp_create_draft')}
              </Button>
            )}
            {reviewing && batch?.status === 'draft' && (
              <Button onClick={() => setConfirming('publish')} disabled={!!busy || counts.approved === 0}>
                {t('qimp_publish', { count: counts.approved })}
              </Button>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={confirming === 'publish'}
          onOpenChange={() => setConfirming(null)}
          title={t('qimp_publish', { count: counts.approved })}
          description={t('qimp_publish_confirm', { count: counts.approved })}
          confirmLabel={t('qimp_publish', { count: counts.approved })}
          cancelLabel={t('common_cancel')}
          loading={busy === 'publishing'}
          destructive={false}
          onConfirm={handlePublish}
        />
        <ConfirmDialog
          open={confirming === 'discard'}
          onOpenChange={() => setConfirming(null)}
          title={t('qimp_discard')}
          description={t('qimp_discard_confirm')}
          confirmLabel={t('qimp_discard')}
          cancelLabel={t('common_cancel')}
          loading={busy === 'discarding'}
          onConfirm={handleDiscard}
        />
        <ConfirmDialog
          open={confirming === 'revert'}
          onOpenChange={() => setConfirming(null)}
          title={t('qimp_revert')}
          description={t('qimp_revert_confirm')}
          confirmLabel={t('qimp_revert')}
          cancelLabel={t('common_cancel')}
          loading={busy === 'reverting'}
          onConfirm={handleRevert}
        />

        <ItemEditDialog
          item={editing}
          open={!!editing}
          saving={savingEdit}
          onOpenChange={value => { if (!value) setEditing(null); }}
          onSave={async (form) => {
            setSavingEdit(true);
            await reviewItem(editing, editing.review_state, form);
            setSavingEdit(false);
            setEditing(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
