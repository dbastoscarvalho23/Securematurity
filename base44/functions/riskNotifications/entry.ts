import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { escapeHtml as esc } from '../../shared/escapeHtml.ts';
import { json, getAuthenticatedUser, canAccessRecord } from '../../shared/http.ts';
import { logEmailSent } from '../../shared/audit.ts';
import { getReminderSettings, buildRecipients } from '../../shared/reminderSettings.ts';
import { riskScore, scoreLevel, RISK_STATUS_LABELS as STATUS_LABELS } from '../../shared/riskLevel.ts';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await getAuthenticatedUser(base44);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json();
  const { type, previousRisk: payloadPreviousRisk } = body;
  let risk = body.risk;

  // Never trust the caller-supplied record: only its id is used to fetch the
  // real record from the database, and the caller must be authorized on it
  // (admin, same customer, creator or owner) before any email is sent.
  const riskId = risk?.id;
  if (!riskId) return json({ error: 'risk.id is required' }, 400);
  let real = null;
  try {
    real = await base44.asServiceRole.entities.RiskItem.get(riskId);
  } catch {
    real = null;
  }
  if (!real) return json({ error: 'risk not found' }, 404);

  if (!canAccessRecord(user, real)) return json({ error: 'Forbidden' }, 403);

  // All email content and recipients are derived from the real record.
  risk = real;

  // The previous state is also client-supplied, so only accept it when it
  // references the same record; otherwise ignore it (prevents forged
  // "previous" data from suppressing or injecting content into emails).
  const previousRisk = payloadPreviousRisk?.id === riskId ? payloadPreviousRisk : null;

  const score = riskScore(risk.impact, risk.likelihood);
  const level = scoreLevel(score);
  const ownerEmail = risk.owner_email;

  if (!ownerEmail) return json({ skipped: 'no owner email' });

  const settings = await getReminderSettings(base44.asServiceRole, risk.customer_id);

  // ── 1. New assignment ──────────────────────────────────────────────────────
  if (type === 'assigned') {
    if (!settings.notify_on_assignment) return json({ skipped: 'assignment notifications disabled' });

    const wasOwner = previousRisk?.owner_email;
    if (wasOwner === ownerEmail) return json({ skipped: 'owner unchanged' });

    const recipients = buildRecipients(ownerEmail, settings);
    const body = `
<p>Hello,</p>
<p>You have been assigned as the owner of the following risk:</p>
<table style="border-collapse:collapse;width:100%;max-width:560px;font-family:sans-serif;font-size:14px;">
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;width:140px;">Risk ID</td><td style="padding:6px 12px;">${esc(risk.risk_id || '—')}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Title</td><td style="padding:6px 12px;">${esc(risk.title)}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Level</td><td style="padding:6px 12px;">${esc(level)} (score ${esc(score)})</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Status</td><td style="padding:6px 12px;">${esc(STATUS_LABELS[risk.status] || risk.status)}</td></tr>
  ${risk.due_date ? `<tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Due Date</td><td style="padding:6px 12px;">${esc(risk.due_date)}</td></tr>` : ''}
  ${risk.description ? `<tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Description</td><td style="padding:6px 12px;">${esc(risk.description)}</td></tr>` : ''}
</table>
<p>Please review this risk and take appropriate action.</p>
<p style="color:#6b7280;font-size:12px;">Assigned by: ${esc(user.full_name || user.email)}</p>
    `.trim();

    for (const to of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: `[Risk Assigned] ${esc(risk.title)}`, body });
    }
    await logEmailSent(base44, {
      user_email: user.email,
      entity_type: 'RiskItem',
      entity_id: risk.id,
      details: `Risk assignment email sent to ${recipients.join(', ')} for risk: ${risk.title}`,
    });
    return json({ sent: 'assigned', to: recipients });
  }

  // ── 2. Status change ───────────────────────────────────────────────────────
  if (type === 'status_changed') {
    if (!settings.notify_on_status_change) return json({ skipped: 'status change notifications disabled' });

    const oldStatus = previousRisk?.status;
    const newStatus = risk.status;
    if (!oldStatus || oldStatus === newStatus) return json({ skipped: 'status unchanged' });

    const recipients = buildRecipients(ownerEmail, settings);
    const body = `
<p>Hello,</p>
<p>The status of a risk you own has been updated:</p>
<table style="border-collapse:collapse;width:100%;max-width:560px;font-family:sans-serif;font-size:14px;">
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;width:140px;">Risk ID</td><td style="padding:6px 12px;">${esc(risk.risk_id || '—')}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Title</td><td style="padding:6px 12px;">${esc(risk.title)}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Old Status</td><td style="padding:6px 12px;">${esc(STATUS_LABELS[oldStatus] || oldStatus)}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">New Status</td><td style="padding:6px 12px;"><strong>${esc(STATUS_LABELS[newStatus] || newStatus)}</strong></td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Risk Level</td><td style="padding:6px 12px;">${esc(level)} (score ${esc(score)})</td></tr>
  ${risk.due_date ? `<tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Due Date</td><td style="padding:6px 12px;">${esc(risk.due_date)}</td></tr>` : ''}
</table>
<p style="color:#6b7280;font-size:12px;">Updated by: ${esc(user.full_name || user.email)}</p>
    `.trim();

    for (const to of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: `[Risk Update] Status changed — ${esc(risk.title)}`, body });
    }
    await logEmailSent(base44, {
      user_email: user.email,
      entity_type: 'RiskItem',
      entity_id: risk.id,
      details: `Risk status change email sent to ${recipients.join(', ')} for risk: ${risk.title} (${STATUS_LABELS[oldStatus] || oldStatus} → ${STATUS_LABELS[newStatus] || newStatus})`,
    });
    return json({ sent: 'status_changed', to: recipients });
  }

  return json({ skipped: 'unknown type' });
});