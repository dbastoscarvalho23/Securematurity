import React, { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Inbox, Upload, Sparkles, Loader2, ExternalLink, ClipboardCheck, FolderSearch, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useLicense, hasModule } from '@/lib/licensing';
import { useAiEnabled } from '@/lib/ai';
import { openFile, FILE_SCHEME } from '@/lib/cloudStorage';
import { EVIDENCE_ACCEPT } from '@/lib/evidence';
import { listIntakes, uploadIntake, classifyIntake, scanIntakeFolder, INTAKE_OPEN_STATES, BATCH_STATES, BATCH_MAX } from '@/lib/intake';
import IntakeReviewDialog from '@/components/repository/IntakeReviewDialog';
import IntakeMetrics from '@/components/repository/IntakeMetrics';

const STATUS_STYLE = {
  pending: 'bg-muted text-muted-foreground',
  classifying: 'bg-chart-1/10 text-chart-1 border-chart-1/30',
  proposed: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
  accepted: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
  rejected: 'bg-muted text-muted-foreground line-through',
  error: 'bg-destructive/10 text-destructive border-destructive/30',
};

const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—');

/**
 * «Por classificar»: documentos carregados para a plataforma propor o que são e onde se indexam.
 * Só o administrador da plataforma e o administrador do cliente. O botão «Classificar» só aparece com o ponto de uso
 * «document_classification» ativo e o módulo «ai_assistant» na licença; sem ele, o documento indexa-se à mão.
 * «Classificar todos» trata um documento de cada vez (no máximo BATCH_MAX), para respeitar o limite de ritmo da IA,
 * e para no primeiro limite de ritmo, quota esgotada ou licença. «Procurar na pasta» só aparece com repositório
 * externo (Google Drive, OneDrive, NAS).
 */
