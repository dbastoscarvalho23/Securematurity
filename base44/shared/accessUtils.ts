/**
 * Access Utilities — shared helpers for external access management.
 *
 * Used by manageAccess and breakGlassAccess backend functions to maintain
 * denormalized arrays on the User entity that drive RLS on operational entities.
 */

/**
 * Normalize a backend role to the 9-role tier system.
 * Maps legacy roles to their new equivalents.
 */
export function normalizeRole(role: string | undefined | null): string {
  if (!role) return "employee";
  const map: Record<string, string> = {
    admin: "master_admin",
    customer_admin: "customer_admin",
    user: "employee",
    master_admin: "master_admin",
    workspace_admin: "workspace_admin",
    partner_admin: "workspace_admin",
    grc_analyst: "grc_analyst",
    control_owner: "control_owner",
    executive: "executive",
    auditor: "auditor",
    employee: "employee",
    consultant: "consultant",
  };
  return map[role] || "employee";
}

/**
 * Check if a user is a platform-level admin (master_admin or workspace_admin).
 */
export function isPlatformAdmin(role: string | undefined | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === "master_admin" || normalized === "workspace_admin";
}

/**
 * Check if a user is the platform owner (master_admin).
 * Only the platform owner acts platform-wide; a partner admin is scoped to
 * the customers of its own workspace subtree (carteira).
 */
export function isPlatformOwner(role: string | undefined | null): boolean {
  return normalizeRole(role) === "master_admin";
}

/**
 * Check if a user is a partner admin (workspace_admin).
 * A partner admin is NOT a platform admin: it only operates inside the
 * carteira (workspace subtree) it belongs to.
 */
export function isPartnerAdmin(role: string | undefined | null): boolean {
  return normalizeRole(role) === "workspace_admin";
}

/**
 * Check if a user is a customer-level admin (customer_admin).
 */
export function isCustomerAdmin(role: string | undefined | null): boolean {
  return normalizeRole(role) === "customer_admin";
}

/**
 * Resolve the customer scope of a user.
 *
 * - master_admin (platform owner): every customer.
 * - workspace_admin (partner admin): the customers of its own workspace and of
 *   every descendant workspace (its carteira), plus its own customer.
 * - everyone else: their own customer only.
 *
 * Used to keep the partner admin inside its carteira on the write paths
 * (list/resolve/onboarding/role assignment), which the entity RLS cannot express.
 */
export async function resolveScopeCustomerIds(
  base44: any,
  user: any,
): Promise<{ all: boolean; customerIds: string[] }> {
  const own = user?.customer_id ? [user.customer_id] : [];

  if (isPlatformOwner(user?.role)) return { all: true, customerIds: [] };

  if (!isPartnerAdmin(user?.role) || !user?.workspace_id) {
    return { all: false, customerIds: own };
  }

  const workspaces = await base44.asServiceRole.entities.Workspace.list("name", 500);

  // Workspace subtree: the partner's workspace plus every descendant.
  const subtree = new Set<string>([user.workspace_id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const ws of workspaces) {
      if (ws?.parent_id && subtree.has(ws.parent_id) && !subtree.has(ws.id)) {
        subtree.add(ws.id);
        grew = true;
      }
    }
  }

  const customerIds = workspaces
    .filter((w: any) => subtree.has(w.id) && w.customer_id)
    .map((w: any) => w.customer_id);

  // The tenant↔workspace link exists on both sides (`Workspace.customer_id` and
  // `Customer.workspace_id`), and a workspace created before its customer — or
  // by a path that does not write the link back — carries no `customer_id`.
  // Reading only the Workspace side left the carteira empty for those tenants,
  // so a partner admin was refused on its own customers. Read both ends.
  const customers = await base44.asServiceRole.entities.Customer.list("name", 500);
  for (const customer of customers) {
    if (customer?.workspace_id && subtree.has(customer.workspace_id)) customerIds.push(customer.id);
  }

  return { all: false, customerIds: Array.from(new Set([...customerIds, ...own])) };
}

