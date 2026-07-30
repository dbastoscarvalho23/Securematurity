import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { getAutomationSecret } from "../../shared/automationSecret.ts";

/**
 * Scheduled data retention automation.
 *
 * Scans entities for records past their retention expiry and performs
 * the configured retention action (archive / anonymize / delete).
 *
 * Currently covers:
 *  - DataProcessingActivity: purges/archives activities past retention_expiry_date
 *  - DataSubjectRequest: purges completed DSR records past retention_purge_date
 *
 * Each action is logged to AuditLog for traceability (GDPR Art. 30(1)(f), Art. 17).
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const now = new Date().toISOString();
  const results = { executed_at: now, purged: 0, archived: 0, errors: [] };

  // Authorization: scheduled automation passes the shared secret (body.args.automation_secret
  // or x-automation-secret header); manual admin triggers authenticate via base44.auth.me().
  // Anonymous external callers are rejected before any destructive service-role operation.
  const automationSecret = await getAutomationSecret(req);
  let authorized = !!automationSecret;
  if (!authorized) {
    try {
      const user = await base44.auth.me();
      authorized = user?.role === 'admin';
    } catch {
      authorized = false;
    }
  }
  if (!authorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    // ── 1. DataProcessingActivity retention ──────────────────────────────
    const activities = await base44.asServiceRole.entities.DataProcessingActivity.list();
    const expiredActivities = activities.filter(
      (a) => a.retention_expiry_date && new Date(a.retention_expiry_date) <= new Date(now) && a.status !== 'inactive'
    );

    for (const activity of expiredActivities) {
      try {
        if (activity.retention_action === 'delete') {
          await base44.asServiceRole.entities.DataProcessingActivity.delete(activity.id);
          results.purged++;
          await base44.asServiceRole.entities.AuditLog.create({
            action: 'data_purged',
            user_email: 'system',
            entity_type: 'DataProcessingActivity',
            entity_id: activity.id,
            customer_id: activity.customer_id,
            details: `Retention purge: activity "${activity.activity_name}" deleted (expiry: ${activity.retention_expiry_date})`,
          });
        } else if (activity.retention_action === 'archive' || activity.retention_action === 'anonymize') {
          await base44.asServiceRole.entities.DataProcessingActivity.update(activity.id, {
            status: 'inactive',
            security_measures: `[Archived ${now}] ${activity.security_measures || ''}`,
          });
          results.archived++;
          await base44.asServiceRole.entities.AuditLog.create({
            action: 'data_archived',
            user_email: 'system',
            entity_type: 'DataProcessingActivity',
            entity_id: activity.id,
            customer_id: activity.customer_id,
            details: `Retention archive: activity "${activity.activity_name}" archived/anonymized (expiry: ${activity.retention_expiry_date})`,
          });
        }
      } catch (e) {
        results.errors.push(`DataProcessingActivity ${activity.id}: ${e.message}`);
      }
    }

    // ── 2. DataSubjectRequest retention purge ────────────────────────────
    const dsrs = await base44.asServiceRole.entities.DataSubjectRequest.list();
    const expiredDsrs = dsrs.filter(
      (d) => d.retention_purge_date && new Date(d.retention_purge_date) <= new Date(now) && d.status === 'completed'
    );

    for (const dsr of expiredDsrs) {
      try {
        await base44.asServiceRole.entities.DataSubjectRequest.delete(dsr.id);
        results.purged++;
        await base44.asServiceRole.entities.AuditLog.create({
          action: 'data_purged',
          user_email: 'system',
          entity_type: 'DataSubjectRequest',
          entity_id: dsr.id,
          customer_id: dsr.customer_id,
          details: `Retention purge: DSR ${dsr.request_id} for ${dsr.data_subject_name} deleted (purge date: ${dsr.retention_purge_date})`,
        });
      } catch (e) {
        results.errors.push(`DataSubjectRequest ${dsr.id}: ${e.message}`);
      }
    }

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'retention_purge_executed',
      user_email: 'system',
      entity_type: 'System',
      details: `Retention purge run: ${results.purged} purged, ${results.archived} archived, ${results.errors.length} errors`,
    });
  } catch (e) {
    results.errors.push(`Fatal: ${e.message}`);
  }

  return Response.json(results);
});