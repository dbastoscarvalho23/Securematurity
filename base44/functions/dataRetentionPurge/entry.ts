import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { getAutomationSecret } from "../../shared/automationSecret.ts";
import { normalizeRole } from "../../shared/accessUtils.ts";
import { withWorkflowRun } from "../../shared/workflowRuns.ts";

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
 * FB4 — the retention policy stored in `RetentionPolicy` (per entity and tenant,
 * configured at /platform-operations) is authoritative: when an active policy
 * applies to a record, the window counts from the record's entry date and the
 * action is the policy's; without a policy the previous record-level rule stands.
 * `managePlatformOperations.simulate` uses exactly this rule, so the dry run and
 * the real run cannot drift.
 *
 * Each action is logged to AuditLog for traceability (GDPR Art. 30(1)(f), Art. 17).
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Active policy that applies to a record — the tenant's policy beats the global one. */
function applicablePolicy(policies: any[], entityName: string, customerId: string) {
  const active = policies.filter((p) => p.entity_name === entityName && p.is_active !== false);
  return (
    active.find((p) => p.customer_id && p.customer_id === customerId) ||
    active.find((p) => !p.customer_id) ||
    null
  );
}

/** Window of a policy, counted from the record's entry date (same rule as the simulation). */
function expiredByPolicy(record: any, policy: any, nowMs: number) {
  const days = Number(policy.retention_days);
  if (!Number.isFinite(days) || days <= 0) return false;
  const date = record?.created_date || record?.updated_date;
  if (!date) return false;
  return new Date(date).getTime() <= nowMs - days * DAY_MS;
}

Deno.serve((req) => withWorkflowRun('dataRetentionPurge', 'scheduled', req, async () => {
  const base44 = createClientFromRequest(req);
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const results = { executed_at: now, purged: 0, archived: 0, errors: [] };

  // Authorization: scheduled automation passes the shared secret (body.args.automation_secret
  // or x-automation-secret header); manual admin triggers authenticate via base44.auth.me().
  // Anonymous external callers are rejected before any destructive service-role operation.
  const automationSecret = await getAutomationSecret(req);
  let authorized = !!automationSecret;
  if (!authorized) {
    try {
      const user = await base44.auth.me();
      authorized = normalizeRole(user?.role) === 'master_admin';
    } catch {
      authorized = false;
    }
  }
  if (!authorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const policies = await base44.asServiceRole.entities.RetentionPolicy.list();

    // ── 1. DataProcessingActivity retention ──────────────────────────────
    const activities = await base44.asServiceRole.entities.DataProcessingActivity.list();
    const expiredActivities = activities.filter((a) => {
      const policy = applicablePolicy(policies, 'DataProcessingActivity', a.customer_id);
      if (policy) return expiredByPolicy(a, policy, nowMs);
      return a.retention_expiry_date && new Date(a.retention_expiry_date) <= new Date(now) && a.status !== 'inactive';
    });

    for (const activity of expiredActivities) {
      try {
        const policy = applicablePolicy(policies, 'DataProcessingActivity', activity.customer_id);
        const purge = policy ? policy.action === 'purge' : activity.retention_action === 'delete';
        const why = policy
          ? `policy ${policy.retention_days} days from ${activity.created_date}`
          : `expiry: ${activity.retention_expiry_date}`;

        if (purge) {
          await base44.asServiceRole.entities.DataProcessingActivity.delete(activity.id);
          results.purged++;
          await base44.asServiceRole.entities.AuditLog.create({
            action: 'data_purged',
            user_email: 'system',
            entity_type: 'DataProcessingActivity',
            entity_id: activity.id,
            customer_id: activity.customer_id,
            details: `Retention purge: activity "${activity.activity_name}" deleted (${why})`,
          });
        } else {
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
            details: `Retention archive: activity "${activity.activity_name}" archived/anonymized (${why})`,
          });
        }
      } catch (e) {
        results.errors.push(`DataProcessingActivity ${activity.id}: ${e.message}`);
      }
    }

    // ── 2. DataSubjectRequest retention purge ────────────────────────────
    const dsrs = await base44.asServiceRole.entities.DataSubjectRequest.list();
    const expiredDsrs = dsrs.filter((d) => {
      const policy = applicablePolicy(policies, 'DataSubjectRequest', d.customer_id);
      if (policy) return expiredByPolicy(d, policy, nowMs);
      return d.retention_purge_date && new Date(d.retention_purge_date) <= new Date(now) && d.status === 'completed';
    });

    for (const dsr of expiredDsrs) {
      try {
        const policy = applicablePolicy(policies, 'DataSubjectRequest', dsr.customer_id);
        // A DSR only has erasure: archiving is not representable in the entity's
        // status enum, so an archive/anonymise policy would delete the wrong thing.
        // Keep the record and report it instead — retaining data is the safe side.
        if (policy && policy.action !== 'purge') {
          results.errors.push(`DataSubjectRequest ${dsr.id}: policy action "${policy.action}" is not supported for this entity`);
          continue;
        }

        await base44.asServiceRole.entities.DataSubjectRequest.delete(dsr.id);
        results.purged++;
        await base44.asServiceRole.entities.AuditLog.create({
          action: 'data_purged',
          user_email: 'system',
          entity_type: 'DataSubjectRequest',
          entity_id: dsr.id,
          customer_id: dsr.customer_id,
          details: `Retention purge: DSR ${dsr.request_id} for ${dsr.data_subject_name} deleted (${policy ? `policy ${policy.retention_days} days from ${dsr.created_date}` : `purge date: ${dsr.retention_purge_date}`})`,
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
}));
