/**
 * Limitação de ritmo por ator (OP-S2) — um só sítio onde o ritmo é contado.
 *
 * Porquê aqui: as escritas da aplicação passam todas por funções de backend, e
 * os caminhos que chamam IA também, pelo que a função é o ponto único onde a
 * regra pode viver — o mesmo padrão do `licenseGuard.ts` (uma decisão, um
 * ficheiro). Nenhuma página, componente ou cliente escreve esta regra.
 *
 * O que é: uma janela fixa por (ator, balde), em memória do processo. A conta
 * sobe a cada chamada e volta a zero quando a janela termina. Quem passa do
 * limite recebe `429` com `Retry-After` — não é uma decisão de autorização (essa
 * continua a ser do RBAC e do licenciamento) mas um travão de custo e de dano:
 * uma conta mal comportada deixa de ser ilimitada.
 *
 * Limites por balde, não por função: um balde é uma família de trabalho com o
 * mesmo custo e o mesmo risco (`ai`, `write`, `write_sensitive`). Uma função
 * escolhe o balde que descreve o que faz — nunca inventa um número.
 *
 * Limitação conhecida e assumida: o contador vive no processo (isolado do
 * `base44 dev`/workerd), tal como o resto do estado local da aplicação. Num
 * backend com várias instâncias cada uma conta o seu lado — a regra continua a
 * travar o abuso por instância e nunca bloqueia trabalho legítimo por engano; um
 * contador partilhado é matéria de infraestrutura, não desta camada. O contador
 * também nunca lança: qualquer falha conta como permitido (falha-aberta), porque
 * isto é um travão de custo e não um controlo de acesso.
 */

/** Regra de um balde: quantas chamadas por janela. */
export interface RateLimitRule {
  /** Chamadas permitidas dentro da janela. */
  limit: number;
  /** Tamanho da janela, em milissegundos. */
  windowMs: number;
}

/**
 * Catálogo de baldes. Um número novo só entra aqui, com o porquê na nota.
 *
 * - `ai` — uma resposta de IA por chamada, com custo por token (busca semântica
 *   de documentos, guias). 20/min por ator trava o abuso sem atrapalhar o uso.
 * - `ai_extract` — extração de um ficheiro inteiro para IA (importação de bases
 *   de perguntas): o trabalho é longo e caro, e o uso legítimo é sequencial.
 * - `write` — escrita corrente de um ator (avaliações, conteúdos, pacotes).
 * - `write_sensitive` — escrita que decide acesso, dinheiro ou âmbito:
 *   delegações, licenciamento, papéis. Limite mais curto de propósito.
 */
export const RATE_LIMIT_RULES = {
  ai: { limit: 20, windowMs: 60_000 },
  ai_extract: { limit: 6, windowMs: 60_000 },
  write: { limit: 60, windowMs: 60_000 },
  write_sensitive: { limit: 20, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitBucket = keyof typeof RATE_LIMIT_RULES;

/** Contador de uma janela fixa. */
interface Counter {
  count: number;
  resetAt: number;
}

const counters = new Map<string, Counter>();

/** Quem é contado: o ator, nunca a função. */
function actorKey(actor: any): string {
  return actor?.email || actor?.id || actor?.__dev_actor ? actor?.email || actor?.id : "anon";
}

/** Chave do contador — (balde, ator). Exportada para os testes. */
export function rateLimitKey(actor: any, bucket: RateLimitBucket): string {
  return `${bucket}:${actorKey(actor)}`;
}

export interface RateLimitResult {
  allowed: boolean;
  bucket: RateLimitBucket;
  limit: number;
  /** Chamadas ainda disponíveis nesta janela. */
  remaining: number;
  /** Milissegundos até a janela reiniciar. */
  retryAfterMs: number;
}

/**
 * Conta uma chamada do ator no balde e diz se passa.
 *
 * Nunca lança: qualquer falha interna devolve `allowed: true` (falha-aberta).
 */
export function consumeRateLimit(
  actor: any,
  bucket: RateLimitBucket,
  rule: RateLimitRule = RATE_LIMIT_RULES[bucket],
): RateLimitResult {
  try {
    const key = rateLimitKey(actor, bucket);
    const now = Date.now();
    const current = counters.get(key);

    if (!current || current.resetAt <= now) {
      counters.set(key, { count: 1, resetAt: now + rule.windowMs });
      return { allowed: true, bucket, limit: rule.limit, remaining: rule.limit - 1, retryAfterMs: 0 };
    }

    current.count += 1;
    if (current.count > rule.limit) {
      return {
        allowed: false,
        bucket,
        limit: rule.limit,
        remaining: 0,
        retryAfterMs: Math.max(1, current.resetAt - now),
      };
    }

    return {
      allowed: true,
      bucket,
      limit: rule.limit,
      remaining: rule.limit - current.count,
      retryAfterMs: 0,
    };
  } catch {
    return { allowed: true, bucket, limit: rule.limit, remaining: rule.limit, retryAfterMs: 0 };
  }
}

/** Resposta devolvida a quem passou do ritmo: 429 com o que fazer a seguir. */
export function rateLimitResponse(result: RateLimitResult): Response {
  const seconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return Response.json(
    {
      error: "rate_limited",
      message: `Demasiados pedidos (${result.bucket}). Tente de novo dentro de ${seconds}s.`,
      bucket: result.bucket,
      limit: result.limit,
      retry_after_seconds: seconds,
    },
    { status: 429, headers: { "Retry-After": String(seconds) } },
  );
}

/**
 * Isenção do harness de validação, com fecho hermético.
 *
 * A limitação está ligada em todos os ambientes. O harness de validação
 * (`tools/validation-harness`) corre centenas de chamadas do MESMO ator e pede,
 * por isso, que as suas chamadas não contem — com o cabeçalho
 * `x-base44-rate-limit: off`. Esse cabeçalho só é honrado quando
 * `BASE44_DEV_IDENTITY === "1"`, a mesma chave hermética do `devActor.ts`
 * (definida apenas no `docker-compose.base44.yml`), pelo que nenhum ambiente
 * implantado o pode usar. Um caso que queira medir o `429` envia `on`.
 */
function rateLimitDisabled(req?: Request): boolean {
  if (Deno.env.get("BASE44_DEV_IDENTITY") !== "1") return false;
  return req?.headers?.get("x-base44-rate-limit") === "off";
}

/**
 * Guarda de uma chamada: devolve `null` quando o ator pode seguir e a resposta
 * `429` quando passou do ritmo. É assim que uma função de backend a usa:
 *
 * ```ts
 * const limited = guardRateLimit(user, "write_sensitive", req);
 * if (limited) return limited;
 * ```
 */
export function guardRateLimit(actor: any, bucket: RateLimitBucket, req?: Request): Response | null {
  if (rateLimitDisabled(req)) return null;
  const result = consumeRateLimit(actor, bucket);
  return result.allowed ? null : rateLimitResponse(result);
}

/** Esvazia os contadores (usado pelos testes; nunca pela aplicação). */
export function resetRateLimits(): void {
  counters.clear();
}
