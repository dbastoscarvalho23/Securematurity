import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, hasAutomationSecret, getAuthenticatedUser, canAccessRecord } from "../../shared/http.ts";

const ENTITY_MAP = {
  Task: 'Task',
  RiskItem: 'RiskItem',
  SecurityDocument: 'SecurityDocument',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    let { event, data, old_data } = payload;

    // Autorização: workflows do Base44 (segredo partilhado) ou, nesta app importada onde os workflows por evento
    // não correm, chamada direta de um utilizador autenticado depois de gravar («direct»). No modo direto o
    // registo é lido da base de dados e o utilizador tem de ter acesso a ele; os destinatários vêm do registo.
    if (!hasAutomationSecret(req, payload)) {
      if (!payload?.direct) return json({ error: 'Unauthorized' }, 403);
      const user = await getAuthenticatedUser(base44);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const entityName = String(payload.entity || '');
      if (!ENTITY_MAP[entityName] || !payload.id) return json({ skipped: true, reason: 'invalid direct call' });
      const rec = await base44.asServiceRole.entities[ENTITY_MAP[entityName]].get(String(payload.id)).catch(() => null);
      if (!rec || !canAccessRecord(user, rec)) return json({ error: 'Forbidden' }, 403);
      event = { entity_name: entityName, entity_id: rec.id, type: payload.event === 'create' ? 'create' : 'update' };
      data = rec;
      old_data = payload.previous || null;
    }

    // Only process trusted entity-automation events (create/update/delete).
    // Reject anything missing a valid automation event envelope.
    if (!event || !ENTITY_MAP[event.entity_name] || !['create', 'update', 'delete'].includes(event.type)) {
      return json({ skipped: true, reason: 'invalid automation event' });
    }
    if (!data) {
      return json({ skipped: true, reason: 'no data' });
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
      return json({ skipped: true, reason: 'entity not found' });
    }

    // old_data is caller-supplied, so only accept it when it references the
    // same record — forged "previous" data can no longer suppress or skew
    // notifications.
    const previous = old_data?.id === event.entity_id ? old_data : null;

    const notifications = [];

    // ── Task changes ────────────────────────────────────────────────
    if (event.entity_name === 'Task') {
      const task = real;
      const prevStatus = previous?.status;

      // Task completed
      if (task.status === 'done' && prevStatus && prevStatus !== 'done') {
        // Notify the assigned user
        if (task.assigned_to) {
          notifications.push({
            user_email: task.assigned_to,
            type: 'task_completed',
            title: 'Tarefa concluída',
            message: `A tarefa "${task.title}" foi marcada como concluída.`,
            entity_type: 'Task',
            entity_id: event.entity_id,
            link: '/tasks',
            customer_id: task.customer_id || null,
            is_read: false,
          });
        }
      }

      // Task assigned (new assignment or changed assignment)
      if (task.assigned_to && task.assigned_to !== previous?.assigned_to) {
        notifications.push({
          user_email: task.assigned_to,
          type: 'task_assigned',
          title: 'Tarefa atribuída',
          message: `Foi-lhe atribuída a tarefa "${task.title}".`,
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
        previous?.status &&
        task.status !== previous?.status &&
        task.status !== 'done'
      ) {
        const statusLabels = { todo: 'Por fazer', in_progress: 'Em curso', blocked: 'Bloqueada' };
        notifications.push({
          user_email: task.assigned_to,
          type: 'general',
          title: 'Estado da tarefa alterado',
          message: `A tarefa "${task.title}" passou para o estado ${statusLabels[task.status] || task.status}.`,
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
      const prevStatus = previous?.status;

      // Risk status changed
      if (prevStatus && risk.status !== prevStatus && risk.owner_email) {
        const statusLabels = { open: 'Aberto', in_treatment: 'Em tratamento', accepted: 'Aceite', closed: 'Fechado' };
        notifications.push({
          user_email: risk.owner_email,
          type: 'risk_status',
          title: 'Estado do risco alterado',
          message: `O risco "${risk.title}" passou para o estado ${statusLabels[risk.status] || risk.status}.`,
          entity_type: 'RiskItem',
          entity_id: event.entity_id,
          link: '/risk-assessment',
          customer_id: risk.customer_id || null,
          is_read: false,
        });
      }

      // Risk owner assigned
      if (risk.owner_email && risk.owner_email !== previous?.owner_email) {
        notifications.push({
          user_email: risk.owner_email,
          type: 'risk_status',
          title: 'Risco atribuído',
          message: `Passou a ser o responsável pelo risco "${risk.title}".`,
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
      const prevStatus = previous?.status;

      if (doc.status === 'approved' && prevStatus !== 'approved' && doc.owner_email) {
        notifications.push({
          user_email: doc.owner_email,
          type: 'document_approved',
          title: 'Documento aprovado',
          message: `O documento "${doc.title}" foi aprovado.`,
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
          title: 'Documento enviado para revisão',
          message: `O documento "${doc.title}" foi enviado para revisão.`,
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

    return json({ created: notifications.length });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});
