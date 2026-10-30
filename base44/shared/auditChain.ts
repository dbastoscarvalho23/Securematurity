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
/**
 * Ações que a interface pode pedir à função `audit` (lista fechada). Tudo o resto só o servidor regista: envios, IA,
 * ficheiros, evidências, licenças, purgas, entradas na plataforma e a própria cadeia. Uma ação nova registada pela
 * interface tem de entrar aqui; o teste src/lib/__tests__/auditChain.test.js compara esta lista com as chamadas.
 */
export const CLIENT_ACTIONS = [
  'assessment_completed', 'assessment_deleted', 'asset_inventory_exported', 'asset_list_exported',
  'customer_created', 'customer_deleted', 'customer_qualified', 'customer_updated', 'data_deleted', 'data_exported',
  'document_created', 'document_deleted', 'document_updated', 'dsr_completed', 'dsr_created', 'dsr_updated',
  'framework_created', 'framework_status_changed', 'incident_created', 'incident_updated', 'question_created',
  'question_deleted', 'question_generated', 'question_updated', 'questions_deduplicated', 'questions_translated',
  'recommendation_created', 'recommendation_generated', 'recommendation_updated', 'risk_created', 'risk_deleted',
  'risk_updated', 'ropa_created', 'ropa_deleted', 'ropa_updated', 'settings_changed', 'task_created', 'task_deleted',
  'task_status_changed', 'task_updated', 'vulnerability_created', 'vulnerability_remediated', 'vulnerability_updated',
];
/** Máximo de registos por minuto que um utilizador pode pedir pela interface. */
export const RECORD_PER_MINUTE = 60;

const PAGE_SIZE = 500;
// 50 000 entradas, lidas em sequência dentro do tempo de uma função. Acima disto a verificação diz que a leitura
// ficou incompleta e não dá a cadeia como verificada (veredito «review»).
const MAX_PAGES = 100;
const ATTEMPTS = 3; // tentativas do selo de partida
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

/** Resumo próprio do selo: o seu conteúdo encadeado no resumo de partida (guardado em `prev_hash`). */
export const sealDigest = (seal: any): Promise<string> => sha256(`${contentOf(seal)}|${String(seal?.prev_hash || '')}`);

const VERIFICATION_ACTIONS = [VERIFIED_ACTION, BROKEN_ACTION, ANCHOR_ACTION];

/**
 * Verificação sobre uma trilha já lida e ordenada. Pura: não lê nem escreve.
 *
 * Conta como quebra (`integrity_ok` falso): selo de partida que não confere, selo alterado, entrada com o conteúdo
 * alterado, entrada sem resumo depois do selo (o escritor dá sempre um), lacuna no encadeamento (entrada removida) e
 * cabeça da cadeia ancorada por uma verificação anterior que desapareceu. Uma bifurcação (escritas simultâneas) e
 * uma leitura incompleta não são quebras, mas pedem revisão: só `verdict === 'verified'` dá a cadeia como verificada.
 */
