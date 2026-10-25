import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { escapeHtml as esc } from '../../shared/escapeHtml.ts';

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

  const { type, task: taskPayload, previousTask } = await req.json();

  // Do NOT trust the client-supplied task object: recipient, title and
  // description could all be forged by the caller. Fetch the real record by id
  // from the database and authorize the caller before sending anything.
  const taskId = taskPayload?.id;
  if (!taskId) return Response.json({ error: 'task id is required' }, { status: 400 });
  let task;
  try {
    task = await base44.asServiceRole.entities.Task.get(taskId);
  } catch {
    task = null;
  }
  if (!task) return Response.json({ error: 'task not found' }, { status: 404 });

  const callerCustomerId = user.customer_id || (user.data && user.data.customer_id);
  const isAuthorized = user.role === 'admin' ||
    (task.customer_id && task.customer_id === callerCustomerId) ||
    task.created_by_id === user.id ||
    task.assigned_to === user.email;
  if (!isAuthorized) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const assignedTo = task.assigned_to;

  if (!assignedTo) return Response.json({ skipped: 'no assigned_to email' });

  const settings = await getSettings(base44, task.customer_id);

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

    const wasAssigned = previousTask?.assigned_to;
    if (wasAssigned === assignedTo) return Response.json({ skipped: 'assignee unchanged' });

    const recipients = buildRecipients(assignedTo);
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
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'email_sent',
      user_email: user.email,
      entity_type: 'Task',
      entity_id: task.id,
      details: `Task assignment email sent to ${recipients.join(', ')} for task: ${task.title}`,
    });
    return Response.json({ sent: 'assigned', to: recipients });
  }

  // ── 2. Status change ───────────────────────────────────────────────────────
  if (type === 'status_changed') {
    if (!settings.notify_on_status_change) return Response.json({ skipped: 'status change notifications disabled' });

    const oldStatus = previousTask?.status;
    const newStatus = task.status;
    if (!oldStatus || oldStatus === newStatus) return Response.json({ skipped: 'status unchanged' });

    const recipients = buildRecipients(assignedTo);
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
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'email_sent',
      user_email: user.email,
      entity_type: 'Task',
      entity_id: task.id,
      details: `Task status change email sent to ${recipients.join(', ')} for task: ${task.title} (${STATUS_LABELS[oldStatus] || oldStatus} → ${STATUS_LABELS[newStatus] || newStatus})`,
    });
    return Response.json({ sent: 'status_changed', to: recipients });
  }

  return Response.json({ skipped: 'unknown type' });
});