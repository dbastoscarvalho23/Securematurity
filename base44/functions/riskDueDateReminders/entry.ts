import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { escapeHtml } from '../../shared/escapeHtml.ts';
import { getAutomationSecret } from '../../shared/automationSecret.ts';

function scoreLevel(score) {
  if (score >= 16) return 'Critical';
  if (score >= 9)  return 'High';
  if (score >= 4)  return 'Medium';
  return 'Low';
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Authorization: scheduled automation passes the shared secret (body.args.automation_secret
  // or x-automation-secret header); manual admin triggers authenticate via base44.auth.me().
  // Anonymous external callers are rejected before any service-role query / email dispatch.
  const automationSecret = await getAutomationSecret(req);
  let authorized = !!automationSecret;
  if (!authorized) {
    try {
      const user = await base44.auth.me();
      authorized = user?.role === 'admin';
    } catch {
      authorized = false;
    }
  }
  if (!authorized) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

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

    const score = (risk.impact || 0) * (risk.likelihood || 0);
    const level = scoreLevel(score);
    const urgencyLabel = daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;

    // Build recipient list
    const recipients = [risk.owner_email];
    if (settings.additional_recipients) {
      settings.additional_recipients.split(',').map(e => e.trim()).filter(Boolean).forEach(e => {
        if (!recipients.includes(e)) recipients.push(e);
      });
    }

    const body = `
<p>Hello,</p>
<p>This is a reminder that a risk you own is due <strong>${urgencyLabel}</strong>:</p>
<table style="border-collapse:collapse;width:100%;max-width:560px;font-family:sans-serif;font-size:14px;">
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;width:140px;">Risk ID</td><td style="padding:6px 12px;">${escapeHtml(risk.risk_id || '—')}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Title</td><td style="padding:6px 12px;">${escapeHtml(risk.title || '')}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Due Date</td><td style="padding:6px 12px;"><strong>${escapeHtml(risk.due_date || '')}</strong></td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Status</td><td style="padding:6px 12px;">${escapeHtml(risk.status?.replace(/_/g, ' ') || '')}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Risk Level</td><td style="padding:6px 12px;">${escapeHtml(level)} (score ${escapeHtml(String(score))})</td></tr>
  ${risk.treatment_notes ? `<tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Treatment</td><td style="padding:6px 12px;">${escapeHtml(risk.treatment_notes)}</td></tr>` : ''}
</table>
<p>Please ensure this risk is addressed before the deadline.</p>
    `.trim();

    for (const to of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to,
        subject: `[Risk Due ${daysLeft === 1 ? 'Tomorrow' : `in ${daysLeft} days`}] ${risk.title}`,
        body,
      });
    }
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'email_sent',
      user_email: 'system',
      entity_type: 'RiskItem',
      entity_id: risk.id,
      details: `Due date reminder email sent to ${recipients.join(', ')} for risk: ${risk.title} (due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''})`,
    });
    sent++;
  }

  return Response.json({ sent, skipped });
});