import { base44 } from '@/api/base44Client';

/**
 * Regista uma entrada na auditoria. As regras de acesso exigem `customer_id` igual ao do utilizador para quem não é
 * administrador da plataforma; por isso o cliente é sempre preenchido (o indicado, ou o do próprio utilizador).
 */
export async function writeAuditLog({ action, entity_type, entity_id, details, user_email, customer_id }) {
  try {
    const me = await base44.auth.me().catch(() => null);
    const ownCustomer = me?.customer_id || me?.data?.customer_id || null;
    const isAdmin = me?.role === 'admin';
    await base44.entities.AuditLog.create({
      action,
      entity_type,
      entity_id,
      details,
      user_email: user_email || me?.email || 'unknown',
      ...((isAdmin ? customer_id || ownCustomer : ownCustomer) ? { customer_id: isAdmin ? customer_id || ownCustomer : ownCustomer } : {}),
    });
  } catch (e) {
    // A auditoria nunca deve interromper a operação principal.
    console.warn('Audit log write failed:', e);
  }
}
