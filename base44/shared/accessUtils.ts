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
 * Check if a user is a customer-level admin (customer_admin).
 */
export function isCustomerAdmin(role: string | undefined | null): boolean {
  return normalizeRole(role) === "customer_admin";
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
 */
export function assignmentTypeToField(assignmentType: string): string {
  switch (assignmentType) {
    case "breakglass":
      return "breakglass_customer_ids";
    case "onboarding":
      return "onboarding_customer_ids";
    case "delegation":
    default:
      return ""; // delegation uses accessLevelToField
  }
}

/**
 * Get the denormalized array field for an assignment.
 * Breakglass and onboarding have their own fields; delegation uses access_level.
 */
export function getDenormalizedField(assignmentType: string, accessLevel?: string): string {
  if (assignmentType === "breakglass") return "breakglass_customer_ids";
  if (assignmentType === "onboarding") return "onboarding_customer_ids";
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
