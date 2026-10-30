import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isPlatformAdmin } from '../../shared/http.ts';
import { logAudit } from '../../shared/audit.ts';
import {
  validateRequest, decisionRefusal, revokeRefusal, effectiveStatus, syncUserScope, customerAdmins, isDecider,
} from '../../shared/delegation.ts';

/**
 * Acesso delegado (UserCustomerAssignment). Operação em `op`:
 *
 * - `list`: o administrador da plataforma vê todas (ou as de `customer_id`); quem administra um cliente vê as desse
 *   cliente; qualquer pessoa vê as suas.
 * - `request` (administrador da plataforma): pede acesso para um consultor. Fica `requested` até o cliente decidir.
 * - `grant` (administração do cliente): concede diretamente (fica `active`).
 * - `approve` / `reject` (administração do cliente): decide um pedido. Ninguém decide o próprio acesso.
 * - `revoke`: cliente, plataforma ou a própria pessoa. Efeito imediato.
 * - `sync` (administrador da plataforma; workflow de hora a hora): expira o que passou do prazo e volta a derivar as
 *   listas delegadas de todas as pessoas com atribuições.
 * - `me`: volta a derivar as listas da própria pessoa (início de sessão).
 *
 * Cada alteração fica na trilha de auditoria encadeada e volta a derivar as listas da pessoa afetada.
 */
