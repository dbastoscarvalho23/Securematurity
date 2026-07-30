import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ENTITY_MAP = {
  Task: 'Task',
  RiskItem: 'RiskItem',
  SecurityDocument: 'SecurityDocument',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data, old_data } = payload;

    // Only process trusted entity-automation events (create/update/delete).
    // Reject anything missing a valid automation event envelope.
    if (!event || !ENTITY_MAP[event.entity_name] || !['create', 'update', 'delete'].includes(event.type)) {
      return Response.json({ skipped: true, reason: 'invalid automation event' });
    }
    if (!data) {
      return Response.json({ skipped: true, reason: 'no data' });
    }

    // Do NOT trust caller-supplied data fields (target email, title, customer).
    // Fetch the real record from the database and use it as the source of truth,
    // so an unauthenticated caller cannot inject notifications to arbitrary users.
    const entityKey = ENTITY_MAP[event.entity_name];
    let real = null;
    if (event.entity_id) {
      try {
        real = await base44.asServiceRole.entities[entityKey].get(event.entity_id);
      } catch {
        real = null;
      }
    }
    if (!real) {
      return Response.json({ skipped: true, reason: 'entity not found' });
    }

    const notifications = [];

    // ── Task changes ────────────────────────────────────────────────
    if (event.entity_name === 'Task') {
      const task = real;
      const prevStatus = old_data?.status;

      // Task completed
      if (task.status === 'done' && prevStatus && prevStatus !== 'done') {
        // Notify the assigned user
        if (task.assigned_to) {
          notifications.push({
            user_email: task.assigned_to,
            type: 'task_completed',
            title: 'Task Completed',
            message: `Task "${task.title}" has been marked as done.`,
            entity_type: 'Task',
            entity_id: event.entity_id,
            link: '/tasks',
            customer_id: task.customer_id || null,
            is_read: false,
          });
        }
      }

      // Task assigned (new assignment or changed assignment)
      if (task.assigned_to && task.assigned_to !== old_data?.assigned_to) {
        notifications.push({
          user_email: task.assigned_to,
          type: 'task_assigned',
          title: 'Task Assigned to You',
          message: `You have been assigned to task "${task.title}".`,
          entity_type: 'Task',
          entity_id: event.entity_id,
          link: '/tasks',
          customer_id: task.customer_id || null,
          is_read: false,
        });
      }

      // Task status changed (notify assigned user)
      if (
        task.assigned_to &&
        old_data?.status &&
        task.status !== old_data.status &&
        task.status !== 'done'
      ) {
        const statusLabels = { todo: 'To Do', in_progress: 'In Progress', blocked: 'Blocked' };
        notifications.push({
          user_email: task.assigned_to,
          type: 'general',
          title: 'Task Status Updated',
          message: `Task "${task.title}" status changed to ${statusLabels[task.status] || task.status}.`,
          entity_type: 'Task',
          entity_id: event.entity_id,
          link: '/tasks',
          customer_id: task.customer_id || null,
          is_read: false,
        });
      }
    }

    // ── RiskItem changes ─────────────────────────────────────────────
    if (event.entity_name === 'RiskItem') {
      const risk = real;
      const prevStatus = old_data?.status;

      // Risk status changed
      if (prevStatus && risk.status !== prevStatus && risk.owner_email) {
        const statusLabels = { open: 'Open', in_treatment: 'In Treatment', accepted: 'Accepted', closed: 'Closed' };
        notifications.push({
          user_email: risk.owner_email,
          type: 'risk_status',
          title: 'Risk Status Updated',
          message: `Risk "${risk.title}" status changed to ${statusLabels[risk.status] || risk.status}.`,
          entity_type: 'RiskItem',
          entity_id: event.entity_id,
          link: '/risk-assessment',
          customer_id: risk.customer_id || null,
          is_read: false,
        });
      }

      // Risk owner assigned
      if (risk.owner_email && risk.owner_email !== old_data?.owner_email) {
        notifications.push({
          user_email: risk.owner_email,
          type: 'risk_status',
          title: 'Risk Assigned to You',
          message: `You are now the owner of risk "${risk.title}".`,
          entity_type: 'RiskItem',
          entity_id: event.entity_id,
          link: '/risk-assessment',
          customer_id: risk.customer_id || null,
          is_read: false,
        });
      }
    }

    // ── SecurityDocument changes ─────────────────────────────────────
    if (event.entity_name === 'SecurityDocument') {
      const doc = real;
      const prevStatus = old_data?.status;

      if (doc.status === 'approved' && prevStatus !== 'approved' && doc.owner_email) {
        notifications.push({
          user_email: doc.owner_email,
          type: 'document_approved',
          title: 'Document Approved',
          message: `Document "${doc.title}" has been approved.`,
          entity_type: 'SecurityDocument',
          entity_id: event.entity_id,
          link: '/security-documents',
          customer_id: doc.customer_id || null,
          is_read: false,
        });
      }

      if (doc.status === 'under_review' && prevStatus !== 'under_review' && doc.owner_email) {
        notifications.push({
          user_email: doc.owner_email,
          type: 'document_review',
          title: 'Document Submitted for Review',
          message: `Document "${doc.title}" has been submitted for review.`,
          entity_type: 'SecurityDocument',
          entity_id: event.entity_id,
          link: '/security-documents',
          customer_id: doc.customer_id || null,
          is_read: false,
        });
      }
    }

    // Bulk create
    if (notifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
    }

    return Response.json({ created: notifications.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});