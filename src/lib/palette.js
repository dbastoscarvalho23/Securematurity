/**
 * Design-system palette (FC2) — the single place a UI colour is resolved to a
 * token. Charts, chips and badges must read from here instead of declaring a
 * hex/hsl literal, so one change moves every surface and the dark theme keeps
 * working (the tokens are theme-aware; literals are not).
 */

/** Chart series colours, chart-1..chart-5, in token order. */
export const CHART_COLORS = [1, 2, 3, 4, 5].map(n => `hsl(var(--chart-${n}))`);

/** Chart colour of series `i`, cycling through the five chart tokens. */
export function chartColor(i) {
  return `hsl(var(--chart-${(i % 5) + 1}))`;
}

/** Risk levels, backed by the contrast-checked --risk-* scale. */
export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

const RISK_TOKENS = {
  low: '--risk-low',
  medium: '--risk-medium',
  high: '--risk-high',
  critical: '--risk-critical',
};

/** Text colour that stays legible on top of each risk colour. */
const RISK_FOREGROUND_TOKENS = {
  low: '--ankora-navy-950',
  medium: '--ankora-navy-950',
  high: '--destructive-foreground',
  critical: '--destructive-foreground',
};

/** Translation keys of the risk levels. */
export const RISK_LEVEL_KEYS = {
  low: 'risk_level_low',
  medium: 'risk_level_medium',
  high: 'risk_level_high',
  critical: 'risk_level_critical',
};

/** Risk level of an impact × likelihood score (1–25). */
export function riskLevelFor(score) {
  if (score >= 16) return 'critical';
  if (score >= 9) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

export function riskColor(level) {
  return `hsl(var(${RISK_TOKENS[level] || RISK_TOKENS.low}))`;
}

export function riskForeground(level) {
  return `hsl(var(${RISK_FOREGROUND_TOKENS[level] || RISK_FOREGROUND_TOKENS.low}))`;
}

export const riskColorForScore = (score) => riskColor(riskLevelFor(score));
export const riskForegroundForScore = (score) => riskForeground(riskLevelFor(score));
