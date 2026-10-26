import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  VULN_SLA_DAYS,
  calculateVulnDueDate,
  DSR_SLA_DAYS,
  DSR_EXTENDED_SLA_DAYS,
  calculateDsrDueDate,
  RJC_INITIAL_NOTIFICATION_HOURS,
  RJC_UPDATE_NOTIFICATION_HOURS,
  RJC_END_OF_IMPACT_HOURS,
  RJC_FINAL_REPORT_BUSINESS_DAYS,
  DORA_INITIAL_HOURS,
  DORA_INITIAL_MAX_HOURS,
  DORA_INTERMEDIATE_HOURS,
  DORA_FINAL_MONTHS,
  NIS2_EARLY_WARNING_HOURS,
  NIS2_NOTIFICATION_HOURS,
  addBusinessDays,
  incidentDeadlines,
  overdueIncidentPhases,
  GDPR_SA_NOTIFICATION_HOURS,
  hoursRemaining,
  daysRemaining,
  isSlaBreached,
  slaStatus,
  formatDateTime,
} from '../complianceUtils';

// ── Vulnerability SLA ─────────────────────────────────────────────────────
describe('calculateVulnDueDate', () => {
  it('applies the SLA per severity', () => {
    expect(VULN_SLA_DAYS).toEqual({ critical: 7, high: 30, medium: 90, low: 180 });
    expect(calculateVulnDueDate('2026-01-01', 'critical')).toBe('2026-01-08');
    expect(calculateVulnDueDate('2026-01-01', 'high')).toBe('2026-01-31');
    expect(calculateVulnDueDate('2026-01-01', 'medium')).toBe('2026-04-01');
    expect(calculateVulnDueDate('2026-01-01', 'low')).toBe('2026-06-30');
  });

  it('defaults to 90 days for unknown severity', () => {
    expect(calculateVulnDueDate('2026-01-01', 'unknown')).toBe('2026-04-01');
  });

  it('returns null without a date', () => {
    expect(calculateVulnDueDate(null, 'critical')).toBeNull();
  });
});

// ── GDPR DSR SLA ──────────────────────────────────────────────────────────
describe('calculateDsrDueDate', () => {
  it('adds 30 days, or 90 when extended', () => {
    expect(DSR_SLA_DAYS).toBe(30);
    expect(DSR_EXTENDED_SLA_DAYS).toBe(90);
    expect(calculateDsrDueDate('2026-03-01')).toBe('2026-03-31');
    expect(calculateDsrDueDate('2026-03-01', true)).toBe('2026-05-30');
  });

  it('returns null without a date', () => {
    expect(calculateDsrDueDate(null)).toBeNull();
  });
});

