import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { escapeHtml as esc } from '../../shared/escapeHtml.ts';
import { json, getAuthenticatedUser, canAccessRecord } from '../../shared/http.ts';
import { logEmailSent } from '../../shared/audit.ts';
import { getReminderSettings, buildRecipients } from '../../shared/reminderSettings.ts';

const STATUS_LABELS = {
  todo: 'To-Do',
  in_progress: 'In Progress',
  done: 'Done',
  blocked: 'Blocked',
};

const PRIORITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await getAuthenticatedUser(base44);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json();
  const { type, previousTask: payloadPreviousTask } = body;
  let task = body.task;

  // Never trust the caller-supplied record: only its id is used to fetch the
  // real record from the database, and the caller must be authorized on it
  // (admin, same customer, creator or assignee) before any email is sent.
  const taskId = task?.id;
  if (!taskId) return json({ error: 'task.id is required' }, 400);
  let real = null;
  try {
    real = await base44.asServiceRole.entities.Task.get(taskId);
  } catch {
    real = null;
  }
  if (!real) return json({ error: 'task not found' }, 404);

  if (!canAccessRecord(user, real)) return json({ error: 'Forbidden' }, 403);

  // All email content and recipients are derived from the real record.
  task = real;

  // The previous state is also client-supplied, so only accept it when it
  // references the same record; otherwise ignore it (prevents forged
  // "previous" data from suppressing or injecting content into emails).
  const previousTask = payloadPreviousTask?.id === taskId ? payloadPreviousTask : null;

  const assignedTo = task.assigned_to;

  if (!assignedTo) return json({ skipped: 'no assigned_to email' });

  const settings = await getReminderSettings(base44.asServiceRole, task.customer_id);

  // ── 1. New assignment ──────────────────────────────────────────────────────
  if (type === 'assigned') {
    if (!settings.notify_on_assignment) return json({ skipped: 'assignment notifications disabled' });

    const wasAssigned = previousTask?.assigned_to;
    if (wasAssigned === assignedTo) return json({ skipped: 'assignee unchanged' });

    const recipients = buildRecipients(assignedTo, settings);
    const body = `
<p>Hello,</p>
<p>You have been assigned to the following task:</p>
<table style="border-collapse:collapse;width:100%;max-width:560px;font-family:sans-serif;font-size:14px;">
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;width:140px;">Title</td><td style="padding:6px 12px;">${esc(task.title)}</td></tr>
  ${task.description ? `<tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Description</td><td style="padding:6px 12px;">${esc(task.description)}</td></tr>` : ''}
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Status</td><td style="padding:6px 12px;">${esc(STATUS_LABELS[task.status] || task.status)}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Priority</td><td style="padding:6px 12px;">${esc(PRIORITY_LABELS[task.priority] || task.priority || '—')}</td></tr>
  ${task.due_date ? `<tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Due Date</td><td style="padding:6px 12px;">${esc(task.due_date)}</td></tr>` : ''}
  ${task.customer_name ? `<tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Customer</td><td style="padding:6px 12px;">${esc(task.customer_name)}</td></tr>` : ''}
</table>
<p>Please review this task and take appropriate action.</p>
<p style="color:#6b7280;font-size:12px;">Assigned by: ${esc(user.full_name || user.email)}</p>
    `.trim();

    for (const to of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: `[Task Assigned] ${esc(task.title)}`, body });
    }
    await logEmailSent(base44, {
      user_email: user.email,
      entity_type: 'Task',
      entity_id: task.id,
      details: `Task assignment email sent to ${recipients.join(', ')} for task: ${task.title}`,
    });
    return json({ sent: 'assigned', to: recipients });
  }

  // ── 2. Status change ───────────────────────────────────────────────────────
  if (type === 'status_changed') {
    if (!settings.notify_on_status_change) return json({ skipped: 'status change notifications disabled' });

    const oldStatus = previousTask?.status;
    const newStatus = task.status;
    if (!oldStatus || oldStatus === newStatus) return json({ skipped: 'status unchanged' });

    const recipients = buildRecipients(assignedTo, settings);
    const body = `
<p>Hello,</p>
<p>The status of a task assigned to you has been updated:</p>
<table style="border-collapse:collapse;width:100%;max-width:560px;font-family:sans-serif;font-size:14px;">
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;width:140px;">Title</td><td style="padding:6px 12px;">${esc(task.title)}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Old Status</td><td style="padding:6px 12px;">${esc(STATUS_LABELS[oldStatus] || oldStatus)}</td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">New Status</td><td style="padding:6px 12px;"><strong>${esc(STATUS_LABELS[newStatus] || newStatus)}</strong></td></tr>
  <tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Priority</td><td style="padding:6px 12px;">${esc(PRIORITY_LABELS[task.priority] || task.priority || '—')}</td></tr>
  ${task.due_date ? `<tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Due Date</td><td style="padding:6px 12px;">${esc(task.due_date)}</td></tr>` : ''}
  ${task.customer_name ? `<tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;">Customer</td><td style="padding:6px 12px;">${esc(task.customer_name)}</td></tr>` : ''}
</table>
<p style="color:#6b7280;font-size:12px;">Updated by: ${esc(user.full_name || user.email)}</p>
    `.trim();

    for (const to of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: `[Task Update] Status changed — ${esc(task.title)}`, body });
    }
    await logEmailSent(base44, {
      user_email: user.email,
      entity_type: 'Task',
      entity_id: task.id,
      details: `Task status change email sent to ${recipients.join(', ')} for task: ${task.title} (${STATUS_LABELS[oldStatus] || oldStatus} → ${STATUS_LABELS[newStatus] || newStatus})`,
    });
    return json({ sent: 'status_changed', to: recipients });
  }

  return json({ skipped: 'unknown type' });
});