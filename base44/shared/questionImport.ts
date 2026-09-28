/**
 * Importação de bases de perguntas — normalização, validação e classificação.
 *
 * O banco de perguntas (`Question`) referencia um framework (`Framework`) e os
 * respectivos controlos (`FrameworkControl`). Uma importação pode trazer os três
 * níveis num único pacote, pelo que este módulo é o único sítio onde um ficheiro
 * externo se transforma em itens de lote com um veredicto: o que é válido, o que
 * colide com o que já existe, o que é uma linha em falta e o que falha validação.
 *
 * Regras do repositório que condicionam este ficheiro:
 *  - o validador do backend em dev rejeita `null` em campos de tipo único e
 *    descarta chaves não declaradas (inclusive em objectos aninhados), por isso
 *    cada item devolve SEMPRE todas as suas chaves, com "" ou 0 por omissão;
 *  - `weight` fora de 1–5 e `answer_type` fora do enum são ERRO (bloqueiam a
 *    publicação); a ausência de tradução PT, de orientação ou de controlo
 *    correspondente é AVISO (não bloqueia);
 *  - nada aqui escreve: a classificação corre em `validate` (pré-visualização) e
 *    outra vez em `create_draft`/`review` (fonte de verdade), e só `publish`
 *    aplica os itens aprovados ao catálogo.
 *
 * A similaridade de perguntas espelha `src/lib/questionSimilarity.js` (a mesma
 * normalização e o mesmo Jaccard que o gerador por IA já usava), tal como
 * `licenseGuard.ts` espelha `licenseModules.js`: o backend corre em Deno e não
 * importa código de `src/`.
 */

export const ANSWER_TYPES = ["maturity_scale", "yes_no", "multiple_choice"];
export const ITEM_TYPES = ["framework", "control", "question"];
export const QUESTION_STATES = ["valid", "warning", "duplicate", "error", "applied"];
export const REVIEW_STATES = ["pending", "approved", "excluded"];

/** Limiar a partir do qual uma pergunta é considerada duplicado exacto. */
export const DUPLICATE_THRESHOLD = 0.75;
/** Limiar a partir do qual uma pergunta é assinalada como semelhante. */
export const SIMILAR_THRESHOLD = 0.45;
/** Perguntas lidas do catálogo para comparar (ordem de leitura da listagem). */
export const MAX_COMPARE_QUESTIONS = 1000;

/** Campos de pergunta aceites na pré-visualização e no mapeamento de colunas. */
export const QUESTION_FIELDS = [
  "framework_code",
  "control_id",
  "domain",
  "domain_pt",
  "question_text",
  "question_text_pt",
  "guidance",
  "guidance_pt",
  "answer_type",
  "weight",
  "order_index",
];

/**
 * Cabeçalhos/campos alternativos aceites num ficheiro (PT e EN).
 * Espelho de `FIELD_ALIASES` em `src/lib/questionImport.js`.
 */
export const FIELD_ALIASES: Record<string, string[]> = {
  framework_code: ["framework_code", "framework", "framework code", "framework_code ", "fw", "standard", "norma", "quadro", "referencial"],
  control_id: ["control_id", "control", "control id", "controlo", "id de controlo", "requirement", "requisito", "ref", "reference"],
  domain: ["domain", "dominio", "domínio", "domain_en", "categoria", "category", "area", "área"],
  domain_pt: ["domain_pt", "dominio_pt", "domínio_pt", "domain pt", "dominio pt"],
  question_text: ["question_text", "question", "questions", "pergunta", "perguntas", "questao", "questão", "texto", "texto da pergunta"],
  question_text_pt: ["question_text_pt", "question_pt", "question pt", "pergunta_pt", "perguntas_pt", "questao_pt", "questão_pt"],
  guidance: ["guidance", "help", "hint", "orientacao", "orientação"],
  guidance_pt: ["guidance_pt", "orientacao_pt", "orientação_pt"],
  answer_type: ["answer_type", "answer", "tipo de resposta", "answer type"],
  weight: ["weight", "peso", "ponderação", "ponderacao"],
  order_index: ["order_index", "order", "ordem", "index", "índice", "indice", "posicao", "posição"],
  title: ["title", "titulo", "título", "control title"],
  description: ["description", "descricao", "descrição"],
  maturity_levels: ["maturity_levels", "niveis", "níveis", "maturity", "levels", "níveis de maturidade"],
  framework_name: ["framework_name", "name", "nome"],
  framework_version: ["framework_version", "version", "versao", "versão"],
  framework_status: ["framework_status", "status", "estado"],
  reference_url: ["reference_url", "url", "link", "reference"],
};

