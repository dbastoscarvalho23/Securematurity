import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { escapeHtml as esc } from '../../shared/escapeHtml.ts';

const STATUS_LABELS = {
  open: 'Open',
  in_treatment: 'In Treatment',
  accepted: 'Accepted',
  closed: 'Closed',
};

function scoreLevel(score) {
  if (score >= 16) return 'Critical';
  if (score >= 9)  return 'High';
  if (score >= 4)  return 'Medium';
  return 'Low';
}

async function getSettings(base44, customerId) {
  const all = await base44.asServiceRole.entities.ReminderSettings.list();
  const customerSpecific = customerId ? all.find(s => s.customer_id === customerId) : null;
  const global = all.find(s => !s.customer_id);
  return customerSpecific || global || {
    notify_on_assignment: true,
    notify_on_status_change: true,
    additional_recipients: '',
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, risk: riskPayload, previousRisk } = await req.json();

  // Do NOT trust the client-supplied risk object: recipient, title and
  // description could all be forged by the caller. Fetch the real record by id
  // from the database and authorize the caller before sending anything.
  const riskId = riskPayload?.id;
  if (!riskId) return Response.json({ error: 'risk id is required' }, { status: 400 });
  let risk;
  try {
    risk = await base44.asServiceRole.entities.RiskItem.get(riskId);
  } catch {
    risk = null;
  }
  if (!risk) return Response.json({ error: 'risk not found' }, { status: 404 });

  const callerCustomerId = user.customer_id || (user.data && user.data.customer_id);
  const isAuthorized = user.role === 'admin' ||
    (risk.customer_id && risk.customer_id === callerCustomerId) ||
    risk.created_by_id === user.id ||
    risk.owner_email === user.email;
  if (!isAuthorized) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const score = (risk.impact || 0) * (risk.likelihood || 0);
  const level = scoreLevel(score);
  const ownerEmail = risk.owner_email;

  if (!ownerEmail) return Response.json({ skipped: 'no owner email' });

  const settings = await getSettings(base44, risk.customer_id);

  // Build recipient list
  const buildRecipients = (primary) => {
    const list = [primary];
    if (settings.additional_recipients) {
      settings.additional_recipients.split(',').map(e => e.trim()).filter(Boolean).forEach(e => {
        if (!list.includes(e)) list.push(e);
      });
    }
    return list;
  };

  // ── 1. New assignment ──────────────────────────────────────────────────────
  if (type === 'assigned') {
    if (!settings.notify_on_assignment) return Response.json({ skipped: 'assignment notifications disabled' });

    const wasOwner = previousRisk?.owner_email;
    if (wasOwner === ownerEmail) return Response.json({ skipped: 'owner unchanged' });

    const recipients = buildRecipients(ownerEmail);
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
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'email_sent',
      user_email: user.email,
      entity_type: 'RiskItem',
      entity_id: risk.id,
      details: `Risk assignment email sent to ${recipients.join(', ')} for risk: ${risk.title}`,
    });
    return Response.json({ sent: 'assigned', to: recipients });
  }

  // ── 2. Status change ───────────────────────────────────────────────────────
  if (type === 'status_changed') {
    if (!settings.notify_on_status_change) return Response.json({ skipped: 'status change notifications disabled' });

    const oldStatus = previousRisk?.status;
    const newStatus = risk.status;
    if (!oldStatus || oldStatus === newStatus) return Response.json({ skipped: 'status unchanged' });

    const recipients = buildRecipients(ownerEmail);
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
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'email_sent',
      user_email: user.email,
      entity_type: 'RiskItem',
      entity_id: risk.id,
      details: `Risk status change email sent to ${recipients.join(', ')} for risk: ${risk.title} (${STATUS_LABELS[oldStatus] || oldStatus} → ${STATUS_LABELS[newStatus] || newStatus})`,
    });
    return Response.json({ sent: 'status_changed', to: recipients });
  }

  return Response.json({ skipped: 'unknown type' });
});