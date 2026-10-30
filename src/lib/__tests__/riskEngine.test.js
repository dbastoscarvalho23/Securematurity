import { describe, it, expect } from 'vitest';
import {
  riskScore,
  riskLevel,
  riskLevelLabel,
  deriveRisksFromAssessment,
  mergeRisks,
  summariseRisks,
} from '../riskEngine';

// ── riskScore / riskLevel / riskLevelLabel ────────────────────────────────
describe('riskScore', () => {
  it('multiplies impact by likelihood', () => {
    expect(riskScore(4, 3)).toBe(12);
    expect(riskScore(5, 5)).toBe(25);
    expect(riskScore(1, 1)).toBe(1);
  });
});

describe('riskLevel thresholds', () => {
  it.each([
    [25, 'critical'],
    [16, 'critical'],
    [15, 'high'],
    [9, 'high'],
    [8, 'medium'],
    [4, 'medium'],
    [3, 'low'],
    [1, 'low'],
  ])('score %i → %s', (score, expected) => {
    expect(riskLevel(score)).toBe(expected);
  });
});

describe('riskLevelLabel thresholds', () => {
  it.each([
    [16, 'Critical'],
    [15, 'High'],
    [4, 'Medium'],
    [3, 'Low'],
  ])('score %i → %s', (score, expected) => {
    expect(riskLevelLabel(score)).toBe(expected);
  });
});

// ── deriveRisksFromAssessment ─────────────────────────────────────────────
const assessment = {
  id: 'a1',
  customer_id: 'c1',
  customer_name: 'TechNova',
  framework_scores: [
    {
      framework_code: 'NIS2',
      domain_scores: [
        { domain: 'Access Control', score: 1.0 },
        { domain: 'Network Security', score: 4.0 }, // strong → not flagged
      ],
    },
    {
      framework_code: 'ISO27001',
      domain_scores: [
        { domain: 'Governance', score: 2.5 },
      ],
    },
  ],
};

describe('deriveRisksFromAssessment', () => {
  it('returns [] for null/missing input', () => {
    expect(deriveRisksFromAssessment(null)).toEqual([]);
    expect(deriveRisksFromAssessment({})).toEqual([]);
    expect(deriveRisksFromAssessment({ framework_scores: null })).toEqual([]);
  });

  it('flags only weak domains (score < 3.5)', () => {
    const risks = deriveRisksFromAssessment(assessment);
    expect(risks).toHaveLength(2);
    expect(risks.map((r) => r.domain)).toEqual(['Access Control', 'Governance']);
  });

  it('maps maturity to likelihood/impact deterministically', () => {
    const [accessControl] = deriveRisksFromAssessment(assessment);
    // score 1.0 → likelihood 5; weight 5 → impact round((5-1)*0.8 + 5*0.2) = 4
    expect(accessControl.likelihood).toBe(5);
    expect(accessControl.impact).toBe(4);
    expect(accessControl.score).toBe(20);
    expect(accessControl.level).toBe('critical');
  });

  it('uses the default domain weight (3) for unknown domains', () => {
    const a = {
      id: 'a2',
      customer_id: 'c1',
      framework_scores: [
        { framework_code: 'NIS2', domain_scores: [{ domain: 'Unknown Domain', score: 1.0 }] },
      ],
    };
    const [r] = deriveRisksFromAssessment(a);
    // impact round((5-1)*0.8 + 3*0.2) = round(3.8) = 4 → same 20 for this case
    expect(r.impact).toBe(4);
    expect(r.score).toBe(20);
  });

  it('derives ids, metadata and open status per framework/domain', () => {
    const risks = deriveRisksFromAssessment(assessment);
    const ac = risks.find((r) => r.framework_code === 'NIS2');
    expect(ac.id).toBe('derived-a1-NIS2-Access Control');
    expect(ac.title).toBe('Access Control Maturity Gap');
    expect(ac.description).toBe('NIS2 domain "Access Control" has a maturity score of 1.0/5.0, indicating a potential vulnerability.');
    expect(ac.category).toBe('compliance');
    expect(ac.customer_id).toBe('c1');
    expect(ac.customer_name).toBe('TechNova');
    expect(ac.assessment_id).toBe('a1');
    expect(ac.status).toBe('open');
    expect(ac.isDerived).toBe(true);
  });

  it('sorts derived risks by score descending', () => {
    const risks = deriveRisksFromAssessment(assessment);
    expect(risks[0].score).toBeGreaterThanOrEqual(risks[1].score);
  });
});

// ── mergeRisks ────────────────────────────────────────────────────────────
describe('mergeRisks', () => {
  const manual = [{ id: 'm1', domain: 'Access Control' }];
  const derived = [
    { id: 'd1', domain: 'Access Control' }, // duplicate → dropped
    { id: 'd2', domain: 'Governance' },
    { id: 'd3', domain: null }, // manual domains set ignores null keys in derived
  ];

  it('manual risks take precedence and manual list comes first', () => {
    const merged = mergeRisks(manual, derived);
    expect(merged.map((r) => r.id)).toEqual(['m1', 'd2', 'd3']);
  });

  it('returns all risks when no domains overlap', () => {
    const merged = mergeRisks([{ id: 'm1', domain: 'X' }], derived);
    expect(merged).toHaveLength(4);
  });
});

// ── summariseRisks ────────────────────────────────────────────────────────
describe('summariseRisks', () => {
  it('buckets risks by their impact × likelihood score', () => {
    const risks = [
      { impact: 5, likelihood: 5 }, // 25 → critical
      { impact: 4, likelihood: 4 }, // 16 → critical
      { impact: 3, likelihood: 3 }, // 9 → high
      { impact: 4, likelihood: 2 }, // 8 → medium
      { impact: 2, likelihood: 2 }, // 4 → medium
      { impact: 2, likelihood: 1 }, // 2 → low
    ];
    expect(summariseRisks(risks)).toEqual({
      critical: 2,
      high: 1,
      medium: 2,
      low: 1,
      total: 6,
    });
  });

  it('handles empty lists', () => {
    expect(summariseRisks([])).toEqual({ critical: 0, high: 0, medium: 0, low: 0, total: 0 });
  });
});
