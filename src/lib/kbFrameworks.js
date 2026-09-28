/**
 * Knowledge Base framework metadata and display helpers.
 * Articles themselves are persisted (KnowledgeArticle entity); this file only
 * holds the framework catalogue used for filtering and colours.
 */

export const KB_FRAMEWORKS = {
  NIS2: { code: 'NIS2', name: 'NIS2 / DL 125/2025', color: '#3b82f6' },
  ISO27001: { code: 'ISO27001', name: 'ISO/IEC 27001', color: '#22c55e' },
  NIST_CSF: { code: 'NIST_CSF', name: 'NIST CSF', color: '#f97316' },
  CIS_V8: { code: 'CIS_V8', name: 'CIS Controls v8', color: '#a855f7' },
  GDPR: { code: 'GDPR', name: 'GDPR', color: '#ef4444' },
};

/** Get the framework colour for an article (grey when it has no framework). */
export function getArticleFrameworkColor(article) {
  const fw = KB_FRAMEWORKS[article?.framework];
  return fw?.color || '#6b7280';
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
