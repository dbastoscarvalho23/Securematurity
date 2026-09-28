import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import {
  normalizeRole,
  isPlatformAdmin,
  addToArray,
  removeFromArray,
  getDenormalizedField,
  writeAccessAuditLog,
} from "../../shared/accessUtils.ts";

/**
 * manageAccess — External access management for delegation and onboarding flows.
 *
 * MVP rules (Core NIS2):
 * - Delegation is time-boxed (explicit expires_at, max 365 days) and always
 *   authorized by the customer (customer_admin of that customer) or the platform
 *   owner (master_admin). Nobody approves their own request, and a partner admin
 *   (workspace_admin) cannot approve on the customer's behalf.
 * - Onboarding is limited to account set-up (users/configuration). Accepting an
 *   onboarding never grants operational access to compliance data — only an
 *   approved delegation does.
 * - Expired assignments are retired lazily whenever access is resolved or listed.
 * - Break-glass/support access is out of the MVP (removed with this phase).
 *
 * Actions:
 * - request_delegation:  User requests time-boxed access to a customer (pending)
 * - approve_delegation:  Customer admin (or master_admin) approves a pending delegation
 * - reject_delegation:   Customer admin (or master_admin) rejects a pending delegation
 * - revoke_delegation:   Customer admin, master_admin or the delegated user revokes
 * - create_onboarding:   Platform admin creates an onboarding (account set-up only)
 * - accept_onboarding:   The assigned user accepts the onboarding (no data access)
 * - revoke_onboarding:   Platform admin revokes an onboarding assignment
 * - list:                List assignments (filtered by role)
 * - resolve:             Resolve the customers a user really can operate on
 */
