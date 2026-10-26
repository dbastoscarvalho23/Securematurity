import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isPlatformAdmin, userCustomerId } from '../../shared/http.ts';
import { sendMail, mailConfig } from '../../shared/mail.ts';
import { logEmailSent } from '../../shared/audit.ts';
import { escapeHtml as esc } from '../../shared/escapeHtml.ts';

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

/** Extrai o conteúdo de <body> quando a interface envia um documento HTML completo. */
function bodyOf(html: string): string {
  const s = String(html || '');
  const m = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return (m ? m[1] : s).replace(/<script[\s\S]*?<\/script>/gi, '');
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

    const result = await sendMail(base44, { to, subject, body: html, heading: body.heading ? String(body.heading) : undefined });
    await logEmailSent(base44, {
      user_email: user.email,
      entity_type: String(body.entity_type || 'Email'),
      entity_id: body.entity_id ? String(body.entity_id) : undefined,
      customer_id: customerId || undefined,
      details: `«${subject.slice(0, 120)}» enviado a ${to.join(', ').slice(0, 300)} (${result.sent}/${to.length})`,
    });
    return json(result);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
