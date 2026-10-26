import { LEGAL_PACK } from './legalPack.ts';
import { CLASSIFY_CATALOG } from './classifyCatalog.ts';

/**
 * Classificação de documentos — lógica pura (sem SDK nem imports do Deno), usada pela função documentIntake e
 * testada no Vitest (src/lib/__tests__/classify.test.js importa este ficheiro diretamente).
 *
 *  1. buildCandidates: tudo aquilo a que o documento do cliente pode ficar ligado — medidas aplicáveis do QNRCS
 *     (Anexo III) ou do Anexo IV, tarefas da jornada RJC_2026, itens ISO/IEC 27001 (se o cliente os usa) e os
 *     quatro níveis de documento de segurança (L1–L4).
 *  2. scoreCandidates/shortlist: pontuação lexical em PT-PT (minúsculas, sem acentos, sem palavras vazias,
 *     sobreposição de termos ponderada por campo e pela raridade do termo) → os 20 mais próximos.
 *  3. validateClassification: limpa a resposta do modelo (só candidatos enviados, excertos confirmados no texto,
 *     confiança entre 0 e 1, no máximo 8 ligações).
 *  4. candidateToLink: ligação da evidência para cada candidato aceite.
 */

export const MAX_CANDIDATES = 20;
export const MAX_LINKS = 8;
export const DOC_LEVELS: Record<string, string> = { L1: 'policy', L2: 'standard', L3: 'procedure', L4: 'playbook' };
export const DOCUMENT_KINDS = ['politica', 'norma', 'procedimento', 'playbook', 'registo', 'relatorio', 'contrato', 'captura', 'plano', 'ata', 'certificado', 'outro'];
export const EVIDENCE_TYPES = ['screenshot', 'tool_report', 'contract_licence', 'policy_procedure', 'log_record', 'test_audit_report', 'other'];
export const EVIDENCE_METHODS = ['examine', 'interview', 'test'];
export const ASSESSMENTS = ['covers', 'partial', 'does_not_cover'];
// Pastas que a classificação pode propor (as restritas e as geradas pela plataforma ficam de fora).
export const CLASSIFY_FOLDERS = ['framing', 'security_docs', 'evidence', 'assessments', 'risks', 'incidents', 'suppliers', 'other'];
// Tipos de candidato que dão origem a uma ligação da evidência.
export const LINKABLE_KINDS = ['measure', 'iso27001', 'journey'];

const LEVELS = ['basico', 'substancial', 'elevado'];

const DOC_LEVEL_TEXT: Record<string, [string, string]> = {
  L1: ['Política (L1)', 'Política de segurança da informação ou de cibersegurança: compromisso e princípios aprovados pela gestão, âmbito, objetivos, papéis e responsabilidades, revisão periódica.'],
  L2: ['Norma (L2)', 'Norma ou standard interno: regras e requisitos obrigatórios, configurações mínimas, critérios técnicos a cumprir.'],
  L3: ['Procedimento (L3)', 'Procedimento: passos a seguir, responsáveis, periodicidade, registos a manter e aprovação.'],
  L4: ['Playbook (L4)', 'Playbook ou instrução operacional: ações passo a passo para responder a uma situação concreta, como um incidente.'],
};

export type Candidate = {
  id: string; kind: string; code: string; title: string; text: string; check: string;
  key?: string; level?: string; group?: string; section_order?: number; task_order?: number; checklist_id?: string;
};

// ── Texto ───────────────────────────────────────────────────────────────────

