/**
 * Assessment scoring — server-side coverage, scoring and methodology snapshot.
 *
 * Phase 6 of the Core NIS2 migration moves scoring out of the browser
 * (previously computed inside `AssessmentDetail.jsx`) so the server is the only
 * source of truth: coverage and scores are derived from persisted responses and
 * a client-supplied `overall_score` is never trusted.
 *
 * Distinctions kept explicit (requirement "distinção entre não respondido, não
 * aplicável e resposta válida"):
 * - unanswered     → no AssessmentResponse row for the question
 * - not_applicable → row with `answer_state: "not_applicable"` (counts for
 *                    coverage, excluded from the score)
 * - answered       → row with a `maturity_level` (counts for coverage and score)
 */

export const SCORING_MODEL = "core-nis2-weighted-maturity-v1";

/** Minimum percentage of questions resolved (answered + not applicable) to allow a partial completion. */
export const MIN_COVERAGE_PCT = 50;

export const ANSWER_STATES = {
  ANSWERED: "answered",
  NOT_APPLICABLE: "not_applicable",
};

/** Error carrying an HTTP status, translated to a response by the functions. */
export class AssessmentError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Weight of a question, defaulting to 1 when absent or invalid. */
export function questionWeight(question: any): number {
  const weight = Number(question?.weight);
  return Number.isFinite(weight) && weight > 0 ? weight : 1;
}

export function isNotApplicable(response: any): boolean {
  return response?.answer_state === ANSWER_STATES.NOT_APPLICABLE;
}

export function isAnswered(response: any): boolean {
  if (!response || isNotApplicable(response)) return false;
  return response.maturity_level !== null && response.maturity_level !== undefined;
}

/**
 * Coverage of an assessment: how many questions are resolved, and how.
 * Coverage is reported separately from the score — a high coverage does not
 * imply a high maturity.
 */
export function computeCoverage(questions: any[], responses: any[]) {
  const byQuestion = new Map<string, any>();
  responses.forEach((r) => {
    if (r?.question_id) byQuestion.set(r.question_id, r);
  });

  let answered = 0;
  let notApplicable = 0;
  questions.forEach((q) => {
    const response = byQuestion.get(q.id);
    if (!response) return;
    if (isNotApplicable(response)) notApplicable += 1;
    else if (isAnswered(response)) answered += 1;
  });

  const total = questions.length;
  const resolved = answered + notApplicable;
  const unanswered = Math.max(0, total - resolved);

  return {
    total_questions: total,
    answered,
    not_applicable: notApplicable,
    unanswered,
    resolved,
    // Coverage: share of questions with a decision (answer or not applicable).
    coverage_pct: total > 0 ? round1((resolved / total) * 100) : 0,
    // Scored coverage: share of questions that actually feed the maturity score.
    scored_coverage_pct: total > 0 ? round1((answered / total) * 100) : 0,
  };
}

/**
 * Weighted maturity score per framework and per domain.
 * Only answered responses score; not-applicable ones are excluded so they can
 * never lower the maturity average.
 */
export function computeScores(questions: any[], responses: any[], frameworks: string[]) {
  const questionById = new Map<string, any>();
  questions.forEach((q) => questionById.set(q.id, q));

  const scored = responses.filter(isAnswered);
  const weightOf = (r: any) => questionWeight(questionById.get(r.question_id));

  const aggregate = (rows: any[]) => {
    const weight = rows.reduce((sum, r) => sum + weightOf(r), 0);
    const value = rows.reduce((sum, r) => sum + (Number(r.maturity_level) || 0) * weightOf(r), 0);
    return { score: weight > 0 ? round1(value / weight) : 0, weight };
  };

  const frameworkScores = (frameworks || []).map((code) => {
    const frameworkRows = scored.filter((r) => r.framework_code === code);
    const domains = [...new Set(frameworkRows.map((r) => r.domain).filter(Boolean))];
    const domainScores = domains.map((domain) => {
      const rows = frameworkRows.filter((r) => r.domain === domain);
      const { score } = aggregate(rows);
      return { domain, score };
    });
    const { score } = aggregate(frameworkRows);
    return {
      framework_code: code,
      score,
      domain_scores: domainScores,
    };
  });

  const { score: overall } = aggregate(scored);

  return {
    overall_score: overall,
    framework_scores: frameworkScores,
    scored_responses: scored.length,
  };
}

/**
 * Completion rules. Full coverage completes directly; a partial completion is
 * allowed only when explicitly confirmed and above the minimum coverage.
 */
export function assertCompletionAllowed(
  questions: any[],
  responses: any[],
  options: { confirm_partial?: boolean } = {},
) {
  if (questions.length === 0) {
    throw new AssessmentError("no_questions", "A avaliação não tem perguntas associadas.", 422);
  }
  if (responses.length === 0) {
    throw new AssessmentError("no_responses", "A avaliação não tem respostas registadas.", 422);
  }

  const coverage = computeCoverage(questions, responses);

  if (coverage.answered === 0) {
    throw new AssessmentError(
      "no_scored_responses",
      "A avaliação não tem respostas válidas (todas as respostas estão marcadas como não aplicáveis).",
      422,
    );
  }

  if (coverage.unanswered > 0) {
    if (!options.confirm_partial) {
      throw new AssessmentError(
        "incomplete_coverage",
        `Existem ${coverage.unanswered} perguntas por responder. Conclua a avaliação parcialmente para as registar como não cobertas.`,
        422,
      );
    }
    if (coverage.coverage_pct < MIN_COVERAGE_PCT) {
      throw new AssessmentError(
        "coverage_below_minimum",
        `A cobertura de ${coverage.coverage_pct}% é inferior ao mínimo de ${MIN_COVERAGE_PCT}% exigido para uma conclusão parcial.`,
        422,
      );
    }
  }

  return coverage;
}

/**
 * Methodology snapshot — preserves the framework versions, questions and weights
 * that were actually used, so a completed assessment stays interpretable after
 * the shared question catalogue changes.
 */
export function buildMethodology(
  assessment: any,
  questions: any[],
  frameworks: { code: string; version?: string | null }[],
) {
  return {
    scoring_model: SCORING_MODEL,
    captured_at: new Date().toISOString(),
    framework_versions: frameworks.map((f) => ({ code: f.code, version: f.version || null })),
    questions: questions.map((q) => ({
      question_id: q.id,
      framework_code: q.framework_code || null,
      domain: q.domain || null,
      control_id: q.control_id || null,
      weight: questionWeight(q),
    })),
    questions_count: questions.length,
    weight_total: questions.reduce((sum, q) => sum + questionWeight(q), 0),
    scale_max: 5,
  };
}

/** Type of completion recorded in the status history. */
export function completionType(coverage: { unanswered: number }): string {
  return coverage.unanswered > 0 ? "partial_coverage" : "full_coverage";
}

/** Append an entry to the assessment status history (never rewrites the past). */
export function appendStatusHistory(assessment: any, entry: any): any[] {
  return [...(assessment?.status_history || []), { at: new Date().toISOString(), ...entry }];
}
