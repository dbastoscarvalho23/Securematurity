/**
 * Cliente ativo de um consultor (papel `consultant`, acesso delegado).
 *
 * Um consultor chega a vários clientes, cada um com o nível que o cliente lhe concedeu. A interface trabalha num de
 * cada vez: o escolhido no topo da página fica aqui (por navegador) e é o que as páginas veem em `user.customer_id`.
 * Quem decide o acesso é sempre o servidor, com a sessão real e as regras das entidades; isto só orienta a interface.
 */
export const ACTIVE_CUSTOMER_KEY = 'ankora-active-customer';
const FIELDS = { viewer: 'delegated_view_customer_ids', contributor: 'delegated_edit_customer_ids', admin: 'delegated_admin_customer_ids' };

const listOf = (user, field) => {
  const v = user?.[field] ?? user?.data?.[field];
  return Array.isArray(v) ? v.map(String) : [];
};

export function readActiveCustomer() {
  try { return localStorage.getItem(ACTIVE_CUSTOMER_KEY) || null; } catch { return null; }
}

export function writeActiveCustomer(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_CUSTOMER_KEY, String(id));
    else localStorage.removeItem(ACTIVE_CUSTOMER_KEY);
  } catch { /* sem armazenamento local */ }
}

/** Clientes a que o consultor chega e o nível em cada um (o mais alto, se houver repetição). */
export function delegatedLevels(user) {
  const levels = {};
  for (const level of ['viewer', 'contributor', 'admin']) for (const id of listOf(user, FIELDS[level])) levels[id] = level;
  const own = user?.customer_id ?? user?.data?.customer_id;
  if (own && !levels[own]) levels[String(own)] = 'own';
  return levels;
}

/**
 * Utilizador como a interface o deve ver. Para quem não é consultor, é o próprio. Para um consultor: o cliente
 * ativo em `customer_id`, o papel equivalente ao nível nesse cliente (admin → customer_admin; outros → user) e o
 * papel real em `platform_role`.
 */
export function effectiveUser(raw, activeId = readActiveCustomer()) {
  if (!raw || raw.role !== 'consultant') return raw;
  const levels = delegatedLevels(raw);
  const ids = Object.keys(levels);
  const active = activeId && levels[activeId] ? activeId : (ids.length === 1 ? ids[0] : null);
  const level = active ? levels[active] : null;
  return {
    ...raw,
    platform_role: 'consultant',
    home_customer_id: raw.customer_id ?? raw.data?.customer_id ?? null,
    accessible_customer_ids: ids,
    delegated_level: level,
    read_only: level === 'viewer',
    role: level === 'admin' ? 'customer_admin' : 'user',
    customer_id: active,
  };
}

// Só depois de a sessão confirmar que a pessoa é consultora (AuthContext) é que os pedidos levam o cliente ativo.
// Até lá (ou para qualquer outro papel), um valor deixado no navegador por outra sessão nunca é enviado.
let consultantSession = false;
export function setConsultantSession(value) { consultantSession = Boolean(value); }

/** Acrescenta o cliente ativo a um pedido a uma função, quando o pedido não indica nenhum (só consultores). */
export function withActiveCustomer(payload) {
  if (!consultantSession) return payload;
  const active = readActiveCustomer();
  if (!active || !payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  if (payload.customer_id) return payload;
  return { ...payload, customer_id: active };
}
