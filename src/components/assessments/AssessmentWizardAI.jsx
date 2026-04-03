import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function AssessmentWizardAI({ meta, selectedCustomer, onBack, onFinish, isSaving }) {
  const [numQuestions, setNumQuestions] = useState(20);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState([]);
  const [selected, setSelected] = useState({});

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerated([]);
    setSelected({});

    const sectorLabel = SECTOR_LABELS[selectedCustomer?.sector] || selectedCustomer?.sector || 'general';
    const fwList = meta.frameworks.join(', ');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a cybersecurity compliance expert. Generate a tailored assessment questionnaire.

Customer: ${selectedCustomer?.name || 'Unknown'}
Sector: ${sectorLabel}
Frameworks: ${fwList}
Number of questions requested: ${numQuestions}

Generate exactly ${numQuestions} high-quality, sector-relevant assessment questions covering all the specified frameworks proportionally.
Each question should be practical and directly assessable with a maturity scale (0-5).
Vary domains across each framework. For each question, provide:
- framework_code (one of: ${fwList})
- domain
- control_id
- question_text (English)
- guidance (brief assessor guidance)
- weight (1-3)`,
      response_json_schema: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                framework_code: { type: 'string' },
                domain: { type: 'string' },
                control_id: { type: 'string' },
                question_text: { type: 'string' },
                guidance: { type: 'string' },
                weight: { type: 'number' },
              }
            }
          }
        }
      }
    });

    const qs = (result?.questions || []).map((q, i) => ({
      ...q,
      answer_type: 'maturity_scale',
      order_index: i + 1,
      _isNew: true,
      _tempId: `temp_${i}`,
    }));

    setGenerated(qs);
    const sel = {};
    qs.forEach((_, i) => { sel[i] = true; });
    setSelected(sel);
    setIsGenerating(false);
  };

  const toggleAll = () => {
    const allSel = generated.every((_, i) => selected[i]);
    const sel = {};
    generated.forEach((_, i) => { sel[i] = !allSel; });
    setSelected(sel);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const handleFinish = () => {
    const toSave = generated.filter((_, i) => selected[i]);
    onFinish(toSave);
  };

  // Group by framework for display
  const byFramework = generated.reduce((acc, q, i) => {
    const fw = q.framework_code || 'Unknown';
    if (!acc[fw]) acc[fw] = [];
    acc[fw].push({ ...q, _idx: i });
    return acc;
  }, {});

  return (
    <div className="space-y-4 py-2">
      <div className="flex gap-4 items-end">
        <div className="space-y-1.5 flex-1">
          <Label>Number of questions</Label>
          <Input
            type="number"
            min={5}
            max={100}
            value={numQuestions}
            onChange={e => setNumQuestions(Number(e.target.value))}
            className="w-32"
          />
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <p><span className="font-medium">Frameworks:</span> {meta.frameworks.join(', ')}</p>
          <p><span className="font-medium">Sector:</span> {SECTOR_LABELS[selectedCustomer?.sector] || '—'}</p>
        </div>
        <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
          {isGenerating
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            : <><Sparkles className="w-4 h-4" /> Generate</>
          }
        </Button>
      </div>

      {isGenerating && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-primary" />
          Generating {numQuestions} tailored questions for {selectedCustomer?.name}...
        </div>
      )}

      {generated.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{generated.length} questions generated</p>
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {generated.every((_, i) => selected[i]) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {generated.every((_, i) => selected[i]) ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          {Object.entries(byFramework).map(([fw, qs]) => (
            <div key={fw}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{fw}</h3>
              <div className="space-y-2">
                {qs.map((q) => (
                  <div
                    key={q._tempId}
                    onClick={() => setSelected(s => ({ ...s, [q._idx]: !s[q._idx] }))}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all text-sm",
                      selected[q._idx]
                        ? "border-primary/40 bg-primary/5"
                        : "border-border opacity-60 hover:opacity-80"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={!!selected[q._idx]}
                        onCheckedChange={v => setSelected(s => ({ ...s, [q._idx]: v }))}
                        onClick={e => e.stopPropagation()}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs text-muted-foreground font-mono">{q.control_id}</span>
                          <Badge variant="outline" className="text-xs">{q.domain}</Badge>
                        </div>
                        <p className="leading-snug">{q.question_text}</p>
                        {q.guidance && <p className="text-xs text-muted-foreground mt-1 italic">{q.guidance}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isGenerating && generated.length === 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Set the number of questions and click <strong>Generate</strong> to create a tailored questionnaire.
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>Back</Button>
        {generated.length > 0 && (
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