const str = (v: any, max = 200) => String(v ?? '').trim().slice(0, max);
const view = (a: any) => ({ ...a, status: effectiveStatus(a) });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const actor = await getAuthenticatedUser(base44);
    if (!actor) return json({ error: 'Unauthorized' }, 401);
    const body = await readJson(req);
    const input = body?.args && typeof body.args === 'object' ? { ...body.args, ...body } : body;
    const op = str(input.op, 20);
    const db = base44.asServiceRole.entities;
    const admin = isPlatformAdmin(actor);
    const audit = (action: string, a: any, details: string) => logAudit(base44, action, {
      user_email: actor.email, customer_id: a.customer_id, entity_type: 'UserCustomerAssignment', entity_id: a.id || '', details,
    });
    const targetUser = async (a: any) => {
      if (a.user_id) return db.User.get(a.user_id).catch(() => null);
      const found = await db.User.filter({ email: a.user_email }).catch(() => []);
      return found?.[0] || null;
    };
    const resync = async (a: any) => { const u = await targetUser(a); if (u) await syncUserScope(base44, u); };
    const load = async () => {
      const a = await db.UserCustomerAssignment.get(str(input.id, 64)).catch(() => null);
      if (!a) throw Object.assign(new Error('Acesso inexistente'), { status: 404 });
      return a;
    };

    if (op === 'me') {
      return json({ scope: await syncUserScope(base44, actor) });
    }

    if (op === 'list') {
      const customerId = str(input.customer_id, 64);
      let rows: any[] = [];
      if (admin) {
        rows = await db.UserCustomerAssignment.filter(customerId ? { customer_id: customerId } : {}, '-created_date', 500);
      } else if (customerId && isDecider(actor, customerId)) {
        rows = await db.UserCustomerAssignment.filter({ customer_id: customerId }, '-created_date', 500);
      } else {
        rows = await db.UserCustomerAssignment.filter({ user_email: String(actor.email || '').toLowerCase() }, '-created_date', 500);
      }
      return json({ assignments: (rows || []).map(view) });
    }

    if (op === 'request' || op === 'grant') {
      const payload = {
        customer_id: str(input.customer_id, 64),
        user_email: str(input.user_email, 200).toLowerCase(),
        assignment_type: str(input.assignment_type, 20) || 'delegation',
        access_level: str(input.access_level, 20) || 'viewer',
        reason: str(input.reason, 1000),
        expires_at: str(input.expires_at, 40),
      };
      if (op === 'request' && !admin) return json({ error: 'Só a plataforma pede acessos; o cliente concede-os.' }, 403);
      if (op === 'grant' && !isDecider(actor, payload.customer_id)) return json({ error: 'Só a administração deste cliente pode conceder acesso.' }, 403);
      const invalid = validateRequest(payload);
      if (invalid) return json({ error: invalid }, 400);
      const customer = await db.Customer.get(payload.customer_id).catch(() => null);
      if (!customer) return json({ error: 'Cliente inexistente' }, 404);
      const user = (await db.User.filter({ email: payload.user_email }).catch(() => []))?.[0];
      if (!user) return json({ error: 'Utilizador inexistente: crie primeiro a conta com o papel de consultor.' }, 404);
      if (user.role !== 'consultant') return json({ error: 'O acesso delegado é só para contas com o papel de consultor.' }, 400);
      if (op === 'grant' && decisionRefusal(actor, { ...payload, user_id: user.id })) return json({ error: decisionRefusal(actor, { ...payload, user_id: user.id }) }, 403);
      const open = await db.UserCustomerAssignment.filter({ customer_id: payload.customer_id, user_email: payload.user_email }).catch(() => []);
      if ((open || []).some((a: any) => ['requested', 'active'].includes(effectiveStatus(a)))) {
        return json({ error: 'Já existe um pedido ou um acesso ativo desta pessoa a este cliente. Revogue-o primeiro.' }, 409);
      }
      const now = new Date().toISOString();
      const row = await db.UserCustomerAssignment.create({
        ...payload,
        customer_name: customer.name || '',
        user_id: user.id,
        status: op === 'grant' ? 'active' : 'requested',
        requested_by: actor.email,
        ...(op === 'grant' ? { decided_by: actor.email, decided_at: now } : {}),
      });
      const what = `${payload.access_level} de ${payload.user_email} a «${customer.name}» até ${payload.expires_at.slice(0, 10)}. Justificação: ${payload.reason}`;
      await audit(op === 'grant' ? 'access_granted' : 'access_requested', row, op === 'grant' ? `Acesso concedido: ${what}` : `Acesso pedido: ${what}`);
      if (op === 'grant') await syncUserScope(base44, user);
      else {
        for (const ca of await customerAdmins(base44, payload.customer_id)) {
          await db.Notification.create({
            user_email: ca.email, customer_id: payload.customer_id, type: 'general', is_read: false,
            title: 'Pedido de acesso aos dados da organização',
            message: `${actor.email} pede acesso ${payload.access_level} para ${payload.user_email} até ${payload.expires_at.slice(0, 10)}. Decida em Definições → Acessos.`,
            link: '/settings?tab=access', entity_type: 'UserCustomerAssignment', entity_id: row.id,
          }).catch(() => null);
        }
      }
      return json({ assignment: view(row) });
    }

    if (op === 'approve' || op === 'reject') {
      const a = await load();
      const refusal = decisionRefusal(actor, a);
      if (refusal) return json({ error: refusal }, 403);
      if (effectiveStatus(a) !== 'requested') return json({ error: `Este pedido já não está pendente (${effectiveStatus(a)}).` }, 409);
      const note = str(input.note, 500);
      const updated = await db.UserCustomerAssignment.update(a.id, {
        status: op === 'approve' ? 'active' : 'rejected', decided_by: actor.email, decided_at: new Date().toISOString(), decision_note: note,
      });
      await audit(op === 'approve' ? 'access_approved' : 'access_rejected', a, `${op === 'approve' ? 'Acesso aprovado' : 'Acesso rejeitado'}: ${a.access_level} de ${a.user_email} até ${String(a.expires_at).slice(0, 10)}.${note ? ` Nota: ${note}` : ''}`);
      await resync(a);
      return json({ assignment: view({ ...a, ...updated }) });
    }

    if (op === 'revoke') {
      const a = await load();
      const refusal = revokeRefusal(actor, a);
      if (refusal) return json({ error: refusal }, 403);
      if (!['requested', 'active'].includes(effectiveStatus(a))) return json({ error: `Este acesso já não está ativo (${effectiveStatus(a)}).` }, 409);
      const note = str(input.note, 500);
      const updated = await db.UserCustomerAssignment.update(a.id, { status: 'revoked', revoked_by: actor.email, revoked_at: new Date().toISOString(), decision_note: note });
      await audit('access_revoked', a, `Acesso revogado: ${a.access_level} de ${a.user_email}.${note ? ` Nota: ${note}` : ''}`);
      await resync(a);
      return json({ assignment: view({ ...a, ...updated }) });
    }

    if (op === 'sync') {
      if (!admin) return json({ error: 'Admin access required' }, 403);
      const rows = await db.UserCustomerAssignment.list('-created_date', 5000).catch(() => []);
      const emails = new Set((rows || []).map((a: any) => String(a.user_email || '').toLowerCase()).filter(Boolean));
      // Também quem tem listas no perfil sem atribuições (ex.: atribuições removidas fora da função).
      const consultants = await db.User.filter({ role: 'consultant' }).catch(() => []);
      for (const u of consultants || []) emails.add(String(u.email || '').toLowerCase());
      let synced = 0;
      for (const email of emails) {
        const user = (await db.User.filter({ email }).catch(() => []))?.[0];
        if (user) { await syncUserScope(base44, user); synced += 1; }
      }
      return json({ synced });
    }

    return json({ error: 'Operação desconhecida' }, 400);
  } catch (error) {
    return json({ error: error?.message || 'Erro no acesso delegado' }, error?.status || 500);
  }
});
