/**
 * Knowledge Base framework metadata and display helpers.
 *
 * A lista de frameworks **não** vive aqui: lê-se do catálogo único
 * (`src/lib/frameworkCatalogue.js`, espelho de `base44/shared/frameworkCatalogue.ts`)
 * e a cor de `src/lib/palette.js`. Este ficheiro só acrescenta o que é
 * apresentação da base de conhecimento — o chip tingido e os rótulos do
 * workflow editorial.
 */
import { FRAMEWORK_CATALOGUE, frameworkName } from './frameworkCatalogue';
import { frameworkColor, frameworkTintColor } from './palette';

/** Catálogo da KB indexado por código: `{ code, name, acronym, color }`. */
export const KB_FRAMEWORKS = Object.fromEntries(
  FRAMEWORK_CATALOGUE.map(entry => [
    entry.code,
    {
      code: entry.code,
      name: entry.name.pt,
      acronym: entry.acronym,
      color: frameworkColor(entry.code),
    },
  ]),
);

/** Códigos do catálogo, pela ordem de apresentação. */
export const KB_FRAMEWORK_CODES = FRAMEWORK_CATALOGUE.map(entry => entry.code);

/** Nome apresentado de um framework (PT por omissão). */
export function getFrameworkName(code, lang = 'pt') {
  return frameworkName(code, lang);
}

/** Get the framework colour for an article (neutral when it has no framework). */
export function getArticleFrameworkColor(article) {
  return KB_FRAMEWORKS[article?.framework]?.color || frameworkColor('__unknown__');
}

/** Tinted chip background — the framework token at chip opacity. */
export function getArticleFrameworkTint(article) {
  return frameworkTintColor(article?.framework);
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
