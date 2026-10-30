/**
 * Acesso delegado: as regras que o servidor aplica.
 *
 * Uma atribuição (UserCustomerAssignment) é a única porta pela qual um consultor chega aos dados de um cliente.
 * Desenho adaptado da app «AnkoraOne Plataforma GRC» (Victor Pereira, base44/shared/delegation.ts):
 *
 * - `delegation`: consultor ou auditor que trabalha com o cliente, com nível (viewer, contributor, admin) e prazo
 *   até 365 dias.
 * - `external`: acesso temporário, sempre de leitura, até 30 dias.
 *
 * Quem decide é o cliente: o seu administrador próprio (customer_admin) concede, aprova e revoga.
 * A plataforma pede e acompanha; ninguém decide o próprio acesso. Uma atribuição fora do prazo deixa de valer quando
 * é lida, e as listas no perfil do utilizador (que as regras das entidades leem) voltam a derivar-se a cada decisão,
 * no início de sessão e de hora a hora.
 *
 * As funções puras não importam nada do SDK e testam-se diretamente (src/lib/__tests__/delegation.test.js).
 */
import { DELEGATED_FIELDS, isPlatformAdmin, userCustomerId } from './http.ts';

export const ACCESS_LEVELS = ['viewer', 'contributor', 'admin'];
export const ASSIGNMENT_TYPES = ['delegation', 'external'];
export const STATUSES = ['requested', 'active', 'rejected', 'revoked', 'expired'];
export const MAX_DELEGATION_DAYS = 365;
export const MAX_EXTERNAL_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export function isExpired(assignment: any, now = Date.now()): boolean {
  return !!assignment?.expires_at && new Date(assignment.expires_at).getTime() <= now;
}

/** Estado real no momento em que é lido: uma atribuição ativa fora do prazo está expirada. */
export function effectiveStatus(assignment: any, now = Date.now()): string {
  const stored = STATUSES.includes(assignment?.status) ? assignment.status : 'requested';
  if ((stored === 'active' || stored === 'requested') && isExpired(assignment, now)) return 'expired';
  return stored;
}

/** Erro de validação de um pedido de acesso, ou null quando é válido. */
export function validateRequest(payload: any, now = Date.now()): string | null {
  const type = payload?.assignment_type || 'delegation';
  if (!ASSIGNMENT_TYPES.includes(type)) return 'Tipo de acesso inválido.';
  const level = payload?.access_level || 'viewer';
  if (!ACCESS_LEVELS.includes(level)) return 'Nível de acesso inválido.';
  if (type === 'external' && level !== 'viewer') return 'Um acesso externo é sempre de leitura.';
  if (!payload?.customer_id) return 'Falta o cliente.';
  if (!payload?.user_email) return 'Falta o utilizador.';
  if (String(payload?.reason || '').trim().length < 10) return 'A justificação é obrigatória (pelo menos 10 caracteres).';
  if (!payload?.expires_at) return 'O prazo é obrigatório.';
  const expires = new Date(payload.expires_at).getTime();
  if (Number.isNaN(expires)) return 'Prazo inválido.';
  if (expires <= now) return 'O prazo tem de ser no futuro.';
  const maxDays = type === 'external' ? MAX_EXTERNAL_DAYS : MAX_DELEGATION_DAYS;
  if (expires > now + maxDays * DAY) return `O prazo máximo é de ${maxDays} dias.`;
  return null;
}

/** A atribuição é da própria pessoa que pede a decisão? Ninguém decide o próprio acesso. */
export function isOwnAccess(actor: any, assignment: any): boolean {
  if (!actor || !assignment) return false;
  if (actor.id && assignment.user_id && String(actor.id) === String(assignment.user_id)) return true;
  const email = String(actor.email || '').trim().toLowerCase();
  return email !== '' && email === String(assignment.user_email || '').trim().toLowerCase();
}

/**
 * Quem decide os acessos a este cliente: o seu administrador próprio (customer_admin). Nem a plataforma nem um
 * consultor com delegação de nível admin decidem: uma delegação nunca pode estender-se a si própria nem a colegas.
 */
