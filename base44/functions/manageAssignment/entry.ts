import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { normalizeRole } from "../../shared/accessUtils.ts";

/**
 * Manages UserCustomerAssignment records — explicit delegation of users
 * to customers/workspaces with a specific access level.
 *
 * Actions:
 * - list:   Returns assignments for a user or customer (admin sees all)
 * - create: Creates a new assignment (admin only)
 * - update: Updates an assignment's role or status (admin only)
 * - delete: Deletes an assignment (admin only)
 *
 * Request body: { action, ...params }
 */
import { resolveActor } from "../../shared/devActor.ts";
import { guardRateLimit } from "../../shared/rateLimit.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await resolveActor(base44, req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // OP-S2 — escrita sensível: atribuições e âmbito de acesso por cliente.
    const limited = guardRateLimit(user, "write_sensitive", req);
    if (limited) return limited;

    const role = normalizeRole(user.role);
    const body = await req.json();
    const { action } = body;

    // ─── List assignments ───────────────────────────────────
    if (action === "list") {
      const { user_id, customer_id } = body;

      let assignments;
      if (role === "master_admin") {
        // Admin: can filter by user_id or customer_id, or list all
        if (user_id) {
          assignments = await base44.asServiceRole.entities.UserCustomerAssignment.filter({ user_id });
        } else if (customer_id) {
          assignments = await base44.asServiceRole.entities.UserCustomerAssignment.filter({ customer_id });
        } else {
          assignments = await base44.asServiceRole.entities.UserCustomerAssignment.list("customer_name", 500);
        }
      } else {
        // Non-admin: only see their own assignments + assignments for their customer
        const own = await base44.asServiceRole.entities.UserCustomerAssignment.filter({ user_id: user.id });
        const customerAssignments = user.customer_id
          ? await base44.asServiceRole.entities.UserCustomerAssignment.filter({ customer_id: user.customer_id })
          : [];
        // Merge and deduplicate
        const seen = new Set<string>();
        assignments = [...own, ...customerAssignments].filter((a: any) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        });
      }

      return Response.json({ assignments });
    }

    // ─── All mutations: admin only ──────────────────────────
    if (role !== "master_admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // ─── Create assignment ─────────────────────────────────
    if (action === "create") {
      const { user_id, user_email, customer_id, customer_name, workspace_id, role_in_customer } = body;
      if (!user_id || !customer_id) {
        return Response.json({ error: "user_id and customer_id are required" }, { status: 400 });
      }

      // Check for existing active assignment (idempotency)
      const existing = await base44.asServiceRole.entities.UserCustomerAssignment.filter({
        user_id,
        customer_id,
        status: "active",
      });
      if (existing.length > 0) {
        return Response.json({ error: "Assignment already exists", assignment: existing[0] }, { status: 409 });
      }

      const assignment = await base44.asServiceRole.entities.UserCustomerAssignment.create({
        user_id,
        user_email,
        customer_id,
        customer_name,
        workspace_id,
        role_in_customer: role_in_customer || "viewer",
        assigned_by: user.email,
        status: "active",
      });

      // Audit log
      await base44.asServiceRole.entities.AuditLog.create({
        customer_id,
        action: "user_assignment_created",
        user_email: user.email,
        entity_type: "UserCustomerAssignment",
        entity_id: assignment.id,
        details: `Assigned user ${user_email} to customer ${customer_name} as ${role_in_customer || "viewer"}`,
      });

      return Response.json({ success: true, assignment });
    }

    // ─── Update assignment ──────────────────────────────────
    if (action === "update") {
      const { assignment_id, ...updates } = body;
      if (!assignment_id) {
        return Response.json({ error: "assignment_id is required" }, { status: 400 });
      }

      const assignment = await base44.asServiceRole.entities.UserCustomerAssignment.update(assignment_id, updates);

      await base44.asServiceRole.entities.AuditLog.create({
        customer_id: assignment.customer_id,
        action: "user_assignment_updated",
        user_email: user.email,
        entity_type: "UserCustomerAssignment",
        entity_id: assignment_id,
        details: `Updated assignment: ${JSON.stringify(updates)}`,
      });

      return Response.json({ success: true, assignment });
    }

    // ─── Delete assignment ─────────────────────────────────
    if (action === "delete") {
      const { assignment_id } = body;
      if (!assignment_id) {
        return Response.json({ error: "assignment_id is required" }, { status: 400 });
      }

      const existing = await base44.asServiceRole.entities.UserCustomerAssignment.get(assignment_id);

      await base44.asServiceRole.entities.UserCustomerAssignment.delete(assignment_id);

      await base44.asServiceRole.entities.AuditLog.create({
        customer_id: existing?.customer_id,
        action: "user_assignment_deleted",
        user_email: user.email,
        entity_type: "UserCustomerAssignment",
        entity_id: assignment_id,
        details: `Deleted assignment for user ${existing?.user_email} to customer ${existing?.customer_name}`,
      });

      return Response.json({ success: true });
    }

    // ─── Resolve user's accessible customers ────────────────
    if (action === "resolve") {
      const { user_id } = body;
      const targetUserId = user_id || user.id;

      // Non-admin can only resolve their own
      if (role !== "master_admin" && user_id && user_id !== user.id) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      // Get active assignments for this user
      const assignments = await base44.asServiceRole.entities.UserCustomerAssignment.filter({
        user_id: targetUserId,
        status: "active",
      });

      const customerIds = assignments.map((a: any) => a.customer_id);

      // Always include the user's own customer_id
      const targetUser = user_id
        ? await base44.asServiceRole.entities.User.get(user_id)
        : user;
      if (targetUser?.customer_id && !customerIds.includes(targetUser.customer_id)) {
        customerIds.push(targetUser.customer_id);
      }

      return Response.json({ customer_ids: customerIds, assignments });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
