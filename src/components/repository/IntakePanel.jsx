import React, { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Inbox, Upload, Sparkles, Loader2, ExternalLink, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useLicense, hasModule } from '@/lib/licensing';
import { useAiEnabled } from '@/lib/ai';
import { openFile, FILE_SCHEME } from '@/lib/cloudStorage';
import { EVIDENCE_ACCEPT } from '@/lib/evidence';
import { listIntakes, uploadIntake, classifyIntake, INTAKE_OPEN_STATES } from '@/lib/intake';
import IntakeReviewDialog from '@/components/repository/IntakeReviewDialog';

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
 */
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

  const { data: intakes = [], isLoading } = useQuery({
    queryKey: ['intakes', customerId],
    queryFn: () => listIntakes(customerId),
    enabled: Boolean(customerId),
  });
  const { data: license } = useLicense(isAdmin ? customerId : undefined);
  const aiOn = useAiEnabled('document_classification');
  const canClassify = aiOn && hasModule(license, user, 'ai_assistant');

  const shown = useMemo(() => intakes.filter((i) => showAll || INTAKE_OPEN_STATES.includes(i.status) || i.status === 'classifying'), [intakes, showAll]);
  const openCount = intakes.filter((i) => INTAKE_OPEN_STATES.includes(i.status)).length;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['intakes', customerId] });
    qc.invalidateQueries({ queryKey: ['repo-stored-files', customerId] });
    qc.invalidateQueries({ queryKey: ['evidence', customerId] });
    qc.invalidateQueries({ queryKey: ['intake'] });
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
          <div className="flex items-center gap-2">
            <input ref={inputRef} type="file" multiple accept={EVIDENCE_ACCEPT} className="hidden" onChange={(e) => onFiles(e.target.files)} />
            <Button size="sm" className="gap-1.5" onClick={() => inputRef.current?.click()} disabled={Boolean(uploading)}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{uploading || t('intake_upload')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('intake_decision_note')}</p>
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
                    {it.status === 'error' && it.error_message && <p className="text-xs text-destructive">{it.error_message}</p>}
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[it.status] || ''}`}>{t(`intake_status_${it.status}`)}</Badge>
                  <div className="flex items-center gap-1">
                    {canClassify && isOpen && (
                      <Button size="sm" variant={it.status === 'proposed' ? 'ghost' : 'outline'} className="gap-1.5 h-8" onClick={() => classify(it)} disabled={busy === it.id}>
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
      </CardContent>
      <IntakeReviewDialog intakeId={reviewId} open={Boolean(reviewId)} onOpenChange={(o) => !o && setReviewId(null)} onDone={refresh} />
    </Card>
  );
}
