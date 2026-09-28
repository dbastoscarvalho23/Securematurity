/**
 * Gap analysis — turns a completed Core NIS2 assessment into traceable gaps and
 * actions (Phase 6: "lacunas → ações com responsável, prazo, prioridade, estado,
 * evidência").
 *
 * Every gap is derived from persisted responses, never from client input:
 * - below_target — an answered requirement whose maturity is under its target
 * - uncovered    — a requirement with no response at all (possible after a
 *                  partial completion, where the questions left unanswered are
 *                  recorded as not covered)
 *
 * A deliberate "não aplicável" answer is a scope decision, so it is never a gap.
 * Each gap keeps the link to its requirement (`question_id` + `control_id`), and
 * each action keeps the link back to the gap (`recommendation_id`) and to the
 * control it addresses (`framework_control_id`).
 */

import { ANSWER_STATES, isAnswered, questionWeight } from "./assessmentScoring.ts";

export const DEFAULT_TARGET_MATURITY = 4;
/** Marker written on recommendations produced by the gap analysis. */
export const GAP_SOURCE = "assessment_gap";

export const GAP_TYPES = {
  BELOW_TARGET: "below_target",
  UNCOVERED: "uncovered",
};

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Suggested timeline per priority — also drives the action due date. */
export const PRIORITY_TIMELINE: Record<string, string> = {
  critical: "immediate",
  high: "short_term",
  medium: "medium_term",
  low: "long_term",
};

/** How many days each timeline allows before the action is due. */
export const TIMELINE_DAYS: Record<string, number> = {
  immediate: 30,
  short_term: 90,
  medium_term: 180,
  long_term: 365,
};

const TITLE_MAX = 160;

