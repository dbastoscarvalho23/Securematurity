/**
 * Delegation utilities for the frontend.
 * Provides helpers to manage UserCustomerAssignment records.
 */
import { base44 } from "@/api/base44Client";

/**
 * List assignments — optionally filtered by user or customer.
 */
export async function listAssignments({ userId, customerId } = {}) {
  try {
    const result = await base44.functions.invoke("manageAssignment", {
      action: "list",
      user_id: userId,
      customer_id: customerId,
    });
    return result.assignments || [];
  } catch (error) {
    console.error("Failed to list assignments:", error);
    return [];
  }
}

/**
 * Create a new user-customer assignment.
 */
export async function createAssignment({ userId, userEmail, customerId, customerName, workspaceId, roleInCustomer }) {
  try {
    const result = await base44.functions.invoke("manageAssignment", {
      action: "create",
      user_id: userId,
      user_email: userEmail,
      customer_id: customerId,
      customer_name: customerName,
      workspace_id: workspaceId,
      role_in_customer: roleInCustomer || "viewer",
    });
    return result;
  } catch (error) {
    console.error("Failed to create assignment:", error);
    throw error;
  }
}

/**
 * Update an existing assignment (role or status).
 */
export async function updateAssignment(assignmentId, updates) {
  try {
    const result = await base44.functions.invoke("manageAssignment", {
      action: "update",
      assignment_id: assignmentId,
      ...updates,
    });
    return result;
  } catch (error) {
    console.error("Failed to update assignment:", error);
    throw error;
  }
}

/**
 * Delete an assignment.
 */
export async function deleteAssignment(assignmentId) {
  try {
    const result = await base44.functions.invoke("manageAssignment", {
      action: "delete",
      assignment_id: assignmentId,
    });
    return result;
  } catch (error) {
    console.error("Failed to delete assignment:", error);
    throw error;
  }
}

/**
 * Resolve all customer IDs a user can access (own + delegated).
 */
export async function resolveUserCustomers(userId) {
  try {
    const result = await base44.functions.invoke("manageAssignment", {
      action: "resolve",
      user_id: userId,
    });
    return result;
  } catch (error) {
    console.error("Failed to resolve user customers:", error);
    return { customer_ids: [], assignments: [] };
  }
}

/**
 * Delegation role metadata.
 */
export const DELEGATION_ROLES = {
  viewer: { label: "Viewer", description: "Read-only access to customer data" },
  contributor: { label: "Contributor", description: "Can create and edit customer data" },
  admin: { label: "Admin", description: "Full access to customer data and settings" },
};
