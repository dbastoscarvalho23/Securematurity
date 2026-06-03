import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const ANSWER_TYPES = ['yes_no', 'scale_1_5', 'text', 'multiple_choice'];

function QuestionRow({ question, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg bg-card">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground" />}
        <span className="flex-1 text-sm font-medium">{question.question_text}</span>
        <Badge variant="outline" className="text-xs">{question.area}</Badge>
        <Badge variant="secondary" className="text-xs">{question.answer_type?.replace('_', ' ')}</Badge>
        {question.answer && <Badge className="text-xs bg-chart-2/10 text-chart-2 border-chart-2/20">Answered</Badge>}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Question Text</label>
              <Textarea
                value={question.question_text}
                onChange={e => onUpdate(question.id, { question_text: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Answer Type</label>
              <Select value={question.answer_type} onValueChange={v => onUpdate(question.id, { answer_type: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANSWER_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g,' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Supplier Answer</label>
              {question.answer_type === 'yes_no' ? (
                <Select value={question.answer || ''} onValueChange={v => onUpdate(question.id, { answer: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="na">N/A</SelectItem>
                  </SelectContent>
                </Select>
              ) : question.answer_type === 'scale_1_5' ? (
                <Select value={question.answer || ''} onValueChange={v => onUpdate(question.id, { answer: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Score..." /></SelectTrigger>
                  <SelectContent>
                    {['1','2','3','4','5'].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-8 text-xs"
                  value={question.answer || ''}
                  onChange={e => onUpdate(question.id, { answer: e.target.value })}
                  placeholder="Answer..."
                />
              )}
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Notes / Evidence</label>
              <Textarea
                value={question.answer_notes || ''}
                onChange={e => onUpdate(question.id, { answer_notes: e.target.value })}
                rows={2}
                placeholder="Evidence or additional context..."
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => onDelete(question.id)} className="text-destructive h-7 text-xs">
              <Trash2 className="w-3 h-3 mr-1" />Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuestionnaireDetail({ questionnaire, onBack }) {
  const queryClient = useQueryClient();
  const [newQuestion, setNewQuestion] = useState('');
  const [newArea, setNewArea] = useState(questionnaire.areas?.[0] || '');
  const [generating, setGenerating] = useState(false);

  const { data: questions = [] } = useQuery({
    queryKey: ['supplier-questions', questionnaire.id],
    queryFn: () => base44.entities.SupplierQuestion.filter({ questionnaire_id: questionnaire.id }),
  });

  const questionsByArea = (questionnaire.areas || []).reduce((acc, area) => {
    acc[area] = questions.filter(q => q.area === area);
    return acc;
  }, {});
  const unassigned = questions.filter(q => !(questionnaire.areas || []).includes(q.area));
  if (unassigned.length) questionsByArea['Other'] = unassigned;

  const handleUpdate = async (id, data) => {
    await base44.entities.SupplierQuestion.update(id, data);
    queryClient.invalidateQueries(['supplier-questions', questionnaire.id]);
  };

  const handleDelete = async (id) => {
    await base44.entities.SupplierQuestion.delete(id);
    queryClient.invalidateQueries(['supplier-questions', questionnaire.id]);
    toast.success('Question deleted');
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.trim()) return;
    await base44.entities.SupplierQuestion.create({
      questionnaire_id: questionnaire.id,
      question_text: newQuestion.trim(),
      area: newArea || 'General',
      order_index: questions.length + 1,
    });
    setNewQuestion('');
    queryClient.invalidateQueries(['supplier-questions', questionnaire.id]);
    toast.success('Question added');
  };

  const handleAIGenerate = async () => {
    if (!questionnaire.areas?.length) {
      toast.error('Please define coverage areas first');
      return;
    }
    setGenerating(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive cybersecurity supply chain questionnaire for assessing a supplier.
The questionnaire should cover the following areas: ${questionnaire.areas.join(', ')}.
For each area, generate 3-5 practical, auditable questions.
Return a JSON object with this schema: { "questions": [{ "area": string, "question_text": string, "answer_type": "yes_no" | "scale_1_5" | "text" }] }`,
        response_json_schema: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  area: { type: 'string' },
                  question_text: { type: 'string' },
                  answer_type: { type: 'string' },
                },
              },
            },
          },
        },
      });
      const generated = (result?.questions || result?.data?.questions || []);
      if (!generated.length) {
        toast.error('No questions returned by AI');
        return;
      }
      await Promise.all(
        generated.map((q, i) =>
          base44.entities.SupplierQuestion.create({
            questionnaire_id: questionnaire.id,
            question_text: q.question_text,
            area: q.area,
            answer_type: q.answer_type || 'yes_no',
            order_index: questions.length + i + 1,
          })
        )
      );
      queryClient.invalidateQueries(['supplier-questions', questionnaire.id]);
      toast.success(`Generated ${generated.length} questions`);
    } catch (e) {
      toast.error('AI generation failed');
    }
    setGenerating(false);
  };

  const answeredCount = questions.filter(q => q.answer).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="w-4 h-4" />Back
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{questionnaire.title}</h2>
          <p className="text-sm text-muted-foreground">{questionnaire.supplier_name || 'No supplier set'} · {questionnaire.customer_name}</p>
        </div>
        <Badge className={
          questionnaire.status === 'completed' ? 'bg-chart-2/10 text-chart-2 border-chart-2/20' :
          questionnaire.status === 'in_progress' ? 'bg-chart-3/10 text-chart-3 border-chart-3/20' :
          'bg-muted text-muted-foreground'
        }>
          {questionnaire.status?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{questions.length}</p>
            <p className="text-xs text-muted-foreground">Total Questions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{answeredCount}</p>
            <p className="text-xs text-muted-foreground">Answered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{questions.length ? Math.round((answeredCount / questions.length) * 100) : 0}%</p>
            <p className="text-xs text-muted-foreground">Completion</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Generate + Add Question */}
      <div className="flex gap-2 items-end">
        <Button variant="outline" onClick={handleAIGenerate} disabled={generating} className="gap-2">
          <Sparkles className="w-4 h-4" />
          {generating ? 'Generating...' : 'AI Generate Questions'}
        </Button>
        <div className="flex gap-2 flex-1">
          {questionnaire.areas?.length > 0 && (
            <Select value={newArea} onValueChange={setNewArea}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Area..." /></SelectTrigger>
              <SelectContent>
                {questionnaire.areas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Input
            className="flex-1"
            value={newQuestion}
            onChange={e => setNewQuestion(e.target.value)}
            placeholder="Type a question and press Enter..."
            onKeyDown={e => e.key === 'Enter' && handleAddQuestion()}
          />
          <Button onClick={handleAddQuestion} disabled={!newQuestion.trim()} className="gap-1">
            <Plus className="w-4 h-4" />Add
          </Button>
        </div>
      </div>

      {/* Questions by area */}
      {Object.keys(questionsByArea).length === 0 && questions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No questions yet. Use AI Generate or add questions manually above.
          </CardContent>
        </Card>
      ) : (
        Object.entries(questionsByArea).map(([area, areaQuestions]) => (
          <div key={area}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{area}</h3>
            <div className="space-y-2">
              {areaQuestions.map(q => (
                <QuestionRow key={q.id} question={q} onUpdate={handleUpdate} onDelete={handleDelete} />
              ))}
              {areaQuestions.length === 0 && (
                <p className="text-xs text-muted-foreground pl-2">No questions in this area yet.</p>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}