/**
 * Resolve the customers a user may READ (not write).
 *
 * Wider than resolveScopeCustomerIds on purpose: besides the user's own tenant
 * and a partner admin's carteira, it includes the tenants reached through
 * delegation — the denormalized `delegated_view_customer_ids` /
 * `delegated_edit_customer_ids` arrays and the user's own live delegations.
 *
 * Delegations are re-validated at read time: a record only counts when it is a
 * delegation in the `active` state and its `expires_at` is still in the future,
 * so a pending, revoked or expired assignment never widens the scope (F15 —
 * entity RLS alone honours the denormalized arrays without checking the dates).
 *
 * Write paths must keep using resolveScopeCustomerIds.
 */
export async function resolveReadableCustomerIds(
  base44: any,
  user: any,
): Promise<{ all: boolean; customerIds: string[] }> {
  if (isPlatformOwner(user?.role)) return { all: true, customerIds: [] };

  const scope = await resolveScopeCustomerIds(base44, user);
  const ids = new Set<string>(scope.customerIds);

  for (const field of ["delegated_view_customer_ids", "delegated_edit_customer_ids"]) {
    for (const id of user?.[field] || []) ids.add(id);
  }

  if (user?.id || user?.email) {
    const assignments = await base44.asServiceRole.entities.UserCustomerAssignment.list("-created_date", 500);
    const now = Date.now();
    for (const a of assignments) {
      if (a.assignment_type !== "delegation" || a.status !== "active") continue;
      if (a.expires_at && new Date(a.expires_at).getTime() <= now) continue;
      const mine = a.user_id === user.id || (!!user.email && a.user_email === user.email);
      if (mine && a.customer_id) ids.add(a.customer_id);
    }
  }

  return { all: false, customerIds: Array.from(ids) };
}

/**
 * Add a value to a user's denormalized array field (deduplication guaranteed).
 * Returns the updated array.
 */
export function addToArray(arr: string[] | undefined | null, value: string): string[] {
  const current = arr || [];
  if (current.includes(value)) return current;
  return [...current, value];
}

/**
 * Remove a value from a user's denormalized array field.
 * Returns the updated array.
 */
export function removeFromArray(arr: string[] | undefined | null, value: string): string[] {
  const current = arr || [];
  return current.filter((v) => v !== value);
}

/**
 * Map access_level to the denormalized array field name on User.
 */
export function accessLevelToField(accessLevel: string): string {
  if (accessLevel === "admin" || accessLevel === "contributor") {
    return "delegated_edit_customer_ids";
  }
  return "delegated_view_customer_ids";
}

/**
 * Map assignment_type to the denormalized array field name on User.
 * Only delegations grant operational access; onboarding is account set-up only.
 */
export function assignmentTypeToField(assignmentType: string): string {
  switch (assignmentType) {
    case "onboarding":
      return "onboarding_customer_ids";
    case "delegation":
    default:
      return ""; // delegation uses accessLevelToField
  }
}

/**
 * Get the denormalized array field for an assignment.
 * Only an approved delegation writes the operational access arrays; onboarding
 * keeps to onboarding_customer_ids and never grants compliance data access.
 */
export function getDenormalizedField(assignmentType: string, accessLevel?: string): string {
  if (assignmentType !== "delegation") return "";
  return accessLevelToField(accessLevel || "viewer");
}

/**
 * Write an audit log entry for an access management action.
 */
export async function writeAccessAuditLog(
  base44: any,
  action: string,
  customerId: string,
  userEmail: string,
  details: string,
  entityType = "UserCustomerAssignment",
  entityId?: string,
): Promise<void> {
  await base44.asServiceRole.entities.AuditLog.create({
    customer_id: customerId,
    action,
    user_email: userEmail,
    entity_type: entityType,
    entity_id: entityId || "",
    details,
  });
}
