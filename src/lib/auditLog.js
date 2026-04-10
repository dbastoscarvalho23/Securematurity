import { base44 } from '@/api/base44Client';

export async function writeAuditLog({ action, entity_type, entity_id, details }) {
  try {
    const user = await base44.auth.me();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await base44.entities.AuditLog.create({
      action,
      entity_type,
      entity_id,
      details,
      user_email: user?.email || 'unknown',
      timezone,
    });
  } catch (e) {
    // silently fail — audit logging should never break the main flow
    console.warn('Audit log write failed:', e);
  }
}