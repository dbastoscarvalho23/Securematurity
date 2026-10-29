import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isPlatformAdmin, userCustomerId } from '../../shared/http.ts';
import { sendMail, mailConfig } from '../../shared/mail.ts';
import { logEmailSent } from '../../shared/audit.ts';
import { escapeHtml as esc } from '../../shared/escapeHtml.ts';
import { sanitizeHtml } from '../../shared/sanitizeHtml.ts';

// Envio de email pedido pela interface. O browser deixa de chamar Core.SendEmail diretamente:
// o envio passa pelo remetente da AnkoraOne (shared/mail.ts), fica no registo de auditoria e
// só utilizadores autenticados e associados a um cliente (ou administradores) podem enviar.
//
// Ações:
//  - seat_request { customer_id, used, limit } → administradores da plataforma (destinatários lidos no servidor)
//  - send { to[], subject, html, customer_id?, entity_type?, entity_id?, heading? } → máx. 50 destinatários
//  - config (admin) → remetente e fornecedor em uso, sem segredos
//  - test (admin) { to? } → email de teste para o próprio administrador (ou para `to`)

const MAX_RECIPIENTS = 50;
// Utilizadores de cliente: máximo de envios por hora (cada envio pode ter até 50 destinatários). Folgado para
// convocatórias e questionários; trava o uso da conta para envios em massa.
const CUSTOMER_SENDS_PER_HOUR = 30;

async function customerSendsLastHour(base44, email) {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const rows = await base44.asServiceRole.entities.AuditLog.filter(
    { user_email: email, action: 'email_sent', created_date: { $gte: since } }, '-created_date', CUSTOMER_SENDS_PER_HOUR + 1,
  ).catch(() => []);
  return rows?.length || 0;
}

/** Extrai o conteúdo de <body> quando a interface envia um documento HTML completo. */
function bodyOf(html: string): string {
  const s = String(html || '');
  const m = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return (m ? m[1] : s).replace(/<script[\s\S]*?<\/script>/gi, '');
}

/**
 * Destinatários autorizados a um utilizador de cliente: apenas endereços que já constam nos registos desse cliente —
 * colegas, administradores da plataforma, contactos do próprio cliente, fornecedores, colaboradores e questionários.
 * Sem isto, qualquer pessoa com conta podia lançar mensagens a estranhos em nome da AnkoraOne (phishing e queima do
 * domínio); com isto os envios reais (questionários a fornecedores, convocatórias, avisos internos) continuam a passar.
 */
