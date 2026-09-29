/**
 * Modelo do relatório de validação — achados agrupados por área.
 *
 * Junta as duas rondas de inspeção num só modelo:
 *  - Ronda 1/2 (segurança e RBAC): `src/lib/validationReportData.js`, mantido como
 *    fonte de verdade dos achados F1–F15, do estado das correções e dos residuais.
 *  - Ronda 3 (funcional, administração, comercial e UX/UI): `src/lib/platformAssessmentData.js`.
 *
 * A página `/validacao-seguranca` e os seus componentes leem tudo daqui: nenhum
 * achado, contagem ou área é escrito na página, para que o relatório não possa
 * divergir do conteúdo das duas fontes.
 */

import {
  FOLLOW_UPS,
  FIX_PLAN,
  ISSUES,
  NOT_EXECUTED,
  REPORT_META,
  SEVERITIES,
  STATUSES,
  VERDICT,
  countBySeverity,
  countByStatus,
  issueStatus,
  severityMeta,
  statusMeta,
} from './validationReportData';
import {
  ASSESSMENT_AREAS,
  ASSESSMENT_FINDINGS,
  COMMERCIAL_AREAS,
  NIS2_AREAS,
  ROUND_META,
} from './platformAssessmentData';
import { TODO_LIST } from './validationTodos';

/**
 * Área dos achados da ronda anterior. Os F1–F15 ficam intactos em
 * `validationReportData.js` e são apenas etiquetados com a área «Segurança e
 * RBAC» — a rastreabilidade do relatório anterior não se perde.
 */
const SECURITY_AREA = {
  id: 'seguranca',
  label: 'Segurança e RBAC',
  description:
    'Validação da ronda anterior: papéis e capacidades, isolamento entre tenants, onboarding, delegações e licenciamento (F1–F15).',
  accent: [220, 38, 38],
  summary: VERDICT.summary,
  solid: VERDICT.positives,
  gaps: VERDICT.blockers,
};

/** Áreas por ordem de apresentação: as três desta ronda e, por fim, a anterior. */
export const AREAS = [...ASSESSMENT_AREAS, SECURITY_AREA];

const LEGACY_AREA_ID = SECURITY_AREA.id;

/** Normaliza um achado da ronda anterior para o formato comum do relatório. */
function normalizeLegacyIssue(issue) {
  const { status = 'pendente', note = '' } = issueStatus(issue.id);
  return {
    id: issue.id,
    area: LEGACY_AREA_ID,
    severity: issue.severity,
    title: issue.title,
    status,
    statusNote: note,
    persona: issue.persona,
    flow: issue.flow,
    evidence: issue.location || [],
    impact: issue.impact,
    recommendation: issue.fix,
    reproduction: issue.reproduction,
    check: issue.regression,
    legacy: true,
  };
}

/** Normaliza um achado desta ronda (já no formato comum). */
function normalizeAssessmentFinding(finding) {
  return { ...finding, legacy: false };
}

/** Todos os achados das duas rondas, na ordem das áreas. */
export const FINDINGS = [
  ...ASSESSMENT_FINDINGS.map(normalizeAssessmentFinding),
  ...ISSUES.map(normalizeLegacyIssue),
];

/** Achados de uma área. */
export function findingsByArea(areaId) {
  return FINDINGS.filter((f) => f.area === areaId);
}

/**
 * Uma lacuna da lista «Lacunas identificadas», com o estado que lhe dá o achado
 * que a fecha. O estado não é escrito à mão em lado nenhum: vem do achado
 * (`finding`), pelo que a lista não pode contradizer os cartões da mesma área —
 * fechar um achado muda a lacuna e o parecer no mesmo instante. Uma lacuna
 * histórica, escrita como texto solto (os bloqueadores do parecer de segurança),
 * não tem achado correspondente e fica «pendente».
 */
function normalizeGap(gap) {
  const { text, finding = null } = typeof gap === 'string' ? { text: gap } : gap;
  const match = finding ? FINDINGS.find((f) => f.id === finding) : null;
  return {
    text,
    finding: match ? match.id : null,
    status: match ? match.status : 'pendente',
    statusNote: (match && match.statusNote) || '',
  };
}