function truncate(text: string, max = TITLE_MAX): string {
  const value = String(text ?? "").trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Drop null/undefined keys: the local backend rejects null on a typed field. */
function compact<T extends Record<string, any>>(payload: T): T {
  Object.keys(payload).forEach((key) => {
    if (payload[key] === null || payload[key] === undefined) delete payload[key];
  });
  return payload;
}

function questionText(question: any, language: "pt" | "en"): string {
  if (language === "pt") return question?.question_text_pt || question?.question_text || "";
  return question?.question_text || "";
}

function questionGuidance(question: any, language: "pt" | "en"): string {
  if (language === "pt") return question?.guidance_pt || question?.guidance || "";
  return question?.guidance || "";
}

/**
 * Priority from the size of the gap and the weight the requirement carries.
 * A one-level gap on a light requirement stays low; a large gap on a heavy
 * requirement is critical.
 */
export function classifyGapPriority(deficit: number, weight: number): string {
  const impact = deficit * Math.max(1, Math.min(5, Number(weight) || 1));
  if (impact >= 9) return "critical";
  if (impact >= 6) return "high";
  if (impact >= 3) return "medium";
  return "low";
}

/** Implementation effort: a larger gap needs more work; an uncovered one is unknown. */
export function classifyGapEffort(gapType: string, deficit: number | null): string {
  if (gapType === GAP_TYPES.UNCOVERED) return "medium";
  return (deficit || 0) >= 2 ? "high" : "medium";
}

/**
 * Identify the gaps of an assessment from its questions and persisted responses.
 * Returns them ordered by priority (critical first).
 */
export function identifyGaps(questions: any[], responses: any[], options: { target_default?: number } = {}) {
  const targetDefault = Number(options.target_default) || DEFAULT_TARGET_MATURITY;
  const byQuestion = new Map<string, any>();
  responses.forEach((r) => {
    if (r?.question_id) byQuestion.set(r.question_id, r);
  });

  const gaps: any[] = [];

  (questions || []).forEach((question) => {
    const weight = questionWeight(question);
    const response = byQuestion.get(question.id);

    // A deliberate "not applicable" is a scope decision, never a gap.
    if (response && response.answer_state === ANSWER_STATES.NOT_APPLICABLE) return;

    const base = {
      question_id: question.id,
      control_id: question.control_id || response?.control_id || null,
      framework_code: question.framework_code || response?.framework_code || null,
      domain: question.domain || response?.domain || null,
      weight,
    };

    if (response && isAnswered(response)) {
      const current = Number(response.maturity_level);
      const target = Number.isFinite(Number(response.target_level))
        ? Number(response.target_level)
        : targetDefault;
      const deficit = target - current;
      if (!(deficit > 0)) return;

      gaps.push({
        ...base,
        gap_type: GAP_TYPES.BELOW_TARGET,
        current_level: current,
        target_level: target,
        deficit,
        priority: classifyGapPriority(deficit, weight),
        effort: classifyGapEffort(GAP_TYPES.BELOW_TARGET, deficit),
        evidence_notes: response.evidence_notes || null,
        improvement_suggestions: response.improvement_suggestions || null,
      });
      return;
    }

    gaps.push({
      ...base,
      gap_type: GAP_TYPES.UNCOVERED,
      current_level: null,
      target_level: targetDefault,
      deficit: null,
      priority: weight >= 3 ? "high" : "medium",
      effort: classifyGapEffort(GAP_TYPES.UNCOVERED, null),
      evidence_notes: null,
      improvement_suggestions: null,
    });
  });

  return gaps.sort((a, b) => {
    const byPriority = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
    if (byPriority !== 0) return byPriority;
    return (b.weight || 0) - (a.weight || 0);
  });
}

/** Counts used by the UI and the audit trail. */
export function summarizeGaps(gaps: any[]) {
  const byPriority: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const byType: Record<string, number> = { [GAP_TYPES.BELOW_TARGET]: 0, [GAP_TYPES.UNCOVERED]: 0 };
  (gaps || []).forEach((gap) => {
    byPriority[gap.priority] = (byPriority[gap.priority] || 0) + 1;
    byType[gap.gap_type] = (byType[gap.gap_type] || 0) + 1;
  });
  return { total: (gaps || []).length, by_priority: byPriority, by_type: byType };
}

/**
 * Build the Recommendation (the recorded gap) for a gap.
 * The requirement link is explicit: `question_id` + `control_id` + `framework_code`.
 */
export function gapToRecommendation(gap: any, question: any, assessment: any) {
  const control = gap.control_id || "";
  const ptText = questionText(question, "pt");
  const enText = questionText(question, "en");
  const guidancePt = questionGuidance(question, "pt");
  const guidanceEn = questionGuidance(question, "en");

  let descriptionPt: string;
  let descriptionEn: string;
  if (gap.gap_type === GAP_TYPES.UNCOVERED) {
    descriptionPt = `O requisito ${control} (${gap.domain}) não foi coberto pela avaliação: não existe resposta registada. O requisito tem de ser avaliado e evidenciado.`;
    descriptionEn = `Requirement ${control} (${gap.domain}) was not covered by the assessment: no answer was recorded. The requirement must be assessed and evidenced.`;
  } else {
    descriptionPt = `Maturidade atual ${gap.current_level} de 5, alvo ${gap.target_level}. Lacuna de ${gap.deficit} nível(es) no requisito ${control} (${gap.domain}).`;
    descriptionEn = `Current maturity ${gap.current_level} of 5 against a target of ${gap.target_level}. Gap of ${gap.deficit} level(s) on requirement ${control} (${gap.domain}).`;
  }

  if (gap.improvement_suggestions) {
    descriptionPt = `${descriptionPt} ${gap.improvement_suggestions}`;
    descriptionEn = `${descriptionEn} ${gap.improvement_suggestions}`;
  } else {
    if (guidancePt) descriptionPt = `${descriptionPt} Orientação: ${guidancePt}`;
    if (guidanceEn) descriptionEn = `${descriptionEn} Guidance: ${guidanceEn}`;
  }

  descriptionPt = `${descriptionPt} Evidência exigida: registo documental ou operacional do controlo, anexado à ação.`;
  descriptionEn = `${descriptionEn} Required evidence: documentary or operational record of the control, attached to the action.`;

  return compact({
    assessment_id: assessment.id,
    customer_id: assessment.customer_id,
    framework_code: gap.framework_code,
    domain: gap.domain,
    control_id: gap.control_id,
    question_id: gap.question_id,
    priority: gap.priority,
    current_level: gap.current_level,
    target_level: gap.target_level,
    effort: gap.effort,
    timeline: PRIORITY_TIMELINE[gap.priority] || "medium_term",
    status: "pending",
    source: GAP_SOURCE,
    title: truncate(`${control ? `${control} — ` : ""}${enText}`),
    title_pt: truncate(`${control ? `${control} — ` : ""}${ptText}`),
    description: descriptionEn,
    description_pt: descriptionPt,
  });
}

/**
 * Build the Task (the action) for a recorded gap: responsible, due date,
 * priority, status and the evidence that must be attached to close it.
 */
export function gapToAction(
  recommendation: any,
  assessment: any,
  options: { assigned_to?: string } = {},
) {
  const timeline = recommendation.timeline || PRIORITY_TIMELINE[recommendation.priority] || "medium_term";
  const days = TIMELINE_DAYS[timeline] ?? TIMELINE_DAYS.medium_term;
  const dueDate = new Date(Date.now() + days * 86400000).toISOString().split("T")[0];

  const action = compact({
    title: recommendation.title,
    description: recommendation.description,
    status: "todo",
    priority: recommendation.priority,
    assigned_to: (options.assigned_to || "").trim(),
    due_date: dueDate,
    assessment_id: assessment.id,
    customer_id: assessment.customer_id,
    customer_name: assessment.customer_name,
    recommendation_id: recommendation.id,
    framework_code: recommendation.framework_code,
    framework_control_id: recommendation.control_id,
    domain: recommendation.domain,
    notes:
      `Ação gerada a partir da lacuna ${recommendation.control_id || ""} da avaliação «${assessment.title}». ` +
      "Evidência exigida: anexar o registo documental ou operacional do controlo.",
  });

  if (!action.assigned_to) delete action.assigned_to;
  return action;
}