async function allowedRecipients(base44, customerId) {
  const db = base44.asServiceRole.entities;
  const [users, customer, suppliers, enrollments, questionnaires] = await Promise.all([
    db.User.list().catch(() => []),
    db.Customer.get(customerId).catch(() => null),
    db.Supplier.filter({ customer_id: customerId }, '-created_date', 500).catch(() => []),
    db.TrainingEnrollment.filter({ customer_id: customerId }, '-created_date', 1000).catch(() => []),
    db.SupplierQuestionnaire.filter({ customer_id: customerId }, '-created_date', 500).catch(() => []),
  ]);
  const out = new Set();
  const add = (value) => {
    const email = String(value || '').trim().toLowerCase();
    if (email) out.add(email);
  };
  // Colegas do mesmo cliente e administradores da plataforma (avisos internos).
  for (const u of users) {
    if (u.role === 'admin' || userCustomerId(u) === customerId) add(u.email);
  }
  if (customer) {
    add(customer.contact_email);
    add(customer.permanent_contact_email);
    add(customer.cybersecurity_manager_email);
  }
  for (const s of suppliers) add(s.contact_email);
  for (const e of enrollments) add(e.user_email);
  for (const q of questionnaires) add(q.supplier_email);
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const admin = isPlatformAdmin(user);
    const own = userCustomerId(user);
    const body = await readJson(req);
    const action = String(body.action || 'send');

    if (action === 'config') {
      if (!admin) return json({ error: 'Forbidden' }, 403);
      const c = mailConfig();
      return json({ provider: c.provider, from: c.from, from_name: c.fromName, reply_to: c.replyTo });
    }

    if (action === 'test') {
      if (!admin) return json({ error: 'Forbidden' }, 403);
      const c = mailConfig();
      const to = String(body.to || user.email);
      const result = await sendMail(base44, {
        to,
        subject: 'Teste de envio — AnkoraOne',
        heading: 'Teste de envio',
        body: `Este é um email de teste da plataforma AnkoraOne.\n\nFornecedor: ${c.provider}\nRemetente configurado: ${c.from}\nResposta para: ${c.replyTo}\n\nSe o recebeu, o envio está a funcionar.`,
      });
      await logEmailSent(base44, { user_email: user.email, entity_type: 'Email', details: `Teste de envio para ${to} (${result.provider}${result.fallback ? ', com recurso ao Base44' : ''})` });
      return json(result);
    }

    if (action === 'seat_request') {
      const customerId = String(body.customer_id || '');
      if (!customerId || (!admin && own !== customerId)) return json({ error: 'Forbidden' }, 403);
      const customer = await base44.asServiceRole.entities.Customer.get(customerId).catch(() => null);
      if (!customer) return json({ error: 'Cliente não encontrado' }, 404);
      const admins = (await base44.asServiceRole.entities.User.filter({ role: 'admin' })).map((u: any) => u.email).filter(Boolean);
      if (!admins.length) return json({ error: 'Não há administradores para notificar' }, 422);
      const used = Number(body.used) || 0, limit = Number(body.limit) || 0;
      const result = await sendMail(base44, {
        to: admins,
        subject: `[Pedido de licenças] ${customer.name} precisa de mais licenças de utilizador`,
        heading: 'Pedido de licenças',
        body: `<p>O cliente <strong>${esc(customer.name)}</strong> atingiu o limite de licenças de utilizador.</p>
<p>Utilização atual: <strong>${used} de ${limit}</strong> licenças.</p>
<p>O cliente pede licenças adicionais para registar mais utilizadores. Reveja e ajuste o limite em Administração → Licenças.</p>
<p style="color:#64748b;">Pedido feito por ${esc(user.email)}.</p>`,
      });
      await logEmailSent(base44, { user_email: user.email, entity_type: 'Customer', entity_id: customerId, customer_id: customerId, details: `Pedido de licenças enviado a ${result.sent} administrador(es)` });
      return json(result);
    }

    if (action !== 'send') return json({ error: 'Ação desconhecida' }, 400);
    if (!admin && !own) return json({ error: 'Forbidden' }, 403);
    const to = (Array.isArray(body.to) ? body.to : [body.to]).map((x: unknown) => String(x || '').trim()).filter(Boolean);
    if (!to.length) return json({ error: 'Sem destinatários' }, 400);
    if (to.length > MAX_RECIPIENTS) return json({ error: `Máximo de ${MAX_RECIPIENTS} destinatários por envio` }, 400);
    const subject = String(body.subject || '').trim();
    const html = bodyOf(String(body.html || body.body || ''));
    if (!subject || !html.trim()) return json({ error: 'Assunto e mensagem são obrigatórios' }, 400);
    // Utilizadores de cliente só registam envios no próprio cliente.
    const customerId = admin ? (body.customer_id || null) : own;

    // Utilizadores de cliente: os destinatários têm de constar nos contactos do cliente.
    if (!admin) {
      const allowed = await allowedRecipients(base44, own);
      const refused = to.filter((email: string) => !allowed.has(email.toLowerCase()));
      if (refused.length) {
        await logEmailSent(base44, {
          user_email: user.email,
          entity_type: 'Email',
          customer_id: own,
          details: `Envio recusado: destinatários fora dos contactos do cliente (${refused.slice(0, 5).join(', ')})`,
        });
        return json({
          error: `Destinatário não autorizado: ${refused.join(', ')}. Só é possível enviar para utilizadores e contactos registados no cliente (colegas, contactos do cliente, fornecedores ou colaboradores).`,
        }, 403);
      }
    }

    // Utilizadores de cliente: HTML limpo (sem scripts, imagens, formulários nem ligações não https), limite por hora
    // e rodapé com o autor, para que a mensagem não possa passar por um aviso oficial da AnkoraOne.
    let finalHtml = html;
    let finalSubject = subject.slice(0, 200);
    if (!admin) {
      if ((await customerSendsLastHour(base44, user.email)) >= CUSTOMER_SENDS_PER_HOUR) {
        return json({ error: `Atingiu o limite de ${CUSTOMER_SENDS_PER_HOUR} envios por hora. Tente mais tarde.` }, 429);
      }
      const customer = await base44.asServiceRole.entities.Customer.get(own).catch(() => null);
      finalHtml = `${sanitizeHtml(html)}<hr><p style="color:#64748b;font-size:12px;">Mensagem enviada por ${esc(user.email)}${customer?.name ? ` (${esc(customer.name)})` : ''} através da plataforma AnkoraOne.</p>`;
      finalSubject = finalSubject.replace(/[\r\n]+/g, ' ');
    }
    const result = await sendMail(base44, { to, subject: finalSubject, body: finalHtml, heading: body.heading ? String(body.heading).slice(0, 120) : undefined });
    await logEmailSent(base44, {
      user_email: user.email,
      entity_type: String(body.entity_type || 'Email'),
      entity_id: body.entity_id ? String(body.entity_id) : undefined,
      customer_id: customerId || undefined,
      details: `«${finalSubject.slice(0, 120)}» enviado a ${to.join(', ').slice(0, 300)} (${result.sent}/${to.length})`,
    });
    return json(result);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});