const MAX_DELEGATION_DAYS = 365;
const ACCESS_LEVELS = ["viewer", "contributor", "admin"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { action } = body;
    const userRole = normalizeRole(user.role);

    // ─── List assignments ───────────────────────────────────────
    if (action === "list") {
      return await handleList(base44, user, body, userRole);
    }

    // ─── Resolve user's accessible customers ──────────────────
    if (action === "resolve") {
      return await handleResolve(base44, user, body, userRole);
    }

    // ─── Delegation flow ───────────────────────────────────────
    if (action === "request_delegation") {
      return await handleRequestDelegation(base44, user, body, userRole);
    }

    if (action === "approve_delegation") {
      return await handleApproveDelegation(base44, user, body, userRole);
    }

    if (action === "reject_delegation") {
      return await handleRejectDelegation(base44, user, body, userRole);
    }

    if (action === "revoke_delegation") {
      return await handleRevokeDelegation(base44, user, body, userRole);
    }

    // ─── Onboarding flow ───────────────────────────────────────
    if (action === "create_onboarding") {
      return await handleCreateOnboarding(base44, user, body, userRole);
    }

    if (action === "accept_onboarding") {
      return await handleAcceptOnboarding(base44, user, body, userRole);
    }

    if (action === "revoke_onboarding") {
      return await handleRevokeOnboarding(base44, user, body, userRole);
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Expiry helpers ───────────────────────────────────────────
function isExpired(assignment: any): boolean {
  return !!assignment?.expires_at && new Date(assignment.expires_at).getTime() <= Date.now();
}

/** Remove a customer from the user's delegated arrays (delegation only). */
async function clearDelegatedAccess(base44: any, assignment: any): Promise<void> {
  const field = getDenormalizedField("delegation", assignment.access_level);
  if (!field) return;
  const targetUser = await base44.asServiceRole.entities.User.get(assignment.user_id);
  if (!targetUser) return;
  const updatedArray = removeFromArray(targetUser[field], assignment.customer_id);
  await base44.asServiceRole.entities.User.update(targetUser.id, { [field]: updatedArray });
}

/**
 * Retire assignments whose expires_at has passed: mark them expired and drop the
 * operational access they granted. Returns only the still-valid assignments.
 */
async function dropExpired(base44: any, assignments: any[]): Promise<any[]> {
  const active: any[] = [];
  for (const assignment of assignments) {
    if (!isExpired(assignment)) {
      active.push(assignment);
      continue;
    }
    try {
      await base44.asServiceRole.entities.UserCustomerAssignment.update(assignment.id, { status: "expired" });
      await clearDelegatedAccess(base44, assignment);
      await writeAccessAuditLog(
        base44, "delegation_expired", assignment.customer_id, "system",
        `Delegation for ${assignment.user_email} expired automatically`,
        "UserCustomerAssignment", assignment.id,
      );
    } catch (_e) {
      // Best effort — never fail a read because an expiry write failed.
    }
  }
  return active;
}

// ─── List ─────────────────────────────────────────────────────
async function handleList(base44: any, user: any, body: any, userRole: string) {
  const { user_id, customer_id, assignment_type, status } = body;

  let assignments;
  if (isPlatformAdmin(userRole) || userRole === "master_admin") {
    // Platform admins see all
    let filter: any = {};
    if (user_id) filter.user_id = user_id;
    if (customer_id) filter.customer_id = customer_id;
    if (assignment_type) filter.assignment_type = assignment_type;
    if (status) filter.status = status;
    assignments = Object.keys(filter).length > 0
      ? await base44.asServiceRole.entities.UserCustomerAssignment.filter(filter)
      : await base44.asServiceRole.entities.UserCustomerAssignment.list("customer_name", 500);
  } else if (userRole === "customer_admin") {
    // Customer admin sees assignments for their customer + their own
    const own = await base44.asServiceRole.entities.UserCustomerAssignment.filter({ user_id: user.id });
    const customerAssignments = user.customer_id
      ? await base44.asServiceRole.entities.UserCustomerAssignment.filter({ customer_id: user.customer_id })
      : [];
    const seen = new Set<string>();
    assignments = [...own, ...customerAssignments].filter((a: any) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  } else {
    // Other users see only their own
    assignments = await base44.asServiceRole.entities.UserCustomerAssignment.filter({ user_id: user.id });
  }

  // Retire anything past its deadline so the UI never shows stale access as active.
  const activeDelegations = assignments.filter((a: any) =>
    a.assignment_type === "delegation" && a.status === "active"
  );
  const stillValid = new Set((await dropExpired(base44, activeDelegations)).map((a: any) => a.id));
  assignments = assignments.map((a: any) =>
    a.assignment_type === "delegation" && a.status === "active" && !stillValid.has(a.id)
      ? { ...a, status: "expired" }
      : a
  );

  return Response.json({ assignments });
}

// ─── Resolve ──────────────────────────────────────────────────
async function handleResolve(base44: any, user: any, body: any, userRole: string) {
  const { user_id } = body;
  const targetUserId = user_id || user.id;

  // Non-admin can only resolve their own
  if (!isPlatformAdmin(userRole) && user_id && user_id !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only an approved delegation grants operational access to a customer.
  // Onboarding is account set-up only and never appears here.
  const assignments = await base44.asServiceRole.entities.UserCustomerAssignment.filter({
    user_id: targetUserId,
    assignment_type: "delegation",
    status: "active",
  });

  const active = await dropExpired(base44, assignments);
  const customerIds = active.map((a: any) => a.customer_id);

  // Include user's own customer_id
  const targetUser = user_id
    ? await base44.asServiceRole.entities.User.get(user_id)
    : user;
  if (targetUser?.customer_id && !customerIds.includes(targetUser.customer_id)) {
    customerIds.push(targetUser.customer_id);
  }

  return Response.json({ customer_ids: customerIds, assignments: active });
}

// ─── Request Delegation ───────────────────────────────────────
async function handleRequestDelegation(base44: any, user: any, body: any, userRole: string) {
  const { customer_id, customer_name, access_level, authorized_modules, expires_at, reason } = body;

  if (!customer_id) return Response.json({ error: "customer_id is required" }, { status: 400 });
  if (!reason || !String(reason).trim()) {
    return Response.json({ error: "reason is required for a delegation request" }, { status: 400 });
  }
  if (!expires_at) {
    return Response.json({ error: "expires_at is required — delegations are always time-boxed" }, { status: 400 });
  }

  const expiresMs = new Date(expires_at).getTime();
  if (Number.isNaN(expiresMs)) {
    return Response.json({ error: "expires_at is not a valid date" }, { status: 400 });
  }
  if (expiresMs <= Date.now()) {
    return Response.json({ error: "expires_at must be in the future" }, { status: 400 });
  }
  if (expiresMs > Date.now() + MAX_DELEGATION_DAYS * 24 * 60 * 60 * 1000) {
    return Response.json({ error: `A delegation cannot last longer than ${MAX_DELEGATION_DAYS} days` }, { status: 400 });
  }

  const level = access_level || "viewer";
  if (!ACCESS_LEVELS.includes(level)) {
    return Response.json({ error: "invalid access_level" }, { status: 400 });
  }

  // Delegation is for people who do not already belong to that customer —
  // it prevents a tenant admin from authorizing their own request.
  if (user.customer_id && user.customer_id === customer_id) {
    return Response.json({ error: "You already belong to this customer" }, { status: 400 });
  }

  // Check for existing active/pending assignment
  const existing = await base44.asServiceRole.entities.UserCustomerAssignment.filter({
    user_id: user.id,
    customer_id,
    status: { $in: ["active", "pending"] },
  });
  if (existing.length > 0) {
    return Response.json({ error: "Assignment already exists", assignment: existing[0] }, { status: 409 });
  }

  const assignment = await base44.asServiceRole.entities.UserCustomerAssignment.create({
    user_id: user.id,
    user_email: user.email,
    customer_id,
    customer_name,
    assignment_type: "delegation",
    access_level: level,
    role_in_customer: level,
    authorized_modules: authorized_modules || [],
    status: "pending",
    requested_by: user.email,
    expires_at: new Date(expiresMs).toISOString(),
    reason,
  });

  await writeAccessAuditLog(
    base44, "delegation_requested", customer_id, user.email,
    `User ${user.email} requested ${level} delegation to ${customer_name || customer_id} until ${new Date(expiresMs).toISOString()}`,
    "UserCustomerAssignment", assignment.id,
  );

  return Response.json({ success: true, assignment });
}

// ─── Approve Delegation ───────────────────────────────────────
async function handleApproveDelegation(base44: any, user: any, body: any, userRole: string) {
  const { assignment_id } = body;
  if (!assignment_id) return Response.json({ error: "assignment_id is required" }, { status: 400 });

  const assignment = await base44.asServiceRole.entities.UserCustomerAssignment.get(assignment_id);
  if (!assignment) return Response.json({ error: "Assignment not found" }, { status: 404 });
  if (assignment.assignment_type !== "delegation" || assignment.status !== "pending") {
    return Response.json({ error: "Assignment is not a pending delegation" }, { status: 400 });
  }

  // Nobody authorizes their own access.
  if (assignment.user_id === user.id || (assignment.requested_by && assignment.requested_by === user.email)) {
    return Response.json({ error: "Forbidden — you cannot approve your own delegation request" }, { status: 403 });
  }

  // Only the customer's own admin, or the platform owner (master_admin).
  // A partner admin (workspace_admin) cannot approve on the customer's behalf.
  const authorized = userRole === "master_admin" ||
    (userRole === "customer_admin" && !!user.customer_id && user.customer_id === assignment.customer_id);
  if (!authorized) {
    return Response.json({ error: "Forbidden — only the customer admin or a platform administrator can approve" }, { status: 403 });
  }

  if (isExpired(assignment)) {
    await base44.asServiceRole.entities.UserCustomerAssignment.update(assignment_id, { status: "expired" });
    return Response.json({ error: "This delegation request has expired" }, { status: 400 });
  }

  const updated = await base44.asServiceRole.entities.UserCustomerAssignment.update(assignment_id, {
    status: "active",
    approved_by: user.email,
  });

  // Add to denormalized array on User
  const targetUser = await base44.asServiceRole.entities.User.get(assignment.user_id);
  if (targetUser) {
    const field = getDenormalizedField("delegation", assignment.access_level);
    const updatedArray = addToArray(targetUser[field], assignment.customer_id);
    await base44.asServiceRole.entities.User.update(targetUser.id, { [field]: updatedArray });
  }

  await writeAccessAuditLog(
    base44, "delegation_approved", assignment.customer_id, user.email,
    `Delegation approved for ${assignment.user_email} by ${user.email} until ${assignment.expires_at}`,
    "UserCustomerAssignment", assignment_id,
  );

  return Response.json({ success: true, assignment: updated });
}

// ─── Reject Delegation ─────────────────────────────────────────
async function handleRejectDelegation(base44: any, user: any, body: any, userRole: string) {
  const { assignment_id } = body;
  if (!assignment_id) return Response.json({ error: "assignment_id is required" }, { status: 400 });

  const assignment = await base44.asServiceRole.entities.UserCustomerAssignment.get(assignment_id);
  if (!assignment) return Response.json({ error: "Assignment not found" }, { status: 404 });
  if (assignment.status !== "pending") {
    return Response.json({ error: "Assignment is not pending" }, { status: 400 });
  }

  const authorized = userRole === "master_admin" ||
    (userRole === "customer_admin" && !!user.customer_id && user.customer_id === assignment.customer_id);
  if (!authorized) {
    return Response.json({ error: "Forbidden — only the customer admin or a platform administrator can reject" }, { status: 403 });
  }

  const updated = await base44.asServiceRole.entities.UserCustomerAssignment.update(assignment_id, {
    status: "revoked",
    approved_by: user.email,
  });

  await writeAccessAuditLog(
    base44, "delegation_rejected", assignment.customer_id, user.email,
    `Delegation rejected for ${assignment.user_email} by ${user.email}`,
    "UserCustomerAssignment", assignment_id,
  );

  return Response.json({ success: true, assignment: updated });
}

// ─── Revoke Delegation ─────────────────────────────────────────
async function handleRevokeDelegation(base44: any, user: any, body: any, userRole: string) {
  const { assignment_id } = body;
  if (!assignment_id) return Response.json({ error: "assignment_id is required" }, { status: 400 });

  const assignment = await base44.asServiceRole.entities.UserCustomerAssignment.get(assignment_id);
  if (!assignment) return Response.json({ error: "Assignment not found" }, { status: 404 });
  if (assignment.status !== "active") {
    return Response.json({ error: "Assignment is not active" }, { status: 400 });
  }

  // The customer's own admin, the platform owner, or the delegated user themselves.
  const canRevoke = userRole === "master_admin" ||
    (userRole === "customer_admin" && !!user.customer_id && user.customer_id === assignment.customer_id) ||
    user.id === assignment.user_id;
  if (!canRevoke) return Response.json({ error: "Forbidden" }, { status: 403 });

  const updated = await base44.asServiceRole.entities.UserCustomerAssignment.update(assignment_id, {
    status: "revoked",
  });

  await clearDelegatedAccess(base44, assignment);

  await writeAccessAuditLog(
    base44, "delegation_revoked", assignment.customer_id, user.email,
    `Delegation revoked for ${assignment.user_email} by ${user.email}`,
    "UserCustomerAssignment", assignment_id,
  );

  return Response.json({ success: true, assignment: updated });
}

// ─── Create Onboarding ─────────────────────────────────────────
async function handleCreateOnboarding(base44: any, user: any, body: any, userRole: string) {
  const { user_id, user_email, customer_id, customer_name, workspace_id, authorized_modules, reason } = body;

  if (!user_id || !customer_id) return Response.json({ error: "user_id and customer_id are required" }, { status: 400 });

  // Only platform admins can create onboarding
  if (!isPlatformAdmin(userRole)) {
    return Response.json({ error: "Forbidden — only platform admins can create onboarding" }, { status: 403 });
  }

  // Check for existing active/pending onboarding
  const existing = await base44.asServiceRole.entities.UserCustomerAssignment.filter({
    user_id,
    customer_id,
    assignment_type: "onboarding",
    status: { $in: ["active", "pending"] },
  });
  if (existing.length > 0) {
    return Response.json({ error: "Onboarding already exists", assignment: existing[0] }, { status: 409 });
  }

  // Onboarding covers account set-up only: it is never a data-access grant,
  // so it carries no access_level and no operational module authorization.
  const assignment = await base44.asServiceRole.entities.UserCustomerAssignment.create({
    user_id,
    user_email,
    customer_id,
    customer_name,
    workspace_id,
    assignment_type: "onboarding",
    access_level: "viewer",
    role_in_customer: "viewer",
    authorized_modules: authorized_modules || [],
    status: "pending",
    onboarding_state: "pending",
    requested_by: user.email,
    reason,
  });

  // Add to onboarding_customer_ids on User immediately (pre-acceptance)
  const targetUser = await base44.asServiceRole.entities.User.get(user_id);
  if (targetUser) {
    const updatedArray = addToArray(targetUser.onboarding_customer_ids, customer_id);
    await base44.asServiceRole.entities.User.update(user_id, { onboarding_customer_ids: updatedArray });
  }

  await writeAccessAuditLog(
    base44, "onboarding_created", customer_id, user.email,
    `Onboarding created for ${user_email} to ${customer_name || customer_id} by ${user.email} (account set-up only)`,
    "UserCustomerAssignment", assignment.id,
  );

  return Response.json({ success: true, assignment });
}

// ─── Accept Onboarding ─────────────────────────────────────────
async function handleAcceptOnboarding(base44: any, user: any, body: any, userRole: string) {
  const { assignment_id } = body;
  if (!assignment_id) return Response.json({ error: "assignment_id is required" }, { status: 400 });

  const assignment = await base44.asServiceRole.entities.UserCustomerAssignment.get(assignment_id);
  if (!assignment) return Response.json({ error: "Assignment not found" }, { status: 404 });
  if (assignment.assignment_type !== "onboarding" || assignment.onboarding_state !== "pending") {
    return Response.json({ error: "Assignment is not a pending onboarding" }, { status: 400 });
  }

  // Only the assigned user can accept onboarding
  if (user.id !== assignment.user_id) {
    return Response.json({ error: "Forbidden — only the assigned user can accept onboarding" }, { status: 403 });
  }

  // Acceptance closes the account set-up. It explicitly does NOT write the
  // delegated_*_customer_ids arrays: operational access requires an approved,
  // time-boxed delegation.
  const updated = await base44.asServiceRole.entities.UserCustomerAssignment.update(assignment_id, {
    status: "active",
    onboarding_state: "accepted",
    approved_by: user.email,
  });

  await writeAccessAuditLog(
    base44, "onboarding_accepted", assignment.customer_id, user.email,
    `Onboarding accepted by ${user.email} for ${assignment.customer_name || assignment.customer_id} (account set-up only, no data access)`,
    "UserCustomerAssignment", assignment_id,
  );

  return Response.json({ success: true, assignment: updated });
}

// ─── Revoke Onboarding ─────────────────────────────────────────
async function handleRevokeOnboarding(base44: any, user: any, body: any, userRole: string) {
  const { assignment_id } = body;
  if (!assignment_id) return Response.json({ error: "assignment_id is required" }, { status: 400 });

  const assignment = await base44.asServiceRole.entities.UserCustomerAssignment.get(assignment_id);
  if (!assignment) return Response.json({ error: "Assignment not found" }, { status: 404 });
  if (assignment.assignment_type !== "onboarding") {
    return Response.json({ error: "Assignment is not an onboarding" }, { status: 400 });
  }

  // Only platform admins can revoke onboarding
  if (!isPlatformAdmin(userRole)) {
    return Response.json({ error: "Forbidden — only platform admins can revoke onboarding" }, { status: 403 });
  }

  const updated = await base44.asServiceRole.entities.UserCustomerAssignment.update(assignment_id, {
    status: "revoked",
    onboarding_state: "revoked",
  });

  // Clear every denormalized array for this customer — onboarding itself only
  // ever writes onboarding_customer_ids, but this also cleans up records created
  // before operational access was removed from the onboarding flow.
  const targetUser = await base44.asServiceRole.entities.User.get(assignment.user_id);
  if (targetUser) {
    await base44.asServiceRole.entities.User.update(targetUser.id, {
      onboarding_customer_ids: removeFromArray(targetUser.onboarding_customer_ids, assignment.customer_id),
      delegated_view_customer_ids: removeFromArray(targetUser.delegated_view_customer_ids, assignment.customer_id),
      delegated_edit_customer_ids: removeFromArray(targetUser.delegated_edit_customer_ids, assignment.customer_id),
    });
  }

  await writeAccessAuditLog(
    base44, "onboarding_revoked", assignment.customer_id, user.email,
    `Onboarding revoked for ${assignment.user_email} by ${user.email}`,
    "UserCustomerAssignment", assignment_id,
  );

  return Response.json({ success: true, assignment: updated });
}
