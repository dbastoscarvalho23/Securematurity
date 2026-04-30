import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function scoreLevel(score) {
  if (score >= 16) return 'Critical';
  if (score >= 9)  return 'High';
  if (score >= 4)  return 'Medium';
  return 'Low';
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Allow scheduled (no user) or admin-triggered calls
  let user = null;
  try { user = await base44.auth.me(); } catch (_) {}
  if (user && user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const risks = await base44.asServiceRole.entities.RiskItem.list();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const warnings = [7, 3, 1]; // days before due date to notify
  let sent = 0;
  let skipped = 0;

  for (const risk of risks) {
    if (!risk.owner_email || !risk.due_date || risk.status === 'closed') {
      skipped++;
      continue;
    }

    const due = new Date(risk.due_date);
    due.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((due - today) / (1000 * 60 * 60 * 24));

    if (!warnings.includes(daysLeft)) {
      skipped++;
      continue;
    }

    const score = (risk.impact || 0) * (risk.likelihood || 0);
    const level = scoreLevel(score);
    const urgencyLabel = daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: risk.owner_email,
      subject: `[Risk Due ${daysLeft === 1 ? 'Tomorrow' : `in ${daysLeft} days`}] ${risk.title}`,
      body: `
<p>Hello,</p>
<p>This is a reminder that a risk you own is due <strong>${urgencyLabel}</strong>:</p>
<table style="border-collapse:collapse;width:100%;max-width:560px;font-family:sans-serif;font-size:14px;">
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;width:140px;">Risk ID</td><td style="padding:6px 12px;">${risk.risk_id || '—'}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Title</td><td style="padding:6px 12px;">${risk.title}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Due Date</td><td style="padding:6px 12px;"><strong>${risk.due_date}</strong></td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Status</td><td style="padding:6px 12px;">${risk.status?.replace(/_/g, ' ')}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Risk Level</td><td style="padding:6px 12px;">${level} (score ${score})</td></tr>
  ${risk.treatment_notes ? `<tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Treatment</td><td style="padding:6px 12px;">${risk.treatment_notes}</td></tr>` : ''}
</table>
<p>Please ensure this risk is addressed before the deadline.</p>
      `.trim(),
    });
    sent++;
  }

  return Response.json({ sent, skipped });
});