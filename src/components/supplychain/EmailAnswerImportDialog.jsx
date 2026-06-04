import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Mail, Sparkles, Check, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function EmailAnswerImportDialog({ open, onClose, questions, onImport }) {
  const { t } = useLanguage();
  const [emailText, setEmailText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedAnswers, setParsedAnswers] = useState(null);

  const handleParse = async () => {
    if (!emailText.trim()) { toast.error(t('sc_import_no_email')); return; }
    setParsing(true);
    try {
      const qList = questions.map((q, i) => `${i + 1}. [ID:${q.id}] ${q.question_text}`).join('\n');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are extracting supplier answers from an email reply to a security questionnaire.

Here are the questions:
${qList}

Here is the supplier's email reply:
---
${emailText}
---

For each question, extract:
- The supplier's answer (for yes/no questions: "yes", "no", "partial", or "na"; for scale questions: "1"-"5"; for text questions: the full answer text)
- Any notes or evidence they provided

If a question was not answered, set answer to null.

Return a JSON object: { "answers": [{ "question_id": string, "answer": string | null, "answer_notes": string }] }`,
        response_json_schema: {
          type: 'object',
          properties: {
            answers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question_id: { type: 'string' },
                  answer: { type: 'string' },
                  answer_notes: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const answers = result?.answers || result?.data?.answers || [];
      if (!answers.length) { toast.error(t('sc_import_no_extracted')); setParsing(false); return; }

      const merged = answers.map(a => {
        const q = questions.find(q => q.id === a.question_id);
        return { ...a, question_text: q?.question_text || '', answer_type: q?.answer_type };
      }).filter(a => a.question_text);

      setParsedAnswers(merged);
    } catch (e) {
      toast.error(t('sc_import_failed'));
    }
    setParsing(false);
  };

  const handleConfirm = () => {
    const toImport = parsedAnswers.filter(a => a.answer);
    onImport(toImport);
    handleClose();
  };

  const handleClose = () => {
    onClose();
    setEmailText('');
    setParsedAnswers(null);
  };

  const answeredCount = parsedAnswers?.filter(a => a.answer)?.length || 0;

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4" />{t('sc_import_dialog_title')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {!parsedAnswers ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('sc_import_desc')}
              </p>
              <div>
                <Label className="text-xs">{t('sc_import_paste_label')}</Label>
                <Textarea
                  value={emailText}
                  onChange={e => setEmailText(e.target.value)}
                  rows={16}
                  className="mt-1 font-mono text-xs"
                  placeholder={t('sc_import_paste_placeholder')}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-chart-2/10 text-chart-2 border-chart-2/20">{answeredCount} {t('sc_import_answers_extracted')}</Badge>
                <span className="text-xs text-muted-foreground">{t('sc_import_out_of')} {questions.length} {t('sc_import_questions')}</span>
              </div>
              <div className="space-y-2">
                {parsedAnswers.map(a => (
                  <div key={a.question_id} className="border rounded-lg p-3 text-sm">
                    <div className="flex items-start gap-2">
                      {a.answer
                        ? <Check className="w-4 h-4 text-chart-2 mt-0.5 flex-shrink-0" />
                        : <X className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium line-clamp-2">{a.question_text}</p>
                        {a.answer
                          ? <p className="text-xs text-chart-2 mt-1 font-semibold">{a.answer}</p>
                          : <p className="text-xs text-muted-foreground mt-1 italic">{t('sc_import_no_answer')}</p>
                        }
                        {a.answer_notes && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.answer_notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {!parsedAnswers ? (
            <>
              <Button variant="outline" onClick={handleClose}>{t('sc_import_cancel')}</Button>
              <Button onClick={handleParse} disabled={parsing || !emailText.trim()} className="gap-2">
                <Sparkles className="w-4 h-4" />
                {parsing ? t('sc_import_extracting') : t('sc_import_extract_btn')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setParsedAnswers(null)}>{t('sc_import_back')}</Button>
              <Button variant="outline" onClick={handleClose}>{t('sc_import_cancel')}</Button>
              <Button onClick={handleConfirm} disabled={answeredCount === 0} className="gap-2">
                <Check className="w-4 h-4" />
                {t('sc_import_confirm_btn')} {answeredCount}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}