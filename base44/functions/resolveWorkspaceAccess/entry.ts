import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";

/**
 * Resolves the set of workspace IDs a user can access.
 *
 * Access model:
 * - admin: all workspaces
 * - customer_admin / user: their own workspace + all descendant workspaces
 *   (uses ancestor_ids chain to find descendants of their workspace)
 *
 * Request body: { workspace_id?: string }
 * If workspace_id is provided, resolves descendants of that workspace.
 * Otherwise uses the caller's own workspace_id (or customer_id as fallback).
 *
 * Response: { workspace_ids: string[], customer_ids: string[] }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const targetWorkspaceId = body.workspace_id || user.workspace_id;

    // Admin without a specific target gets everything
    if (user.role === "admin" && !targetWorkspaceId) {
      const workspaces = await base44.asServiceRole.entities.Workspace.list("name", 500);
      const workspaceIds = workspaces.map((w: any) => w.id);
      const customerIds = workspaces.filter((w: any) => w.customer_id).map((w: any) => w.customer_id);
      return Response.json({ workspace_ids: workspaceIds, customer_ids: customerIds });
    }

    if (!targetWorkspaceId) {
      // No workspace assigned — fall back to customer_id only
      if (user.customer_id) {
        return Response.json({ workspace_ids: [], customer_ids: [user.customer_id] });
      }
      return Response.json({ workspace_ids: [], customer_ids: [] });
    }

    // Fetch all workspaces to resolve descendants
    const workspaces = await base44.asServiceRole.entities.Workspace.list("name", 500);

    // Find the target workspace
    const targetWs = workspaces.find((w: any) => w.id === targetWorkspaceId);
    if (!targetWs) {
      // Workspace not found — fall back to customer_id
      if (user.customer_id) {
        return Response.json({ workspace_ids: [], customer_ids: [user.customer_id] });
      }
      return Response.json({ workspace_ids: [], customer_ids: [] });
    }

    // Security check: non-admin users can only resolve from their own workspace
    if (user.role !== "admin" && user.workspace_id && user.workspace_id !== targetWorkspaceId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find all descendants: workspaces whose ancestor_ids contains targetWorkspaceId
    const descendantIds = new Set<string>([targetWorkspaceId]);
    for (const ws of workspaces) {
      if (ws.ancestor_ids && Array.isArray(ws.ancestor_ids) && ws.ancestor_ids.includes(targetWorkspaceId)) {
        descendantIds.add(ws.id);
      }
    }

    // Collect customer_ids from accessible workspaces
    const customerIds = workspaces
      .filter((w: any) => descendantIds.has(w.id) && w.customer_id)
      .map((w: any) => w.customer_id);

    // Always include the user's own customer_id
    if (user.customer_id && !customerIds.includes(user.customer_id)) {
      customerIds.push(user.customer_id);
    }

    return Response.json({
      workspace_ids: Array.from(descendantIds),
      customer_ids: customerIds,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