export function isDecider(actor: any, customerId: string): boolean {
  if (!actor || !customerId || isPlatformAdmin(actor)) return false;
  return actor.role === 'customer_admin' && String(userCustomerId(actor) || '') === String(customerId);
}

/**
 * Recusa de uma decisão (conceder, aprovar, rejeitar), ou null quando quem pede pode decidir.
 * A plataforma pede e acompanha, mas não decide em nome do cliente.
 */
export function decisionRefusal(actor: any, assignment: any): string | null {
  if (isOwnAccess(actor, assignment)) return 'Ninguém decide o próprio acesso.';
  if (isDecider(actor, assignment?.customer_id)) return null;
  if (isPlatformAdmin(actor)) return 'O acesso aos dados de um cliente é decidido pelo cliente: a plataforma pede e acompanha.';
  return 'Só a administração deste cliente pode decidir este acesso.';
}

/** Revogar reduz acesso: pode o cliente, a plataforma e a própria pessoa (renúncia). */
export function revokeRefusal(actor: any, assignment: any): string | null {
  if (isPlatformAdmin(actor) || isOwnAccess(actor, assignment) || isDecider(actor, assignment?.customer_id)) return null;
  return 'Sem permissão para revogar este acesso.';
}

/** Listas delegadas derivadas das atribuições vivas de uma pessoa. */
export function deriveScope(assignments: any[], now = Date.now()): Record<string, string[]> {
  const scope: Record<string, Set<string>> = {
    [DELEGATED_FIELDS.viewer]: new Set(),
    [DELEGATED_FIELDS.contributor]: new Set(),
    [DELEGATED_FIELDS.admin]: new Set(),
  };
  for (const a of assignments || []) {
    if (effectiveStatus(a, now) !== 'active' || !a.customer_id) continue;
    const level = a.assignment_type === 'external' ? 'viewer' : (ACCESS_LEVELS.includes(a.access_level) ? a.access_level : 'viewer');
    scope[DELEGATED_FIELDS[level]].add(String(a.customer_id));
  }
  return Object.fromEntries(Object.entries(scope).map(([k, v]) => [k, [...v].sort()]));
}

const sameList = (a: any, b: string[]) => JSON.stringify([...(Array.isArray(a) ? a.map(String) : [])].sort()) === JSON.stringify(b);

/**
 * Volta a derivar as listas delegadas de uma pessoa a partir das suas atribuições e grava-as no perfil quando mudam.
 * Marca como expiradas as atribuições ativas fora do prazo. Devolve as listas em vigor.
 */
export async function syncUserScope(base44: any, user: any, now = Date.now()): Promise<Record<string, string[]>> {
  const db = base44.asServiceRole.entities;
  const email = String(user?.email || '').toLowerCase();
  const byEmail = email ? await db.UserCustomerAssignment.filter({ user_email: email }, '-created_date', 500).catch(() => []) : [];
  const byId = user?.id ? await db.UserCustomerAssignment.filter({ user_id: user.id }, '-created_date', 500).catch(() => []) : [];
  const all = [...new Map([...(byEmail || []), ...(byId || [])].map((a) => [a.id, a])).values()];
  for (const a of all) {
    if (a.status === 'active' && effectiveStatus(a, now) === 'expired') {
      await db.UserCustomerAssignment.update(a.id, { status: 'expired' }).catch(() => null);
    }
  }
  const scope = deriveScope(all, now);
  if (user?.id) {
    const current = await db.User.get(user.id).catch(() => null);
    const changed = Object.entries(scope).some(([k, v]) => !sameList(current?.[k] ?? current?.data?.[k], v));
    // Uma falha propaga-se: quem chama decide (a sincronização regista-a por pessoa e tenta de novo na hora seguinte).
    if (current && changed) await db.User.update(user.id, scope);
  }
  return scope;
}

/** Administradores (próprios) de um cliente: quem recebe o pedido de decisão. */
export async function customerAdmins(base44: any, customerId: string): Promise<any[]> {
  const users = await base44.asServiceRole.entities.User.filter({ customer_id: customerId }).catch(() => []);
  return (users || []).filter((u: any) => u.role === 'customer_admin' && String(userCustomerId(u)) === String(customerId));
}