/**
 * Um achado está aberto enquanto a correção não estiver concluída: «parcial» e
 * «pendente» contam como abertos; «corrigido» fica fora das contagens.
 */
const OPEN_STATUSES = ['parcial', 'pendente'];

/** Achado ainda por fechar (parcial ou pendente). */
export function isOpenFinding(finding) {
  return OPEN_STATUSES.includes(finding.status);
}

/** Achados abertos, em todas as áreas. */
export function openFindings() {
  return FINDINGS.filter(isOpenFinding);
}

/** Contagem global por severidade, só dos achados abertos. */
export function openSeverityCounts() {
  return SEVERITIES.reduce((acc, s) => {
    acc[s.id] = FINDINGS.filter((f) => f.severity === s.id && isOpenFinding(f)).length;
    return acc;
  }, {});
}

/** Contagem de achados abertos de uma área por severidade. */
export function areaOpenSeverityCounts(areaId) {
  return SEVERITIES.reduce((acc, s) => {
    acc[s.id] = FINDINGS.filter(
      (f) => f.area === areaId && f.severity === s.id && isOpenFinding(f)
    ).length;
    return acc;
  }, {});
}

/** Contagem de achados de uma área por severidade. */
export function areaSeverityCounts(areaId) {
  return SEVERITIES.reduce((acc, s) => {
    acc[s.id] = FINDINGS.filter((f) => f.area === areaId && f.severity === s.id).length;
    return acc;
  }, {});
}

/** Contagem de achados de uma área por estado da recomendação. */
export function areaStatusCounts(areaId) {
  return STATUSES.reduce((acc, s) => {
    acc[s.id] = FINDINGS.filter((f) => f.area === areaId && f.status === s.id).length;
    return acc;
  }, {});
}

/** Contagem global por severidade, nas duas rondas. */
export function totalSeverityCounts() {
  return SEVERITIES.reduce((acc, s) => {
    acc[s.id] = FINDINGS.filter((f) => f.severity === s.id).length;
    return acc;
  }, {});
}

/** Contagem global por estado da recomendação. */
export function totalStatusCounts() {
  return STATUSES.reduce((acc, s) => {
    acc[s.id] = FINDINGS.filter((f) => f.status === s.id).length;
    return acc;
  }, {});
}

/**
 * Modelo pronto a renderizar: cada área com os seus achados — todos e só os
 * abertos — e as contagens correspondentes, para que a página possa alternar
 * entre «só abertos» (por omissão) e o relatório completo.
 */
export function buildReportModel() {
  return AREAS.map((area) => {
    const findings = findingsByArea(area.id);
    return {
      ...area,
      gaps: area.gaps.map(normalizeGap),
      findings,
      openFindings: findings.filter(isOpenFinding),
      severityCounts: areaSeverityCounts(area.id),
      openSeverityCounts: areaOpenSeverityCounts(area.id),
      statusCounts: areaStatusCounts(area.id),
      // Nota 0–5 da área, calculada dos seus achados (nunca escrita à mão).
      maturity: maturityForFindings(findings),
    };
  });
}

// ─── Escala de maturidade 0–5 ───────────────────────────────────

/**
 * Escala única de maturidade (0–5), aplicada às três famílias de áreas do
 * relatório: as áreas do relatório de validação, as áreas comerciais da
 * plataforma (FM1–FM6) e as categorias de requisitos NIS2.
 */
export const MATURITY_SCALE = [
  { level: 0, label: 'Inexistente', description: 'Nada existe para avaliar.' },
  { level: 1, label: 'Esboçado', description: 'Existe desenho ou intenção, sem execução utilizável.' },
  { level: 2, label: 'Parcial', description: 'Funciona em parte; as lacunas impedem o uso pleno.' },
  { level: 3, label: 'Funcional', description: 'Cobre o percurso principal, com lacunas conhecidas e delimitadas.' },
  { level: 4, label: 'Robusto', description: 'Cobre o percurso e os casos-limite; restam residuais assumidos.' },
  { level: 5, label: 'Validado', description: 'Sem achados abertos na área.' },
];

/** Peso de cada severidade na descida da nota e fator de cada estado do achado. */
export const MATURITY_WEIGHTS = { critica: 2, alta: 1.5, media: 0.75, baixa: 0.25, verificar: 0.25 };
export const MATURITY_STATUS_FACTOR = { corrigido: 0, parcial: 0.5, pendente: 1 };

