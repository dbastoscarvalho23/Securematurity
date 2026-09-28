/**
 * Workspace utilities for the frontend.
 * Provides helpers to fetch the workspace tree and resolve workspace access.
 */
import { base44 } from "@/api/base44Client";

/**
 * Fetch the full workspace tree (admin only).
 * Returns a nested tree of workspace nodes.
 */
export async function fetchWorkspaceTree() {
  try {
    const result = await base44.functions.invoke("getWorkspaceTree", {});
    return result;
  } catch (error) {
    console.error("Failed to fetch workspace tree:", error);
    return { tree: [], total: 0 };
  }
}

/**
 * Resolve the set of workspace IDs and customer IDs a user can access.
 * For non-admin users, returns their workspace + all descendants.
 */
export async function resolveWorkspaceAccess(workspaceId) {
  try {
    const result = await base44.functions.invoke("resolveWorkspaceAccess", {
      workspace_id: workspaceId,
    });
    return result;
  } catch (error) {
    console.error("Failed to resolve workspace access:", error);
    return { workspace_ids: [], customer_ids: [] };
  }
}

/**
 * Run the idempotent workspace migration.
 * Creates root workspaces for existing customers and links them.
 */
export async function migrateExistingWorkspaces() {
  try {
    const result = await base44.functions.invoke("migrateExistingWorkspaces", {});
    return result;
  } catch (error) {
    console.error("Failed to migrate workspaces:", error);
    throw error;
  }
}

/**
 * Flatten a workspace tree into a list with depth info.
 * Useful for displaying the hierarchy as a flat list with indentation.
 */
export function flattenWorkspaceTree(tree, depth = 0, result = []) {
  for (const node of tree) {
    result.push({ ...node, _depth: depth });
    if (node.children && node.children.length > 0) {
      flattenWorkspaceTree(node.children, depth + 1, result);
    }
  }
  return result;
}

/**
 * Count total workspaces in a tree (including nested children).
 */
export function countWorkspaces(tree) {
  let count = 0;
  for (const node of tree) {
    count += 1;
    if (node.children && node.children.length > 0) {
      count += countWorkspaces(node.children);
    }
  }
  return count;
}

/**
 * Find a workspace node by ID in the tree.
 */
export function findWorkspaceInTree(tree, workspaceId) {
  for (const node of tree) {
    if (node.id === workspaceId) return node;
    if (node.children && node.children.length > 0) {
      const found = findWorkspaceInTree(node.children, workspaceId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Workspace type metadata for display.
 */
export const WORKSPACE_TYPES = {
  root: { label: "Root", color: "text-blue-600", badge: "bg-blue-100 text-blue-700" },
  organization: { label: "Organization", color: "text-indigo-600", badge: "bg-indigo-100 text-indigo-700" },
  division: { label: "Division", color: "text-purple-600", badge: "bg-purple-100 text-purple-700" },
  subsidiary: { label: "Subsidiary", color: "text-green-600", badge: "bg-green-100 text-green-700" },
  department: { label: "Department", color: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
};
