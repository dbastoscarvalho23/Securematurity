import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Plus, Search, Trash2, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

const FRAMEWORK_COLORS = {
  NIS2: 'bg-chart-1/10 text-chart-1 border-chart-1/20',
  ISO27001: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  NIST_CSF: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  CIS_V8: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  QNRC: 'bg-chart-5/10 text-chart-5 border-chart-5/20',
  ENISA: 'bg-chart-1/10 text-chart-1 border-chart-1/20',
};

export default function AssessmentWizardManual({ meta, selectedCustomer, onBack, onFinish, isSaving }) {
  const [search, setSearch] = useState('');
  const [filterFw, setFilterFw] = useState('all');
  const [filterDomain, setFilterDomain] = useState('all');
  // Selected question IDs from DB
  const [selectedIds, setSelectedIds] = useState(new Set());
  // New inline questions written by admin
  const [newQuestions, setNewQuestions] = useState([]);
  const [newQForm, setNewQForm] = useState({ framework_code: meta.frameworks[0] || '', domain: '', control_id: '', question_text: '', guidance: '', weight: 1 });
  const [showNewForm, setShowNewForm] = useState(false);

  const { data: allQuestions = [] } = useQuery({
    queryKey: ['questions'],
    queryFn: () => base44.entities.Question.list('order_index', 500),
  });

  // Only global questions (no assessment_id) matching the selected frameworks
  const dbQuestions = useMemo(() => allQuestions.filter(
    q => !q.assessment_id && meta.frameworks.includes(q.framework_code)
  ), [allQuestions, meta.frameworks]);

  const domains = useMemo(() => {
    const src = filterFw !== 'all' ? dbQuestions.filter(q => q.framework_code === filterFw) : dbQuestions;
    return [...new Set(src.map(q => q.domain).filter(Boolean))].sort();
  }, [dbQuestions, filterFw]);

  const filtered = useMemo(() => dbQuestions.filter(q => {
    const matchFw = filterFw === 'all' || q.framework_code === filterFw;
    const matchDomain = filterDomain === 'all' || q.domain === filterDomain;
    const matchSearch = !search || q.question_text?.toLowerCase().includes(search.toLowerCase())
      || q.control_id?.toLowerCase().includes(search.toLowerCase())
      || q.domain?.toLowerCase().includes(search.toLowerCase());
    return matchFw && matchDomain && matchSearch;
  }), [dbQuestions, filterFw, filterDomain, search]);

  const toggleId = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (filtered.every(q => selectedIds.has(q.id))) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(q => next.delete(q.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(q => next.add(q.id));
        return next;
      });
    }
  };

  const handleAddNew = () => {
    if (!newQForm.question_text || !newQForm.framework_code || !newQForm.domain) return;
    const entry = {
      ...newQForm,
      answer_type: 'maturity_scale',
      order_index: newQuestions.length + 1,
      _isNew: true,        // flag: needs to be saved to global Question DB
      _tempId: `new_${Date.now()}`,
    };
    setNewQuestions(prev => [...prev, entry]);
    setNewQForm(prev => ({ ...prev, question_text: '', guidance: '', control_id: '' }));
    setShowNewForm(false);
  };

  const removeNew = (tempId) => setNewQuestions(prev => prev.filter(q => q._tempId !== tempId));

  const handleFinish = () => {
    // Existing DB questions — just pass them as-is (they already exist, AssessmentDetail will load them from DB)
    const existingQs = dbQuestions.filter(q => selectedIds.has(q.id));
    // New questions get created with assessment_id in the mutation
    const allQs = [...existingQs, ...newQuestions];
    onFinish(allQs);
  };

  const totalCount = selectedIds.size + newQuestions.length;

  return (
    <div className="space-y-4 py-2">
      <Tabs defaultValue="pick">
        <TabsList>
          <TabsTrigger value="pick">Pick from Question Bank</TabsTrigger>
          <TabsTrigger value="new">Write New Questions</TabsTrigger>
        </TabsList>

        {/* ---- PICK FROM BANK ---- */}
        <TabsContent value="pick" className="space-y-3 mt-3">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search questions..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Select value={filterFw} onValueChange={v => { setFilterFw(v); setFilterDomain('all'); }}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Framework" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Frameworks</SelectItem>
                {meta.frameworks.map(fw => <SelectItem key={fw} value={fw}>{fw}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDomain} onValueChange={setFilterDomain}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Domain" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Domains</SelectItem>
                {domains.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{filtered.length} questions · {selectedIds.size} selected</span>
            <button
              onClick={toggleAll}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {filtered.every(q => selectedIds.has(q.id)) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              {filtered.every(q => selectedIds.has(q.id)) ? 'Deselect all' : 'Select all shown'}
            </button>
          </div>

          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No questions found for these frameworks. Add questions in the Question Bank.</p>
            )}
            {filtered.map(q => (
              <div
                key={q.id}
                onClick={() => toggleId(q.id)}
                className={cn(
                  "flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all text-sm",
                  selectedIds.has(q.id)
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
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
                    <Badge variant="outline" className={cn("text-xs", FRAMEWORK_COLORS[q.framework_code])}>
                      {q.framework_code}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{q.domain}</span>
                    {q.control_id && <span className="text-xs font-mono text-muted-foreground">{q.control_id}</span>}
                  </div>
                  <p className="leading-snug line-clamp-2">{q.question_text}</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ---- WRITE NEW ---- */}
        <TabsContent value="new" className="space-y-3 mt-3">
          {newQuestions.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {newQuestions.map(q => (
                <div key={q._tempId} className="flex items-start gap-2 p-3 rounded-lg border bg-muted/20 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className={cn("text-xs", FRAMEWORK_COLORS[q.framework_code])}>{q.framework_code}</Badge>
                      <span className="text-xs text-muted-foreground">{q.domain}</span>
                      {q.control_id && <span className="text-xs font-mono text-muted-foreground">{q.control_id}</span>}
                    </div>
                    <p className="leading-snug">{q.question_text}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0" onClick={() => removeNew(q._tempId)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!showNewForm ? (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowNewForm(true)}>
              <Plus className="w-4 h-4" /> Add New Question
            </Button>
          ) : (
            <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Framework *</Label>
                  <Select value={newQForm.framework_code} onValueChange={v => setNewQForm(p => ({ ...p, framework_code: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {meta.frameworks.map(fw => <SelectItem key={fw} value={fw}>{fw}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Domain *</Label>
                  <Input
                    value={newQForm.domain}
                    onChange={e => setNewQForm(p => ({ ...p, domain: e.target.value }))}
                    placeholder="e.g. Access Control"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Control ID</Label>
                  <Input
                    value={newQForm.control_id}
                    onChange={e => setNewQForm(p => ({ ...p, control_id: e.target.value }))}
                    placeholder="e.g. A.5.1"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Weight (1–5)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={newQForm.weight}
                    onChange={e => setNewQForm(p => ({ ...p, weight: Number(e.target.value) }))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Question Text *</Label>
                <Textarea
                  value={newQForm.question_text}
                  onChange={e => setNewQForm(p => ({ ...p, question_text: e.target.value }))}
                  placeholder="Write your question here..."
                  rows={2}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Guidance (optional)</Label>
                <Input
                  value={newQForm.guidance}
                  onChange={e => setNewQForm(p => ({ ...p, guidance: e.target.value }))}
                  placeholder="Brief assessor guidance..."
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowNewForm(false)}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={handleAddNew}
                  disabled={!newQForm.question_text || !newQForm.framework_code || !newQForm.domain}
                >
                  Add Question
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{totalCount} question{totalCount !== 1 ? 's' : ''} selected</span>
          <Button onClick={handleFinish} disabled={isSaving || totalCount === 0} className="gap-2">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}