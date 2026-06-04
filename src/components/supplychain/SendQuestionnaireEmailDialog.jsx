import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function SendQuestionnaireEmailDialog({ open, onClose, questionnaire, questions }) {
  const { t } = useLanguage();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setTo(questionnaire?.supplier_email || '');
      setSubject(`Security Questionnaire – ${questionnaire?.title || ''}`);

      const intro = `Dear ${questionnaire?.supplier_name || 'Supplier'},\n\nPlease find below the security questionnaire we would like you to complete. For each question, please provide your answer and any relevant notes or evidence.\n\nReply to this email with your answers in the same format.\n\n---\n\n`;

      const questionLines = questions.map((q, i) => {
        const answerGuide =
          q.answer_type === 'yes_no' ? '[ Yes / No / Partial / N/A ]' :
          q.answer_type === 'scale_1_5' ? '[ Score 1–5 ]' :
          '[ Your answer ]';
        return `${i + 1}. ${q.question_text}\n${q.question_text_pt ? `   (PT) ${q.question_text_pt}\n` : ''}   Answer: ${answerGuide}\n   Notes: `;
      }).join('\n\n');

      const footer = `\n\n---\nPlease reply with your answers filled in above.\n\nThank you,\n${questionnaire?.customer_name || ''}`;

      setBody(intro + questionLines + footer);
    }
  }, [open, questions]);

  const handleSend = async () => {
    if (!to.trim()) { toast.error(t('sc_send_no_recipient')); return; }
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({ to: to.trim(), subject, body });
      toast.success(t('sc_sent_success'));
      onClose();
    } catch (e) {
      toast.error(t('sc_sent_error'));
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4" />{t('sc_send_dialog_title')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          <div>
            <Label className="text-xs">{t('sc_send_to')}</Label>
            <Input value={to} onChange={e => setTo(e.target.value)} placeholder="supplier@company.com" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t('sc_send_subject')}</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t('sc_send_body')}</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={18} className="mt-1 font-mono text-xs" />
          </div>
          <p className="text-xs text-muted-foreground">{questions.length} {t('sc_send_questions_included')}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('sc_send_cancel')}</Button>
          <Button onClick={handleSend} disabled={sending || !to.trim()} className="gap-2">
            <Send className="w-4 h-4" />
            {sending ? t('sc_sending') : t('sc_send_btn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}