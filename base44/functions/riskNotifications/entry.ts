import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, risk, previousRisk } = await req.json();
  const score = (risk.impact || 0) * (risk.likelihood || 0);
  const level = scoreLevel(score);
  const ownerEmail = risk.owner_email;

  if (!ownerEmail) return Response.json({ skipped: 'no owner email' });

  // ── 1. New assignment ──────────────────────────────────────────────────────
  if (type === 'assigned') {
    const wasOwner = previousRisk?.owner_email;
    if (wasOwner === ownerEmail) return Response.json({ skipped: 'owner unchanged' });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: ownerEmail,
      subject: `[Risk Assigned] ${risk.title}`,
      body: `
<p>Hello,</p>
<p>You have been assigned as the owner of the following risk:</p>
<table style="border-collapse:collapse;width:100%;max-width:560px;font-family:sans-serif;font-size:14px;">
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;width:140px;">Risk ID</td><td style="padding:6px 12px;">${risk.risk_id || '—'}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Title</td><td style="padding:6px 12px;">${risk.title}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Level</td><td style="padding:6px 12px;">${level} (score ${score})</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Status</td><td style="padding:6px 12px;">${STATUS_LABELS[risk.status] || risk.status}</td></tr>
  ${risk.due_date ? `<tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Due Date</td><td style="padding:6px 12px;">${risk.due_date}</td></tr>` : ''}
  ${risk.description ? `<tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Description</td><td style="padding:6px 12px;">${risk.description}</td></tr>` : ''}
</table>
<p>Please review this risk and take appropriate action.</p>
<p style="color:#6b7280;font-size:12px;">Assigned by: ${user.full_name || user.email}</p>
      `.trim(),
    });
    return Response.json({ sent: 'assigned', to: ownerEmail });
  }

  // ── 2. Status change ───────────────────────────────────────────────────────
  if (type === 'status_changed') {
    const oldStatus = previousRisk?.status;
    const newStatus = risk.status;
    if (!oldStatus || oldStatus === newStatus) return Response.json({ skipped: 'status unchanged' });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: ownerEmail,
      subject: `[Risk Update] Status changed — ${risk.title}`,
      body: `
<p>Hello,</p>
<p>The status of a risk you own has been updated:</p>
<table style="border-collapse:collapse;width:100%;max-width:560px;font-family:sans-serif;font-size:14px;">
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;width:140px;">Risk ID</td><td style="padding:6px 12px;">${risk.risk_id || '—'}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Title</td><td style="padding:6px 12px;">${risk.title}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Old Status</td><td style="padding:6px 12px;">${STATUS_LABELS[oldStatus] || oldStatus}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">New Status</td><td style="padding:6px 12px;"><strong>${STATUS_LABELS[newStatus] || newStatus}</strong></td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Risk Level</td><td style="padding:6px 12px;">${level} (score ${score})</td></tr>
  ${risk.due_date ? `<tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Due Date</td><td style="padding:6px 12px;">${risk.due_date}</td></tr>` : ''}
</table>
<p style="color:#6b7280;font-size:12px;">Updated by: ${user.full_name || user.email}</p>
      `.trim(),
    });
    return Response.json({ sent: 'status_changed', to: ownerEmail });
  }

  return Response.json({ skipped: 'unknown type' });
});