/** Minúsculas, sem acentos, só letras e algarismos separados por um espaço. */
export function normalizeText(s: unknown): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// Palavras vazias do português e termos que aparecem em quase todas as medidas (não distinguem nada).
export const STOPWORDS = new Set(`a ao aos as ate com como da das de del dela dele deles do dos e ela elas ele eles em entre era essa essas esse
esses esta estas este estes eu foi for ha isso isto ja la lhe lhes mais mas me mesmo meu minha muito na nao nas nem no nos nossa nosso o
os ou para pela pelas pelo pelos por qual quando que quem se sem ser seu seus sua suas sao tambem te tem ter um uma umas uns vos onde
cada todo toda todos todas outro outra outros outras sobre apos desde durante ainda sendo seja sejam sido forma caso deve devem devera
deverao pode podem podera bem assim tal tais modo vez vezes atraves inclusive nomeadamente designadamente respetiva respetivo respetivas
respetivos relativa relativo relativas relativos ambito entidade entidades medida medidas ciberseguranca seguranca informacao sistema
sistemas rede redes the and for with from this that are`.split(/\s+/).filter(Boolean));

/** Raiz simples: sem plural em -s e cortada a 7 letras («políticas» e «político» → «politic»). */
export function stem(w: string): string {
  let x = w;
  if (x.length > 4 && x.endsWith('s')) x = x.slice(0, -1);
  return x.length > 7 ? x.slice(0, 7) : x;
}

export function tokens(s: unknown): string[] {
  const out: string[] = [];
  for (const w of normalizeText(s).split(' ')) {
    if (w.length < 3 || /^\d+$/.test(w) || STOPWORDS.has(w)) continue;
    const st = stem(w);
    if (!STOPWORDS.has(st)) out.push(st);
  }
  return out;
}

// ── Candidatos ──────────────────────────────────────────────────────────────

function measureCandidate(controlId: string, lv: string): Candidate | null {
  const c = (LEGAL_PACK.controls as any)[controlId];
  const m = c?.measures?.[lv];
  if (!m) return null;
  const key = `${controlId}@${lv}`;
  return { id: `measure:${key}`, kind: 'measure', key, code: controlId, level: lv, title: c.statement, text: m.measure, check: m.verification || '' };
}

/** Chaves do Anexo IV iguais às de applicableEprMeasures (src/lib/legal/index.js): código + #n quando se repete. */
function eprCandidates(group: string): Candidate[] {
  const groups = group === 'A' ? ['B', 'A'] : group === 'B' ? ['B'] : [];
  return groups.flatMap((g) => {
    const seen: Record<string, number> = {};
    return ((LEGAL_PACK.epr as any)[g] || []).map((m: any) => {
      seen[m.code] = (seen[m.code] || 0) + 1;
      const key = seen[m.code] === 1 ? `EPR-${g}:${m.code}` : `EPR-${g}:${m.code}#${seen[m.code]}`;
      return { id: `measure:${key}`, kind: 'measure', key, code: m.code, group: g, title: m.area, text: m.measure, check: m.verification || '' };
    });
  });
}

/**
 * Medidas aplicáveis ao cliente:
 *  - essencial/importante com nível → medidas do QNRCS desse nível e dos anteriores (Reg. 756/2026, art. 30.º, n.º 2)
 *  - pública relevante com grupo → Anexo IV (Grupo A inclui o Grupo B)
 *  - sem qualificação → todos os controlos do QNRCS no seu nível mínimo
 */
export function measureCandidates(customer: any): Candidate[] {
  const q = customer?.rjc_qualification;
  if (['essencial', 'importante'].includes(q) && LEVELS.includes(customer?.conformity_level)) {
    const levels = LEVELS.slice(0, LEVELS.indexOf(customer.conformity_level) + 1);
    const out: Candidate[] = [];
    for (const id of Object.keys(LEGAL_PACK.controls)) for (const lv of levels) { const c = measureCandidate(id, lv); if (c) out.push(c); }
    return out;
  }
  if (q === 'publica_relevante' && ['A', 'B'].includes(customer?.epr_group)) return eprCandidates(customer.epr_group);
  return Object.entries(CLASSIFY_CATALOG.qnrcs_min_level).map(([id, lv]) => measureCandidate(id, lv as string)).filter(Boolean) as Candidate[];
}

