import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isStaffRole, isPlatformAdmin, userCustomerId } from '../../shared/http.ts';
import { sendMail } from '../../shared/mail.ts';
import { logEmailSent } from '../../shared/audit.ts';
import { inviteEmail, passwordResetEmail, accessApprovedEmail } from '../../shared/emailTemplates.ts';

/**
 * accountEmails — emails de acesso à plataforma, no tema da AnkoraOne e em PT-PT.
 *
 * Ações:
 *  - invite           { email, role, customer_id?, customer_name?, action_url? }
 *  - password_reset   { email, action_url? }
 *  - access_approved  { email, role, customer_id?, customer_name?, action_url? }
 *
 * O link de ação é enviado pelo cliente (`action_url`); sem ele usa-se o endereço
 * publicado da plataforma, para os envios automáticos.
 *
 * Acesso: administradores da plataforma e administradores de cliente (apenas
 * utilizadores do próprio cliente). Todos os envios ficam registados na auditoria.
 */

const PUBLIC_APP_URL = 'https://securematurity-80cb9ed8.base44.app';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACTIONS = ['invite', 'password_reset', 'access_approved'];

/** Link de ação: o do cliente, validado, ou o endereço publicado da plataforma. */
function actionUrl(raw, fallbackPath) {
  const value = String(raw || '').trim();
  if (/^https:\/\/[^\s]+$/i.test(value)) return value;
  return `${PUBLIC_APP_URL}${fallbackPath}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (!isStaffRole(user)) return json({ error: 'Forbidden' }, 403);

    const body = await readJson(req);
    const action = String(body.action || '');
    if (!ACTIONS.includes(action)) return json({ error: 'Ação desconhecida' }, 400);

    const email = String(body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return json({ error: 'Email inválido' }, 400);

    const admin = isPlatformAdmin(user);
    const ownCustomerId = userCustomerId(user);
    const customerId = body.customer_id ? String(body.customer_id) : null;
    const customerName = body.customer_name ? String(body.customer_name) : null;

    if (!admin) {
      // Administrador de cliente: só comunica com utilizadores do próprio cliente.
      if (!ownCustomerId) return json({ error: 'Forbidden' }, 403);
      if (customerId && customerId !== ownCustomerId) return json({ error: 'Forbidden' }, 403);
      const target = await base44.asServiceRole.entities.User.filter({ email }).catch(() => []);
      if (!target?.length || userCustomerId(target[0]) !== ownCustomerId) {
        return json({ error: 'Forbidden' }, 403);
      }
    }

    let mail;
    let details;
    if (action === 'invite') {
      mail = inviteEmail({
        email,
        role: body.role,
        customerName,
        invitedBy: body.invited_by || user.email,
        actionUrl: actionUrl(body.action_url, `/login?email=${encodeURIComponent(email)}`),
        expiresInHours: body.expires_in_hours,
      });
      details = `Convite de acesso enviado a ${email}`;
    } else if (action === 'password_reset') {
      mail = passwordResetEmail({
        email,
        actionUrl: actionUrl(body.action_url, `/forgot-password?email=${encodeURIComponent(email)}`),
        expiresInMinutes: body.expires_in_minutes,
        requestedAt: body.requested_at,
      });
      details = `Instruções de redefinição de palavra-passe enviadas a ${email}`;
    } else {
      mail = accessApprovedEmail({
        email,
        role: body.role,
        customerName,
        approvedBy: body.approved_by || user.email,
        approvedAt: body.approved_at || new Date().toISOString().slice(0, 10),
        actionUrl: actionUrl(body.action_url, '/'),
      });
      details = `Aviso de acesso aprovado enviado a ${email}`;
    }

    const result = await sendMail(base44, { to: email, subject: mail.subject, heading: mail.heading, body: mail.html });
    await logEmailSent(base44, {
      user_email: user.email,
      entity_type: 'User',
      customer_id: customerId || ownCustomerId || undefined,
      details: `${details} (${result.sent}/1${result.fallback ? ', com recurso ao Base44' : ''})`,
    });
    return json({ ...result, subject: mail.subject });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
