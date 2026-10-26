import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import { aiSources, aiGenerate } from '@/lib/ai';
import AiDraftView from './AiDraftView';

/**
 * Gera um rascunho com IA para uma medida, um incidente ou o relatório anual.
 * target: { type: 'measure', key } | { type: 'incident', id } | { type: 'annual_report', year }
 */
export default function AiDraftDialog({ open, onOpenChange, customerId, target, kinds, title, initialDraft = null }) {
  const { t } = useLanguage();
  const [kind, setKind] = useState(kinds?.[0]);
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState(null);
  useEffect(() => { if (open) { setKind(kinds?.[0]); setInstructions(''); setGenerated(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const draft = generated ?? initialDraft;
  const setDraft = setGenerated;

  const { data: preview, isLoading, error: previewError } = useQuery({
    queryKey: ['ai-sources', customerId, JSON.stringify(target), kind],
    queryFn: () => aiSources(customerId, target, kind),
    enabled: open && Boolean(customerId && target && kind) && !draft,
  });

  const generate = async () => {
    setBusy(true);
    try { const r = await aiGenerate(customerId, target, kind, instructions); setDraft(r.draft); }
    catch (e) { toast.error(e?.message || t('ev_error')); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />{title || t('ai_title')}</DialogTitle></DialogHeader>
        {draft ? <AiDraftView draft={draft} customerId={customerId} onChange={setDraft} /> : (
          <div className="space-y-3 text-sm">
            {kinds?.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs">{t('ai_kind')}</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{kinds.map((k) => <SelectItem key={k} value={k}>{t(`ai_kind_${k}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="rounded-md border p-2 space-y-1">
              <p className="text-xs font-medium">{t('ai_sources_preview')}</p>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <ul className="text-xs space-y-0.5">
                  {(preview?.sources || []).map((s) => <li key={s.id} className={s.related ? 'text-muted-foreground' : ''}><span className="font-mono">[{s.id}]</span> {s.label}</li>)}
                </ul>
              )}
              {previewError && <p className="text-xs text-destructive">{previewError.message}</p>}
              {preview?.sections?.length > 0 && <p className="text-[11px] text-muted-foreground">{t('ai_structure')}: {preview.sections.map((s) => s.heading).join(' · ')}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('ai_instructions')}</Label>
              <Textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder={t('ai_instructions_ph')} />
            </div>
            <p className="text-[11px] text-muted-foreground">{t('ai_privacy')}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common_cancel')}</Button>
              <Button onClick={generate} disabled={busy || !kind}>{busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}{busy ? t('ai_generating') : t('ai_generate')}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