/** O cliente usa a ISO/IEC 27001? (referencial permitido ou guia já iniciado) */
export function usesIso27001(customer: any, checklist: any[] = []): boolean {
  return (customer?.allowed_frameworks || []).includes('ISO27001') || checklist.some((r) => r?.framework === 'ISO27001_2022');
}

export function isoCandidates(): Candidate[] {
  return CLASSIFY_CATALOG.iso27001.map((i: any) => ({
    id: `iso27001:${i.id}`, kind: 'iso27001', code: i.id, title: i.title, text: i.description, check: i.evidence,
  }));
}

/** Tarefas da jornada RJC_2026, com o registo ComplianceChecklist do cliente quando existe (secção + ordem). */
export function journeyCandidates(checklist: any[] = []): Candidate[] {
  const byPos: Record<string, string> = {};
  for (const r of checklist) if (r?.framework === 'RJC_2026' && r.id) byPos[`${r.section_order}.${r.task_order}`] = r.id;
  return CLASSIFY_CATALOG.journey.map((t: any) => {
    const pos = `${t.section_order}.${t.task_order}`;
    return {
      id: `journey:${pos}`, kind: 'journey', code: `RJC ${pos}`, title: t.title, text: `${t.section}. ${t.basis}`, check: '',
      section_order: t.section_order, task_order: t.task_order, ...(byPos[pos] ? { checklist_id: byPos[pos] } : {}),
    };
  });
}

export function docLevelCandidates(): Candidate[] {
  return Object.entries(DOC_LEVEL_TEXT).map(([lv, [title, text]]) => ({ id: `doc_level:${lv}`, kind: 'doc_level', code: lv, level: lv, title, text, check: '' }));
}

/** Conjunto completo de candidatos de um cliente. `checklist` = registos ComplianceChecklist do cliente. */
export function buildCandidates(customer: any, checklist: any[] = []): Candidate[] {
  return [
    ...measureCandidates(customer),
    ...journeyCandidates(checklist),
    ...(usesIso27001(customer, checklist) ? isoCandidates() : []),
    ...docLevelCandidates(),
  ];
}

// ── Pontuação ───────────────────────────────────────────────────────────────

const FIELD_WEIGHTS: Array<[keyof Candidate, number]> = [['title', 3], ['check', 2], ['text', 1.5]];

/** Termos de um candidato com o peso do campo mais forte em que aparecem. */
function candidateTerms(c: Candidate): Map<string, number> {
  const out = new Map<string, number>();
  for (const [field, w] of FIELD_WEIGHTS) for (const t of tokens(c[field])) if ((out.get(t) || 0) < w) out.set(t, w);
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** O código do candidato aparece no documento? (ex.: «PR.FC-1», «A.5.15»; não confunde A.5.1 com A.5.15) */
export function mentionsCode(c: Candidate, lowerText: string): boolean {
  if (c.kind === 'journey' || c.kind === 'doc_level') return false;
  if (c.kind === 'iso27001' && !/^A\./.test(c.code)) return false; // cláusulas («C.4.1») não aparecem assim nos documentos
  const code = c.code.toLowerCase();
  return new RegExp(`(^|[^a-z0-9.])${escapeRe(code)}(?![0-9a-z])`).test(lowerText);
}

/**
 * Pontua cada candidato contra o texto do documento e o nome do ficheiro (que vale como 3 ocorrências de cada termo).
 * score = Σ peso(termo) × idf(termo) × (1 + ln tf) / √Σ peso × idf, + 3 quando o código aparece no texto.
 */
export function scoreCandidates(candidates: Candidate[], text: string, fileName = ''): Array<{ candidate: Candidate; score: number }> {
  const tf = new Map<string, number>();
  for (const t of tokens(text)) tf.set(t, (tf.get(t) || 0) + 1);
  for (const t of tokens(String(fileName).replace(/\.[a-z0-9]+$/i, ''))) tf.set(t, (tf.get(t) || 0) + 3);
  const terms = candidates.map(candidateTerms);
  const df = new Map<string, number>();
  for (const m of terms) for (const t of m.keys()) df.set(t, (df.get(t) || 0) + 1);
  const n = candidates.length || 1;
  const lower = `${String(text || '')} ${fileName}`.toLowerCase();
  return candidates.map((candidate, i) => {
    let hit = 0; let norm = 0;
    for (const [t, w] of terms[i]) {
      const idf = Math.log(1 + n / (df.get(t) || 1));
      norm += w * idf;
      const f = tf.get(t) || 0;
      if (f) hit += w * idf * (1 + Math.log(f));
    }
    let score = norm ? hit / Math.sqrt(norm) : 0;
    if (mentionsCode(candidate, lower)) score += 3;
    return { candidate, score: Math.round(score * 1000) / 1000 };
  });
}

/** Os MAX_CANDIDATES melhores (com pontuação > 0), mais os quatro níveis de documento, que vão sempre. */
export function shortlist(candidates: Candidate[], text: string, fileName = '', max = MAX_CANDIDATES) {
  const scored = scoreCandidates(candidates, text, fileName);
  const top = scored.filter((s) => s.candidate.kind !== 'doc_level' && s.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id)).slice(0, max);
  const levels = scored.filter((s) => s.candidate.kind === 'doc_level');
  return [...top, ...levels];
}

