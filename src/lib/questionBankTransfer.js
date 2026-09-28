/**
 * Question Bank transfer package (JSON).
 *
 * One file carries the whole question bank — frameworks, controls, domains and
 * questions — so it can be imported into another instance of the application.
 *
 * Package layout:
 *   { format, version, exported_at, source_app, counts,
 *     frameworks: [], controls: [], domains: [], questions: [] }
 *
 * Instance-specific data (record ids, audit fields, assessment linkage) is
 * dropped: those references do not exist in the target instance.
 */
import { base44 } from '@/api/base44Client';
import { DOMAIN_TRANSLATIONS } from '@/lib/domainTranslations';

export const QUESTION_BANK_FORMAT = 'ankoraone-question-bank';
export const QUESTION_BANK_VERSION = 1;

const FRAMEWORK_FIELDS = ['code', 'name', 'version', 'description', 'status', 'reference_url', 'document_url', 'document_name'];
const CONTROL_FIELDS = ['framework_code', 'control_id', 'domain', 'title', 'description', 'maturity_levels'];
const QUESTION_FIELDS = [
  'framework_code', 'control_id', 'domain', 'domain_pt',
  'question_text', 'question_text_pt', 'guidance', 'guidance_pt',
  'answer_type', 'weight', 'order_index', 'is_active',
];

const WRITE_CHUNK_SIZE = 25;

const str = (value) => (value === undefined || value === null ? '' : String(value).trim());
const refKey = (...parts) => parts.map(part => str(part).toLowerCase()).join('|');
const normalizeText = (value) => str(value).toLowerCase().replace(/\s+/g, ' ');

function pickFields(record, fields) {
  const picked = {};
  for (const field of fields) {
    const value = record?.[field];
    if (value === undefined || value === null || value === '') continue;
    picked[field] = value;
  }
  return picked;
}

