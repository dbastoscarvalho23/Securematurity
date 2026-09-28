import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import {
  normalizeRole,
  addToArray,
  removeFromArray,
  writeAccessAuditLog,
} from "../../shared/accessUtils.ts";

/**
 * breakGlassAccess — Emergency break-glass access for master_admin.
 *
 * Break-glass provides temporary (1-8h) access to a customer's compliance data.
 * Only master_admin can initiate break-glass. Customer admins are notified via
 * audit log. All actions are logged.
 *
 * Actions:
 * - start:  master_admin initiates break-glass for a customer (1-8h TTL)
 * - end:    master_admin ends an active break-glass session
 * - list:   List active break-glass assignments (master_admin only)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { action } = body;
    const userRole = normalizeRole(user.role);

    // ─── List active break-glass assignments ──────────────
    if (action === "list") {
      if (userRole !== "master_admin") {
        return Response.json({ error: "Forbidden — break-glass is master_admin only" }, { status: 403 });
      }

      const assignments = await base44.asServiceRole.entities.UserCustomerAssignment.filter({
        assignment_type: "breakglass",
        status: "active",
      });

      return Response.json({ assignments });
    }

    // ─── Start break-glass ─────────────────────────────────
    if (action === "start") {
      if (userRole !== "master_admin") {
        return Response.json({ error: "Forbidden — break-glass is master_admin only" }, { status: 403 });
      }

      const { customer_id, customer_name, duration_hours, reason } = body;
      if (!customer_id) return Response.json({ error: "customer_id is required" }, { status: 400 });
      if (!reason) return Response.json({ error: "reason is required for break-glass access" }, { status: 400 });

      // Validate duration (1-8h)
      const hours = Math.min(Math.max(duration_hours || 1, 1), 8);
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

      // Check for existing active break-glass
      const existing = await base44.asServiceRole.entities.UserCustomerAssignment.filter({
        user_id: user.id,
        customer_id,
        assignment_type: "breakglass",
        status: "active",
      });
      if (existing.length > 0) {
        return Response.json({ error: "Break-glass already active", assignment: existing[0] }, { status: 409 });
      }

      const assignment = await base44.asServiceRole.entities.UserCustomerAssignment.create({
        user_id: user.id,
        user_email: user.email,
        customer_id,
        customer_name,
        assignment_type: "breakglass",
        access_level: "admin",
        role_in_customer: "admin",
        status: "active",
        requested_by: user.email,
        approved_by: user.email, // self-approved (master_admin)
        expires_at: expiresAt,
        reason,
      });

      // Add to breakglass_customer_ids on User
      const updatedArray = addToArray(user.breakglass_customer_ids, customer_id);
      await base44.asServiceRole.entities.User.update(user.id, {
        breakglass_customer_ids: updatedArray,
      });

      // Audit log
      await writeAccessAuditLog(
        base44, "breakglass_started", customer_id, user.email,
        `Break-glass access STARTED by ${user.email} for ${customer_name || customer_id} (duration: ${hours}h, reason: ${reason})`,
        "UserCustomerAssignment", assignment.id,
      );

      // Notify customer admins — create notifications
      const customerAdmins = await base44.asServiceRole.entities.User.filter({
        customer_id,
        role: { $in: ["customer_admin", "admin"] },
      });
      for (const admin of customerAdmins) {
        await base44.asServiceRole.entities.Notification.create({
          user_email: admin.email,
          customer_id,
          title: "Break-Glass Access Activated",
          message: `${user.email} has activated break-glass access to ${customer_name || customer_id}. Reason: ${reason}. Duration: ${hours}h.`,
          type: "warning",
          is_read: false,
        });
      }

      return Response.json({ success: true, assignment, expires_at: expiresAt });
    }

    // ─── End break-glass ───────────────────────────────────
    if (action === "end") {
      if (userRole !== "master_admin") {
        return Response.json({ error: "Forbidden — break-glass is master_admin only" }, { status: 403 });
      }

      const { assignment_id } = body;
      if (!assignment_id) return Response.json({ error: "assignment_id is required" }, { status: 400 });

      const assignment = await base44.asServiceRole.entities.UserCustomerAssignment.get(assignment_id);
      if (!assignment) return Response.json({ error: "Assignment not found" }, { status: 404 });
      if (assignment.assignment_type !== "breakglass" || assignment.status !== "active") {
        return Response.json({ error: "Assignment is not an active break-glass" }, { status: 400 });
      }

      // Only the user who started it can end it (or another master_admin)
      if (assignment.user_id !== user.id && userRole !== "master_admin") {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      const updated = await base44.asServiceRole.entities.UserCustomerAssignment.update(assignment_id, {
        status: "expired",
      });

      // Remove from breakglass_customer_ids on User
      const targetUser = assignment.user_id === user.id
        ? user
        : await base44.asServiceRole.entities.User.get(assignment.user_id);
      if (targetUser) {
        const updatedArray = removeFromArray(targetUser.breakglass_customer_ids, assignment.customer_id);
        await base44.asServiceRole.entities.User.update(targetUser.id, {
          breakglass_customer_ids: updatedArray,
        });
      }

      await writeAccessAuditLog(
        base44, "breakglass_ended", assignment.customer_id, user.email,
        `Break-glass access ENDED by ${user.email} for ${assignment.customer_name || assignment.customer_id}`,
        "UserCustomerAssignment", assignment_id,
      );

      return Response.json({ success: true, assignment: updated });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
