import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, Sparkles, ChevronDown, ChevronRight, Send, Mail, Languages } from 'lucide-react';
import AIQuestionsReviewDialog from './AIQuestionsReviewDialog';
import AIGenerateOptionsDialog from './AIGenerateOptionsDialog';
import SendQuestionnaireEmailDialog from './SendQuestionnaireEmailDialog';
import EmailAnswerImportDialog from './EmailAnswerImportDialog';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';

const ANSWER_TYPES = ['yes_no', 'scale_1_5', 'text', 'multiple_choice'];

function QuestionRow({ question, onUpdate, onDelete, t, lang }) {
  const [expanded, setExpanded] = useState(false);
  const displayText = (lang === 'pt' && question.question_text_pt) ? question.question_text_pt : question.question_text;

  return (
    <div className="border rounded-lg bg-card">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground" />}
        <span className="flex-1 text-sm font-medium">{displayText}</span>
        <Badge variant="outline" className="text-xs">{question.area}</Badge>
        <Badge variant="secondary" className="text-xs">{question.answer_type?.replace('_', ' ')}</Badge>
        {question.answer && <Badge className="text-xs bg-chart-2/10 text-chart-2 border-chart-2/20">{t('sc_answered_badge')}</Badge>}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('sc_question_en')}</label>
              <Textarea
                value={question.question_text}
                onChange={e => onUpdate(question.id, { question_text: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('sc_question_pt')}</label>
              <Textarea
                value={question.question_text_pt || ''}
                onChange={e => onUpdate(question.id, { question_text_pt: e.target.value })}
                rows={2}
                placeholder={t('sc_question_pt_placeholder')}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('sc_answer_type')}</label>
              <Select value={question.answer_type} onValueChange={v => onUpdate(question.id, { answer_type: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANSWER_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g,' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('sc_supplier_answer')}</label>
              {question.answer_type === 'yes_no' ? (
                <Select value={question.answer || ''} onValueChange={v => onUpdate(question.id, { answer: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('sc_answer_select')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="na">N/A</SelectItem>
                  </SelectContent>
                </Select>
              ) : question.answer_type === 'scale_1_5' ? (
                <Select value={question.answer || ''} onValueChange={v => onUpdate(question.id, { answer: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('sc_answer_score')} /></SelectTrigger>
                  <SelectContent>
                    {['1','2','3','4','5'].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-8 text-xs"
                  value={question.answer || ''}
                  onChange={e => onUpdate(question.id, { answer: e.target.value })}
                  placeholder={t('sc_answer_placeholder')}
                />
              )}
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">{t('sc_notes_evidence')}</label>
              <Textarea
                value={question.answer_notes || ''}
                onChange={e => onUpdate(question.id, { answer_notes: e.target.value })}
                rows={2}
                placeholder={t('sc_notes_placeholder')}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => onDelete(question.id)} className="text-destructive h-7 text-xs">
              <Trash2 className="w-3 h-3 mr-1" />{t('sc_delete')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuestionnaireDetail({ questionnaire: initialQuestionnaire, onBack }) {
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const [newQuestion, setNewQuestion] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showOptionsDialog, setShowOptionsDialog] = useState(false);
  const [reviewQuestions, setReviewQuestions] = useState(null);
  const [showSendEmail, setShowSendEmail] = useState(false);
  const [showEmailImport, setShowEmailImport] = useState(false);
  const [translating, setTranslating] = useState(false);

  // Always fetch fresh questionnaire data
  const { data: questionnaire = initialQuestionnaire } = useQuery({
    queryKey: ['supplier-questionnaire', initialQuestionnaire.id],
    queryFn: () => base44.entities.SupplierQuestionnaire.filter({ id: initialQuestionnaire.id }).then(r => r[0] || initialQuestionnaire),
  });

  const [newArea, setNewArea] = useState(questionnaire.areas?.[0] || '');

  const { data: questions = [] } = useQuery({
    queryKey: ['supplier-questions', initialQuestionnaire.id],
    queryFn: () => base44.entities.SupplierQuestion.filter({ questionnaire_id: initialQuestionnaire.id }),
  });

  const questionsByArea = (questionnaire.areas || []).reduce((acc, area) => {
    acc[area] = questions.filter(q => q.area === area);
    return acc;
  }, {});
  const unassigned = questions.filter(q => !(questionnaire.areas || []).includes(q.area));
  if (unassigned.length) questionsByArea['Other'] = unassigned;

  const qid = initialQuestionnaire.id;

  const handleUpdate = async (id, data) => {
    await base44.entities.SupplierQuestion.update(id, data);
    queryClient.invalidateQueries(['supplier-questions', qid]);
  };

  const handleDelete = async (id) => {
    await base44.entities.SupplierQuestion.delete(id);
    queryClient.invalidateQueries(['supplier-questions', qid]);
    toast.success(t('sc_question_deleted'));
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.trim()) return;
    await base44.entities.SupplierQuestion.create({
      questionnaire_id: qid,
      question_text: newQuestion.trim(),
      area: newArea || 'General',
      order_index: questions.length + 1,
    });
    setNewQuestion('');
    queryClient.invalidateQueries(['supplier-questions', qid]);
    toast.success(t('sc_question_added'));
  };

  const handleAIGenerate = async ({ count, areas }) => {
    setShowOptionsDialog(false);
    setGenerating(true);
    const areaContext = areas.length
      ? `covering these specific subjects: ${areas.join(', ')}`
      : `covering general cybersecurity topics such as Access Control, Data Protection, Incident Response, and Network Security`;
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a cybersecurity supply chain questionnaire for assessing a supplier named "${questionnaire.supplier_name || 'the supplier'}".
The questionnaire should ${areaContext}.
For EACH subject/area, generate EXACTLY ${count} practical, auditable questions.
For EVERY question provide both the English version (question_text) and the European Portuguese translation (question_text_pt).
Return a JSON object with this schema: { "questions": [{ "area": string, "question_text": string, "question_text_pt": string, "answer_type": "yes_no" | "scale_1_5" | "text" }] }`,
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
                  question_text_pt: { type: 'string' },
                  answer_type: { type: 'string' },
                },
              },
            },
          },
        },
      });
      const generated = (result?.questions || result?.data?.questions || []);
      if (!generated.length) {
        toast.error(t('sc_ai_no_questions'));
        setGenerating(false);
        return;
      }
      setReviewQuestions(generated);
    } catch (e) {
      toast.error(t('sc_ai_failed'));
    }
    setGenerating(false);
  };

  const handleReviewConfirm = async (accepted) => {
    await Promise.all(
      accepted.map((q, i) =>
        base44.entities.SupplierQuestion.create({
          questionnaire_id: qid,
          question_text: q.question_text,
          question_text_pt: q.question_text_pt,
          area: q.area,
          answer_type: q.answer_type || 'yes_no',
          order_index: questions.length + i + 1,
        })
      )
    );
    queryClient.invalidateQueries(['supplier-questions', qid]);
    toast.success(`${accepted.length} ${t('sc_questions_added')}`);
    setReviewQuestions(null);
  };

  const handleTranslateToPT = async () => {
    const untranslated = questions.filter(q => !q.question_text_pt);
    if (!untranslated.length) {
      toast.success(t('sc_all_translated'));
      return;
    }
    setTranslating(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate the following cybersecurity questionnaire questions to European Portuguese.
Return a JSON object with a "translations" array, each item having "id" and "question_text_pt".
Questions:
${untranslated.map(q => `{"id":"${q.id}","question_text":"${q.question_text}"}`).join('\n')}`,
        response_json_schema: {
          type: 'object',
          properties: {
            translations: {
              type: 'array',
              items: { type: 'object', properties: { id: { type: 'string' }, question_text_pt: { type: 'string' } } },
            },
          },
        },
      });
      const translations = result?.translations || result?.data?.translations || [];
      await Promise.all(
        translations.map(tr => base44.entities.SupplierQuestion.update(tr.id, { question_text_pt: tr.question_text_pt }))
      );
      queryClient.invalidateQueries(['supplier-questions', qid]);
      toast.success(`${translations.length} ${t('sc_translated_success')}`);
    } catch (e) {
      toast.error(t('sc_ai_failed'));
    }
    setTranslating(false);
  };

  const handleEmailImport = async (answers) => {
    await Promise.all(
      answers.map(a => base44.entities.SupplierQuestion.update(a.question_id, {
        answer: a.answer,
        answer_notes: a.answer_notes || '',
      }))
    );
    queryClient.invalidateQueries(['supplier-questions', qid]);
    toast.success(`${answers.length} ${t('sc_answers_imported')}`);
  };

  const answeredCount = questions.filter(q => q.answer).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="w-4 h-4" />{t('sc_back')}
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{questionnaire.title}</h2>
          <p className="text-sm text-muted-foreground">{questionnaire.supplier_name || t('sc_no_supplier')} · {questionnaire.customer_name}</p>
        </div>
        <Badge className={
          questionnaire.status === 'completed' ? 'bg-chart-2/10 text-chart-2 border-chart-2/20' :
          questionnaire.status === 'in_progress' ? 'bg-chart-3/10 text-chart-3 border-chart-3/20' :
          'bg-muted text-muted-foreground'
        }>
          {questionnaire.status?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
        </Badge>
        {questions.some(q => !q.question_text_pt) && (
          <Button variant="outline" size="sm" onClick={handleTranslateToPT} disabled={translating} className="gap-2">
            <Languages className="w-4 h-4" />{translating ? t('sc_translating') : t('sc_translate_to_pt')}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setShowSendEmail(true)} className="gap-2">
          <Send className="w-4 h-4" />{t('sc_send_to_supplier')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowEmailImport(true)} className="gap-2">
          <Mail className="w-4 h-4" />{t('sc_import_email_reply')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{questions.length}</p>
            <p className="text-xs text-muted-foreground">{t('sc_total_questions')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{answeredCount}</p>
            <p className="text-xs text-muted-foreground">{t('sc_answered')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{questions.length ? Math.round((answeredCount / questions.length) * 100) : 0}%</p>
            <p className="text-xs text-muted-foreground">{t('sc_completion')}</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Generate + Add Question */}
      <div className="flex gap-2 items-end">
        <Button variant="outline" onClick={() => setShowOptionsDialog(true)} disabled={generating} className="gap-2">
          <Sparkles className="w-4 h-4" />
          {generating ? t('sc_generating') : t('sc_ai_generate')}
        </Button>
        <div className="flex gap-2 flex-1">
          {questionnaire.areas?.length > 0 && (
            <Select value={newArea} onValueChange={setNewArea}>
              <SelectTrigger className="w-44"><SelectValue placeholder={t('sc_area_placeholder')} /></SelectTrigger>
              <SelectContent>
                {questionnaire.areas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Input
            className="flex-1"
            value={newQuestion}
            onChange={e => setNewQuestion(e.target.value)}
            placeholder={t('sc_question_placeholder')}
            onKeyDown={e => e.key === 'Enter' && handleAddQuestion()}
          />
          <Button onClick={handleAddQuestion} disabled={!newQuestion.trim()} className="gap-1">
            <Plus className="w-4 h-4" />{t('sc_add')}
          </Button>
        </div>
      </div>

      {/* Questions by area */}
      {Object.keys(questionsByArea).length === 0 && questions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {t('sc_no_questions')}
          </CardContent>
        </Card>
      ) : (
        Object.entries(questionsByArea).map(([area, areaQuestions]) => (
          <div key={area}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{area}</h3>
            <div className="space-y-2">
              {areaQuestions.map(q => (
                <QuestionRow key={q.id} question={q} onUpdate={handleUpdate} onDelete={handleDelete} t={t} lang={language} />
              ))}
              {areaQuestions.length === 0 && (
                <p className="text-xs text-muted-foreground pl-2">{t('sc_no_questions_in_area')}</p>
              )}
            </div>
          </div>
        ))
      )}

      <SendQuestionnaireEmailDialog
        open={showSendEmail}
        onClose={() => setShowSendEmail(false)}
        questionnaire={questionnaire}
        questions={questions}
      />

      <EmailAnswerImportDialog
        open={showEmailImport}
        onClose={() => setShowEmailImport(false)}
        questions={questions}
        onImport={handleEmailImport}
      />

      <AIGenerateOptionsDialog
        open={showOptionsDialog}
        onClose={() => setShowOptionsDialog(false)}
        onGenerate={handleAIGenerate}
        preselectedAreas={questionnaire.areas || []}
      />

      {reviewQuestions && (
        <AIQuestionsReviewDialog
          open={true}
          questions={reviewQuestions}
          onConfirm={handleReviewConfirm}
          onClose={() => setReviewQuestions(null)}
        />
      )}
    </div>
  );
}