/**
 * A nota 0–5 de um conjunto de achados: 5 menos o peso dos achados abertos
 * («parcial» conta metade, «corrigido» não conta), arredondado ao nível inteiro.
 * A justificação diz sempre o que baixou a nota — nunca há uma nota sem razão.
 */
export function maturityForFindings(findings = []) {
  const open = findings.filter(isOpenFinding);
  const penalty = open.reduce(
    (sum, f) =>
      sum + (MATURITY_WEIGHTS[f.severity] ?? 0.25) * (MATURITY_STATUS_FACTOR[f.status] ?? 1),
    0
  );
  // O nível 5 é «sem achados abertos»: qualquer achado aberto tira pelo menos um
  // nível (senão um achado de peso baixo não descia a nota e a justificação
  // contradizia o rótulo). Acima disso, o peso da severidade arredonda para cima.
  const rounded = open.length > 0 ? Math.max(1, Math.round(penalty)) : 0;
  const level = Math.max(0, Math.min(5, 5 - rounded));
  const meta = MATURITY_SCALE[level];
  const closed = findings.length - open.length;

  return {
    level,
    label: meta.label,
    description: meta.description,
    rationale: open.length
      ? `Achados abertos: ${open
          .map((f) => `${f.id} (${severityMeta(f.severity).label}, ${statusMeta(f.status).label})`)
          .join(' · ')}.`
      : `Sem achados abertos${closed ? ` — ${closed} já corrigido(s)` : ''}.`,
    open,
    closed,
    total: findings.length,
  };
}

/** Nota 0–5 de uma área do relatório, pelos achados que lhe pertencem. */
export function maturityForArea(areaId) {
  return maturityForFindings(findingsByArea(areaId));
}

/**
 * As três famílias de áreas medidas na mesma escala. As duas últimas são
 * conjuntos de áreas adicionais (áreas comerciais FM e categorias de requisitos
 * NIS2) e passam pela mesma função de cálculo que as áreas do relatório.
 */
export const MATURITY_FAMILIES = [
  {
    id: 'relatorio',
    label: 'Áreas do relatório de validação',
    description: 'Funcionalidades e fluxos, administração da plataforma, UX/UI, gestão comercial e segurança e RBAC.',
    areas: () =>
      AREAS.map((area) => ({
        id: area.id,
        label: area.label,
        description: area.description,
        findings: findingsByArea(area.id).map((f) => f.id),
      })),
  },
  {
    id: 'comercial',
    label: 'Áreas comerciais da plataforma',
    description: 'A prontidão comercial (FM1–FM6) lida pelos achados que a descrevem.',
    areas: () => COMMERCIAL_AREAS,
  },
  {
    id: 'nis2',
    label: 'Categorias de requisitos NIS2',
    description: 'As medidas do art. 21.º/2 do RJCS, medidas pelos achados da plataforma que tocam o suporte a cada uma.',
    areas: () => NIS2_AREAS,
  },
];

/**
 * Matriz de maturidade pronta a renderizar: cada família com as suas áreas, os
 * achados que a produzem e a nota calculada. Nenhuma nota é escrita à mão.
 */
export function buildMaturityMatrix() {
  const byId = new Map(FINDINGS.map((f) => [f.id, f]));
  return MATURITY_FAMILIES.map((family) => ({
    id: family.id,
    label: family.label,
    description: family.description,
    areas: family.areas().map((area) => {
      const findings = (area.findings || []).map((id) => byId.get(id)).filter(Boolean);
      return {
        id: area.id,
        label: area.label,
        description: area.description,
        findings,
        maturity: maturityForFindings(findings),
      };
    }),
  }));
}

/** Rótulo curto do estado de um achado (ex.: «Corrigido», «Pendente»). */
export function findingStatusLabel(finding) {
  return statusMeta(finding.status).label;
}

export {
  FIX_PLAN,
  FOLLOW_UPS,
  TODO_LIST,
  NOT_EXECUTED,
  REPORT_META,
  ROUND_META,
  SEVERITIES,
  STATUSES,
  VERDICT,
  countBySeverity,
  countByStatus,
  severityMeta,
  statusMeta,
};
