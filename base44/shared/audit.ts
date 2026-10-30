import { appendAuditEntry } from './auditChain.ts';

/**
 * Registo na trilha de auditoria, pelo escritor único encadeado (auditChain.ts).
 *
 * As escritas na trilha nunca interrompem a operação que registam: uma falha é escrita na consola da função e
 * engolida. `fields.user_email` vem sempre do servidor (o utilizador da sessão resolvida pela função, ou 'system'
 * numa automação), por isso a autoria fica atestada quando há um utilizador.
 */
export async function logAudit(base44, action, fields: any = {}) {
  const email = String(fields?.user_email || '');
  const attested = Boolean(email) && email !== 'system';
  try {
    await appendAuditEntry(base44, {
      ...fields,
      action,
      user_email: email || 'system',
      actor_attested: attested,
      origin: attested ? 'session' : 'automation',
    });
  } catch (e) {
    console.error(`AuditLog write failed (${action}):`, e?.message || e);
  }
}

/** Standard audit entry for dispatched platform e-mails. */
export function logEmailSent(base44, { user_email, entity_type, entity_id, customer_id, details }) {
  return logAudit(base44, 'email_sent', { user_email, entity_type, entity_id, customer_id, details });
}
