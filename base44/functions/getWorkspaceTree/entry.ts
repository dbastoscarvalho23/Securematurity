import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { normalizeRole } from "../../shared/accessUtils.ts";

/**
 * Returns the full workspace hierarchy as a nested tree.
 * Admin-only: platform admins manage the entire workspace tree.
 *
 * Response: { tree: WorkspaceNode[] }
 * WorkspaceNode = { ...workspace, children: WorkspaceNode[] }
 */
import { resolveActor } from "../../shared/devActor.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await resolveActor(base44, req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (normalizeRole(user.role) !== "master_admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const workspaces = await base44.asServiceRole.entities.Workspace.list("name", 500);

    // Build a lookup map
    const map = new Map<string, any>();
    for (const ws of workspaces) {
      map.set(ws.id, { ...ws, children: [] });
    }

    // Build tree: attach each workspace to its parent's children array
    const roots: any[] = [];
    for (const ws of map.values()) {
      if (ws.parent_id && map.has(ws.parent_id)) {
        map.get(ws.parent_id).children.push(ws);
      } else {
        roots.push(ws);
      }
    }

    return Response.json({ tree: roots, total: workspaces.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
