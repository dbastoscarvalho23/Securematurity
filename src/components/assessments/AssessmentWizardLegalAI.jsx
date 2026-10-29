import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, AlertTriangle, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import { questionnaireGenerate, questionnaireSave, QUESTIONNAIRE_FRAMEWORKS } from '@/lib/ai';

/**
 * Questionário elaborado pela IA a partir da Biblioteca Legal. Cada pergunta cita a fonte do repositório de onde
 * nasce (medida do QNRCS, artigo da NIS2, ponto do Reg. 2024/2690, obrigação DORA ou guia ISO); o consultor revê,
 * corrige o texto, escolhe as perguntas e grava. A gravação é feita no servidor, que confirma cada fonte.
 */
export default function AssessmentWizardLegalAI({ meta, selectedCustomer, onBack, onSaved }) {
  const { t } = useLanguage();
  const [count, setCount] = useState(20);
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // { questions, warnings, unsupported, provider, model, sources_count }
  const [items, setItems] = useState([]); // [{ ...q, _on, _text }]

  const supported = meta.frameworks.filter((f) => QUESTIONNAIRE_FRAMEWORKS.includes(f));
  const unsupported = meta.frameworks.filter((f) => !QUESTIONNAIRE_FRAMEWORKS.includes(f));

  const generate = async () => {
    setBusy(true);
    try {
      const r = await questionnaireGenerate(selectedCustomer?.id || meta.customer_id, meta.frameworks, count, instructions.trim() || undefined);
      setResult(r);
      setItems((r?.questions || []).map((q) => ({ ...q, _on: true, _text: q.question_text })));
    } catch (e) {
      toast.error(e?.message || t('qai_error'));
    } finally {
      setBusy(false);
    }
  };

  const groups = useMemo(() => items.reduce((m, q, i) => { (m[q.framework_code] ||= []).push([q, i]); return m; }, {}), [items]);
  const chosen = items.filter((q) => q._on && q._text.trim().length >= 15);
  const set = (i, patch) => setItems((arr) => arr.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  const save = async () => {
    setSaving(true);
    try {
      await questionnaireSave(selectedCustomer?.id || meta.customer_id, {
        title: meta.title, period: meta.period, frameworks: meta.frameworks,
        questions: chosen.map((q) => ({ source_id: q.source_id, question_text: q._text.trim(), guidance: q.guidance })),
      });
      toast.success(t('qai_saved', { n: chosen.length }));
      onSaved?.();
    } catch (e) {
      toast.error(e?.message || t('qai_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 py-2">
      <p className="text-sm text-muted-foreground flex gap-2"><BookOpen className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />{t('qai_intro')}</p>
      {unsupported.length > 0 && (
        <p className="text-xs flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />{t('qai_unsupported', { list: unsupported.join(', ') })}
        </p>
      )}
      <div className="grid sm:grid-cols-[8rem_1fr] gap-3 items-start">
        <div className="space-y-1.5">
          <Label htmlFor="qai-count">{t('assessment_wizard_num_questions')}</Label>
          <Input id="qai-count" type="number" min={5} max={60} value={count} onChange={(e) => setCount(Math.max(5, Math.min(60, Number(e.target.value) || 5)))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qai-instr">{t('qai_instructions')}</Label>
          <Textarea id="qai-instr" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder={t('qai_instructions_hint')} />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" onClick={generate} disabled={busy || saving || supported.length === 0} className="gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {busy ? t('qai_generating') : result ? t('qai_regenerate') : t('qai_generate')}
        </Button>
        <span className="text-xs text-muted-foreground">{t('qai_frameworks', { list: supported.join(', ') || '—' })}</span>
      </div>

      {result && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('qai_result_line', { n: items.length, sources: result.sources_count, provider: result.provider, model: result.model })}</p>
          {result.warnings?.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-5 space-y-0.5">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          )}
          {Object.entries(groups).map(([fw, list]) => (
            <div key={fw} className="space-y-2">
              <p className="text-sm font-semibold">{fw} <span className="text-xs font-normal text-muted-foreground">({list.length})</span></p>
              {list.map(([q, i]) => (
                <div key={`${q.source_id}-${i}`} className={`rounded-md border p-3 space-y-2 ${q._on ? '' : 'opacity-60'}`}>
                  <div className="flex items-start gap-2">
                    <Checkbox checked={q._on} onCheckedChange={(v) => set(i, { _on: Boolean(v) })} aria-label={t('qai_include')} className="mt-1" />
                    <Textarea rows={2} value={q._text} onChange={(e) => set(i, { _text: e.target.value })} className="text-sm" aria-label={t('qai_question')} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pl-6">
                    <Badge variant="outline" className="text-[10px] font-mono">{q.control_id}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${q.official ? 'bg-chart-2/10 text-chart-2 border-chart-2/30' : ''}`}>{q.official ? t('qai_official') : t('qai_guide')}</Badge>
                    <span className="text-[11px] text-muted-foreground">{q.source_ref.replace(/ — pergunta elaborada com IA a partir desta fonte$/, '')}</span>
                  </div>
                  {q.guidance && <p className="text-xs text-muted-foreground pl-6 whitespace-pre-line">{q.guidance}</p>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onBack} disabled={busy || saving}>{t('common_back')}</Button>
        <Button type="button" onClick={save} disabled={!chosen.length || busy || saving} className="gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}{t('qai_save', { n: chosen.length })}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">{t('qai_note')}</p>
    </div>
  );
}
