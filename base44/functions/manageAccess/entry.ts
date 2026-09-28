import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import {
  normalizeRole,
  isPlatformAdmin,
  isCustomerAdmin,
  addToArray,
  removeFromArray,
  getDenormalizedField,
  writeAccessAuditLog,
} from "../../shared/accessUtils.ts";

/**
 * manageAccess — External access management for delegation and onboarding flows.
 *
 * Actions:
 * - request_delegation:  Consultant requests access to a customer (creates pending assignment)
 * - approve_delegation:  Customer admin approves a pending delegation
 * - reject_delegation:   Customer admin rejects a pending delegation
 * - revoke_delegation:    Customer admin or delegated user revokes an active delegation
 * - create_onboarding:    Platform admin onboards a user to a customer (auto-approved)
 * - accept_onboarding:    User accepts onboarding (activates assignment)
 * - revoke_onboarding:   Platform admin revokes an onboarding assignment
 * - list:                 List assignments (filtered by role)
 * - resolve:              Resolve user's accessible customers
 */
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

  const assignments = await base44.asServiceRole.entities.UserCustomerAssignment.filter({
    user_id: targetUserId,
    status: "active",
  });

  const customerIds = assignments.map((a: any) => a.customer_id);

  // Include user's own customer_id
  const targetUser = user_id
    ? await base44.asServiceRole.entities.User.get(user_id)
    : user;
  if (targetUser?.customer_id && !customerIds.includes(targetUser.customer_id)) {
    customerIds.push(targetUser.customer_id);
  }

  return Response.json({ customer_ids: customerIds, assignments });
}

// ─── Request Delegation ───────────────────────────────────────
async function handleRequestDelegation(base44: any, user: any, body: any, userRole: string) {
  const { customer_id, customer_name, access_level, authorized_modules, reason } = body;

  if (!customer_id) return Response.json({ error: "customer_id is required" }, { status: 400 });

  // Any user can request delegation (typically consultant)
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
    access_level: access_level || "viewer",
    role_in_customer: access_level || "viewer",
    authorized_modules: authorized_modules || [],
    status: "pending",
    requested_by: user.email,
    reason,
  });

  await writeAccessAuditLog(
    base44, "delegation_requested", customer_id, user.email,
    `User ${user.email} requested ${access_level || "viewer"} delegation to ${customer_name || customer_id}`,
    "UserCustomerAssignment", assignment.id,
  );

  return Response.json({ success: true, assignment });
}

// ─── Approve Delegation ───────────────────────────────────────
async function handleApproveDelegation(base44: any, user: any, body: any, userRole: string) {
  const { assignment_id } = body;
  if (!assignment_id) return Response.json({ error: "assignment_id is required" }, { status: 400 });

  // Only customer_admin of that customer or platform admin can approve
  const assignment = await base44.asServiceRole.entities.UserCustomerAssignment.get(assignment_id);
  if (!assignment) return Response.json({ error: "Assignment not found" }, { status: 404 });
  if (assignment.assignment_type !== "delegation" || assignment.status !== "pending") {
    return Response.json({ error: "Assignment is not a pending delegation" }, { status: 400 });
  }

  if (!isPlatformAdmin(userRole)) {
    if (userRole !== "customer_admin" || user.customer_id !== assignment.customer_id) {
      return Response.json({ error: "Forbidden — only customer admin or platform admin can approve" }, { status: 403 });
    }
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
    `Delegation approved for ${assignment.user_email} by ${user.email}`,
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

  if (!isPlatformAdmin(userRole)) {
    if (userRole !== "customer_admin" || user.customer_id !== assignment.customer_id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
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

  // Customer admin of that customer, platform admin, or the delegated user themselves can revoke
  const canRevoke = isPlatformAdmin(userRole) ||
    (userRole === "customer_admin" && user.customer_id === assignment.customer_id) ||
    user.id === assignment.user_id;
  if (!canRevoke) return Response.json({ error: "Forbidden" }, { status: 403 });

  const updated = await base44.asServiceRole.entities.UserCustomerAssignment.update(assignment_id, {
    status: "revoked",
  });

  // Remove from denormalized array on User
  const targetUser = await base44.asServiceRole.entities.User.get(assignment.user_id);
  if (targetUser) {
    const field = getDenormalizedField("delegation", assignment.access_level);
    const updatedArray = removeFromArray(targetUser[field], assignment.customer_id);
    await base44.asServiceRole.entities.User.update(targetUser.id, { [field]: updatedArray });
  }

  await writeAccessAuditLog(
    base44, "delegation_revoked", assignment.customer_id, user.email,
    `Delegation revoked for ${assignment.user_email} by ${user.email}`,
    "UserCustomerAssignment", assignment_id,
  );

  return Response.json({ success: true, assignment: updated });
}

// ─── Create Onboarding ─────────────────────────────────────────
async function handleCreateOnboarding(base44: any, user: any, body: any, userRole: string) {
  const { user_id, user_email, customer_id, customer_name, workspace_id, access_level, authorized_modules, expires_at, reason } = body;

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

  const assignment = await base44.asServiceRole.entities.UserCustomerAssignment.create({
    user_id,
    user_email,
    customer_id,
    customer_name,
    workspace_id,
    assignment_type: "onboarding",
    access_level: access_level || "contributor",
    role_in_customer: access_level || "contributor",
    authorized_modules: authorized_modules || [],
    status: "pending",
    onboarding_state: "pending",
    requested_by: user.email,
    approved_by: user.email, // auto-approved by platform admin
    expires_at,
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
    `Onboarding created for ${user_email} to ${customer_name || customer_id} by ${user.email}`,
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

  const updated = await base44.asServiceRole.entities.UserCustomerAssignment.update(assignment_id, {
    status: "active",
    onboarding_state: "accepted",
  });

  // Move from onboarding_customer_ids to delegated arrays
  const targetUser = await base44.asServiceRole.entities.User.get(assignment.user_id);
  if (targetUser) {
    // Remove from onboarding_customer_ids
    const onboardingIds = removeFromArray(targetUser.onboarding_customer_ids, assignment.customer_id);
    // Add to delegated array based on access_level
    const field = getDenormalizedField("delegation", assignment.access_level);
    const delegatedIds = addToArray(targetUser[field], assignment.customer_id);
    await base44.asServiceRole.entities.User.update(targetUser.id, {
      onboarding_customer_ids: onboardingIds,
      [field]: delegatedIds,
    });
  }

  await writeAccessAuditLog(
    base44, "onboarding_accepted", assignment.customer_id, user.email,
    `Onboarding accepted by ${user.email} for ${assignment.customer_name || assignment.customer_id}`,
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

  // Remove from all denormalized arrays on User
  const targetUser = await base44.asServiceRole.entities.User.get(assignment.user_id);
  if (targetUser) {
    const onboardingIds = removeFromArray(targetUser.onboarding_customer_ids, assignment.customer_id);
    const viewIds = removeFromArray(targetUser.delegated_view_customer_ids, assignment.customer_id);
    const editIds = removeFromArray(targetUser.delegated_edit_customer_ids, assignment.customer_id);
    await base44.asServiceRole.entities.User.update(targetUser.id, {
      onboarding_customer_ids: onboardingIds,
      delegated_view_customer_ids: viewIds,
      delegated_edit_customer_ids: editIds,
    });
  }

  await writeAccessAuditLog(
    base44, "onboarding_revoked", assignment.customer_id, user.email,
    `Onboarding revoked for ${assignment.user_email} by ${user.email}`,
    "UserCustomerAssignment", assignment_id,
  );

  return Response.json({ success: true, assignment: updated });
}
