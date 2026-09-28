/**
 * Dev Actor — identidade explícita do invocador, SÓ em desenvolvimento.
 *
 * O backend local (in-memory) mantém uma única sessão activa e ignora escritas
 * na entidade `User` (criação, eliminação e alteração do campo `role`), pelo que
 * não é possível validar RBAC, delegações e licenciamento por identidade
 * percorrendo a aplicação com um único utilizador autenticado.
 *
 * Este helper permite que as funções de backend recebam a identidade do
 * utilizador de teste no limite da invocação, a partir do cabeçalho
 * `x-base44-dev-actor` (JSON em base64). Sem o cabeçalho, a função comporta-se
 * exactamente como antes e devolve o utilizador autenticado.
 *
 * FECHO HERMÉTICO: o cabeçalho só é honrado quando a variável de ambiente
 * `BASE44_DEV_IDENTITY` vale exactamente "1". Essa variável é definida apenas no
 * `docker-compose.base44.yml` (ambiente local); nenhum ambiente implantado a
 * define, pelo que em produção este caminho está desligado e o cabeçalho é
 * ignorado por completo. Nunca acrescentar a variável a outro ambiente.
 */

/** True apenas quando o ambiente local autoriza identidade explícita. */
export function devIdentityEnabled(): boolean {
  return Deno.env.get("BASE44_DEV_IDENTITY") === "1";
}

/** Decode the base64 `x-base44-dev-actor` header (UTF-8 safe). */
function decodeActor(raw: string): any | null {
  try {
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || !parsed.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Resolve the actor a function should act as.
 *
 * - Produção (ou qualquer ambiente sem `BASE44_DEV_IDENTITY=1`): o utilizador
 *   autenticado, exactamente como antes.
 * - Desenvolvimento com o cabeçalho presente: a identidade de teste indicada,
 *   marcada com `__dev_actor: true` para que o resultado seja auditável.
 */
export async function resolveActor(base44: any, req: Request): Promise<any> {
  let authenticated: any = null;
  try {
    authenticated = await base44.auth.me();
  } catch {
    authenticated = null;
  }

  if (!devIdentityEnabled()) return authenticated;

  const raw = req.headers.get("x-base44-dev-actor");
  if (!raw) return authenticated;

  const actor = decodeActor(raw);
  if (!actor) return authenticated;

  return {
    ...actor,
    id: actor.id || `dev-${actor.role}`,
    email: actor.email || `dev.${actor.role}@local.test`,
    full_name: actor.full_name || `Dev ${actor.role}`,
    __dev_actor: true,
  };
}
