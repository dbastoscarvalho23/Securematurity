import { base44 } from '@/api/base44Client';

export async function writeAuditLog({ action, entity_type, entity_id, details, user_email }) {
  try {
    const email = user_email || (await base44.auth.me())?.email || 'unknown';
    await base44.entities.AuditLog.create({
      action,
      entity_type,
      entity_id,
      details,
      user_email: email,
    });
  } catch (e) {
    // silently fail — audit logging should never break the main flow
    console.warn('Audit log write failed:', e);
  }
}