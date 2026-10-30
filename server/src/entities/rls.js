// Regras de acesso ao nível do registo (RLS), no formato definido em base44/entities/*.jsonc.
//
// Formato suportado:
//   null ou {}                         -> acesso livre
//   { "$or": [...] } / { "$and": [...] }
//   { "user_condition": { "role": "admin" } }        -> condição sobre o utilizador
//   { "data.customer_id": "{{user.data.customer_id}}" } -> condição sobre o registo
//   { "created_by_id": "{{user.id}}" }
// Várias chaves no mesmo objeto combinam-se com AND.
import { isPlainObject, getPath } from '../util.js';

const TEMPLATE_RE = /^\{\{\s*([\w.]+)\s*\}\}$/;
const UNRESOLVED = Symbol('unresolved');

/** Campos do utilizador que as regras podem referir (nunca chaves arbitrárias guardadas pelo utilizador). */
const TRUSTED_USER_FIELDS = ['customer_id', 'customer_name', 'display_name', 'language'];

const isScalar = (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

/** Contexto do utilizador para resolver modelos: campos base + `data` com campos personalizados de confiança. */
export function userTemplateContext(user) {
  if (!user) return null;
  const data = {};
  for (const key of TRUSTED_USER_FIELDS) if (isScalar(user[key])) data[key] = user[key];
  return { id: user.id, email: user.email, role: user.role, full_name: user.full_name, data, ...data };
}

function resolveValue(value, ctx) {
  if (typeof value === 'string') {
    const m = value.match(TEMPLATE_RE);
    if (m) {
      if (!ctx) return UNRESOLVED;
      const resolved = getPath({ user: ctx }, m[1]);
      // Só valores escalares: um objeto (ex.: {"$ne": null}) nunca pode virar operador de filtro.
      return isScalar(resolved) && resolved !== '' ? resolved : UNRESOLVED;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => resolveValue(v, ctx));
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveValue(v, ctx)]));
  return value;
}

function hasUnresolved(value) {
  if (value === UNRESOLVED) return true;
  if (Array.isArray(value)) return value.some(hasUnresolved);
  if (isPlainObject(value)) return Object.values(value).some(hasUnresolved);
  return false;
}

/** Converte o nome de campo da regra para o nome usado nos filtros de registos. */
const recordField = (key) => (key.startsWith('data.') ? key.slice(5) : key);

function userConditionHolds(cond, ctx) {
  if (!ctx) return false;
  return Object.entries(cond).every(([key, expected]) => {
    const resolved = resolveValue(expected, ctx);
    if (hasUnresolved(resolved)) return false;
    const actual = getPath(ctx, key);
    if (isPlainObject(resolved) && Array.isArray(resolved.$in)) return resolved.$in.includes(actual);
    if (Array.isArray(resolved)) return resolved.includes(actual);
    return actual === resolved;
  });
}

const and = (parts) => {
  if (parts.some((p) => p === false)) return false;
  const rest = parts.filter((p) => p !== true);
  if (rest.length === 0) return true;
  return rest.length === 1 ? rest[0] : { $and: rest };
};

const or = (parts) => {
  if (parts.some((p) => p === true)) return true;
  const rest = parts.filter((p) => p !== false);
  if (rest.length === 0) return false;
  return rest.length === 1 ? rest[0] : { $or: rest };
};

/**
 * Converte uma regra num filtro de registos (ou true/false).
 * Opção `nullMatchesUnresolved`: num create, um modelo vazio (ex.: utilizador sem customer_id)
 * só corresponde a registos em que o campo também está vazio. Nas leituras/alterações é sempre falso.
 */
export function ruleToFilter(rule, user, { nullMatchesUnresolved = false } = {}) {
  if (rule === null || rule === undefined) return true;
  // Uma regra booleana vale como está: `"delete": false` proíbe a todos (ex.: a trilha de auditoria).
  if (rule === false) return false;
  if (rule === true) return true;
  if (!isPlainObject(rule) || Object.keys(rule).length === 0) return true;
  const ctx = userTemplateContext(user);
  const walk = (node) => {
    const parts = [];
    for (const [key, value] of Object.entries(node)) {
      if (key === '$or') parts.push(or(value.map(walk)));
      else if (key === '$and') parts.push(and(value.map(walk)));
      else if (key === 'user_condition') parts.push(userConditionHolds(value, ctx));
      else {
        const resolved = resolveValue(value, ctx);
        if (hasUnresolved(resolved)) {
          if (nullMatchesUnresolved && resolved === UNRESOLVED) parts.push({ [recordField(key)]: null });
          else parts.push(false);
        } else {
          parts.push({ [recordField(key)]: resolved });
        }
      }
    }
    return and(parts);
  };
  return walk(rule);
}

/** Regras incorporadas para a entidade User (a Base44 aplica-as implicitamente). */
export const USER_RULES = {
  read: { $or: [{ user_condition: { role: 'admin' } }, { id: '{{user.id}}' }] },
  update: { $or: [{ user_condition: { role: 'admin' } }, { id: '{{user.id}}' }] },
  create: { user_condition: { role: 'admin' } },
  delete: { user_condition: { role: 'admin' } },
};
