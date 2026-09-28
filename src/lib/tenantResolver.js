/**
 * Resolução única de tenant/contexto — parte pura, sem React.
 *
 * Separada do hook (`tenantContext.js`) para poder ser exercitada fora do
 * browser: é aqui que vive a regra que todas as páginas passam a partilhar, e é
 * esta a decisão que a suíte de validação verifica para as nove identidades.
 *
 * Antes disto cada página resolvia o tenant à sua maneira — umas liam
 * `user.customer_id` directamente, outras olhavam para as delegações, outras
 * para o workspace selecionado — e o mesmo utilizador via listas cheias numa
 * página e vazias na seguinte (FA2), sem saber em que cliente estava a operar.
 *
 * Ordem de resolução:
 *   1. o cliente do workspace selecionado (o que faz o seletor de workspace
 *      alterar mesmo o contexto de dados — FB3);
 *   2. o tenant do próprio utilizador;
 *   3. os clientes a que o utilizador tem acesso por delegação viva.
 *
 * As delegações são re-validadas aqui (estado `active` e prazo no futuro), para
 * que uma delegação pendente, revogada ou expirada não alargue o contexto antes
 * de o servidor o fazer (F15).
 */

/** Identificador do utilizador, tolerando as duas formas do objecto de sessão. */
export function userIdOf(user) {
  return user?.id || user?.data?.id || '';
}

/** Email do utilizador, tolerando as duas formas do objecto de sessão. */
export function userEmailOf(user) {
  return user?.email || user?.data?.email || '';
}

/** Workspace associado ao utilizador, tolerando as duas formas do objecto. */
export function userWorkspaceIdOf(user) {
  return user?.workspace_id || user?.data?.workspace_id || '';
}

/** Workspace selecionado, tolerando as duas formas do objecto de sessão. */
export function selectedWorkspaceIdOf(user) {
  return user?.selected_workspace_id || user?.data?.selected_workspace_id || '';
}

/**
 * Clientes a que uma delegação viva dá acesso.
 * Só contam delegações `active` e dentro do prazo.
 */
export function activeDelegatedCustomerIds(assignments, { userId, email, now = Date.now() } = {}) {
  const ids = [];
  for (const a of assignments || []) {
    if (a.assignment_type !== 'delegation' || a.status !== 'active') continue;
    if (a.expires_at && new Date(a.expires_at).getTime() <= now) continue;
    const mine = (!!userId && a.user_id === userId) || (!!email && a.user_email === email);
    if (mine && a.customer_id && !ids.includes(a.customer_id)) ids.push(a.customer_id);
  }
  return ids;
}

/** Clientes de um workspace e de todos os seus descendentes (a carteira). */
export function workspaceSubtreeCustomerIds(workspaces, workspaceId) {
  if (!workspaceId) return [];
  const subtree = new Set([workspaceId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const ws of workspaces || []) {
      if (ws?.parent_id && subtree.has(ws.parent_id) && !subtree.has(ws.id)) {
        subtree.add(ws.id);
        grew = true;
      }
    }
  }
  return (workspaces || [])
    .filter((ws) => subtree.has(ws.id) && ws.customer_id)
    .map((ws) => ws.customer_id);
}

/** Todos os clientes que o utilizador pode ver, por ordem de prioridade. */
export function accessibleCustomerIds({ user, workspaces = [], delegatedCustomerIds = [] } = {}) {
  const ids = [];
  const add = (id) => {
    if (id && !ids.includes(id)) ids.push(id);
  };

  add(user?.customer_id);
  for (const id of delegatedCustomerIds) add(id);
  for (const id of workspaceSubtreeCustomerIds(workspaces, userWorkspaceIdOf(user))) add(id);

  return ids;
}

/**
 * O tenant activo: o do workspace selecionado, o próprio, ou o primeiro cliente
 * delegado. Devolve "" quando não há contexto de tenant.
 */
export function resolveActiveCustomerId({
  user,
  workspaces = [],
  delegatedCustomerIds = [],
  selectedWorkspaceId = '',
} = {}) {
  const accessible = accessibleCustomerIds({ user, workspaces, delegatedCustomerIds });

  if (selectedWorkspaceId) {
    const selected = (workspaces || []).find((ws) => ws.id === selectedWorkspaceId);
    if (selected?.customer_id && accessible.includes(selected.customer_id)) return selected.customer_id;
    const inSubtree = workspaceSubtreeCustomerIds(workspaces, selectedWorkspaceId).find((id) =>
      accessible.includes(id),
    );
    if (inSubtree) return inSubtree;
  }

  return accessible[0] || '';
}