/** Reads every record of an entity, paging past the per-request limit. */
export async function fetchAllRecords(entity, sort = '-created_date', pageSize = 500) {
  const records = [];
  for (let skip = 0; ; skip += pageSize) {
    const page = await entity.list(sort, pageSize, skip);
    if (!Array.isArray(page) || page.length === 0) break;
    records.push(...page);
    if (page.length < pageSize) break;
  }
  return records;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function buildQuestionBankPackage({ questions = [], frameworks = [], controls = [] } = {}) {
  // Questions bound to a specific assessment belong to that assessment, not to
  // the shared bank, and cannot be carried over to another instance.
  const bankQuestions = questions.filter(q => !q.assessment_id);

  const pkgQuestions = bankQuestions.map(q => pickFields(q, QUESTION_FIELDS));
  const pkgControls = controls.map(c => pickFields(c, CONTROL_FIELDS));

  const domainMap = new Map();
  const addDomain = (domain, domainPt) => {
    const name = str(domain);
    if (!name) return;
    const key = name.toLowerCase();
    const translated = str(domainPt) || DOMAIN_TRANSLATIONS[name] || '';
    const current = domainMap.get(key);
    if (!current) domainMap.set(key, { domain: name, domain_pt: translated });
    else if (!current.domain_pt && translated) current.domain_pt = translated;
  };
  pkgQuestions.forEach(q => addDomain(q.domain, q.domain_pt));
  pkgControls.forEach(c => addDomain(c.domain));
  const domains = [...domainMap.values()].sort((a, b) => a.domain.localeCompare(b.domain));

  return {
    format: QUESTION_BANK_FORMAT,
    version: QUESTION_BANK_VERSION,
    exported_at: new Date().toISOString(),
    source_app: 'AnkoraOne',
    counts: {
      frameworks: frameworks.length,
      controls: pkgControls.length,
      domains: domains.length,
      questions: pkgQuestions.length,
    },
    frameworks: frameworks.map(f => pickFields(f, FRAMEWORK_FIELDS)),
    controls: pkgControls,
    domains,
    questions: pkgQuestions,
  };
}

/** Triggers the browser download and returns the generated file name. */
export function downloadQuestionBankPackage(pkg) {
  const fileName = `question-bank_${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return fileName;
}

// ─── Import ───────────────────────────────────────────────────────────────────

/** Throws Error('invalid_json') or Error('invalid_package') on bad input. */
export function parseQuestionBankPackage(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('invalid_json');
    }
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.questions)) {
    throw new Error('invalid_package');
  }
  return {
    format: data.format || null,
    version: data.version || null,
    exported_at: data.exported_at || null,
    source_app: data.source_app || null,
    frameworks: Array.isArray(data.frameworks) ? data.frameworks : [],
    controls: Array.isArray(data.controls) ? data.controls : [],
    domains: Array.isArray(data.domains) ? data.domains : [],
    questions: data.questions,
  };
}

/**
 * Compares the package with what already exists and returns what would happen.
 * Records are matched on their natural keys: framework `code`, control
 * `framework_code` + `control_id`, question `framework_code` + `control_id` +
 * question text. Existing records are only rewritten when `updateExisting`.
 */
export function buildImportPlan(pkg, existing = {}, { updateExisting = false } = {}) {
  const frameworkIds = {};
  const frameworkByCode = new Map();
  (existing.frameworks || []).forEach(f => {
    const key = refKey(f.code);
    frameworkByCode.set(key, f);
    frameworkIds[key] = f.id;
  });

  const domainPtByKey = new Map();
  (pkg.domains || []).forEach(d => {
    if (d?.domain) domainPtByKey.set(refKey(d.domain), str(d.domain_pt));
  });

  const frameworks = { create: [], update: [] };
  (pkg.frameworks || []).forEach(f => {
    const data = pickFields(f, FRAMEWORK_FIELDS);
    if (!data.code || !data.name) return;
    const key = refKey(data.code);
    const match = frameworkByCode.get(key);
    if (!match) {
      frameworks.create.push(data);
      if (!(key in frameworkIds)) frameworkIds[key] = null;
    } else if (updateExisting) {
      frameworks.update.push({ id: match.id, data });
    }
  });

  const controlByKey = new Map();
  (existing.controls || []).forEach(c => controlByKey.set(refKey(c.framework_code, c.control_id), c));

  const controls = { create: [], update: [], skipped: 0 };
  (pkg.controls || []).forEach(c => {
    const data = pickFields(c, CONTROL_FIELDS);
    if (!data.framework_code || !data.control_id) {
      controls.skipped += 1;
      return;
    }
    if (!(refKey(data.framework_code) in frameworkIds)) {
      controls.skipped += 1;
      return;
    }
    const match = controlByKey.get(refKey(data.framework_code, data.control_id));
    if (!match) controls.create.push(data);
    else if (updateExisting) controls.update.push({ id: match.id, data });
    else controls.skipped += 1;
  });

  const questionByKey = new Map();
  (existing.questions || []).forEach(q => {
    questionByKey.set(refKey(q.framework_code, q.control_id, normalizeText(q.question_text)), q);
  });

  const questions = { create: [], update: [], skipped: 0 };
  (pkg.questions || []).forEach(q => {
    const data = pickFields(q, QUESTION_FIELDS);
    if (!data.framework_code || !data.domain || !data.question_text) {
      questions.skipped += 1;
      return;
    }
    // The exported domain list carries the Portuguese label as a fallback.
    if (!data.domain_pt) {
      const domainPt = domainPtByKey.get(refKey(data.domain));
      if (domainPt) data.domain_pt = domainPt;
    }
    const match = questionByKey.get(refKey(data.framework_code, data.control_id, normalizeText(data.question_text)));
    if (!match) questions.create.push(data);
    else if (updateExisting) questions.update.push({ id: match.id, data });
    else questions.skipped += 1;
  });

  return {
    frameworkIds,
    frameworks,
    controls,
    questions,
    total: frameworks.create.length + frameworks.update.length
      + controls.create.length + controls.update.length
      + questions.create.length + questions.update.length,
  };
}

async function createInChunks(entity, records) {
  const created = [];
  for (let i = 0; i < records.length; i += WRITE_CHUNK_SIZE) {
    const result = await entity.bulkCreate(records.slice(i, i + WRITE_CHUNK_SIZE));
    if (Array.isArray(result)) created.push(...result);
  }
  return created;
}

async function updateInChunks(entity, updates) {
  for (let i = 0; i < updates.length; i += WRITE_CHUNK_SIZE) {
    await Promise.all(updates.slice(i, i + WRITE_CHUNK_SIZE).map(u => entity.update(u.id, u.data)));
  }
}

/** Executes a plan: frameworks first, then controls (bound to the new ids), then questions. */
export async function applyImportPlan(plan) {
  const result = {
    frameworks: { created: 0, updated: 0 },
    controls: { created: 0, updated: 0 },
    questions: { created: 0, updated: 0 },
  };

  if (plan.frameworks.update.length) {
    await updateInChunks(base44.entities.Framework, plan.frameworks.update);
    result.frameworks.updated = plan.frameworks.update.length;
  }
  if (plan.frameworks.create.length) {
    const created = await createInChunks(base44.entities.Framework, plan.frameworks.create);
    created.forEach(f => { plan.frameworkIds[refKey(f.code)] = f.id; });
    result.frameworks.created = created.length;
  }

  const withFrameworkId = (data) => ({ ...data, framework_id: plan.frameworkIds[refKey(data.framework_code)] });
  const controlUpdates = plan.controls.update.map(u => ({ id: u.id, data: withFrameworkId(u.data) }));
  const controlCreates = plan.controls.create.map(withFrameworkId).filter(c => c.framework_id);

  if (controlUpdates.length) {
    await updateInChunks(base44.entities.FrameworkControl, controlUpdates);
    result.controls.updated = controlUpdates.length;
  }
  if (controlCreates.length) {
    const created = await createInChunks(base44.entities.FrameworkControl, controlCreates);
    result.controls.created = created.length;
  }

  if (plan.questions.update.length) {
    await updateInChunks(base44.entities.Question, plan.questions.update);
    result.questions.updated = plan.questions.update.length;
  }
  if (plan.questions.create.length) {
    const created = await createInChunks(base44.entities.Question, plan.questions.create);
    result.questions.created = created.length;
  }

  return result;
}