const STOP_STATUS = [402, 403, 429];
export default function IntakePanel({ customerId }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState('');
  const [busy, setBusy] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [reviewId, setReviewId] = useState(null);
  const [batch, setBatch] = useState(null); // { i, n } durante a classificação em lote
  const [scanning, setScanning] = useState(false);
  const stopRef = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ['intakes', customerId],
    queryFn: () => listIntakes(customerId),
    enabled: Boolean(customerId),
  });
  const intakes = data?.intakes || [];
  const external = Boolean(data?.provider && data.provider !== 'base44');
  const { data: license } = useLicense(isAdmin ? customerId : undefined);
  const aiOn = useAiEnabled('document_classification');
  const canClassify = aiOn && hasModule(license, user, 'ai_assistant');

  const shown = useMemo(() => intakes.filter((i) => showAll || INTAKE_OPEN_STATES.includes(i.status) || i.status === 'classifying'), [intakes, showAll]);
  const openCount = intakes.filter((i) => INTAKE_OPEN_STATES.includes(i.status)).length;
  // Mais antigos primeiro: a lista vem por data de criação descendente.
  const batchQueue = useMemo(() => intakes.filter((i) => BATCH_STATES.includes(i.status)).reverse(), [intakes]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['intakes', customerId] });
    qc.invalidateQueries({ queryKey: ['repo-stored-files', customerId] });
    qc.invalidateQueries({ queryKey: ['evidence', customerId] });
    qc.invalidateQueries({ queryKey: ['intake'] });
    qc.invalidateQueries({ queryKey: ['intake-metrics', customerId] });
  };

  const classifyAll = async () => {
    const queue = batchQueue.slice(0, BATCH_MAX);
    if (!queue.length) return;
    stopRef.current = false;
    let ok = 0; let failed = 0; let stopped = '';
    for (const [i, it] of queue.entries()) {
      if (stopRef.current) { stopped = t('intake_batch_cancelled'); break; }
      setBatch({ i: i + 1, n: queue.length });
      setBusy(it.id);
      try {
        await classifyIntake(it.id);
        ok += 1;
      } catch (e) {
        if (STOP_STATUS.includes(e?.status)) { stopped = e?.message || t('intake_error'); break; }
        failed += 1;
      }
      qc.invalidateQueries({ queryKey: ['intakes', customerId] });
    }
    setBusy(''); setBatch(null);
    refresh();
    if (ok) toast.success(t('intake_batch_done', { n: ok }));
    if (failed) toast.error(t('intake_batch_failed', { n: failed }));
    if (stopped) toast.message(t('intake_batch_stopped', { reason: stopped }));
    if (batchQueue.length > queue.length && !stopped) toast.message(t('intake_batch_more', { n: batchQueue.length - queue.length }));
  };

  const scan = async () => {
    setScanning(true);
    try {
      const r = await scanIntakeFolder(customerId);
      const added = r?.added?.length || 0;
      if (added) toast.success(t('intake_scan_added', { n: added, location: r.location }));
      else toast.message(t('intake_scan_none', { location: r?.location || '' }));
      if (r?.duplicates?.length) toast.message(t('intake_duplicates', { n: r.duplicates.length }));
      for (const s of (r?.skipped || []).slice(0, 5)) toast.error(`${s.name}: ${s.reason}`);
      if (r?.remaining) toast.message(t('intake_scan_remaining', { n: r.remaining }));
      refresh();
    } catch (e) {
      toast.error(e?.message || t('intake_error'));
    } finally {
      setScanning(false);
    }
  };

  const onFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    let ok = 0; let dup = 0; let failed = 0;
    for (const [i, f] of files.entries()) {
      setUploading(t('intake_uploading', { i: i + 1, n: files.length }));
      try {
        const res = await uploadIntake(f, customerId);
        if (res?.duplicate) dup += 1; else ok += 1;
      } catch (e) {
        failed += 1;
        toast.error(`${f.name}: ${e?.message || t('intake_error')}`);
      }
    }
    setUploading('');
    if (inputRef.current) inputRef.current.value = '';
    if (ok) toast.success(t('intake_uploaded', { n: ok }));
    if (dup) toast.message(t('intake_duplicates', { n: dup }));
    if (ok || dup || failed) refresh();
  };

  const classify = async (it) => {
    setBusy(it.id);
    try {
      await classifyIntake(it.id);
      refresh();
      setReviewId(it.id);
    } catch (e) {
      toast.error(e?.message || t('intake_error'));
      refresh();
    } finally {
      setBusy('');
    }
  };

  const open = async (it) => {
    try { await openFile(`${FILE_SCHEME}${it.stored_file_id}`, it.file_name); } catch (e) { toast.error(e?.message || t('repo_open_error')); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="w-4 h-4 text-primary" />{t('intake_title')}
              {openCount > 0 && <Badge variant="secondary">{openCount}</Badge>}
            </CardTitle>
            <CardDescription>{t('intake_desc')}</CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canClassify && (batch ? (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { stopRef.current = true; }}>
                <Loader2 className="w-4 h-4 animate-spin" />{t('intake_batch_progress', { i: batch.i, n: batch.n })} · {t('intake_batch_stop')}
              </Button>
            ) : batchQueue.length > 1 && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={classifyAll} disabled={Boolean(busy) || Boolean(uploading)}>
                <Layers className="w-4 h-4" />{t('intake_batch', { n: Math.min(batchQueue.length, BATCH_MAX) })}
              </Button>
            ))}
            {external && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={scan} disabled={scanning || Boolean(batch)}>
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderSearch className="w-4 h-4" />}{t('intake_scan')}
              </Button>
            )}
            <input ref={inputRef} type="file" multiple accept={EVIDENCE_ACCEPT} className="hidden" onChange={(e) => onFiles(e.target.files)} />
            <Button size="sm" className="gap-1.5" onClick={() => inputRef.current?.click()} disabled={Boolean(uploading)}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{uploading || t('intake_upload')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('intake_decision_note')}</p>
        {external && <p className="text-xs text-muted-foreground">{t('intake_scan_note')}</p>}
        {!canClassify && <p className="text-xs text-muted-foreground">{t('intake_manual_only')}</p>}
        <div className="flex items-center gap-2">
          <Switch id="intake-show-all" checked={showAll} onCheckedChange={setShowAll} />
          <Label htmlFor="intake-show-all" className="text-sm">{t('intake_show_all')}</Label>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('intake_empty')}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {shown.map((it) => {
              const isOpen = INTAKE_OPEN_STATES.includes(it.status);
              return (
                <li key={it.id} className="px-3 py-2.5 flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate" title={it.file_name}>{it.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {it.uploaded_by || '—'} · {fmtDate(it.created_date)}
                      {isOpen && ` · ${t('intake_candidates_n', { n: (it.candidates || []).filter((c) => !c.startsWith('doc_level:')).length })}`}
                      {it.status === 'proposed' && ` · ${t('intake_links_n', { n: it.classification?.links?.length || 0 })}`}
                    </p>
                    {it.source === 'folder_scan' && <p className="text-xs text-muted-foreground">{t('intake_from_folder')}</p>}
                    {it.status === 'error' && it.error_message && <p className="text-xs text-destructive">{it.error_message}</p>}
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[it.status] || ''}`}>{t(`intake_status_${it.status}`)}</Badge>
                  <div className="flex items-center gap-1">
                    {canClassify && isOpen && (
                      <Button size="sm" variant={it.status === 'proposed' ? 'ghost' : 'outline'} className="gap-1.5 h-8" onClick={() => classify(it)} disabled={busy === it.id || Boolean(batch)}>
                        {busy === it.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {it.status === 'proposed' ? t('intake_reclassify') : t('intake_classify')}
                      </Button>
                    )}
                    <Button size="sm" variant={it.status === 'proposed' ? 'default' : 'ghost'} className="gap-1.5 h-8" onClick={() => setReviewId(it.id)} disabled={busy === it.id}>
                      <ClipboardCheck className="w-4 h-4" />{isOpen ? t('intake_review') : t('intake_view')}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => open(it)} aria-label={`${t('repo_open')} ${it.file_name}`}>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <IntakeMetrics customerId={customerId} />
      </CardContent>
      <IntakeReviewDialog intakeId={reviewId} open={Boolean(reviewId)} onOpenChange={(o) => !o && setReviewId(null)} onDone={refresh} />
    </Card>
  );
}
