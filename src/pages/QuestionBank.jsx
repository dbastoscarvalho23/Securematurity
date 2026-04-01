import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Pencil, Trash2, Sparkles, ShieldCheck, Loader2, Languages } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import QuestionFormDialog from '@/components/questions/QuestionFormDialog';
import AIQuestionGeneratorDialog from '@/components/questions/AIQuestionGeneratorDialog';

const FRAMEWORK_COLORS = {
  NIS2: 'bg-chart-1/10 text-chart-1 border-chart-1/20',
  ISO27001: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  NIST_CSF: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  CIS_V8: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  QNRC: 'bg-chart-5/10 text-chart-5 border-chart-5/20',
  GDPR: 'bg-blue-100/10 text-blue-600 border-blue-600/20',
};

export default function QuestionBank() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterFramework, setFilterFramework] = useState('all');
  const [filterDomain, setFilterDomain] = useState('all');
  const [filterControlId, setFilterControlId] = useState('');
  const [filterWeight, setFilterWeight] = useState('all');
  const [filterLang, setFilterLang] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateProgress, setTranslateProgress] = useState({ done: 0, total: 0 });

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['questions'],
    queryFn: () => base44.entities.Question.list('order_index', 500),
  });

  const { data: allFrameworks = [] } = useQuery({
    queryKey: ['frameworks'],
    queryFn: () => base44.entities.Framework.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Question.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions'] }),
  });

  const domains = useMemo(() => {
    const filtered = filterFramework !== 'all'
      ? questions.filter(q => q.framework_code === filterFramework)
      : questions;
    return [...new Set(filtered.map(q => q.domain).filter(Boolean))].sort();
  }, [questions, filterFramework]);

  const filtered = useMemo(() => {
    return questions.filter(q => {
      const matchFw = filterFramework === 'all' || q.framework_code === filterFramework;
      const matchDomain = filterDomain === 'all' || q.domain === filterDomain;
      const matchControlId = !filterControlId || q.control_id?.toLowerCase().includes(filterControlId.toLowerCase());
      const matchWeight = filterWeight === 'all' || String(q.weight || 1) === filterWeight;
      const matchLang = filterLang === 'all' || (filterLang === 'PT' ? !!q.question_text_pt : !q.question_text_pt);
      const matchSearch = !search || q.question_text?.toLowerCase().includes(search.toLowerCase())
        || q.control_id?.toLowerCase().includes(search.toLowerCase())
        || q.domain?.toLowerCase().includes(search.toLowerCase());
      return matchFw && matchDomain && matchControlId && matchWeight && matchLang && matchSearch;
    });
  }, [questions, filterFramework, filterDomain, filterControlId, filterWeight, filterLang, search]);

  const handleEdit = (q) => {
    setEditingQuestion(q);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingQuestion(null);
    setDialogOpen(true);
  };

  const handleTranslate = async () => {
    const untranslated = questions.filter(q => !q.question_text_pt);
    if (untranslated.length === 0) {
      toast.success('All questions already have a Portuguese translation!');
      return;
    }
    if (!confirm(`Translate ${untranslated.length} question${untranslated.length !== 1 ? 's' : ''} to European Portuguese?`)) return;

    setIsTranslating(true);
    setTranslateProgress({ done: 0, total: untranslated.length });

    // Process in batches of 10 to avoid large prompts
    const BATCH_SIZE = 10;
    for (let i = 0; i < untranslated.length; i += BATCH_SIZE) {
      const batch = untranslated.slice(i, i + BATCH_SIZE);
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a professional translator specialising in European Portuguese (Portugal), not Brazilian Portuguese.
Translate the following cybersecurity assessment questions and their guidance texts to European Portuguese (Portugal).
Use formal register ("você"/"a organização"), European vocabulary and spelling (e.g. "implementação" not "implementação", avoid Brazilian colloquialisms).

Questions to translate (JSON array):
${JSON.stringify(batch.map(q => ({ id: q.id, question_text: q.question_text, guidance: q.guidance || '' })), null, 2)}

Return only valid JSON with the translations.`,
        response_json_schema: {
          type: 'object',
          properties: {
            translations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  question_text_pt: { type: 'string' },
                  guidance_pt: { type: 'string' },
                }
              }
            }
          }
        }
      });

      if (result?.translations) {
        await Promise.all(result.translations.map(t =>
          base44.entities.Question.update(t.id, {
            question_text_pt: t.question_text_pt,
            ...(t.guidance_pt ? { guidance_pt: t.guidance_pt } : {}),
          })
        ));
      }

      setTranslateProgress({ done: Math.min(i + BATCH_SIZE, untranslated.length), total: untranslated.length });
    }

    queryClient.invalidateQueries({ queryKey: ['questions'] });
    setIsTranslating(false);
    toast.success(`Translated ${untranslated.length} question${untranslated.length !== 1 ? 's' : ''} to European Portuguese.`);
  };

  const handleRemoveDuplicates = async () => {
    const normalize = (str) => str?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
    const seen = new Set();
    const toDelete = [];

    for (const q of questions) {
      const key = normalize(q.question_text);
      if (seen.has(key)) {
        toDelete.push(q.id);
      } else {
        seen.add(key);
      }
    }

    if (toDelete.length === 0) {
      toast.success('No duplicates found — your question bank is clean!');
      return;
    }

    if (!confirm(`Found ${toDelete.length} duplicate question${toDelete.length !== 1 ? 's' : ''}. Delete them now?`)) return;

    setIsDeduplicating(true);
    await Promise.all(toDelete.map(id => base44.entities.Question.delete(id)));
    queryClient.invalidateQueries({ queryKey: ['questions'] });
    setIsDeduplicating(false);
    toast.success(`Removed ${toDelete.length} duplicate question${toDelete.length !== 1 ? 's' : ''}.`);
  };

  const handleDelete = (q) => {
    if (confirm(`Delete question "${q.question_text.substring(0, 60)}..."?`)) {
      deleteMutation.mutate(q.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Manage assessment questions across all frameworks
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTranslate} disabled={isTranslating} className="gap-2">
            {isTranslating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Translating {translateProgress.done}/{translateProgress.total}</>
              : <><Languages className="w-4 h-4" /> Translate to PT</>
            }
          </Button>
          <Button variant="outline" onClick={handleRemoveDuplicates} disabled={isDeduplicating} className="gap-2">
            {isDeduplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Remove Duplicates
          </Button>
          <Button variant="outline" onClick={() => setAiDialogOpen(true)} className="gap-2">
            <Sparkles className="w-4 h-4" /> AI Generate
          </Button>
          <Button onClick={handleNew} className="gap-2">
            <Plus className="w-4 h-4" /> New Question
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search questions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-muted-foreground flex-wrap">
        <span>Showing <strong className="text-foreground">{filtered.length}</strong> of {questions.length} questions</span>
        {allFrameworks.map(fw => {
          const count = questions.filter(q => q.framework_code === fw.code).length;
          return count > 0 ? (
            <span key={fw.code}>
              <Badge variant="outline" className={`text-xs ${FRAMEWORK_COLORS[fw.code] || 'bg-muted/10 text-muted-foreground border-muted'}`}>{fw.name}</Badge>
              {' '}{count}
            </span>
          ) : null;
        })}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
              <p>No questions found.</p>
              <Button variant="outline" size="sm" onClick={handleNew}>Create your first question</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead className="w-36">
                    <div className="space-y-1">
                      <span>Framework</span>
                      <Select value={filterFramework} onValueChange={v => { setFilterFramework(v); setFilterDomain('all'); }}>
                        <SelectTrigger className="h-7 text-xs w-full">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {allFrameworks.map(fw => <SelectItem key={fw.code} value={fw.code}>{fw.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableHead>
                  <TableHead className="w-44">
                    <div className="space-y-1">
                      <span>Domain</span>
                      <Select value={filterDomain} onValueChange={setFilterDomain}>
                        <SelectTrigger className="h-7 text-xs w-full">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {domains.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableHead>
                  <TableHead className="w-32">
                    <div className="space-y-1">
                      <span>Control ID</span>
                      <Input
                        value={filterControlId}
                        onChange={e => setFilterControlId(e.target.value)}
                        placeholder="Filter..."
                        className="h-7 text-xs"
                      />
                    </div>
                  </TableHead>
                  <TableHead className="w-20">
                    <div className="space-y-1">
                      <span>Weight</span>
                      <Select value={filterWeight} onValueChange={setFilterWeight}>
                        <SelectTrigger className="h-7 text-xs w-full">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {[1, 2, 3, 4, 5].map(w => <SelectItem key={w} value={String(w)}>{w}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableHead>
                  <TableHead className="w-20">
                    <div className="space-y-1">
                      <span>Language</span>
                      <Select value={filterLang} onValueChange={setFilterLang}>
                        <SelectTrigger className="h-7 text-xs w-full">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="PT">PT ✓</SelectItem>
                          <SelectItem value="EN">EN only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q, i) => (
                  <TableRow key={q.id} className="group">
                    <TableCell className="text-muted-foreground text-xs font-mono">{i + 1}</TableCell>
                    <TableCell>
                      <p className="text-sm line-clamp-2">{q.question_text}</p>
                      {q.question_text_pt && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 italic">{q.question_text_pt}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${FRAMEWORK_COLORS[q.framework_code] || ''}`}>
                        {q.framework_code}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{q.domain}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{q.control_id || '—'}</TableCell>
                    <TableCell className="text-sm text-center">{q.weight || 1}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <span className="text-xs font-medium text-muted-foreground">EN</span>
                        {q.question_text_pt && <span className="text-xs font-medium text-accent">PT</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(q)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(q)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <QuestionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        question={editingQuestion}
      />

      <AIQuestionGeneratorDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        existingQuestions={questions}
        onSave={async (newQuestions) => {
          await base44.entities.Question.bulkCreate(newQuestions);
          queryClient.invalidateQueries({ queryKey: ['questions'] });
        }}
      />
    </div>
  );
}