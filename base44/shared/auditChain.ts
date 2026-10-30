/**
 * Trilha de auditoria encadeada: o escritor único, o selo de partida e a verificação.
 *
 * Adaptado do desenho da app «AnkoraOne Plataforma GRC» (Victor Pereira, base44/shared/auditTrail.ts), com duas
 * diferenças deliberadas:
 *  - o resumo é SHA-256 (Web Crypto), e não um resumo de 64 bits não criptográfico, que se forja com facilidade;
 *  - a leitura pagina com `list(sort, limit, skip)`, a forma que esta app e o servidor próprio já suportam.
 *
 * Como funciona:
 *  - Só o servidor escreve na trilha (a entidade AuditLog recusa criação e alteração a qualquer sessão de utilizador
 *    e não deixa eliminar). A autoria vem da sessão resolvida no servidor, nunca de um campo indicado pelo cliente.
 *  - Cada entrada guarda o resumo da anterior (`prev_hash`) e o seu próprio (`entry_hash`), calculado sobre o
 *    conteúdo e a ligação. Alterar uma entrada muda o seu resumo e deixa de bater com a ligação da seguinte.
 *  - O selo de partida cobre as entradas anteriores à cadeia com um resumo calculado sobre todas elas, pela ordem.
 *  - A verificação recalcula o selo e percorre a cadeia. Uma bifurcação (duas escritas simultâneas que leram a
 *    mesma «última») ou uma lacuna (elo removido) assinalam-se à parte da alteração de conteúdo.
 *
 * Este módulo não importa nada: as funções puras testam-se diretamente (src/lib/__tests__/auditChain.test.js) e as
 * que leem ou escrevem recebem o cliente `base44` como argumento.
 */

export const CHAIN_ORIGIN = '#origem';
export const CHAIN_UNCHAINED = '#sem-cadeia';

export const SEAL_ACTION = 'audit_chain_sealed';
export const VERIFIED_ACTION = 'audit_chain_verified';
export const BROKEN_ACTION = 'audit_chain_broken';
export const ANCHOR_ACTION = 'audit_chain_anchor_review';
/** Ações que só o servidor escreve: o pedido de registo vindo da interface recusa-as. */
export const SERVER_ONLY_ACTIONS = [SEAL_ACTION, VERIFIED_ACTION, BROKEN_ACTION, ANCHOR_ACTION, 'email_sent'];

const PAGE_SIZE = 500;
const MAX_PAGES = 40;
const ATTEMPTS = 3;
export const DETAILS_MAX = 1200;

