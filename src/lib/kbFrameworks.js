/**
 * Knowledge Base framework metadata and display helpers.
 * Articles themselves are persisted (KnowledgeArticle entity); this file only
 * holds the framework catalogue used for filtering and colours.
 */

/** Framework colour tokens — the single source of the KB framework palette (FC2). */
const FRAMEWORK_TOKENS = {
  NIS2: '--chart-1',
  ISO27001: '--chart-2',
  NIST_CSF: '--chart-3',
  CIS_V8: '--chart-4',
  GDPR: '--destructive',
};
const NEUTRAL_TOKEN = '--muted-foreground';

export const KB_FRAMEWORKS = {
  NIS2: { code: 'NIS2', name: 'NIS2 / DL 125/2025', color: `hsl(var(${FRAMEWORK_TOKENS.NIS2}))` },
  ISO27001: { code: 'ISO27001', name: 'ISO/IEC 27001', color: `hsl(var(${FRAMEWORK_TOKENS.ISO27001}))` },
  NIST_CSF: { code: 'NIST_CSF', name: 'NIST CSF', color: `hsl(var(${FRAMEWORK_TOKENS.NIST_CSF}))` },
  CIS_V8: { code: 'CIS_V8', name: 'CIS Controls v8', color: `hsl(var(${FRAMEWORK_TOKENS.CIS_V8}))` },
  GDPR: { code: 'GDPR', name: 'GDPR', color: `hsl(var(${FRAMEWORK_TOKENS.GDPR}))` },
};

/** Get the framework colour for an article (neutral when it has no framework). */
export function getArticleFrameworkColor(article) {
  const fw = KB_FRAMEWORKS[article?.framework];
  return fw?.color || `hsl(var(${NEUTRAL_TOKEN}))`;
}

/** Tinted chip background — the framework token at chip opacity. */
export function getArticleFrameworkTint(article) {
  return `hsl(var(${FRAMEWORK_TOKENS[article?.framework] || NEUTRAL_TOKEN}) / 0.14)`;
}

/** Article statuses and the labels used by the editorial panel. */
export const ARTICLE_STATUS_LABELS = {
  draft: 'kb_status_draft',
  in_review: 'kb_status_in_review',
  published: 'kb_status_published',
  archived: 'kb_status_archived',
};

/** Legal editorial actions per status (mirrors base44/shared/contentUtils.ts). */
export const ARTICLE_ACTIONS_BY_STATUS = {
  draft: ['submit_review', 'publish', 'archive'],
  in_review: ['publish', 'reject', 'archive'],
  published: ['archive'],
  archived: ['restore'],
};
