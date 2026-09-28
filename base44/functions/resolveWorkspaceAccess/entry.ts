import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { normalizeRole } from "../../shared/accessUtils.ts";

/**
 * Resolves the set of workspace IDs a user can access.
 *
 * Access model:
 * - master_admin (platform owner, including the legacy `admin` role): all workspaces
 * - everyone else: their own workspace + all descendant workspaces (uses the
 *   ancestor_ids chain to find descendants of their workspace), and never any
 *   workspace outside that subtree
 * - a user with no workspace_id cannot resolve somebody else's workspace at all:
 *   the guard no longer depends on the caller having a workspace_id (F8)
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
    // The role is normalised — no literal comparison, so a legacy `admin` and a
    // master_admin behave the same (F7).
    const isOwner = normalizeRole(user.role) === "master_admin";

    // Platform owner without a specific target gets everything
    if (isOwner && !targetWorkspaceId) {
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

    // Scope check (F7/F8): only the platform owner resolves outside its own
    // subtree, and the guard applies even when the caller has no workspace_id.
    if (!isOwner) {
      if (!user.workspace_id) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const permitted = new Set<string>([user.workspace_id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const ws of workspaces) {
          if (ws?.parent_id && permitted.has(ws.parent_id) && !permitted.has(ws.id)) {
            permitted.add(ws.id);
            grew = true;
          }
        }
      }
      if (!permitted.has(targetWorkspaceId)) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
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
