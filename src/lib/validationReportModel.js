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
import { ASSESSMENT_AREAS, ASSESSMENT_FINDINGS, ROUND_META } from './platformAssessmentData';

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
    };
  });
}

/** Rótulo curto do estado de um achado (ex.: «Corrigido», «Pendente»). */
export function findingStatusLabel(finding) {
  return statusMeta(finding.status).label;
}

export {
  FIX_PLAN,
  FOLLOW_UPS,
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
