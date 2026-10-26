/**
 * Shared HTTP / authorization helpers for backend functions.
 *
 * Every function keeps its own handler, but the cross-cutting concerns
 * (JSON parsing, auth gates, tenant-scoped record access, automation gates)
 * live here so they are implemented exactly once.
 */

/** Uniform JSON response. */
export function json(data, status = 200) {
  return Response.json(data, { status });
}

/** Parses the request's JSON body; returns {} when absent or invalid. */
export async function readJson(req) {
  try {
    return (await req.json()) || {};
  } catch {
    return {};
  }
}

/** The caller's customer id, wherever the SDK exposes it. */
export function userCustomerId(user) {
  return user?.customer_id ?? user?.data?.customer_id ?? null;
}

/** Authenticated user, or null when anonymous/expired. Never throws. */
export async function getAuthenticatedUser(base44) {
  try {
    return await base44.auth.me();
  } catch {
    return null;
  }
}

/** Platform admin (full cross-tenant access). */
export function isPlatformAdmin(user) {
  return user?.role === 'admin';
}

/** Admin or customer_admin — roles allowed to manage users/settings. */
export function isStaffRole(user) {
  return user?.role === 'admin' || user?.role === 'customer_admin';
}

/**
 * Record-level access: platform admins see everything; other users only
 * records of their own customer, or records they created, own or are
 * assigned to. Use for service-role reads whose result reaches the caller.
 */
export function canAccessRecord(user, record) {
  if (!user || !record) return false;
  if (isPlatformAdmin(user)) return true;
  const customerId = userCustomerId(user);
  if (customerId && record.customer_id === customerId) return true;
  return (
    record.created_by_id === user.id ||
    record.owner_email === user.email ||
    record.assigned_to === user.email
  );
}

/**
 * Gate for scheduled/system automations.
 *
 * A workflow invokes a backend function with the app owner's own session, so the
 * platform-admin identity *is* the automation gate. That is why no shared secret
 * lives in the workflow files any more: a secret written into the repository is a
 * secret leaked, and it had to be rotated by hand. A manual trigger by a platform
 * admin passes the same check; anonymous external callers fail `auth.me()` and are
 * rejected before any service-role read or write.
 *
 * Returns the 403 response to send, or null when authorized.
 */
export async function authorizeAutomationOrAdmin(req, base44) {
  const user = await getAuthenticatedUser(base44);
  if (isPlatformAdmin(user)) return null;
  return json({ error: 'Forbidden' }, 403);
}

/** Sync variant for handlers that already read the caller with `auth.me()`. */
export function isAutomationCaller(user) {
  return isPlatformAdmin(user);
}