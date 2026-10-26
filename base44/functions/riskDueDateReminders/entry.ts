import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { escapeHtml } from '../../shared/escapeHtml.ts';
import { json, authorizeAutomationOrAdmin } from '../../shared/http.ts';
import { logEmailSent } from '../../shared/audit.ts';
import { riskScore, scoreLevel } from '../../shared/riskLevel.ts';
import { buildRecipients } from '../../shared/reminderSettings.ts';
import { sendMail } from '../../shared/mail.ts';

const LEVEL_PT = { Critical: 'Crítico', High: 'Alto', Medium: 'Médio', Low: 'Baixo' };
const RISK_STATUS_PT = { open: 'Aberto', in_treatment: 'Em tratamento', accepted: 'Aceite', closed: 'Fechado' };

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Authorization: scheduled automation (shared secret) or manual platform admin.
  // Anonymous external callers are rejected before any service-role query / email dispatch.
  const forbidden = await authorizeAutomationOrAdmin(req, base44);
  if (forbidden) return forbidden;

  const [risks, allSettings] = await Promise.all([
    base44.asServiceRole.entities.RiskItem.list(),
    base44.asServiceRole.entities.ReminderSettings.list(),
  ]);

  // Build a settings lookup: customer_id -> settings (null key = global)
  const globalSettings = allSettings.find(s => !s.customer_id) || {
    due_date_reminders_enabled: true,
    reminder_days_before: [7, 3, 1],
    notify_on_assignment: true,
    notify_on_status_change: true,
    additional_recipients: '',
  };

  const settingsByCustomer = {};
  allSettings.filter(s => s.customer_id).forEach(s => {
    settingsByCustomer[s.customer_id] = s;
  });

  const getSettings = (risk) => settingsByCustomer[risk.customer_id] || globalSettings;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let sent = 0;
  let skipped = 0;

  for (const risk of risks) {
    const settings = getSettings(risk);

    if (!settings.due_date_reminders_enabled) { skipped++; continue; }
    if (!risk.owner_email || !risk.due_date || risk.status === 'closed') { skipped++; continue; }

    const due = new Date(risk.due_date);
    due.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((due - today) / (1000 * 60 * 60 * 24));

    const thresholds = settings.reminder_days_before?.length ? settings.reminder_days_before : [7, 3, 1];
    if (!thresholds.includes(daysLeft)) { skipped++; continue; }

    const score = riskScore(risk.impact, risk.likelihood);
    const level = scoreLevel(score);
    const urgencyLabel = daysLeft === 1 ? 'amanhã' : `daqui a ${daysLeft} dias`;

    const recipients = buildRecipients(risk.owner_email, settings);

    const body = `
<p>Olá,</p>
<p>O prazo de um risco pelo qual é responsável termina <strong>${urgencyLabel}</strong>:</p>
<table style="border-collapse:collapse;width:100%;max-width:560px;font-family:sans-serif;font-size:14px;">
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;width:140px;">ID do risco</td><td style="padding:6px 12px;">${escapeHtml(risk.risk_id || '—')}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Título</td><td style="padding:6px 12px;">${escapeHtml(risk.title || '')}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Data-limite</td><td style="padding:6px 12px;"><strong>${escapeHtml(risk.due_date || '')}</strong></td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Estado</td><td style="padding:6px 12px;">${escapeHtml(RISK_STATUS_PT[risk.status] || risk.status?.replace(/_/g, ' ') || '')}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Nível de risco</td><td style="padding:6px 12px;">${escapeHtml(LEVEL_PT[level] || level)} (pontuação ${escapeHtml(String(score))})</td></tr>
  ${risk.treatment_notes ? `<tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Tratamento</td><td style="padding:6px 12px;">${escapeHtml(risk.treatment_notes)}</td></tr>` : ''}
</table>
<p>Trate este risco antes do fim do prazo.</p>
    `.trim();

    for (const to of recipients) {
      await sendMail(base44, {
        to,
        subject: `[Prazo do risco: ${daysLeft === 1 ? 'amanhã' : `${daysLeft} dias`}] ${risk.title}`,
        body,
      });
    }
    await logEmailSent(base44, {
      user_email: 'system',
      entity_type: 'RiskItem',
      entity_id: risk.id,
      details: `Due date reminder email sent to ${recipients.join(', ')} for risk: ${risk.title} (due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''})`,
    });
    sent++;
  }

  return json({ sent, skipped });
});
