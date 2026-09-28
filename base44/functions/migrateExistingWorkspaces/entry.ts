import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { writeLicenseAuditLog } from "../../shared/licenseGuard.ts";

/**
 * Idempotent migration: creates a root Workspace for every existing Customer
 * that doesn't have one yet, and links the Customer + its Users to that workspace.
 *
 * Admin-only. Safe to run multiple times.
 *
 * Response: { success, migrated_count, skipped_count, migrated, skipped }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const customers = await base44.asServiceRole.entities.Customer.list("name", 500);
    const migrated: string[] = [];
    const skipped: string[] = [];

    for (const customer of customers) {
      // Idempotency: skip if customer already has a workspace_id
      if (customer.workspace_id) {
        skipped.push(customer.id);
        continue;
      }

      // Check if a workspace already exists for this customer
      const existingWs = await base44.asServiceRole.entities.Workspace.filter({
        customer_id: customer.id,
      });
      if (existingWs.length > 0) {
        // Link the customer to the existing workspace
        await base44.asServiceRole.entities.Customer.update(customer.id, {
          workspace_id: existingWs[0].id,
        });
        skipped.push(customer.id);
        continue;
      }

      // Create a root workspace for this customer
      const workspace = await base44.asServiceRole.entities.Workspace.create({
        name: customer.name,
        type: "root",
        parent_id: null,
        ancestor_ids: [],
        customer_id: customer.id,
        customer_name: customer.name,
        status: "active",
        path: customer.name,
        description: `Root workspace for ${customer.name}`,
      });

      // Link the customer to the workspace
      await base44.asServiceRole.entities.Customer.update(customer.id, {
        workspace_id: workspace.id,
      });

      // Link all users of this customer to the workspace
      const users = await base44.asServiceRole.entities.User.filter({
        customer_id: customer.id,
      });
      for (const u of users) {
        await base44.asServiceRole.entities.User.update(u.id, {
          workspace_id: workspace.id,
        });
      }

      await writeLicenseAuditLog(
        base44,
        "workspace_migrated",
        customer.id,
        `Created root workspace '${workspace.id}' for customer ${customer.name}, linked ${users.length} users`,
      );

      migrated.push(customer.id);
    }

    return Response.json({
      success: true,
      migrated_count: migrated.length,
      skipped_count: skipped.length,
      migrated,
      skipped,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
