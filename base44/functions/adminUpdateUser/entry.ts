import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import {
  normalizeRole,
  resolveScopeCustomerIds,
  writeAccessAuditLog,
} from "../../shared/accessUtils.ts";

/**
 * adminUpdateUser — the only supported write path for User records.
 *
 * The User entity's RLS blocks direct client writes, because the denormalized
 * access arrays on User (delegated_*, onboarding_*) are the boundary that the
 * operational entities trust. This function runs as service role and re-applies
 * the rules in code:
 *
 * - master_admin / workspace_admin (platform & partner): may set customer
 *   membership, display name and any role.
 * - customer_admin: only users of their own customer; may edit the display name
 *   and remove a user from their own customer. May not change roles, move a user
 *   to another customer, or touch a platform/partner administrator.
 * - Everyone else: forbidden.
 *
 * Payload: { userId, data: { display_name?, full_name?, customer_id?, customer_name?, role? } }
 */
const TENANT_ROLES = [
  "user",
  "employee",
  "customer_admin",
  "grc_analyst",
  "control_owner",
  "executive",
  "auditor",
  "consultant",
];

const PLATFORM_ROLES = ["admin", "master_admin", "workspace_admin", "partner_admin"];

const ALLOWED_ROLES = [...TENANT_ROLES, ...PLATFORM_ROLES];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();
    if (!currentUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const currentRole = normalizeRole(currentUser.role);
    const isOwner = currentRole === "master_admin";
    const isPartner = currentRole === "workspace_admin";
    const isPlatformAdmin = isOwner || isPartner;

    if (!isPlatformAdmin && currentRole !== "customer_admin") {
      return Response.json({ error: "Forbidden: admin access required" }, { status: 403 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { userId, data } = body || {};
    if (!userId) return Response.json({ error: "userId is required" }, { status: 400 });
    if (!data || typeof data !== "object") {
      return Response.json({ error: "data is required" }, { status: 400 });
    }

    const target = await base44.asServiceRole.entities.User.get(userId).catch(() => null);
    if (!target) return Response.json({ error: "User not found" }, { status: 404 });

    const { role, full_name, display_name, customer_id, customer_name } = data;

    // ─── Authorization ─────────────────────────────────────────
    // Nobody grants themselves a role or a tenant through this API (F6): the
    // self-escalation guard comes before every other check, including the
    // platform owner's.
    if (userId === currentUser.id && (role !== undefined || customer_id !== undefined)) {
      return Response.json(
        { error: "Forbidden: you cannot change your own role or customer" },
        { status: 403 },
      );
    }

    // A partner admin assigns roles — but only tenant roles, and only to users
    // inside its own carteira. Platform roles stay with the platform owner.
    if (isPartner && !isOwner) {
      if (role !== undefined && !TENANT_ROLES.includes(role)) {
        return Response.json(
          { error: "Forbidden: a partner admin cannot assign platform roles" },
          { status: 403 },
        );
      }
      if (target.customer_id) {
        const scope = await resolveScopeCustomerIds(base44, currentUser);
        if (!scope.all && !scope.customerIds.includes(target.customer_id)) {
          return Response.json({ error: "Forbidden: user outside your carteira" }, { status: 403 });
        }
      }
    }

    if (!isPlatformAdmin) {
      if (!currentUser.customer_id || target.customer_id !== currentUser.customer_id) {
        return Response.json({ error: "Forbidden: you can only edit users of your own customer" }, { status: 403 });
      }
      if (PLATFORM_ROLES.includes(target.role)) {
        return Response.json({ error: "Forbidden: you cannot edit a platform or partner administrator" }, { status: 403 });
      }
      // A customer admin may remove a user from their customer, but not move them elsewhere.
      if (customer_id !== undefined && customer_id !== null && customer_id !== target.customer_id) {
        return Response.json({ error: "Forbidden: you cannot move a user to another customer" }, { status: 403 });
      }
      if (customer_name !== undefined) {
        return Response.json({ error: "Forbidden: you cannot change the customer name" }, { status: 403 });
      }
      if (role !== undefined) {
        return Response.json({ error: "Forbidden: only a platform administrator can change a user's role" }, { status: 403 });
      }
    }

    if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
      return Response.json({ error: `Invalid role: ${role}` }, { status: 400 });
    }

    // ─── Apply ─────────────────────────────────────────────────
    const update = {};
    if (display_name !== undefined || full_name !== undefined) {
      update.display_name = display_name !== undefined ? display_name : full_name;
    }
    if (customer_id !== undefined) update.customer_id = customer_id;
    if (customer_name !== undefined) update.customer_name = customer_name;
    if (role !== undefined) update.role = role;

    if (Object.keys(update).length === 0) {
      return Response.json({ success: true, user: target });
    }

    const updated = await base44.asServiceRole.entities.User.update(userId, update);

    const changes = Object.keys(update).map((k) => `${k}=${update[k]}`).join(", ");
    await writeAccessAuditLog(
      base44, "user_updated", updated?.customer_id || target.customer_id || "", currentUser.email,
      `User ${target.email} updated by ${currentUser.email} (${changes})`,
      "User", userId,
    );

    return Response.json({ success: true, user: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
