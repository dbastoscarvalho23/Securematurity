/**
 * Delegation / External Access utilities for the frontend.
 * Provides helpers to manage UserCustomerAssignment records via manageAccess backend function.
 */
import { base44 } from "@/api/base44Client";

/**
 * List assignments — optionally filtered by user, customer, type, or status.
 */
export async function listAssignments({ userId, customerId, assignmentType, status } = {}) {
  try {
    const result = await base44.functions.invoke("manageAccess", {
      action: "list",
      user_id: userId,
      customer_id: customerId,
      assignment_type: assignmentType,
      status,
    });
    return result.assignments || [];
  } catch (error) {
    console.error("Failed to list assignments:", error);
    return [];
  }
}

/**
 * Request delegation — a user requests time-boxed access to a customer
 * (pending; the customer's own admin must approve it).
 */
export async function requestDelegation({ customerId, customerName, accessLevel, authorizedModules, expiresAt, reason }) {
  return base44.functions.invoke("manageAccess", {
    action: "request_delegation",
    customer_id: customerId,
    customer_name: customerName,
    access_level: accessLevel || "viewer",
    authorized_modules: authorizedModules || [],
    expires_at: expiresAt,
    reason,
  });
}

/**
 * Approve a pending delegation (customer_admin only).
 */
export async function approveDelegation(assignmentId) {
  return base44.functions.invoke("manageAccess", {
    action: "approve_delegation",
    assignment_id: assignmentId,
  });
}

/**
 * Reject a pending delegation (customer_admin only).
 */
export async function rejectDelegation(assignmentId) {
  return base44.functions.invoke("manageAccess", {
    action: "reject_delegation",
    assignment_id: assignmentId,
  });
}

/**
 * Revoke an active delegation (customer_admin or delegated user).
 */
export async function revokeDelegation(assignmentId) {
  return base44.functions.invoke("manageAccess", {
    action: "revoke_delegation",
    assignment_id: assignmentId,
  });
}

/**
 * Create onboarding — platform admin onboards a user to a customer.
 * Onboarding covers account set-up only: it grants no access to compliance data,
 * so the user still needs an approved delegation to operate on the customer.
 */
export async function createOnboarding({ userId, userEmail, customerId, customerName, workspaceId, authorizedModules, reason }) {
  return base44.functions.invoke("manageAccess", {
    action: "create_onboarding",
    user_id: userId,
    user_email: userEmail,
    customer_id: customerId,
    customer_name: customerName,
    workspace_id: workspaceId,
    authorized_modules: authorizedModules || [],
    reason,
  });
}

/**
 * Accept onboarding — the assigned user accepts onboarding.
 */
export async function acceptOnboarding(assignmentId) {
  return base44.functions.invoke("manageAccess", {
    action: "accept_onboarding",
    assignment_id: assignmentId,
  });
}

/**
 * Revoke onboarding — platform admin revokes an onboarding assignment.
 */
export async function revokeOnboarding(assignmentId) {
  return base44.functions.invoke("manageAccess", {
    action: "revoke_onboarding",
    assignment_id: assignmentId,
  });
}

/**
 * Resolve all customer IDs a user can access (own + delegated).
 */
export async function resolveUserCustomers(userId) {
  try {
    const result = await base44.functions.invoke("manageAccess", {
      action: "resolve",
      user_id: userId,
    });
    return result;
  } catch (error) {
    console.error("Failed to resolve user customers:", error);
    return { customer_ids: [], assignments: [] };
  }
}

// ─── Legacy compat wrappers (for existing code) ──────────────────
export async function createAssignment(data) {
  // Map old-style create to new onboarding (admin creates → auto-approved)
  return createOnboarding({
    userId: data.userId,
    userEmail: data.userEmail,
    customerId: data.customerId,
    customerName: data.customerName,
    workspaceId: data.workspaceId,
    accessLevel: data.roleInCustomer,
  });
}

export async function updateAssignment(assignmentId, updates) {
  // Map old-style update to revoke if status=revoked
  if (updates.status === "revoked") {
    return revokeDelegation(assignmentId);
  }
  return base44.functions.invoke("manageAssignment", {
    action: "update",
    assignment_id: assignmentId,
    ...updates,
  });
}

export async function deleteAssignment(assignmentId) {
  return base44.functions.invoke("manageAssignment", {
    action: "delete",
    assignment_id: assignmentId,
  });
}

/**
 * Delegation role metadata.
 */
export const DELEGATION_ROLES = {
  viewer: { label: "Viewer", description: "Read-only access to customer data" },
  contributor: { label: "Contributor", description: "Can create and edit customer data" },
  admin: { label: "Admin", description: "Full access to customer data and settings" },
};

/**
 * Assignment type labels.
 */
export const ASSIGNMENT_TYPES = {
  delegation: { label: "Delegation", icon: "Network" },
  onboarding: { label: "Onboarding", icon: "UserPlus" },
};

/**
 * Status badge variants.
 */
export const STATUS_BADGES = {
  pending: { variant: "secondary", label: "Pending" },
  active: { variant: "default", label: "Active" },
  expired: { variant: "outline", label: "Expired" },
  revoked: { variant: "destructive", label: "Revoked" },
  onboarding: { variant: "secondary", label: "Onboarding" },
};