/** Texto curto de um candidato para o pedido ao modelo. */
export function candidatePromptLine(c: Candidate): string {
  const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const head = c.kind === 'measure' ? `${c.code}${c.level ? ` (${c.level})` : c.group ? ` (Anexo IV, grupo ${c.group})` : ''}` : c.code;
  const check = c.check ? ` Verificação: ${cut(c.check, 220)}` : '';
  return `[${c.id}] ${head} — ${cut(c.title, 200)}.${check}`;
}

// ── Validação da resposta do modelo ─────────────────────────────────────────

const str = (v: unknown, n: number) => (v == null ? '' : String(v)).trim().slice(0, n);
/** Data real no formato AAAA-MM-DD (2026-02-30 não passa). */
const isDate = (v: unknown) => {
  const t = String(v || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
  const d = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t;
};

/** Forma usada para procurar um excerto no texto: minúsculas, aspas e espaços uniformes. */
export function excerptKey(s: unknown): string {
  return String(s ?? '').toLowerCase().replace(/[‘’‚‛]/g, "'").replace(/[“”„«»]/g, '"')
    .replace(/[‐-―]/g, '-').replace(/[…]/g, '...').replace(/\s+/g, ' ').trim();
}

export function excerptFound(excerpt: string, text: string): boolean {
  const e = excerptKey(excerpt).replace(/^\.\.\.|\.\.\.$/g, '').trim();
  return e.length > 0 && excerptKey(text).includes(e);
}

/**
 * Normaliza a resposta do modelo. `allowed` = ids dos candidatos enviados; `text` = texto local do documento
 * (vazio em PDF e imagens: os excertos ficam marcados como não verificados).
 */
export function validateClassification(result: any, { allowed, text, defaultFolder = 'evidence' }: { allowed: Set<string> | string[]; text: string; defaultFolder?: string }) {
  const ids = allowed instanceof Set ? allowed : new Set(allowed);
  const r = result && typeof result === 'object' ? result : {};
  const hasText = Boolean(String(text || '').trim());
  const warnings: string[] = [];
  const seen = new Set<string>();
  const links = [];
  for (const l of Array.isArray(r.links) ? r.links : []) {
    const id = str(l?.candidate_id, 160);
    const kind = id.split(':')[0];
    if (!ids.has(id) || !LINKABLE_KINDS.includes(kind)) { if (id) warnings.push(`Ligação recusada (fora dos candidatos): ${id}`); continue; }
    if (seen.has(id)) continue;
    seen.add(id);
    let excerpt = str(l?.excerpt, 300).replace(/\s+/g, ' ');
    let excerptStatus = excerpt ? 'verified' : 'none';
    if (excerpt && hasText && !excerptFound(excerpt, text)) {
      warnings.push(`Excerto retirado em ${id}: não aparece no documento`);
      excerpt = ''; excerptStatus = 'dropped';
    } else if (excerpt && !hasText) excerptStatus = 'unverified';
    const c = Number(l?.confidence);
    links.push({
      candidate_id: id,
      confidence: Number.isFinite(c) ? Math.min(1, Math.max(0, Math.round(c * 100) / 100)) : 0,
      excerpt,
      excerpt_unverified: excerptStatus === 'unverified',
      excerpt_dropped: excerptStatus === 'dropped',
      assessment: ASSESSMENTS.includes(l?.assessment) ? l.assessment : 'partial',
      missing: str(l?.missing, 300),
    });
  }
  links.sort((a, b) => b.confidence - a.confidence);
  const level = String(r.security_doc_level || '').toUpperCase();
  return {
    document_kind: DOCUMENT_KINDS.includes(r.document_kind) ? r.document_kind : 'outro',
    security_doc_level: DOC_LEVELS[level] ? level : null,
    evidence_type: EVIDENCE_TYPES.includes(r.evidence_type) ? r.evidence_type : 'other',
    method: EVIDENCE_METHODS.includes(r.method) ? r.method : 'examine',
    title: str(r.title, 200),
    summary: str(r.summary, 400),
    issued_date: isDate(r.issued_date) ? String(r.issued_date) : '',
    valid_until: isDate(r.valid_until) ? String(r.valid_until) : '',
    review_date: isDate(r.review_date) ? String(r.review_date) : '',
    approver_detected: str(r.approver_detected, 200),
    folder_key: CLASSIFY_FOLDERS.includes(r.folder_key) ? r.folder_key : defaultFolder,
    links: links.slice(0, MAX_LINKS),
    warnings: [...new Set(warnings)].slice(0, 20),
  };
}

// ── Ligações da evidência ───────────────────────────────────────────────────

/**
 * Ligação da evidência para um candidato (mesmo formato do ComplianceTab, Iso27001Tab e ChecklistItemRow).
 * Tarefa da jornada sem registo ComplianceChecklist → null (a jornada ainda não foi criada para o cliente).
 */
export function candidateToLink(c: Candidate) {
  const cut = (s: string, n: number) => String(s || '').slice(0, n);
  if (c.kind === 'measure') return { type: 'measure', id: c.key, ref: c.code, label: cut(`${c.code}${c.level ? ` · ${c.level}` : ''} — ${c.title}`, 160) };
  if (c.kind === 'iso27001') return { type: 'iso27001', id: c.code, ref: c.code, label: cut(`${c.code} — ${c.title}`, 160) };
  if (c.kind === 'journey' && c.checklist_id) return { type: 'checklist', id: c.checklist_id, ref: `RJC_2026 ${c.section_order}.${c.task_order}`, label: cut(c.title, 120) };
  return null;
}

// ── Qualidade das propostas ──────────────────────────────────────────────────

export const CONFIDENCE_BANDS = [
  { key: 'high', min: 0.8 },
  { key: 'medium', min: 0.5 },
  { key: 'low', min: 0 },
];

const ratio = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 1000 : null);
const bandOf = (c: number) => (CONFIDENCE_BANDS.find((b) => c >= b.min) || CONFIDENCE_BANDS[CONFIDENCE_BANDS.length - 1]).key;