/** Serialização estável: a mesma entrada dá sempre o mesmo texto, qualquer que seja a ordem das chaves. */
export function stable(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** SHA-256 em hexadecimal (64 caracteres). */
export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** O que o resumo cobre: o conteúdo da entrada, sem a data, que só a plataforma carimba depois de a entrada existir. */
export function contentOf(entry: any): string {
  return stable({
    action: String(entry?.action || ''),
    entity_type: String(entry?.entity_type || ''),
    entity_id: String(entry?.entity_id || ''),
    customer_id: String(entry?.customer_id || ''),
    details: String(entry?.details || ''),
    user_email: String(entry?.user_email || ''),
    actor_attested: entry?.actor_attested === true,
    origin: String(entry?.origin || ''),
    chain_count: Number(entry?.chain_count || 0),
  });
}

/**
 * Resumo de uma entrada: o conteúdo encadeado na ligação guardada. Uma entrada sem ligação (escrita fora do escritor,
 * ou anterior ao selo) resume-se com uma marca fixa, para continuar coberta pela verificação.
 */
export function digestOf(entry: any, sealAt?: string | null): Promise<string> {
  const link = entry?.prev_hash || (sealAt && String(entry?.created_date || '') > sealAt ? CHAIN_UNCHAINED : CHAIN_ORIGIN);
  return sha256(`${contentOf(entry)}|${link}`);
}

/** Ordem única para todos os cálculos: o momento e, em empate, o identificador. */
export function byMoment(left: any, right: any): number {
  const a = `${String(left?.created_date || '')}|${String(left?.id || '')}`;
  const b = `${String(right?.created_date || '')}|${String(right?.id || '')}`;
  return a < b ? -1 : a > b ? 1 : 0;
}

export const ordered = (rows: any[]): any[] => [...(rows || [])].sort(byMoment);

/** Resumo de partida: o resumo da sequência de resumos das entradas cobertas, pela ordem. */
export async function baselineOf(rows: any[]): Promise<string> {
  const digests = [];
  for (const row of rows) digests.push(await digestOf(row, null));
  return sha256(digests.join('|'));
}

/**
 * Verificação sobre uma trilha já lida e ordenada. Pura: não lê nem escreve.
 * `integrity_ok` diz se o conteúdo confere; `ok` exige também o encadeamento contínuo.
 */
export async function verifyRows(list: any[]): Promise<any> {
  const sealIndex = list.map((row) => row.action).lastIndexOf(SEAL_ACTION);
  if (sealIndex < 0) {
    return { ok: false, integrity_ok: false, sealed: false, entries: list.length, note: 'A cadeia ainda não tem selo de partida.' };
  }
  const seal = list[sealIndex];
  const before = list.slice(0, sealIndex);
  const declared = seal?.chain_count === undefined || seal?.chain_count === null ? null : Number(seal.chain_count);
  const covered = declared === null ? before : before.slice(0, Math.max(0, declared));
  const uncovered = Math.max(0, before.length - covered.length);
  const baselineOk = (await baselineOf(covered)) === String(seal.entry_hash || '');

  const sealAt = String(seal.created_date || '');
  const known = new Set(list.map((row) => String(row.entry_hash || '')).filter(Boolean));
  let expected = String(seal.entry_hash || '');
  let firstBroken: any = null;
  let checked = 0;
  let chained = 0;
  let unchained = 0;
  const forks: any[] = [];
  const gaps: any[] = [];

  for (const entry of list.slice(sealIndex + 1)) {
    checked += 1;
    const computed = await digestOf(entry, sealAt);
    if (entry.entry_hash) chained += 1; else unchained += 1;
    if (entry.prev_hash && String(entry.prev_hash) !== expected) {
      (known.has(String(entry.prev_hash)) ? forks : gaps).push({ id: entry.id, action: entry.action, at: entry.created_date });
    }
    if (!firstBroken && entry.entry_hash && String(entry.entry_hash) !== computed) {
      firstBroken = { id: entry.id, action: entry.action, at: entry.created_date, reason: 'O resumo desta entrada não bate com o conteúdo que ela guarda.' };
    }
    expected = entry.entry_hash ? String(entry.entry_hash) : computed;
  }

  const integrityOk = baselineOk && uncovered === 0 && !firstBroken;
  const continuous = forks.length === 0 && gaps.length === 0;
  return {
    ok: integrityOk && continuous,
    integrity_ok: integrityOk,
    continuous,
    sealed: true,
    entries: list.length,
    covered: covered.length,
    uncovered,
    checked,
    chained,
    unchained,
    baseline_ok: baselineOk,
    forks: forks.length,
    fork_first: forks[0] || null,
    gaps: gaps.length,
    gap_first: gaps[0] || null,
    seal_at: sealAt,
    first_broken: firstBroken,
    note: firstBroken
      ? `Cadeia quebrada em ${firstBroken.action} (${firstBroken.at}): ${firstBroken.reason}`
      : !baselineOk
        ? `O resumo de partida não confere com as ${covered.length} entrada(s) que o selo declara cobrir.`
        : uncovered
          ? `Conteúdo íntegro, mas ${uncovered} entrada(s) ficaram entre o cálculo e a escrita do selo: selar de novo.`
          : !continuous
            ? `Conteúdo íntegro desde o selo (${checked} entrada(s)). Encadeamento com ${forks.length} bifurcação(ões) e ${gaps.length} lacuna(s).`
            : `Cadeia verificada: selo sobre ${covered.length} entrada(s) e ${checked} entrada(s) desde o selo, sem quebras.`,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Leitura e escrita (recebem o cliente base44; escrevem só com o papel de serviço)
// ---------------------------------------------------------------------------------------------------------------

/** A trilha completa, por páginas, até ao fim ou ao limite de páginas (assinalado em `truncated`). */
export async function readTrail(base44: any, { pageSize = PAGE_SIZE, maxPages = MAX_PAGES } = {}): Promise<any> {
  const rows: any[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const items = (await base44.asServiceRole.entities.AuditLog.list('created_date', pageSize, page * pageSize)) || [];
    rows.push(...items);
    if (items.length < pageSize) return { rows: ordered(rows), pages: page + 1, truncated: false };
  }
  return { rows: ordered(rows), pages: maxPages, truncated: true };
}

export async function latestSeal(base44: any): Promise<any | null> {
  const rows = await base44.asServiceRole.entities.AuditLog.filter({ action: SEAL_ACTION }, '-created_date', 1).catch(() => []);
  return rows?.[0] || null;
}

/**
 * O escritor único. `values.user_email` tem de vir do servidor (a sessão resolvida, ou 'system' numa automação).
 * Erros propagam-se: quem chama decide se a operação principal continua (logAudit engole-os).
 */
export async function appendAuditEntry(base44: any, values: any): Promise<any> {
  const db = base44.asServiceRole.entities.AuditLog;
  const seal = await latestSeal(base44);
  const sealAt = seal?.created_date || null;
  const last = ordered((await db.list('-created_date', 20)) || []).pop() || null;
  const previous = last ? last.entry_hash || (await digestOf(last, sealAt)) : '';

  const entry: any = {
    action: String(values.action || ''),
    entity_type: String(values.entity_type || ''),
    entity_id: String(values.entity_id || ''),
    user_email: String(values.user_email || 'system'),
    details: String(values.details || '').slice(0, DETAILS_MAX),
    actor_attested: values.actor_attested === true,
    origin: values.origin === 'automation' ? 'automation' : 'session',
    prev_hash: previous || null,
  };
  if (values.customer_id) entry.customer_id = String(values.customer_id);
  if (values.chain_count !== undefined) entry.chain_count = Number(values.chain_count) || 0;

  let digest = await sha256(`${contentOf(entry)}|${previous || CHAIN_ORIGIN}`);
  const row = await db.create({ ...entry, entry_hash: digest });

  // Escritas simultâneas podem ler a mesma «última» e bifurcar a cadeia. Enquanto esta entrada for a última,
  // refaz-se a ligação sobre a que ficou imediatamente antes; uma entrada que já tem sucessora não se altera.
  for (let attempt = 0; attempt < ATTEMPTS && row?.id; attempt += 1) {
    const tail = ordered((await db.list('-created_date', 30)) || []);
    const index = tail.findIndex((item) => item.id === row.id);
    if (index <= 0 || index !== tail.length - 1) break;
    const prior = tail[index - 1];
    const priorHash = prior.entry_hash || (await digestOf(prior, sealAt));
    if (String(entry.prev_hash || '') === String(priorHash)) break;
    entry.prev_hash = priorHash;
    digest = await sha256(`${contentOf(entry)}|${priorHash}`);
    await db.update(row.id, { prev_hash: priorHash, entry_hash: digest });
  }
  return { id: row?.id, entry_hash: digest, prev_hash: entry.prev_hash };
}

/** Lê a trilha e verifica-a. */
export async function verifyChain(base44: any): Promise<any> {
  const { rows, pages, truncated } = await readTrail(base44);
  const result = await verifyRows(rows);
  return { ...result, pages, truncated, note: `${result.note}${truncated ? ' Leitura truncada: a trilha excede o limite de páginas.' : ''}` };
}

/**
 * Selo de partida: uma vez, cobre o que existe antes de a cadeia começar. Só se refaz quando o selo em vigor deixou
 * de ser reproduzível ou deixou entradas fora da cobertura. Depois de escrito, confirma-se que é reproduzível.
 */
export async function sealChain(base44: any, actor: string): Promise<any> {
  const db = base44.asServiceRole.entities.AuditLog;
  const existing = await latestSeal(base44);
  if (existing) {
    const current = await verifyChain(base44);
    if (current.baseline_ok && !current.uncovered) return { sealed: false, already: true, at: existing.created_date, covered: Number(existing.chain_count || 0) };
  }
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const read = await readTrail(base44);
    if (read.truncated) return { sealed: false, pending: true, note: 'A trilha não pôde ser lida por inteiro; um selo sobre uma leitura parcial nunca conferiria.' };
    const covered = read.rows;
    const baseline = await baselineOf(covered);
    const row = await db.create({
      action: SEAL_ACTION,
      entity_type: 'AuditLog',
      entity_id: '',
      user_email: actor,
      details: existing
        ? `Novo selo de partida: o anterior deixou de ser reproduzível. Ficam cobertas ${covered.length} entrada(s).`
        : `Selo de partida da cadeia de integridade: ${covered.length} entrada(s) anteriores ficam cobertas por este resumo.`,
      actor_attested: true,
      origin: 'session',
      chain_count: covered.length,
      prev_hash: null,
      entry_hash: baseline,
    });
    const confirm = await readTrail(base44);
    const index = confirm.rows.findIndex((item) => item.id === row?.id);
    const preceding = index >= 0 ? confirm.rows.slice(0, index) : [];
    if (index >= 0 && !confirm.truncated && preceding.length === covered.length && (await baselineOf(preceding)) === baseline) {
      return { sealed: true, resealed: Boolean(existing), attempts: attempt, id: row?.id, covered: covered.length, entry_hash: baseline };
    }
  }
  return { sealed: false, pending: true, note: 'Entraram escritas entre o cálculo e a escrita do selo. Repetir o selo.' };
}