// ── Incident deadlines (RJC / DORA) ───────────────────────────────────────
describe('incidentDeadlines', () => {
  it('returns [] for null or regime "nenhum"', () => {
    expect(incidentDeadlines(null)).toEqual([]);
    expect(incidentDeadlines({ reporting_regime: 'nenhum' })).toEqual([]);
  });

  it('returns the RJC phases with correct SLA hours', () => {
    const inc = {
      significant_verified_at: '2026-01-01T10:00:00Z',
      early_warning_sent: false,
      notification_sent: false,
    };
    const phases = incidentDeadlines(inc);
    expect(RJC_INITIAL_NOTIFICATION_HOURS).toBe(24);
    expect(RJC_UPDATE_NOTIFICATION_HOURS).toBe(72);
    expect(RJC_END_OF_IMPACT_HOURS).toBe(24);
    expect(RJC_FINAL_REPORT_BUSINESS_DAYS).toBe(30);
    expect(phases.map((p) => p.id)).toEqual(['rjc_initial', 'rjc_update', 'rjc_end_of_impact', 'rjc_final']);
    // initial = verified + 24h; update = verified + 72h
    expect(phases[0].due.toISOString()).toBe('2026-01-02T10:00:00.000Z');
    expect(phases[1].due.toISOString()).toBe('2026-01-04T10:00:00.000Z');
    expect(phases[1].optional).toBe(true);
    // end of impact / final due only after their trigger facts are recorded
    expect(phases[2].due).toBeNull();
    expect(phases[3].due).toBeNull();
  });

  it('falls back to detected_at when verification not registered', () => {
    const phases = incidentDeadlines({ detected_at: '2026-01-01T10:00:00Z' });
    expect(phases[0].due.toISOString()).toBe('2026-01-02T10:00:00.000Z');
  });

  it('resolved_within_2h skips the initial/update phases', () => {
    const phases = incidentDeadlines({
      resolved_within_2h: true,
      impact_ended_at: '2026-01-01T12:00:00Z',
      end_of_impact_notification_sent_at: '2026-01-02T09:00:00Z',
    });
    expect(phases.map((p) => p.id)).toEqual(['rjc_end_of_impact', 'rjc_final']);
    expect(phases[0].due.toISOString()).toBe('2026-01-02T12:00:00.000Z');
    // final = 30 business days after end-of-impact notification
    expect(phases[1].due).toEqual(addBusinessDays('2026-01-02T09:00:00Z', 30));
  });

  it('computes end-of-impact and final due dates when trigger facts exist', () => {
    const phases = incidentDeadlines({
      significant_verified_at: '2026-01-01T10:00:00Z',
      impact_ended_at: '2026-01-05T08:00:00Z',
      end_of_impact_notification_sent_at: '2026-01-06T09:00:00Z',
    });
    expect(phases.find((p) => p.id === 'rjc_end_of_impact').due.toISOString()).toBe('2026-01-06T08:00:00.000Z');
    expect(phases.find((p) => p.id === 'rjc_final').due).toEqual(addBusinessDays('2026-01-06T09:00:00Z', 30));
  });

  it('DORA: classificação dentro das 24h usa o prazo mais cedo', () => {
    expect(DORA_INITIAL_HOURS).toBe(4);
    expect(DORA_INITIAL_MAX_HOURS).toBe(24);
    expect(DORA_INTERMEDIATE_HOURS).toBe(72);
    expect(DORA_FINAL_MONTHS).toBe(1);
    const inc = {
      reporting_regime: 'dora',
      detected_at: '2026-01-01T00:00:00Z',
      dora_classified_major_at: '2026-01-01T06:00:00Z', // dentro das 24h → min(06+4h, 00+24h)
    };
    const [initial] = incidentDeadlines(inc);
    expect(initial.due.toISOString()).toBe('2026-01-01T10:00:00.000Z');
  });

  it('DORA: classificação após as 24h vence 4h após a classificação', () => {
    const inc = {
      reporting_regime: 'dora',
      detected_at: '2026-01-01T00:00:00Z',
      dora_classified_major_at: '2026-01-03T00:00:00Z',
    };
    const [initial] = incidentDeadlines(inc);
    expect(initial.due.toISOString()).toBe('2026-01-03T04:00:00.000Z');
  });

  it('DORA: intercalar conta desde a notificação inicial; final +1 mês', () => {
    const phases = incidentDeadlines({
      reporting_regime: 'dora',
      detected_at: '2026-01-01T00:00:00Z',
      early_warning_sent_at: '2026-01-02T12:00:00Z',
      notification_sent_at: '2026-01-04T00:00:00Z',
    });
    expect(phases.map((p) => p.id)).toEqual(['dora_initial', 'dora_intermediate', 'dora_final']);
    expect(phases[1].due.toISOString()).toBe('2026-01-05T12:00:00.000Z');
    expect(phases[2].due.toISOString()).toBe('2026-02-04T00:00:00.000Z');
  });

  it('RJC compatibility aliases point to the RJC hours', () => {
    expect(NIS2_EARLY_WARNING_HOURS).toBe(RJC_INITIAL_NOTIFICATION_HOURS);
    expect(NIS2_NOTIFICATION_HOURS).toBe(RJC_UPDATE_NOTIFICATION_HOURS);
    expect(GDPR_SA_NOTIFICATION_HOURS).toBe(72);
  });
});

