/**
 * Shared compliance utilities for SLA calculations, NIS2 notification timers,
 * and GDPR data subject request tracking.
 */

// ── Vulnerability SLA enforcement (days from discovery) ──────────────────
export const VULN_SLA_DAYS = {
  critical: 7,
  high: 30,
  medium: 90,
  low: 180,
};

export function calculateVulnDueDate(discoveredDate, severity) {
  if (!discoveredDate) return null;
  const days = VULN_SLA_DAYS[severity] || 90;
  const d = new Date(discoveredDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── DSR SLA (GDPR: 1 month, extendable by 2 months) ─────────────────────
export const DSR_SLA_DAYS = 30;
export const DSR_EXTENDED_SLA_DAYS = 90;

export function calculateDsrDueDate(receivedDate, extended = false) {
  if (!receivedDate) return null;
  const days = extended ? DSR_EXTENDED_SLA_DAYS : DSR_SLA_DAYS;
  const d = new Date(receivedDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── NIS2 Incident notification timers ────────────────────────────────────
export const NIS2_EARLY_WARNING_HOURS = 24;
export const NIS2_NOTIFICATION_HOURS = 72;
export const NIS2_FINAL_REPORT_DAYS = 30;

// GDPR Art. 33 — supervisory authority notification within 72h
export const GDPR_SA_NOTIFICATION_HOURS = 72;

/**
 * Returns hours remaining until a deadline from the detected_at timestamp.
 * Negative = overdue.
 */
export function hoursRemaining(detectedAt, hoursDeadline) {
  if (!detectedAt) return null;
  const detected = new Date(detectedAt).getTime();
  const deadline = detected + hoursDeadline * 3600 * 1000;
  const now = Date.now();
  return Math.round((deadline - now) / (3600 * 1000));
}

/**
 * Returns days remaining until a due date.
 * Negative = overdue.
 */
export function daysRemaining(dueDate) {
  if (!dueDate) return null;
  const due = new Date(dueDate).getTime();
  const now = new Date().setHours(0, 0, 0, 0);
  return Math.ceil((due - now) / (86400 * 1000));
}

export function isSlaBreached(dueDate) {
  const days = daysRemaining(dueDate);
  return days !== null && days < 0;
}

export function slaStatus(dueDate) {
  const days = daysRemaining(dueDate);
  if (days === null) return 'unknown';
  if (days < 0) return 'breached';
  if (days <= 3) return 'critical';
  if (days <= 7) return 'warning';
  return 'ok';
}

export const SLA_STATUS_STYLES = {
  breached: 'bg-destructive/10 text-destructive border-destructive/20',
  critical: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  warning: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  ok: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  unknown: 'bg-muted text-muted-foreground',
};

export const SEVERITY_STYLES = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  medium: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  low: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
};

export const STATUS_STYLES = {
  active: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  inactive: 'bg-muted text-muted-foreground',
  draft: 'bg-muted text-muted-foreground',
  detected: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  investigating: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  contained: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  resolved: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  closed: 'bg-muted text-muted-foreground',
  received: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  identity_verification: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  in_progress: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  completed: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
  withdrawn: 'bg-muted text-muted-foreground',
  open: 'bg-destructive/10 text-destructive border-destructive/20',
  remediated: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  verified: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  accepted_risk: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  false_positive: 'bg-muted text-muted-foreground',
};

export function formatDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}