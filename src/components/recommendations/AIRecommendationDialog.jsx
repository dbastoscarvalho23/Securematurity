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
import { writeAuditLog } from '@/lib/auditLog';

const FRAMEWORKS = [
  { code: 'NIS2', name: 'NIS2 / DL 125/2025' },
  { code: 'ISO27001', name: 'ISO/IEC 27001' },
  { code: 'NIST_CSF', name: 'NIST CSF' },
  { code: 'CIS_V8', name: 'CIS Controls v8' },
  { code: 'ENISA', name: 'ENISA Cybersecurity Framework' },
  { code: 'QNRC', name: 'QNRC' },
  { code: 'GDPR', name: 'GDPR' },
];

const PRIORITY_COLORS = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  medium: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  low: 'bg-muted text-muted-foreground',
};

export default function AIRecommendationDialog({ open, onOpenChange, customers, onSave }) {
  const [framework, setFramework] = useState('NIS2');
  const [customerId, setCustomerId] = useState('none');
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setSuggestions([]);
    setSelected({});

    const fw = FRAMEWORKS.find(f => f.code === framework);
    const customer = customers?.find(c => c.id === customerId);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a cybersecurity compliance expert. Generate actionable improvement recommendations for the ${fw?.name || framework} framework.
${customer ? `Organization context: ${customer.name}, sector: ${customer.sector?.replace(/_/g, ' ')}, size: ${customer.num_employees} employees.` : ''}

Generate 6-8 high-quality, specific, and actionable recommendations covering different domains of the ${framework} framework.
Each recommendation should be practical and address common compliance gaps.
Vary the priorities (include critical, high, medium, and low).
Include clear titles, detailed descriptions, effort estimates, and suggested timelines.`,
      response_json_schema: {
        type: 'object',
        properties: {
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                framework_code: { type: 'string' },
                domain: { type: 'string' },
                control_id: { type: 'string' },
                priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                title: { type: 'string' },
                description: { type: 'string' },
                effort: { type: 'string', enum: ['low', 'medium', 'high'] },
                timeline: { type: 'string', enum: ['immediate', 'short_term', 'medium_term', 'long_term'] },
              }
            }
          }
        }
      }
    });

    const recs = (result?.recommendations || []).map(r => ({
      ...r,
      framework_code: framework,
      customer_id: customerId !== 'none' ? customerId : undefined,
      customer_name: customer?.name,
      status: 'pending',
    }));

    setSuggestions(recs);
    const sel = {};
    recs.forEach((_, i) => { sel[i] = true; });
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
    const fw = FRAMEWORKS.find(f => f.code === framework);
    await writeAuditLog({
      action: 'recommendation_generated',
      entity_type: 'Recommendation',
      details: `AI generated ${toSave.length} recommendation${toSave.length !== 1 ? 's' : ''} for ${fw?.name || framework}`,
    });
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
            AI Recommendation Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Controls */}
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <Label>Framework</Label>
              <Select value={framework} onValueChange={setFramework}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FRAMEWORKS.map(fw => (
                    <SelectItem key={fw.code} value={fw.code}>{fw.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {customers?.length > 0 && (
              <div className="flex-1 space-y-1.5">
                <Label>Customer (optional)</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="No customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No customer</SelectItem>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
              Generating recommendations for <strong>{FRAMEWORKS.find(f => f.code === framework)?.name}</strong>...
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{suggestions.length} recommendations generated</p>
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

              {suggestions.map((rec, i) => (
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
                        <Badge variant="outline" className={cn("text-xs border", PRIORITY_COLORS[rec.priority])}>
                          {rec.priority}
                        </Badge>
                        {rec.domain && <span className="text-xs text-muted-foreground">{rec.domain}</span>}
                        {rec.effort && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {rec.effort} effort
                          </span>
                        )}
                        {rec.timeline && (
                          <span className="text-xs text-muted-foreground">
                            {rec.timeline.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium leading-snug">{rec.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isGenerating && suggestions.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Select a framework and click <strong>Generate</strong> to get AI-suggested recommendations.
            </div>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-sm text-muted-foreground">{selectedCount} of {suggestions.length} selected</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving || selectedCount === 0} className="gap-2">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save {selectedCount > 0 ? selectedCount : ''} Recommendation{selectedCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}