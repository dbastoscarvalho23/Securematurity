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
  { code: 'NIS2', name: 'NIS2' },
  { code: 'ISO27001', name: 'ISO/IEC 27001:2022' },
  { code: 'NIST_CSF', name: 'NIST CSF' },
  { code: 'CIS_V8', name: 'CIS v8' },
  { code: 'QNRC', name: 'QNRC' },
  { code: 'GDPR', name: 'GDPR' },
  { code: 'ENISA', name: 'ENISA' },
];

const FRAMEWORK_COLORS = {
  NIS2: 'bg-chart-1/10 text-chart-1 border-chart-1/20',
  ISO27001: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  NIST_CSF: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  CIS_V8: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  QNRC: 'bg-chart-5/10 text-chart-5 border-chart-5/20',
  ENISA: 'bg-chart-1/10 text-chart-1 border-chart-1/20',
};

export default function AIQuestionGeneratorDialog({ open, onOpenChange, existingQuestions, onSave }) {
  const [filterFramework, setFilterFramework] = useState('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setSuggestions([]);
    setSelected({});
    setDuplicatesRemoved(0);

    const filtered = filterFramework === 'all'
      ? existingQuestions
      : existingQuestions.filter(q => q.framework_code === filterFramework);

    const summary = filtered.map(q => ({
      framework: q.framework_code,
      domain: q.domain,
      control_id: q.control_id,
      question: q.question_text,
    }));

    const FRAMEWORK_DOMAINS = {
      NIS2: ['Governance', 'Risk Management', 'Incident Response', 'Business Continuity', 'Supply Chain', 'Access Control', 'Cryptography', 'Physical Security', 'Vulnerability Management'],
      ISO27001: ['Organizational Controls', 'People Controls', 'Physical Controls', 'Technological Controls'],
      NIST_CSF: ['Identify (ID)', 'Protect (PR)', 'Detect (DE)', 'Respond (RS)', 'Recover (RC)', 'Govern (GV)'],
      CIS_V8: ['Inventory & Control', 'Data Protection', 'Secure Configuration', 'Account Management', 'Access Control', 'Vulnerability Management', 'Audit Log Management', 'Email & Web Browser', 'Malware Defenses', 'Network Infrastructure', 'Data Recovery', 'Network Monitoring', 'Security Awareness', 'Application Security', 'Incident Response'],
      GDPR: ['Lawfulness & Transparency', 'Data Subject Rights', 'Consent Management', 'Data Minimisation', 'Purpose Limitation', 'Storage Limitation', 'Accuracy', 'Security of Processing', 'Data Breach Notification', 'Data Protection by Design', 'Data Protection Officer', 'International Transfers', 'Records of Processing', 'Data Processor Management'],
      ENISA: ['Governance & Risk Management', 'Incident Handling', 'Business Continuity & Crisis Management', 'Supply Chain Security', 'Network & System Security', 'Cyber Hygiene & Training', 'Cryptography & Encryption', 'Access Control & HR Security', 'Authentication & Secure Communications', 'Monitoring & Detection'],
      QNRC: ['Identificar — Gestão de Ativos (ID.GA)', 'Identificar — Ambiente de Negócio (ID.AO)', 'Identificar — Governação (ID.GV)', 'Identificar — Avaliação de Risco (ID.AR)', 'Identificar — Estratégia de Gestão de Risco (ID.GR)', 'Identificar — Gestão de Risco na Cadeia de Fornecimento (ID.GL)', 'Proteger — Gestão de Identidades e Acessos (PR.GA)', 'Proteger — Consciencialização e Formação (PR.FC)', 'Proteger — Segurança dos Dados (PR.SD)', 'Proteger — Processos e Procedimentos (PR.PI)', 'Proteger — Manutenção (PR.MA)', 'Proteger — Tecnologia de Proteção (PR.TP)', 'Detetar — Anomalias e Eventos (DE.AE)', 'Detetar — Monitorização Contínua (DE.MC)', 'Detetar — Processos de Deteção (DE.PD)', 'Responder — Planeamento de Resposta (RS.PR)', 'Responder — Comunicações (RS.CO)', 'Responder — Análise (RS.AN)', 'Responder — Mitigação (RS.MI)', 'Responder — Melhorias (RS.ME)', 'Recuperar — Planeamento de Recuperação (RC.PR)', 'Recuperar — Melhorias (RC.ME)', 'Recuperar — Comunicações (RC.CO)'],
    };

    const frameworksInScope = filterFramework === 'all'
      ? FRAMEWORKS
      : FRAMEWORKS.filter(fw => fw.code === filterFramework);

    const frameworkContext = frameworksInScope.map(fw => ({
      code: fw.code,
      name: fw.name,
      valid_domains: FRAMEWORK_DOMAINS[fw.code] || [],
    }));

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a cybersecurity compliance expert. Analyze the following existing assessment questions and identify coverage gaps.

Existing questions:
${JSON.stringify(summary, null, 2)}

Target frameworks for gap analysis:
${JSON.stringify(frameworkContext, null, 2)}

Generate 6-10 new, high-quality assessment questions that fill coverage gaps.
CRITICAL RULES:
- Set "framework_code" to EXACTLY one of the codes listed above (e.g. "QNRC", "NIS2", "ISO27001", "NIST_CSF", "CIS_V8", "ENISA").
- Set "domain" to EXACTLY one of the valid_domains listed for that framework_code. Do NOT invent new domain names.
- For ISO27001 questions, strictly follow the ISO/IEC 27001:2022 structure (Annex A: Clause 5 Organizational Controls, Clause 6 People Controls, Clause 7 Physical Controls, Clause 8 Technological Controls). Do NOT use the old 2013 domain structure.
- For QNRC questions, use control_id format like "ID.GA-3", "PR.SD-3", "DE.MC-2", etc. matching the domain prefix.
- For QNRC questions, provide both English (question_text) and European Portuguese (question_text_pt) translations.
- Use maturity_scale answer type.`,
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

    const rawQs = result?.questions || [];

    // Deduplicate against existing questions using normalized text comparison
    const normalize = (str) => str?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
    const existingNormalized = new Set(existingQuestions.map(q => normalize(q.question_text)));

    const qs = rawQs.filter(q => {
      const norm = normalize(q.question_text);
      // Also deduplicate within the generated batch itself
      if (existingNormalized.has(norm)) return false;
      existingNormalized.add(norm); // prevent duplicates within the batch
      return true;
    });

    setSuggestions(qs);
    setDuplicatesRemoved(rawQs.length - qs.length);
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
    await writeAuditLog({
      action: 'question_generated',
      entity_type: 'Question',
      details: `AI generated ${toSave.length} question${toSave.length !== 1 ? 's' : ''} for ${filterFramework === 'all' ? 'all frameworks' : filterFramework}`,
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
              {duplicatesRemoved > 0 && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                  {duplicatesRemoved} duplicate{duplicatesRemoved !== 1 ? 's' : ''} removed — already exist in your question bank.
                </div>
              )}
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