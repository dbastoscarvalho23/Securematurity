/**
 * Biblioteca legal — acesso aos dados oficiais em src/data/legal/.
 *
 * Os ficheiros grandes (textos integrais) são carregados a pedido (import dinâmico), para não pesarem no
 * carregamento inicial da aplicação. O catálogo e as correspondências são pequenos e carregados de imediato.
 *
 * Fontes: apenas documentos oficiais (Diário da República, EUR-Lex, CIS, ENX/VDA). Ver docs/legal/README.md.
 */
import catalog from '@/data/legal/catalog.json';

export { catalog };

const loaders = {
  qnrcs: () => import('@/data/legal/qnrcs.json'),
  epr: () => import('@/data/legal/epr-measures.json'),
  rjc: () => import('@/data/legal/rjc.json'),
  reg756: () => import('@/data/legal/reg756.json'),
  nis2: () => import('@/data/legal/nis2.json'),
  regexec2690: () => import('@/data/legal/regexec2690.json'),
  dora: () => import('@/data/legal/dora.json'),
  isa6: () => import('@/data/legal/isa6.json'),
  isa2027: () => import('@/data/legal/isa2027.json'),
  isaChanges: () => import('@/data/legal/isa-changes.json'),
  enxNis2Isa6: () => import('@/data/legal/enx-nis2-isa6.json'),
  tisax: () => import('@/data/legal/tisax.json'),
  cisIds: () => import('@/data/legal/cis-ids.json'),
  obligations: () => import('@/data/legal/obligations.json'),
};

const cache = new Map();

/** Carrega um conjunto de dados da biblioteca (com cache). */
export function loadLegal(key) {
  if (!loaders[key]) return Promise.reject(new Error(`Conjunto de dados desconhecido: ${key}`));
  if (!cache.has(key)) cache.set(key, loaders[key]().then((m) => m.default || m));
  return cache.get(key);
}

export const LEVELS = ['basico', 'substancial', 'elevado'];
export const EPR_GROUPS = ['grupo_B', 'grupo_A'];

/** Níveis aplicáveis (cumulativos) — Regulamento n.º 756/2026, art. 30.º, n.º 2. */
export function cumulativeLevels(level) {
  const i = LEVELS.indexOf(level);
  return i < 0 ? [] : LEVELS.slice(0, i + 1);
}

/** Lista plana dos controlos do QNRCS. */
export function flattenQnrcs(qnrcs) {
  const out = [];
  for (const o of qnrcs?.objectives || []) {
    for (const c of o.categories) {
      for (const k of c.controls) out.push({ ...k, objective: o, category: c });
    }
  }
  return out;
}

/**
 * Medidas mínimas aplicáveis a uma entidade essencial/importante com um dado nível de conformidade.
 * Cada medida é identificada por `${controlId}@${nivel}` (o mesmo controlo pode ter medidas em vários níveis).
 */
export function applicableMeasures(qnrcs, level) {
  const levels = cumulativeLevels(level);
  const out = [];
  for (const k of flattenQnrcs(qnrcs)) {
    for (const lv of levels) {
      const m = k.measures?.[lv];
      if (m) out.push({ key: `${k.id}@${lv}`, control: k, level: lv, ...m });
    }
  }
  return out;
}

/** Medidas aplicáveis a uma entidade pública relevante (Grupo A inclui o Grupo B — art. 30.º, n.º 3). */
export function applicableEprMeasures(epr, group) {
  if (!epr) return [];
  const groups = group === 'A' ? ['B', 'A'] : group === 'B' ? ['B'] : [];
  return groups.flatMap((g) => (epr[`group_${g}`] || []).map((m, i) => ({ key: `EPR-${g}:${m.code}:${i}`, group: g, ...m })));
}

/** Instrumento do catálogo pelo id. */
export function getInstrument(id) {
  return catalog.instruments.find((i) => i.id === id) || null;
}

/** Estado de vigência de um instrumento numa data. */
export function instrumentStatus(inst, at = new Date()) {
  if (!inst) return 'unknown';
  if (inst.status === 'revogado') return 'revogado';
  if (inst.status === 'futuro' || (inst.valid_from && new Date(inst.valid_from) > at)) return 'futuro';
  return inst.status || 'em_vigor';
}