/** Texto normalizado para comparação (igual ao do gerador por IA). */
export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: unknown): Set<string> {
  return new Set(normalizeText(value).split(" ").filter((w) => w.length > 3));
}

/** Jaccard entre duas perguntas (0–1). */
export function similarity(a: unknown, b: unknown): number {
  const setA = tokens(a);
  const setB = tokens(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared += 1;
  return shared / (setA.size + setB.size - shared);
}

/** Chave lógica de uma pergunta: framework + controlo + texto normalizado. */
export function questionKey(question: any): string {
  return [question?.framework_code, question?.control_id, question?.question_text]
    .map((part) => normalizeText(part))
    .join("|");
}

/** Pergunta existente mais parecida (acima do limiar de semelhança). */
export function findSimilar(
  candidate: any,
  existing: any[],
  threshold = SIMILAR_THRESHOLD,
): { similarity: number; question: any } | null {
  let best: { similarity: number; question: any } | null = null;
  for (const question of existing) {
    const score = similarity(candidate?.question_text, question?.question_text);
    if (score >= threshold && (!best || score > best.similarity)) {
      best = { similarity: score, question };
    }
  }
  return best;
}

// ─── Normalização do ficheiro ────────────────────────────────────────────────

function pick(raw: any, field: string): any {
  if (!raw || typeof raw !== "object") return undefined;
  const candidates = [field, ...(FIELD_ALIASES[field] || [])];
  for (const key of candidates) {
    const direct = raw[key];
    if (direct !== undefined && direct !== null && String(direct).trim() !== "") return direct;
  }
  // Chaves com maiúsculas/espaços ("Framework Code") também são aceites.
  const lowered = new Map(Object.keys(raw).map((k) => [k.toLowerCase().trim(), k]));
  for (const key of candidates) {
    const actual = lowered.get(String(key).toLowerCase().trim());
    if (!actual) continue;
    const value = raw[actual];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return undefined;
}

function text(raw: any, field: string): string {
  const value = pick(raw, field);
  return value === undefined ? "" : String(value).trim();
}

/** Peso: `null` significa "foi indicado mas não é um número" (erro de validação). */
function parseWeight(raw: any): number | null {
  const value = pick(raw, "weight");
  if (value === undefined) return 1;
  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseNumber(raw: any, field: string, fallback: number): number {
  const value = pick(raw, field);
  if (value === undefined) return fallback;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeQuestion(raw: any, rowNumber: number): any {
  const isActive = pick(raw, "is_active");
  return {
    item_type: "question",
    framework_code: text(raw, "framework_code"),
    control_id: text(raw, "control_id"),
    domain: text(raw, "domain"),
    domain_pt: text(raw, "domain_pt"),
    question_text: text(raw, "question_text"),
    question_text_pt: text(raw, "question_text_pt"),
    guidance: text(raw, "guidance"),
    guidance_pt: text(raw, "guidance_pt"),
    answer_type: text(raw, "answer_type"),
    weight: parseWeight(raw),
    order_index: parseNumber(raw, "order_index", rowNumber),
    is_active: isActive === undefined ? true : !(isActive === false || String(isActive).toLowerCase() === "false"),
    row_number: rowNumber,
  };
}

function normalizeControl(raw: any, rowNumber: number): any {
  const levels = pick(raw, "maturity_levels");
  return {
    item_type: "control",
    framework_code: text(raw, "framework_code"),
    control_id: text(raw, "control_id"),
    domain: text(raw, "domain"),
    title: text(raw, "title") || text(raw, "control_id"),
    description: text(raw, "description"),
    maturity_levels: Array.isArray(levels)
      ? levels
          .map((level: any, index: number) => ({
            level: Number(level?.level ?? index + 1) || index + 1,
            description: String(level?.description ?? level ?? "").trim(),
          }))
          .filter((level: any) => level.description)
      : [],
    row_number: rowNumber,
  };
}

function normalizeFramework(raw: any): any {
  return {
    item_type: "framework",
    framework_code: text(raw, "framework_code") || text(raw, "framework_code") || String(pick(raw, "code") ?? "").trim(),
    framework_name: text(raw, "framework_name") || text(raw, "title"),
    framework_version: text(raw, "framework_version"),
    framework_status: text(raw, "framework_status"),
    reference_url: text(raw, "reference_url"),
    row_number: 0,
  };
}

/**
 * Aceita as formas tolerantes que um ficheiro de perguntas costuma ter:
 * uma lista simples de perguntas, ou um pacote
 * `{ framework, controls, questions }` (também `items` / `perguntas` / `controlos`).
 */
export function normalizeBundle(raw: any): { framework: any | null; controls: any[]; questions: any[] } {
  if (Array.isArray(raw)) {
    return {
      framework: null,
      controls: [],
      questions: raw.map((row, index) => normalizeQuestion(row, index + 1)),
    };
  }

  const rawQuestions = Array.isArray(raw?.questions)
    ? raw.questions
    : Array.isArray(raw?.perguntas)
      ? raw.perguntas
      : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw?.data)
          ? raw.data
          : [];

  const rawControls = Array.isArray(raw?.controls)
    ? raw.controls
    : Array.isArray(raw?.controlos)
      ? raw.controlos
      : [];

  const rawFramework = raw?.framework || raw?.quadro || null;

  return {
    framework: rawFramework ? normalizeFramework(rawFramework) : null,
    controls: rawControls.map((row: any, index: number) => normalizeControl(row, index + 1)),
    questions: rawQuestions.map((row: any, index: number) => normalizeQuestion(row, index + 1)),
  };
}

// ─── Classificação ───────────────────────────────────────────────────────────

type Issue = { code: string; field: string; severity: string; detail: string };

function issue(code: string, field: string, severity: string, detail = ""): Issue {
  return { code, field, severity, detail };
}

function highestState(states: string[]): string {
  if (states.includes("error")) return "error";
  if (states.includes("duplicate")) return "duplicate";
  if (states.includes("warning")) return "warning";
  return "valid";
}

function beforeSnapshot(record: any, keys: string[]): Record<string, any> {
  const snapshot: Record<string, any> = {};
  for (const key of keys) {
    const value = record?.[key];
    if (value === undefined || value === null) continue;
    snapshot[key] = value;
  }
  return snapshot;
}

const FRAMEWORK_SNAPSHOT_KEYS = ["name", "version", "status"];
const CONTROL_SNAPSHOT_KEYS = ["title", "description", "domain", "control_id"];
const QUESTION_SNAPSHOT_KEYS = [
  "question_text",
  "question_text_pt",
  "domain",
  "domain_pt",
  "control_id",
  "guidance",
  "guidance_pt",
  "answer_type",
  "weight",
  "order_index",
  "is_active",
];

export type ImportContext = {
  frameworks: any[];
  controls: any[];
  questions: any[];
};

/**
 * Constrói os itens do lote com o veredicto de cada um.
 *
 * A ordem de precedência é erro > duplicado > aviso > válido: um duplicado
 * continua a poder ser aprovado (atualiza a pergunta existente), um erro não.
 */
export function buildImportItems(
  bundle: { framework: any | null; controls: any[]; questions: any[] },
  context: ImportContext,
): any[] {
  const items: any[] = [];
  const frameworks = context.frameworks || [];
  const controls = context.controls || [];
  const questions = context.questions || [];

  const declaredFramework: any = bundle.framework || null;
  const declaredCode = normalizeText(declaredFramework?.framework_code);

  // ─── Framework ────────────────────────────────────────────────────────────
  if (declaredFramework) {
    const existing = frameworks.find((f: any) => normalizeText(f.code) === declaredCode) || null;
    const issues: Issue[] = [];
    if (!declaredFramework.framework_code) issues.push(issue("missing_framework_code", "framework_code", "error"));
    if (!declaredFramework.framework_name) issues.push(issue("missing_framework_name", "framework_name", "error"));
    const status = declaredFramework.framework_status;
    if (status && !["active", "draft", "deprecated"].includes(status)) {
      issues.push(issue("invalid_framework_status", "framework_status", "error", status));
    }

    items.push({
      ...declaredFramework,
      state: highestState(issues.map((i) => i.severity === "error" ? "error" : "warning")),
      review_state: "pending",
      action: existing ? "update" : "create",
      target_id: existing?.id || null,
      issues,
      similarity: 0,
      similar_to: "",
      before: existing ? beforeSnapshot(existing, FRAMEWORK_SNAPSHOT_KEYS) : {},
    });
  }

  // ─── Controlos ────────────────────────────────────────────────────────────
  for (const control of bundle.controls || []) {
    const key = `${normalizeText(control.framework_code)}|${normalizeText(control.control_id)}`;
    const existing =
      controls.find((c: any) => `${normalizeText(c.framework_code)}|${normalizeText(c.control_id)}` === key) || null;
    const issues: Issue[] = [];

    if (!control.control_id) issues.push(issue("missing_control_id", "control_id", "error"));
    if (!control.title) issues.push(issue("missing_control_title", "title", "error"));
    if (!control.framework_code) {
      if (declaredFramework?.framework_code) control.framework_code = declaredFramework.framework_code;
      else issues.push(issue("missing_framework_code", "framework_code", "error"));
    }
    const frameworkExists =
      frameworks.some((f: any) => normalizeText(f.code) === normalizeText(control.framework_code)) ||
      normalizeText(declaredFramework?.framework_code) === normalizeText(control.framework_code);
    if (!frameworkExists) {
      issues.push(issue("unknown_framework", "framework_code", "error", control.framework_code));
    }
    if ((control.maturity_levels || []).length === 0) {
      issues.push(issue("missing_maturity_levels", "maturity_levels", "warning"));
    }

    items.push({
      ...control,
      state: highestState(issues.map((i) => i.severity === "error" ? "error" : "warning")),
      review_state: "pending",
      action: existing ? "update" : "create",
      target_id: existing?.id || null,
      issues,
      similarity: 0,
      similar_to: "",
      before: existing ? beforeSnapshot(existing, CONTROL_SNAPSHOT_KEYS) : {},
    });
  }

  // ─── Perguntas ────────────────────────────────────────────────────────────
  // Os controlos do próprio pacote contam como conhecidos; o código do
  // framework pode vir só do framework declarado, pelo que esta lista é
  // construída DEPOIS do ciclo acima (que preenche esse campo).
  const declaredControlKeys = new Set(
    (bundle.controls || []).map(
      (control: any) =>
        `${normalizeText(control.framework_code || declaredFramework?.framework_code)}|${normalizeText(control.control_id)}`,
    ),
  );
  const existingByKey = new Map<string, any>();
  for (const question of questions) existingByKey.set(questionKey(question), question);
  const seenInBatch = new Set<string>();

  for (const question of bundle.questions || []) {
    const issues: Issue[] = [];
    const states: string[] = [];
    if (!question.framework_code) {
      if (declaredFramework?.framework_code) question.framework_code = declaredFramework.framework_code;
      else issues.push(issue("missing_framework_code", "framework_code", "error"));
    }
    if (!question.domain) issues.push(issue("missing_domain", "domain", "error"));
    if (!question.question_text) issues.push(issue("missing_question_text", "question_text", "error"));

    if (question.weight === null || question.weight < 1 || question.weight > 5) {
      issues.push(issue("invalid_weight", "weight", "error", String(question.weight ?? "")));
      question.weight = 1;
    }
    if (question.answer_type && !ANSWER_TYPES.includes(question.answer_type)) {
      issues.push(issue("invalid_answer_type", "answer_type", "error", question.answer_type));
    }
    if (!question.answer_type) question.answer_type = "maturity_scale";

    const frameworkExists =
      frameworks.some((f: any) => normalizeText(f.code) === normalizeText(question.framework_code)) ||
      normalizeText(declaredFramework?.framework_code) === normalizeText(question.framework_code);
    if (!frameworkExists) {
      issues.push(issue("unknown_framework", "framework_code", "error", question.framework_code));
    }

    const controlKey = `${normalizeText(question.framework_code)}|${normalizeText(question.control_id)}`;
    if (question.control_id) {
      const controlExists =
        controls.some((c: any) => `${normalizeText(c.framework_code)}|${normalizeText(c.control_id)}` === controlKey) ||
        declaredControlKeys.has(controlKey);
      if (!controlExists) issues.push(issue("unknown_control", "control_id", "warning", question.control_id));
    }

    if (!question.question_text_pt) issues.push(issue("missing_pt", "question_text_pt", "warning"));
    if (!question.guidance) issues.push(issue("missing_guidance", "guidance", "warning"));

    let action: string;
    let targetId: string | null = null;
    let before: Record<string, any> = {};
    let similarityScore = 0;
    let similarTo = "";

    const key = questionKey(question);
    const existing = question.question_text ? existingByKey.get(key) : null;

    if (existing) {
      states.push("duplicate");
      action = "update";
      targetId = existing.id;
      before = beforeSnapshot(existing, QUESTION_SNAPSHOT_KEYS);
      const unchanged = QUESTION_SNAPSHOT_KEYS.every((field) => {
        if (!(field in before)) return true;
        const beforeValue = before[field];
        const afterValue = field === "weight" ? Number(question.weight) : question[field];
        return String(beforeValue ?? "") === String(afterValue ?? "");
      });
      if (unchanged) {
        action = "skip";
        issues.push(issue("identical_existing", "question_text", "duplicate"));
      } else {
        issues.push(issue("updates_existing", "question_text", "duplicate"));
      }
    } else if (seenInBatch.has(key)) {
      states.push("duplicate");
      action = "skip";
      issues.push(issue("duplicate_in_batch", "question_text", "duplicate"));
    } else {
      const similar = findSimilar(question, questions);
      if (similar) {
        states.push("warning");
        similarityScore = similar.similarity;
        similarTo = String(similar.question?.question_text || "").slice(0, 300);
        issues.push(issue("similar_existing", "question_text", "warning", String(Math.round(similar.similarity * 100))));
      }
      action = "create";
    }

    if (question.question_text) seenInBatch.add(key);

    const errorStates = issues.filter((i) => i.severity === "error").map(() => "error");
    const warningStates = issues.filter((i) => i.severity === "warning").map(() => "warning");

    items.push({
      ...question,
      state: highestState([...errorStates, ...states.filter((s) => s !== "warning"), ...warningStates]),
      review_state: "pending",
      action,
      target_id: targetId,
      issues,
      similarity: similarityScore,
      similar_to: similarTo,
      before,
    });
  }

  return items;
}

/** Contagens do lote (por estado e por tipo). */
export function summarizeItems(items: any[]): Record<string, any> {
  const summary: Record<string, any> = {
    item_count: items.length,
    question_count: 0,
    control_count: 0,
    framework_count: 0,
    valid_count: 0,
    warning_count: 0,
    duplicate_count: 0,
    error_count: 0,
    framework_codes: [] as string[],
  };
  const codes = new Set<string>();
  for (const item of items) {
    if (item.item_type === "question") summary.question_count += 1;
    if (item.item_type === "control") summary.control_count += 1;
    if (item.item_type === "framework") summary.framework_count += 1;
    if (item.state === "valid") summary.valid_count += 1;
    if (item.state === "warning") summary.warning_count += 1;
    if (item.state === "duplicate") summary.duplicate_count += 1;
    if (item.state === "error") summary.error_count += 1;
    if (item.framework_code) codes.add(item.framework_code);
  }
  summary.framework_codes = [...codes].sort();
  return summary;
}

// ─── Payloads de publicação ──────────────────────────────────────────────────

/** Campos de `Question` a escrever a partir de um item aprovado. */
export function questionPayload(item: any): Record<string, any> {
  return {
    framework_code: item.framework_code || "",
    control_id: item.control_id || "",
    domain: item.domain || "",
    domain_pt: item.domain_pt || "",
    question_text: item.question_text || "",
    question_text_pt: item.question_text_pt || "",
    guidance: item.guidance || "",
    guidance_pt: item.guidance_pt || "",
    answer_type: ANSWER_TYPES.includes(item.answer_type) ? item.answer_type : "maturity_scale",
    weight: Number(item.weight) >= 1 && Number(item.weight) <= 5 ? Number(item.weight) : 1,
    order_index: Number.isFinite(Number(item.order_index)) ? Number(item.order_index) : 0,
    is_active: item.is_active !== false,
  };
}

/** Campos de `Framework` a escrever a partir do item aprovado. */
export function frameworkPayload(item: any): Record<string, any> {
  return {
    code: item.framework_code || "",
    name: item.framework_name || item.framework_code || "",
    version: item.framework_version || "",
    status: ["active", "draft", "deprecated"].includes(item.framework_status) ? item.framework_status : "active",
    reference_url: item.reference_url || "",
  };
}

/** Campos de `FrameworkControl` a escrever a partir do item aprovado. */
export function controlPayload(item: any, frameworkId: string): Record<string, any> {
  return {
    framework_id: frameworkId || "",
    framework_code: item.framework_code || "",
    control_id: item.control_id || "",
    domain: item.domain || "",
    title: item.title || item.control_id || "",
    description: item.description || "",
    maturity_levels: Array.isArray(item.maturity_levels) ? item.maturity_levels : [],
  };
}
