import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';

const SECTOR_LABELS = {
  financial_services: 'Financial Services',
  healthcare: 'Healthcare',
  energy: 'Energy',
  telecommunications: 'Telecommunications',
  public_administration: 'Public Administration',
  technology: 'Technology',
  manufacturing: 'Manufacturing',
  retail: 'Retail',
  transportation: 'Transportation',
  education: 'Education',
  defense: 'Defense',
  other: 'Other',
};

const FRAMEWORK_COLORS = {
  NIS2: 'bg-chart-1/10 text-chart-1 border-chart-1/20',
  'ISO27001:2022': 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  ISO27001: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  NIST_CSF: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  CIS_V8: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  QNRC: 'bg-chart-5/10 text-chart-5 border-chart-5/20',
  ENISA: 'bg-chart-1/10 text-chart-1 border-chart-1/20',
};

export default function AssessmentWizardAI({ meta, selectedCustomer, onBack, onFinish, isSaving }) {
  const { language } = useLanguage();
  const [numQuestions, setNumQuestions] = useState(20);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggested, setSuggested] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const { data: allQuestions = [], isLoading: loadingQuestions } = useQuery({
    queryKey: ['questions-global'],
    queryFn: () => base44.entities.Question.filter({ is_active: true }, 'order_index', 1000),
  });

  const dbQuestions = useMemo(() =>
    allQuestions.filter(q => !q.assessment_id && meta.frameworks.includes(q.framework_code)),
    [allQuestions, meta.frameworks]
  );

  const handleGenerate = async () => {
    if (dbQuestions.length === 0) return;

    setIsGenerating(true);
    setSuggested([]);
    setSelectedIds(new Set());

    const sectorLabel = SECTOR_LABELS[selectedCustomer?.sector] || selectedCustomer?.sector || 'general';
    const fwList = meta.frameworks.join(', ');

    const questionList = dbQuestions.map(q => ({
      id: q.id,
      framework_code: q.framework_code,
      domain: q.domain,
      control_id: q.control_id,
      question_text: q.question_text,
    }));

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a cybersecurity compliance expert. Select the most relevant questions for this assessment.

Customer: ${selectedCustomer?.name || 'Unknown'}
Sector: ${sectorLabel}
Frameworks: ${fwList}
Requested number of questions: ${numQuestions}

From the list below, select the ${numQuestions} most relevant and impactful questions for this customer's sector and the specified frameworks.
Aim for good coverage across domains. Return ONLY the question IDs you select (up to ${numQuestions}).

Available questions:
${JSON.stringify(questionList)}`,
      response_json_schema: {
        type: 'object',
        properties: {
          selected_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of question IDs selected as most relevant'
          }
        }
      }
    });

    const pickedIds = new Set(result?.selected_ids || []);
    const validIds = dbQuestions.filter(q => pickedIds.has(q.id)).map(q => q.id);
    setSuggested(validIds);
    setSelectedIds(new Set(validIds));
    setIsGenerating(false);
  };

  const toggleId = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (suggested.every(id => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(suggested));
    }
  };

  const suggestedQuestions = dbQuestions.filter(q => suggested.includes(q.id));

  const byFramework = suggestedQuestions.reduce((acc, q) => {
    const fw = q.framework_code || 'Unknown';
    if (!acc[fw]) acc[fw] = [];
    acc[fw].push(q);
    return acc;
  }, {});

  const selectedCount = selectedIds.size;

  const handleFinish = () => {
    const selected = dbQuestions.filter(q => selectedIds.has(q.id));
    onFinish(selected);
  };

  return (
    <div className="space-y-4 py-2">
      <div className="flex gap-4 items-end flex-wrap">
        <div className="space-y-1.5">
          <Label>Number of questions</Label>
          <Input
            type="number"
            min={5}
            max={Math.max(5, dbQuestions.length)}
            value={numQuestions}
            onChange={e => setNumQuestions(Number(e.target.value))}
            className="w-32"
          />
        </div>
        <div className="text-sm text-muted-foreground space-y-1 flex-1">
          <p><span className="font-medium">Frameworks:</span> {meta.frameworks.join(', ')}</p>
          <p><span className="font-medium">Sector:</span> {SECTOR_LABELS[selectedCustomer?.sector] || '—'}</p>
          {!loadingQuestions && (
            <p><span className="font-medium">Available in DB:</span> {dbQuestions.length} questions</p>
          )}
        </div>
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || loadingQuestions || dbQuestions.length === 0}
          className="gap-2"
        >
          {isGenerating
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Selecting...</>
            : <><Sparkles className="w-4 h-4" /> AI Select</>
          }
        </Button>
      </div>

      {dbQuestions.length === 0 && !loadingQuestions && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          No questions found in the Question Bank for the selected frameworks ({meta.frameworks.join(', ')}). Please add questions first.
        </div>
      )}

      {isGenerating && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-primary" />
          AI is selecting the most relevant questions from your Question Bank...
        </div>
      )}

      {suggested.length > 0 && !isGenerating && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{suggested.length} questions suggested by AI</p>
            <button
              type="button"
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {suggested.every(id => selectedIds.has(id)) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {suggested.every(id => selectedIds.has(id)) ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          {Object.entries(byFramework).map(([fw, qs]) => (
            <div key={fw}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{fw}</h3>
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {qs.map(q => (
                  <div
                    key={q.id}
                    onClick={() => toggleId(q.id)}
                    className={cn(
                      "flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all text-sm",
                      selectedIds.has(q.id)
                        ? "border-primary/40 bg-primary/5"
                        : "border-border opacity-60 hover:opacity-80"
                    )}
                  >
                    <Checkbox
                      checked={selectedIds.has(q.id)}
                      onCheckedChange={() => toggleId(q.id)}
                      onClick={e => e.stopPropagation()}
                      className="mt-0.5 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className={cn("text-xs", FRAMEWORK_COLORS[fw])}>
                          {q.domain}
                        </Badge>
                        {q.control_id && <span className="text-xs font-mono text-muted-foreground">{q.control_id}</span>}
                      </div>
                      <p className="leading-snug">{language === 'pt' && q.question_text_pt ? q.question_text_pt : q.question_text}</p>
                      {q.guidance && <p className="text-xs text-muted-foreground mt-1 italic">{language === 'pt' && q.guidance_pt ? q.guidance_pt : q.guidance}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isGenerating && suggested.length === 0 && dbQuestions.length > 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Click <strong>AI Select</strong> to have the AI pick the most relevant questions from your Question Bank.
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        {suggested.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{selectedCount} questions selected</span>
            <Button onClick={handleFinish} disabled={isSaving || selectedCount === 0} className="gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Assessment
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}