describe('addBusinessDays', () => {
  it('skips weekends', () => {
    // Friday + 1 business day → Monday
    expect(addBusinessDays('2026-01-02', 1).toISOString().slice(0, 10)).toBe('2026-01-05');
    // Monday + 4 → Friday
    expect(addBusinessDays('2026-01-05', 4).toISOString().slice(0, 10)).toBe('2026-01-09');
  });

  it('returns null without a date', () => {
    expect(addBusinessDays(null, 5)).toBeNull();
  });
});

describe('overdueIncidentPhases', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T00:00:00Z'));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('lists overdue, non-optional, unsent phases only', () => {
    const inc = {
      significant_verified_at: '2026-01-01T00:00:00Z',
      early_warning_sent: false,
      notification_sent: false,
    };
    const ids = overdueIncidentPhases(inc).map((p) => p.id);
    // initial (24h) está em atraso; update (72h) também, mas é optional → não conta
    expect(ids).toEqual(['rjc_initial']);
  });

  it('excludes phases already sent and closed incidents', () => {
    const sent = overdueIncidentPhases({ significant_verified_at: '2026-01-01T00:00:00Z', early_warning_sent: true });
    // a única fase por enviar é a update, que é optional → nada conta
    expect(sent.map((p) => p.id)).toEqual([]);
    expect(overdueIncidentPhases({ status: 'closed' })).toEqual([]);
    expect(overdueIncidentPhases(null)).toEqual([]);
  });
});

// ── Time-to-deadline helpers ──────────────────────────────────────────────
describe('hoursRemaining', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-04T11:00:00Z'));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('counts hours from detected_at to the deadline', () => {
    expect(hoursRemaining('2026-01-01T12:00:00Z', 72)).toBe(1);
  });

  it('is negative once overdue', () => {
    vi.setSystemTime(new Date('2026-01-04T14:00:00Z'));
    expect(hoursRemaining('2026-01-01T12:00:00Z', 72)).toBe(-2);
  });

  it('returns null without a date', () => {
    expect(hoursRemaining(null, 24)).toBeNull();
  });
});

describe('daysRemaining / isSlaBreached / slaStatus', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T12:00:00'));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('counts whole days until the due date, ceil of partial days', () => {
    expect(daysRemaining('2026-01-15T00:00:00')).toBe(5);
    expect(daysRemaining('2026-01-10T18:00:00')).toBe(1);
  });

  it('is negative for overdue due dates', () => {
    expect(daysRemaining('2026-01-05T00:00:00')).toBe(-5);
  });

  it('returns null without a date; breach only when negative', () => {
    expect(daysRemaining(null)).toBeNull();
    expect(isSlaBreached(null)).toBe(false);
    expect(isSlaBreached('2026-01-05T00:00:00')).toBe(true);
    expect(isSlaBreached('2026-01-15T00:00:00')).toBe(false);
  });

  it('buckets the status by days remaining', () => {
    expect(slaStatus(null)).toBe('unknown');
    expect(slaStatus('2026-01-05T00:00:00')).toBe('breached');
    expect(slaStatus('2026-01-13T00:00:00')).toBe('critical'); // 3 dias
    expect(slaStatus('2026-01-17T00:00:00')).toBe('warning'); // 7 dias
    expect(slaStatus('2026-02-09T00:00:00')).toBe('ok');
  });
});

// ── Formatting ────────────────────────────────────────────────────────────
describe('formatDateTime', () => {
  it('renders an em dash for empty input', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('')).toBe('—');
  });

  it('formats with the given locale', () => {
    expect(formatDateTime('2026-01-15T10:30:00', 'en-GB')).toContain('Jan');
    expect(formatDateTime('2026-01-15T10:30:00', 'en-GB')).toContain('2026');
  });
});
