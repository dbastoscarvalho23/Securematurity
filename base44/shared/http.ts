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

// ─── Acesso delegado ────────────────────────────────────────────────────────────────────────────────────────────
// Um consultor (papel `consultant`) não tem cliente próprio: chega aos clientes que lhe concederam acesso, por
// atribuições (UserCustomerAssignment) aprovadas pelo próprio cliente e com prazo. O servidor deriva delas três
// listas no perfil do utilizador, as mesmas que as regras de acesso das entidades leem. Ver docs/acesso-delegado.md.

export const DELEGATED_FIELDS = {
  viewer: 'delegated_view_customer_ids',
  contributor: 'delegated_edit_customer_ids',
  admin: 'delegated_admin_customer_ids',
};

function listOf(user, field) {
  const value = user?.[field] ?? user?.data?.[field];
  return Array.isArray(value) ? value.map(String) : [];
}

/** Clientes a que o utilizador chega por delegação, a partir de um nível mínimo (viewer inclui os níveis acima). */
export function delegatedCustomerIds(user, minLevel = 'viewer') {
  const levels = minLevel === 'admin' ? ['admin'] : minLevel === 'contributor' ? ['contributor', 'admin'] : ['viewer', 'contributor', 'admin'];
  return Array.from(new Set(levels.flatMap((level) => listOf(user, DELEGATED_FIELDS[level]))));
}

/**
 * Papel efetivo de um utilizador num cliente:
 * - 'platform': administrador da plataforma (todos os clientes);
 * - 'admin': administrador do cliente, pelo próprio papel ou por delegação de nível admin;
 * - 'member': membro do cliente, ou delegação de nível contributor (lê e escreve conteúdo);
 * - 'viewer': delegação de nível viewer (só lê);
 * - null: sem acesso.
 */
export function customerRole(user, customerId) {
  if (!user || !customerId) return null;
  if (isPlatformAdmin(user)) return 'platform';
  const id = String(customerId);
  const own = userCustomerId(user);
  if (own && String(own) === id) return user.role === 'customer_admin' ? 'admin' : 'member';
  if (listOf(user, DELEGATED_FIELDS.admin).includes(id)) return 'admin';
  if (listOf(user, DELEGATED_FIELDS.contributor).includes(id)) return 'member';
  if (listOf(user, DELEGATED_FIELDS.viewer).includes(id)) return 'viewer';
  return null;
}

/** O papel chega para escrever conteúdo do cliente? */
export const roleCanWrite = (role) => role === 'platform' || role === 'admin' || role === 'member';
/** O papel chega para gerir o cliente (o que hoje é do customer_admin)? */
export const roleCanManage = (role) => role === 'platform' || role === 'admin';

/**
 * Cliente de um pedido. O administrador da plataforma escolhe livremente (ou fica com o seu, se tiver). Os restantes
 * ficam com o cliente pedido só se tiverem acesso a ele (e escrita, quando `write`), ou, sem pedido, com o próprio
 * cliente, ou com o único cliente delegado. Devolve { customerId, role } ou null (sem acesso).
 */
export function resolveCustomer(user, requested, { write = false } = {}) {
  if (!user) return null;
  const asked = requested ? String(requested) : '';
  if (isPlatformAdmin(user)) return { customerId: asked || userCustomerId(user) || null, role: 'platform' };
  let customerId = asked || userCustomerId(user) || null;
  if (!customerId) {
    const delegated = delegatedCustomerIds(user);
    if (delegated.length === 1) customerId = delegated[0];
  }
  const role = customerRole(user, customerId);
  if (!role || (write && !roleCanWrite(role))) return null;
  return { customerId: String(customerId), role };
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
  // Acesso delegado (aprovado pelo cliente, com prazo) aos registos desse cliente.
  if (record.customer_id && customerRole(user, record.customer_id)) return true;
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