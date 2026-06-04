import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

function buildHtmlEmail({ questionnaire, questions, isPt }) {
  const supplierName = questionnaire?.supplier_name || (isPt ? 'Fornecedor' : 'Supplier');
  const customerName = questionnaire?.customer_name || '';
  const title = questionnaire?.title || '';

  const groupedByArea = questions.reduce((acc, q) => {
    const area = q.area || (isPt ? 'Geral' : 'General');
    if (!acc[area]) acc[area] = [];
    acc[area].push(q);
    return acc;
  }, {});

  const answerGuide = (q) => {
    if (q.answer_type === 'yes_no') return isPt ? 'Sim &nbsp;|&nbsp; Não &nbsp;|&nbsp; Parcial &nbsp;|&nbsp; N/D' : 'Yes &nbsp;|&nbsp; No &nbsp;|&nbsp; Partial &nbsp;|&nbsp; N/A';
    if (q.answer_type === 'scale_1_5') return isPt ? 'Pontuação: 1 &nbsp;|&nbsp; 2 &nbsp;|&nbsp; 3 &nbsp;|&nbsp; 4 &nbsp;|&nbsp; 5' : 'Score: 1 &nbsp;|&nbsp; 2 &nbsp;|&nbsp; 3 &nbsp;|&nbsp; 4 &nbsp;|&nbsp; 5';
    if (q.answer_type === 'multiple_choice') {
      const opts = (isPt && q.options_pt?.length ? q.options_pt : q.options) || [];
      return opts.join(' &nbsp;|&nbsp; ');
    }
    return isPt ? '(texto livre)' : '(free text)';
  };

  const questionRows = Object.entries(groupedByArea).map(([area, areaQs]) => {
    const areaHeader = `
      <tr>
        <td colspan="2" style="background:#1e293b;color:#ffffff;padding:10px 16px;font-size:13px;font-weight:600;letter-spacing:0.05em;">
          ${area.toUpperCase()}
        </td>
      </tr>`;

    const rows = areaQs.map((q, i) => {
      const qText = (isPt && q.question_text_pt) ? q.question_text_pt : q.question_text;
      const answerLabel = isPt ? 'Resposta' : 'Answer';
      const notesLabel = isPt ? 'Notas / Evidências' : 'Notes / Evidence';
      return `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:14px 16px;vertical-align:top;width:55%;">
          <div style="font-size:13px;color:#1e293b;font-weight:500;margin-bottom:4px;">${i + 1}. ${qText}</div>
          <div style="font-size:11px;color:#64748b;">${answerGuide(q)}</div>
        </td>
        <td style="padding:14px 16px;vertical-align:top;background:#f8fafc;">
          <div style="margin-bottom:10px;">
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">${answerLabel}</div>
            <div style="border-bottom:1px solid #cbd5e1;min-height:22px;">&nbsp;</div>
          </div>
          <div>
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">${notesLabel}</div>
            <div style="border-bottom:1px solid #cbd5e1;min-height:22px;">&nbsp;</div>
            <div style="border-bottom:1px solid #e2e8f0;min-height:22px;">&nbsp;</div>
          </div>
        </td>
      </tr>`;
    }).join('');

    return areaHeader + rows;
  }).join('');

  const greeting = isPt
    ? `Caro/a <strong>${supplierName}</strong>,`
    : `Dear <strong>${supplierName}</strong>,`;

  const introPara = isPt
    ? `Agradecemos a sua colaboração. Solicitamos o preenchimento do questionário de segurança abaixo, no âmbito da avaliação de fornecedores de <strong>${customerName}</strong>.<br><br>Para cada pergunta, preencha a resposta e quaisquer notas ou evidências relevantes. <strong>Responda a este e-mail com o questionário preenchido.</strong>`
    : `Thank you for your cooperation. Please complete the security questionnaire below as part of the supplier assessment for <strong>${customerName}</strong>.<br><br>For each question, fill in your answer and any relevant notes or evidence. <strong>Reply to this email with the completed questionnaire.</strong>`;

  const footerText = isPt
    ? `Por favor responda a este e-mail com as suas respostas preenchidas.<br>Obrigado/a,<br><strong>${customerName}</strong>`
    : `Please reply to this email with your answers filled in.<br>Thank you,<br><strong>${customerName}</strong>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="700" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:28px 32px;">
            <div style="color:#ffffff;font-size:20px;font-weight:700;">${title}</div>
            <div style="color:#93c5fd;font-size:13px;margin-top:4px;">${customerName}</div>
          </td>
        </tr>

        <!-- Intro -->
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #e2e8f0;">
            <p style="margin:0 0 12px;font-size:14px;color:#334155;">${greeting}</p>
            <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${introPara}</p>
          </td>
        </tr>

        <!-- Questions table -->
        <tr>
          <td style="padding:0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <thead>
                <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                  <th style="padding:10px 16px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;width:55%;">${isPt ? 'Pergunta' : 'Question'}</th>
                  <th style="padding:10px 16px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">${isPt ? 'Resposta do Fornecedor' : 'Supplier Response'}</th>
                </tr>
              </thead>
              <tbody>
                ${questionRows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">${footerText}</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default function SendQuestionnaireEmailDialog({ open, onClose, questionnaire, questions }) {
  const { t, language } = useLanguage();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      const isPt = language === 'pt';
      setTo(questionnaire?.supplier_email || '');
      setSubject(isPt
        ? `Questionário de Segurança – ${questionnaire?.title || ''}`
        : `Security Questionnaire – ${questionnaire?.title || ''}`
      );
      setHtmlBody(buildHtmlEmail({ questionnaire, questions, isPt }));
    }
  }, [open, questions, language]);

  const handleSend = async () => {
    if (!to.trim()) { toast.error(t('sc_send_no_recipient')); return; }
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({ to: to.trim(), subject, body: htmlBody });
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
            <Label className="text-xs text-muted-foreground mb-2 block">{t('sc_send_preview_label') || 'Email Preview'}</Label>
            <div
              className="border rounded-lg overflow-hidden"
              style={{ maxHeight: '360px', overflowY: 'auto' }}
              dangerouslySetInnerHTML={{ __html: htmlBody }}
            />
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