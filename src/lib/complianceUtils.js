/**
 * Shared compliance utilities for SLA calculations, incident notification deadlines (RJC / DORA),
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

// ── Prazos de notificação de incidentes ─────────────────────────────────────
// Regime Jurídico da Cibersegurança (DL 125/2025), arts. 41.º a 44.º — ver Biblioteca Legal › Obrigações e prazos.
// (Substituem os prazos da Diretiva NIS2, art. 23.º, usados anteriormente: em Portugal aplica-se o RJC.)
export const RJC_INITIAL_NOTIFICATION_HOURS = 24;   // art. 42.º, n.º 1 — após verificação do incidente significativo
export const RJC_UPDATE_NOTIFICATION_HOURS = 72;    // art. 42.º, n.º 3 — atualização, quando necessária
export const RJC_END_OF_IMPACT_HOURS = 24;          // art. 43.º, n.º 1 — após o fim do impacto
export const RJC_FINAL_REPORT_BUSINESS_DAYS = 30;   // art. 44.º, n.º 1 — após a notificação de fim de impacto
export const RJC_RESOLVED_WITHIN_HOURS = 2;         // art. 41.º, n.º 2 — só notificação de fim de impacto
// DORA — Regulamento Delegado (UE) 2025/301, art. 5.º
export const DORA_INITIAL_HOURS = 4;                // desde a classificação como incidente de caráter severo
export const DORA_INITIAL_MAX_HOURS = 24;           // máximo desde o conhecimento do incidente
export const DORA_INTERMEDIATE_HOURS = 72;          // desde a notificação inicial
export const DORA_FINAL_MONTHS = 1;                 // desde o (último) relatório intercalar

// Compatibilidade com código anterior
export const NIS2_EARLY_WARNING_HOURS = RJC_INITIAL_NOTIFICATION_HOURS;
export const NIS2_NOTIFICATION_HOURS = RJC_UPDATE_NOTIFICATION_HOURS;

const addHours = (d, h) => (d ? new Date(new Date(d).getTime() + h * 3600 * 1000) : null);

/**
 * Soma dias úteis (segunda a sexta). Os feriados não são descontados: o prazo calculado
 * fica igual ou anterior ao prazo legal (nunca posterior).
 */
export function addBusinessDays(date, days) {
  if (!date) return null;
  const d = new Date(date);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  return d;
}

const addMonths = (date, n) => {
  if (!date) return null;
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
};

/**
 * Fases de notificação aplicáveis a um incidente, com o respetivo prazo.
 * Devolve [{ id, labelKey, due: Date|null, sent: boolean, ref, optional? }].
 * `due` é null enquanto o facto que inicia a contagem não estiver registado.
 */
export function incidentDeadlines(inc) {
  if (!inc) return [];
  const regime = inc.reporting_regime || 'rjc';
  if (regime === 'nenhum') return [];
  if (regime === 'dora') {
    const aware = inc.detected_at;
    const classified = inc.dora_classified_major_at;
    let initialDue = null;
    if (classified) {
      const fromClass = addHours(classified, DORA_INITIAL_HOURS);
      const cap = addHours(aware, DORA_INITIAL_MAX_HOURS);
      // Classificado dentro das 24 h: o que ocorrer primeiro. Depois das 24 h: 4 h após a classificação (art. 5.º, n.º 2).
      initialDue = cap && new Date(classified) <= cap ? new Date(Math.min(fromClass, cap)) : fromClass;
    }
    return [
      { id: 'dora_initial', labelKey: 'inc_dora_initial', due: initialDue, sent: !!inc.early_warning_sent, ref: 'RTS 2025/301, art. 5.º, n.º 1, a)' },
      { id: 'dora_intermediate', labelKey: 'inc_dora_intermediate', due: addHours(inc.early_warning_sent_at, DORA_INTERMEDIATE_HOURS), sent: !!inc.notification_sent, ref: 'RTS 2025/301, art. 5.º, n.º 1, b)' },
      { id: 'dora_final', labelKey: 'inc_dora_final', due: addMonths(inc.notification_sent_at, DORA_FINAL_MONTHS), sent: !!inc.final_report_sent, ref: 'RTS 2025/301, art. 5.º, n.º 1, c)' },
    ];
  }
  const start = inc.significant_verified_at || inc.detected_at;
  const endOfImpact = { id: 'rjc_end_of_impact', labelKey: 'inc_rjc_end_of_impact', due: addHours(inc.impact_ended_at, RJC_END_OF_IMPACT_HOURS), sent: !!inc.end_of_impact_notification_sent, ref: 'RJC, art. 43.º, n.º 1' };
  const final = { id: 'rjc_final', labelKey: 'inc_rjc_final', due: addBusinessDays(inc.end_of_impact_notification_sent_at, RJC_FINAL_REPORT_BUSINESS_DAYS), sent: !!inc.final_report_sent, ref: 'RJC, art. 44.º, n.º 1' };
  if (inc.resolved_within_2h) return [endOfImpact, final];
  return [
    { id: 'rjc_initial', labelKey: 'inc_rjc_initial', due: addHours(start, RJC_INITIAL_NOTIFICATION_HOURS), sent: !!inc.early_warning_sent, ref: 'RJC, art. 42.º, n.º 1' },
    { id: 'rjc_update', labelKey: 'inc_rjc_update', due: addHours(start, RJC_UPDATE_NOTIFICATION_HOURS), sent: !!inc.notification_sent, ref: 'RJC, art. 42.º, n.º 3', optional: true },
    endOfImpact,
    final,
  ];
}

/** Fases em atraso (prazo ultrapassado e notificação por enviar; as opcionais não contam). */
export function overdueIncidentPhases(inc, now = Date.now()) {
  if (!inc || inc.status === 'closed') return [];
  return incidentDeadlines(inc).filter((p) => !p.sent && !p.optional && p.due && p.due.getTime() < now);
}

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

export function formatDateTime(dt, locale = 'en-GB') {
  if (!dt) return '—';
  return new Date(dt).toLocaleString(locale, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}