/**
 * Mede a qualidade das propostas do modelo face à decisão das pessoas. Só entram nas taxas os documentos
 * indexados que tinham proposta: uma ligação proposta conta como «mantida» se a pessoa a gravou na evidência.
 * `linkKeyOf(candidateId)` devolve a chave `${type}:${id}` da ligação que esse candidato gera (ou null); as
 * ligações gravadas comparam-se pela mesma chave, o que serve também para registos antigos sem
 * `accepted_candidates`. Não lê texto nem ficheiros: só estados, contagens e confiança.
 */
export function intakeMetrics(intakes: any[], linkKeyOf: (candidateId: string) => string | null) {
  const list = Array.isArray(intakes) ? intakes : [];
  const by_status: Record<string, number> = {};
  for (const it of list) by_status[it?.status || 'pending'] = (by_status[it?.status || 'pending'] || 0) + 1;

  const bands: Record<string, { proposed: number; kept: number }> = {};
  for (const b of CONFIDENCE_BANDS) bands[b.key] = { proposed: 0, kept: 0 };
  const engines: Record<string, { documents: number; proposed: number; kept: number }> = {};
  let proposed = 0; let kept = 0; let added = 0; let reviewed = 0; let allKept = 0; let noneKept = 0;
  let rejectedAfterProposal = 0; let classified = 0;
  const waits: number[] = [];

  for (const it of list) {
    const cls = it?.classification;
    if (!cls?.classified_at) continue;
    classified += 1;
    if (it.status === 'rejected') { rejectedAfterProposal += 1; continue; }
    if (it.status !== 'accepted') continue;
    reviewed += 1;
    const acceptedKeys = new Set((it.accepted_links || []).map((l: any) => `${l?.type}:${l?.id}`));
    const proposedKeys = new Set<string>();
    let docKept = 0; let docProposed = 0;
    const engine = `${cls.provider || '—'} · ${cls.model || '—'}`;
    engines[engine] = engines[engine] || { documents: 0, proposed: 0, kept: 0 };
    engines[engine].documents += 1;
    for (const l of Array.isArray(cls.links) ? cls.links : []) {
      const key = linkKeyOf(String(l?.candidate_id || ''));
      if (!key || proposedKeys.has(key)) continue;
      proposedKeys.add(key);
      const k = acceptedKeys.has(key);
      const band = bandOf(Number(l?.confidence) || 0);
      bands[band].proposed += 1; if (k) bands[band].kept += 1;
      engines[engine].proposed += 1; if (k) engines[engine].kept += 1;
      docProposed += 1; if (k) docKept += 1;
    }
    proposed += docProposed; kept += docKept;
    added += [...acceptedKeys].filter((k) => !proposedKeys.has(k)).length;
    if (docProposed > 0 && docKept === docProposed) allKept += 1;
    if (docProposed > 0 && docKept === 0) noneKept += 1;
    const t0 = Date.parse(cls.classified_at); const t1 = Date.parse(it.decided_at || '');
    if (Number.isFinite(t0) && Number.isFinite(t1) && t1 >= t0) waits.push((t1 - t0) / 60000);
  }

  waits.sort((a, b) => a - b);
  const median = waits.length ? Math.round(waits.length % 2 ? waits[(waits.length - 1) / 2] : (waits[waits.length / 2 - 1] + waits[waits.length / 2]) / 2) : null;
  return {
    total: list.length,
    by_status,
    classified,
    reviewed,
    rejected_after_proposal: rejectedAfterProposal,
    links: { proposed, kept, dropped: proposed - kept, added, kept_rate: ratio(kept, proposed), from_proposal_rate: ratio(kept, kept + added) },
    documents_all_kept: allKept,
    documents_none_kept: noneKept,
    by_confidence: CONFIDENCE_BANDS.map((b) => ({ band: b.key, ...bands[b.key], kept_rate: ratio(bands[b.key].kept, bands[b.key].proposed) })),
    by_engine: Object.entries(engines).map(([engine, v]) => ({ engine, ...v, kept_rate: ratio(v.kept, v.proposed) })),
    median_minutes_to_decision: median,
  };
}
