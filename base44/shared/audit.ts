/**
 * Best-effort audit logging.
 *
 * Audit trail writes must never break the operation they record — a failure
 * here is logged to the function console and swallowed.
 */
export async function logAudit(base44, action, fields = {}) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({ action, ...fields });
  } catch (e) {
    console.error(`AuditLog write failed (${action}):`, e?.message || e);
  }
}

/** Standard audit entry for dispatched platform e-mails. */
export function logEmailSent(base44, { user_email, entity_type, entity_id, customer_id, details }) {
  return logAudit(base44, 'email_sent', { user_email, entity_type, entity_id, customer_id, details });
}
