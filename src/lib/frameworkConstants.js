/**
 * Nomes dos frameworks para os dashboards e relatórios.
 * Lê do catálogo único (`frameworkCatalogue.js`) — deixou de ser uma segunda
 * lista mantida à mão.
 */
import { FRAMEWORK_CATALOGUE } from './frameworkCatalogue';

/** `{ NIS2: 'NIS2 / DL 125/2025', … }` — nome em português, por código. */
export const FRAMEWORK_NAMES = Object.fromEntries(
  FRAMEWORK_CATALOGUE.map(entry => [entry.code, entry.name.pt]),
);

/** Códigos do catálogo, pela ordem de apresentação. */
export const FRAMEWORK_CODES = FRAMEWORK_CATALOGUE.map(entry => entry.code);
