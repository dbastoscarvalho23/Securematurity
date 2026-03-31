import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, CheckSquare, Square } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const FRAMEWORKS = [
  { code: 'NIS2', name: 'NIS2' },
  { code: 'ISO27001', name: 'ISO 27001' },
  { code: 'NIST_CSF', name: 'NIST CSF' },
  { code: 'CIS_V8', name: 'CIS v8' },
];

const FRAMEWORK_COLORS = {
  NIS2: 'bg-chart-1/10 text-chart-1 border-chart-1/20',
  ISO27001: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  NIST_CSF: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  CIS_V8: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
};

export default function AIQuestionGeneratorDialog({ open, onOpenChange, existingQuestions, onSave }) {
  const [filterFramework, setFilterFramework] = useState('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setSuggestions([]);
    setSelected({});

    const filtered = filterFramework === 'all'
      ? existingQuestions
      : existingQuestions.filter(q => q.framework_code === filterFramework);

    const summary = filtered.map(q => ({
      framework: q.framework_code,
      domain: q.domain,
      control_id: q.control_id,
      question: q.question_text,
    }));

    const frameworkScope = filterFramework === 'all'
      ? 'NIS2, ISO27001, NIST CSF, and CIS Controls v8'
      : filterFramework;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a cybersecurity compliance expert. Analyze the following existing assessment questions and identify coverage gaps.

Existing questions:
${JSON.stringify(summary, null, 2)}

Based on the above, suggest new questions that fill gaps in coverage for ${frameworkScope}. 
Focus on important areas not already covered or underrepresented domains.
Generate 6-10 new, high-quality assessment questions with maturity-scale answer type.
Each question should assess a specific control or practice not already covered.`,
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
                question_text_pt: { type: 'string' },
                guidance: { type: 'string' },
                weight: { type: 'number' },
                answer_type: { type: 'string' },
                order_index: { type: 'number' },
              }
            }
          },
          analysis: { type: 'string' }
        }
      }
    });

    const qs = result?.questions || [];
    setSuggestions(qs);
    // Select all by default
    const sel = {};
    qs.forEach((_, i) => { sel[i] = true; });
    setSelected(sel);
    setIsGenerating(false);
  };

  const toggleAll = () => {
    const allSelected = suggestions.every((_, i) => selected[i]);
    const sel = {};
    suggestions.forEach((_, i) => { sel[i] = !allSelected; });
    setSelected(sel);
  };

  const handleSave = async () => {
    const toSave = suggestions.filter((_, i) => selected[i]);
    if (toSave.length === 0) return;
    setIsSaving(true);
    await onSave(toSave);
    setIsSaving(false);
    setSuggestions([]);
    setSelected({});
    onOpenChange(false);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Question Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Controls */}
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <Label>Scope (Framework)</Label>
              <Select value={filterFramework} onValueChange={setFilterFramework}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frameworks</SelectItem>
                  {FRAMEWORKS.map(fw => (
                    <SelectItem key={fw.code} value={fw.code}>{fw.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
              {isGenerating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
                : <><Sparkles className="w-4 h-4" /> Analyze & Generate</>
              }
            </Button>
          </div>

          {/* Analysis state */}
          {isGenerating && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-primary" />
              Analyzing {existingQuestions.length} existing questions and identifying gaps...
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{suggestions.length} suggested questions</p>
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {suggestions.every((_, i) => selected[i])
                    ? <CheckSquare className="w-4 h-4" />
                    : <Square className="w-4 h-4" />
                  }
                  {suggestions.every((_, i) => selected[i]) ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {suggestions.map((q, i) => (
                <div
                  key={i}
                  onClick={() => setSelected(s => ({ ...s, [i]: !s[i] }))}
                  className={cn(
                    "p-4 rounded-lg border cursor-pointer transition-all",
                    selected[i]
                      ? "border-primary/40 bg-primary/5"
                      : "border-border opacity-60 hover:opacity-80"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={!!selected[i]}
                      onCheckedChange={(v) => setSelected(s => ({ ...s, [i]: v }))}
                      onClick={e => e.stopPropagation()}
                      className="mt-0.5 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge variant="outline" className={cn("text-xs", FRAMEWORK_COLORS[q.framework_code])}>
                          {q.framework_code}
                        </Badge>
                        {q.domain && <span className="text-xs text-muted-foreground">{q.domain}</span>}
                        {q.control_id && (
                          <span className="text-xs font-mono text-muted-foreground">{q.control_id}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium leading-snug">{q.question_text}</p>
                      {q.guidance && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{q.guidance}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isGenerating && suggestions.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Select a scope and click <strong>Analyze & Generate</strong> to get AI-suggested questions based on gaps in your current question bank.
            </div>
          )}
        </div>

        {/* Footer */}
        {suggestions.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-sm text-muted-foreground">{selectedCount} of {suggestions.length} selected</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving || selectedCount === 0} className="gap-2">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save {selectedCount > 0 ? selectedCount : ''} Question{selectedCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}