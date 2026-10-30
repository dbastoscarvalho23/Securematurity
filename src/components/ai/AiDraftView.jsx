import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, X, FileDown, Copy, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import { aiApprove, aiDiscard, draftToMarkdown, draftToPdf } from '@/lib/ai';

const VERDICT = {
  covers: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
  partial: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
  does_not_cover: 'bg-destructive/10 text-destructive border-destructive/30',
};

/** Mostra um rascunho de IA com fontes, avisos da validação e ações de aprovação/exportação. */
export default function AiDraftView({ draft, customerId, onChange }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [busy, setBusy] = useState('');
  const labels = Object.fromEntries((draft.sources || []).map((s) => [s.id, s.label]));
  const act = async (kind) => {
    setBusy(kind);
    try {
      const r = kind === 'discard' ? await aiDiscard(customerId, draft.id) : await aiApprove(customerId, draft.id, kind === 'approve_doc');
      toast.success(kind === 'discard' ? t('ai_discarded') : r.draft.security_document_id ? t('ai_approved_doc') : t('ai_approved'));
      qc.invalidateQueries({ queryKey: ['ai-drafts', customerId] });
      onChange?.(r.draft);
    } catch (e) { toast.error(e?.message || t('ev_error')); } finally { setBusy(''); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(draftToMarkdown(draft)); toast.success(t('ai_copied')); } catch { toast.error(t('ev_error')); } };
  const download = () => {
    const blob = new Blob([draftToMarkdown(draft)], { type: 'text/markdown' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${(draft.title || 'rascunho').replace(/[^\w\- ]+/g, '').slice(0, 60)}.md`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-md border border-chart-3/30 bg-chart-3/10 p-2 text-xs text-chart-3">{t('ai_disclaimer')}</div>
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-semibold">{draft.title}</h3>
        <Badge variant="outline" className="text-[10px]">{t(`ai_status_${draft.status}`)}</Badge>
        {draft.verdict && <Badge variant="outline" className={`text-[10px] ${VERDICT[draft.verdict]}`}>{t(`ai_verdict_${draft.verdict}`)}</Badge>}
        <span className="text-[11px] text-muted-foreground">{draft.provider} · {(draft.created_date || '').slice(0, 16).replace('T', ' ')}</span>
      </div>
      {draft.warnings?.length > 0 && (
        <ul className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs space-y-0.5">
          {draft.warnings.map((w) => <li key={w} className="flex gap-1"><AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />{w}</li>)}
        </ul>
      )}
      {(draft.sections || []).map((s) => (
        <section key={s.id} className="space-y-1">
          <h4 className="font-medium">{s.heading}</h4>
          {s.ref && <p className="text-[11px] text-muted-foreground italic">{s.ref}</p>}
          <p className="whitespace-pre-wrap text-sm">{s.body}</p>
          {s.fixed && <p className="text-[11px] text-muted-foreground">{t('ai_fixed_section')}</p>}
          {s.citations?.length > 0 && (
            <div className="flex flex-wrap gap-1">{s.citations.map((c) => <Badge key={c} variant="outline" className="text-[10px] font-normal" title={labels[c]}>{c}</Badge>)}</div>
          )}
        </section>
      ))}
      {draft.gaps?.length > 0 && (
        <section><h4 className="font-medium">{t('ai_gaps')}</h4><ul className="list-disc pl-5 text-xs">{draft.gaps.map((g) => <li key={g}>{g}</li>)}</ul></section>
      )}
      {draft.evidence_suggestions?.length > 0 && (
        <section><h4 className="font-medium">{t('ai_evidence_suggestions')}</h4><ul className="list-disc pl-5 text-xs">{draft.evidence_suggestions.map((g) => <li key={g}>{g}</li>)}</ul></section>
      )}
      <section>
        <h4 className="font-medium">{t('ai_sources')}</h4>
        <ul className="text-xs space-y-0.5">{(draft.sources || []).map((s) => <li key={s.id}><span className="font-mono">[{s.id}]</span> {s.label}</li>)}</ul>
      </section>
      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button size="sm" variant="outline" onClick={copy}><Copy className="w-3.5 h-3.5 mr-1" />{t('ai_copy')}</Button>
        <Button size="sm" variant="outline" onClick={download}><FileDown className="w-3.5 h-3.5 mr-1" />Markdown</Button>
        <Button size="sm" variant="outline" onClick={() => draftToPdf(draft)}><FileText className="w-3.5 h-3.5 mr-1" />PDF</Button>
        {draft.status === 'draft' && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => act('discard')} disabled={!!busy}><X className="w-3.5 h-3.5 mr-1" />{t('ai_discard')}</Button>
            {['policy', 'procedure'].includes(draft.kind) && <Button size="sm" variant="outline" onClick={() => act('approve_doc')} disabled={!!busy}>{t('ai_approve_doc')}</Button>}
            <Button size="sm" onClick={() => act('approve')} disabled={!!busy}><Check className="w-3.5 h-3.5 mr-1" />{t('ai_approve')}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