export async function verifyRows(list: any[], { truncated = false }: { truncated?: boolean } = {}): Promise<any> {
  const sealIndex = list.map((row) => row.action).lastIndexOf(SEAL_ACTION);
  if (sealIndex < 0) {
    return { ok: false, integrity_ok: false, sealed: false, verdict: 'unsealed', entries: list.length, note: 'A cadeia ainda não tem selo de partida.' };
  }
  const seal = list[sealIndex];
  const before = list.slice(0, sealIndex);
  const declared = seal?.chain_count === undefined || seal?.chain_count === null ? null : Number(seal.chain_count);
  const covered = declared === null ? before : before.slice(0, Math.max(0, declared));
  const uncovered = Math.max(0, before.length - covered.length);
  const baselineOk = (await baselineOf(covered)) === String(seal.prev_hash || '');
  const sealOk = (await sealDigest(seal)) === String(seal.entry_hash || '');

  const sealAt = String(seal.created_date || '');
  const after = list.slice(sealIndex + 1);
  const known = new Set(list.map((row) => String(row.entry_hash || '')).filter(Boolean));
  let expected = String(seal.entry_hash || '');
  let firstBroken: any = null;
  const broken = (entry: any, reason: string) => { if (!firstBroken) firstBroken = { id: entry.id, action: entry.action, at: entry.created_date, reason }; };
  let checked = 0;
  const forks: any[] = [];
  const gaps: any[] = [];

  for (const entry of after) {
    checked += 1;
    if (!entry.entry_hash) {
      broken(entry, 'Entrada sem resumo depois do selo: foi escrita fora do escritor único ou teve o resumo removido.');
      expected = await digestOf(entry, sealAt);
      continue;
    }
    if (String(entry.entry_hash) !== (await digestOf(entry, sealAt))) broken(entry, 'O resumo desta entrada não bate com o conteúdo que ela guarda.');
    if (String(entry.prev_hash || '') !== expected) {
      (known.has(String(entry.prev_hash || '')) ? forks : gaps).push({ id: entry.id, action: entry.action, at: entry.created_date });
    }
    expected = String(entry.entry_hash);
  }
  if (gaps.length) broken(gaps[0], 'Lacuna no encadeamento: a entrada anterior a esta foi removida da trilha.');

  // Cabeça ancorada: cada verificação guarda em entity_id o resumo da última entrada que viu. Se esse resumo já não
  // existe, foram removidas entradas do fim da trilha.
  for (const v of after.filter((row) => VERIFICATION_ACTIONS.includes(row.action) && row.entity_id && /^[a-f0-9]{64}$/.test(String(row.entity_id)))) {
    if (!known.has(String(v.entity_id))) broken(v, 'Uma verificação anterior ancorou uma entrada que já não está na trilha.');
  }

  const integrityOk = baselineOk && sealOk && !firstBroken;
  const verdict = !integrityOk ? 'broken' : truncated || uncovered || forks.length ? 'review' : 'verified';
  const head = after.length ? String(after[after.length - 1].entry_hash || '') : String(seal.entry_hash || '');
  return {
    ok: verdict === 'verified',
    integrity_ok: integrityOk,
    verdict,
    sealed: true,
    entries: list.length,
    covered: covered.length,
    uncovered,
    checked,
    baseline_ok: baselineOk,
    seal_ok: sealOk,
    forks: forks.length,
    fork_first: forks[0] || null,
    gaps: gaps.length,
    gap_first: gaps[0] || null,
    truncated,
    head,
    seal_at: sealAt,
    first_broken: firstBroken,
    note: !sealOk
      ? 'O selo de partida foi alterado depois de escrito.'
      : !baselineOk
        ? `O resumo de partida não confere com as ${covered.length} entrada(s) que o selo declara cobrir: há entradas antigas alteradas ou removidas.`
        : firstBroken
          ? `Cadeia quebrada em ${firstBroken.action} (${firstBroken.at}): ${firstBroken.reason}`
          : truncated
            ? `Leitura incompleta: a trilha excede o limite de leitura e não foi verificada por inteiro (${checked} entrada(s) conferidas).`
            : uncovered
              ? `Conteúdo íntegro, mas ${uncovered} entrada(s) ficaram entre o cálculo e a escrita do selo.`
              : forks.length
                ? `Conteúdo íntegro desde o selo (${checked} entrada(s)), com ${forks.length} bifurcação(ões) de escritas simultâneas.`
                : `Cadeia verificada: selo sobre ${covered.length} entrada(s) e ${checked} entrada(s) desde o selo, sem quebras.`,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Leitura e escrita (recebem o cliente base44; escrevem só com o papel de serviço)
// ---------------------------------------------------------------------------------------------------------------

/** A trilha completa, por páginas, até ao fim ou ao limite de páginas (assinalado em `truncated`). */
export async function readTrail(base44: any, { pageSize = PAGE_SIZE, maxPages = MAX_PAGES } = {}): Promise<any> {
  // Por identificador: entradas com a mesma data podem repetir-se entre páginas quando se pagina por posição.
  const rows = new Map<string, any>();
  for (let page = 0; page < maxPages; page += 1) {
    const items = (await base44.asServiceRole.entities.AuditLog.list('created_date', pageSize, page * pageSize)) || [];
    for (const item of items) rows.set(String(item.id), item);
    if (items.length < pageSize) return { rows: ordered([...rows.values()]), pages: page + 1, truncated: false };
  }
  return { rows: ordered([...rows.values()]), pages: maxPages, truncated: true };
}

export async function latestSeal(base44: any): Promise<any | null> {
  const rows = await base44.asServiceRole.entities.AuditLog.filter({ action: SEAL_ACTION }, '-created_date', 1).catch(() => []);
  return rows?.[0] || null;
}

/**
 * O escritor único. `values.user_email` tem de vir do servidor (a sessão resolvida, ou 'system' numa automação).
 * Erros propagam-se: quem chama decide se a operação principal continua (logAudit engole-os).
 *
 * Limitação conhecida: remover ao mesmo tempo as entradas mais recentes e a última verificação não se deteta sem uma
 * âncora fora da plataforma (por exemplo, o resumo mensal enviado por email); a âncora interna cobre as verificações
 * que ficam.
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

  // Nenhuma entrada muda depois de escrita. Duas escritas simultâneas que leram a mesma «última» ficam como
  // bifurcação: a verificação assinala-a para revisão, sem a confundir com uma alteração ou uma remoção.
  const digest = await sha256(`${contentOf(entry)}|${previous || CHAIN_ORIGIN}`);
  const row = await db.create({ ...entry, entry_hash: digest });
  return { id: row?.id, entry_hash: digest, prev_hash: entry.prev_hash };
}

/** Lê a trilha e verifica-a. */
export async function verifyChain(base44: any): Promise<any> {
  const { rows, pages, truncated } = await readTrail(base44);
  return { ...(await verifyRows(rows, { truncated })), pages };
}

/**
 * Selo de partida: uma vez, cobre o que existe antes de a cadeia começar. O resumo de partida fica em `prev_hash` e o
 * resumo próprio do selo em `entry_hash`, para o conteúdo do selo também ficar protegido.
 *
 * Um novo selo, quando o anterior deixou de conferir, apagaria a prova de uma alteração: só se faz com confirmação
 * explícita e uma justificação, que ficam escritas no próprio selo.
 */
export async function sealChain(base44: any, actor: string, { confirm = false, reason = '' }: { confirm?: boolean; reason?: string } = {}): Promise<any> {
  const db = base44.asServiceRole.entities.AuditLog;
  const existing = await latestSeal(base44);
  let previousNote = '';
  if (existing) {
    const current = await verifyChain(base44);
    if (current.baseline_ok && current.seal_ok && !current.uncovered) {
      return { sealed: false, already: true, at: existing.created_date, covered: Number(existing.chain_count || 0) };
    }
    const why = String(reason || '').trim();
    if (!confirm || why.length < 10) {
      return {
        sealed: false,
        requires_confirmation: true,
        note: `O selo de ${existing.created_date} deixou de conferir (${current.note}). Um novo selo cobriria as entradas tal como estão hoje: só com confirmação e justificação.`,
      };
    }
    previousNote = ` Substitui o selo de ${existing.created_date}, que deixou de conferir: ${current.note} Justificação: ${why.slice(0, 400)}`;
  }
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const read = await readTrail(base44);
    if (read.truncated) return { sealed: false, pending: true, note: 'A trilha não pôde ser lida por inteiro; um selo sobre uma leitura parcial nunca conferiria.' };
    const covered = read.rows;
    const baseline = await baselineOf(covered);
    const seal: any = {
      action: SEAL_ACTION,
      entity_type: 'AuditLog',
      entity_id: '',
      user_email: actor,
      details: `Selo de partida da cadeia de integridade: ${covered.length} entrada(s) anteriores ficam cobertas por este resumo.${previousNote}`.slice(0, DETAILS_MAX),
      actor_attested: true,
      origin: 'session',
      chain_count: covered.length,
      prev_hash: baseline,
    };
    const row = await db.create({ ...seal, entry_hash: await sealDigest(seal) });
    const confirmRead = await readTrail(base44);
    const index = confirmRead.rows.findIndex((item) => item.id === row?.id);
    const preceding = index >= 0 ? confirmRead.rows.slice(0, index) : [];
    if (index >= 0 && !confirmRead.truncated && preceding.length === covered.length && (await baselineOf(preceding)) === baseline) {
      return { sealed: true, resealed: Boolean(existing), attempts: attempt, id: row?.id, covered: covered.length, baseline };
    }
  }
  return { sealed: false, pending: true, note: 'Entraram escritas entre o cálculo e a escrita do selo. Repetir o selo.' };
}
