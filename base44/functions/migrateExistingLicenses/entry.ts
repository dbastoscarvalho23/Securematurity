import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { writeLicenseAuditLog } from "../../shared/licenseGuard.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const customers = await base44.asServiceRole.entities.Customer.list("name", 500);
    const migrated: string[] = [];
    const skipped: string[] = [];
    const rollbackData: { customer_id: string; old_seat_limit: number; old_frameworks: string[] }[] = [];

    for (const customer of customers) {
      // Idempotency: skip if TenantSubscription already exists for this customer
      const existing = await base44.asServiceRole.entities.TenantSubscription.filter({
        customer_id: customer.id,
      });
      if (existing.length > 0) {
        skipped.push(customer.id);
        continue;
      }

      // Snapshot old values for rollback
      rollbackData.push({
        customer_id: customer.id,
        old_seat_limit: customer.user_seat_limit || 5,
        old_frameworks: customer.allowed_frameworks || [],
      });

      // Map old license to nearest tier
      const seatLimit = customer.user_seat_limit || 5;
      const addonCount = customer.user_seat_addon_count || 0;
      const totalSeats = seatLimit + addonCount;
      const frameworks = customer.allowed_frameworks || [];

      let tierCode = "core";
      // Heuristic: more frameworks/seats → higher tier
      if (frameworks.length >= 5 || totalSeats > 20) {
        tierCode = "advanced";
      } else if (frameworks.length >= 3 || totalSeats > 10) {
        tierCode = "professional";
      }

      // Create TenantSubscription
      const now = new Date();
      const sub = await base44.asServiceRole.entities.TenantSubscription.create({
        customer_id: customer.id,
        customer_name: customer.name,
        tier_code: tierCode,
        status: "active",
        started_date: now.toISOString().split("T")[0],
        seat_limit: totalSeats,
        seats_used: 0,
        monthly_usage_count: 0,
        monthly_usage_reset_date: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split("T")[0],
        notes: `Migrated from old license (seats: ${totalSeats}, frameworks: ${frameworks.join(", ")})`,
      });

      // Create TenantModule records for tier modules
      const tierModules: Record<string, string[]> = {
        core: ["nis2_journey", "assessments_action_plan", "documents_evidence", "reporting_audit_prep"],
        professional: ["nis2_journey", "assessments_action_plan", "documents_evidence", "reporting_audit_prep", "risk_management", "incident_management"],
        advanced: ["nis2_journey", "assessments_action_plan", "documents_evidence", "reporting_audit_prep", "risk_management", "incident_management", "supplier_management", "knowledge_guidance", "privacy"],
        partner: ["nis2_journey", "assessments_action_plan", "documents_evidence", "reporting_audit_prep", "risk_management", "incident_management", "supplier_management", "knowledge_guidance", "privacy"],
      };

      for (const moduleCode of tierModules[tierCode] || tierModules.core) {
        await base44.asServiceRole.entities.TenantModule.create({
          customer_id: customer.id,
          module_code: moduleCode,
          status: "active",
          activated_at: now.toISOString(),
        });
      }

      // Create TenantStandard records for existing frameworks
      for (const framework of frameworks) {
        await base44.asServiceRole.entities.TenantStandard.create({
          customer_id: customer.id,
          standard_code: framework,
          status: "active",
          activated_at: now.toISOString(),
        });
      }

      // Audit
      await writeLicenseAuditLog(
        base44,
        "license_migrated",
        customer.id,
        `Migrated to tier ${tierCode} (seats: ${totalSeats}, frameworks: ${frameworks.join(", ") || "none"})`,
      );

      migrated.push(customer.id);
    }

    return Response.json({
      success: true,
      migrated_count: migrated.length,
      skipped_count: skipped.length,
      migrated,
      skipped,
      rollback_data: rollbackData,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
