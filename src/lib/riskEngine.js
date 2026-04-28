/**
 * Risk Scoring Engine
 * Derives risk items from assessment maturity scores.
 * Low maturity scores → higher likelihood and impact for corresponding domain.
 */

// Maps maturity score (0-5) to likelihood (1-5): lower maturity = higher likelihood
function maturityToLikelihood(score) {
  if (score <= 1) return 5;
  if (score <= 2) return 4;
  if (score <= 3) return 3;
  if (score <= 4) return 2;
  return 1;
}

// Maps maturity score to impact (1-5): based on domain criticality weight
function maturityToImpact(score, domainWeight = 3) {
  // Impact is partially driven by how critical the domain is and how low the score is
  const base = Math.max(1, Math.round((5 - score) * 0.8 + domainWeight * 0.2));
  return Math.min(5, Math.max(1, base));
}

// Domain criticality weights (higher = more impactful if weak)
const DOMAIN_WEIGHTS = {
  'Access Control': 5,
  'Identity and Access Management': 5,
  'Incident Response': 5,
  'Supply Chain': 4,
  'Third Party Risk': 4,
  'Data Protection': 5,
  'Cryptography': 4,
  'Network Security': 4,
  'Asset Management': 3,
  'Vulnerability Management': 4,
  'Risk Management': 4,
  'Governance': 3,
  'Compliance': 3,
  'Business Continuity': 4,
  'Physical Security': 3,
  'Awareness and Training': 3,
  'Logging and Monitoring': 4,
};

function getDomainWeight(domain) {
  // Try exact match first, then partial
  if (DOMAIN_WEIGHTS[domain]) return DOMAIN_WEIGHTS[domain];
  const key = Object.keys(DOMAIN_WEIGHTS).find(k =>
    domain?.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(domain?.toLowerCase())
  );
  return key ? DOMAIN_WEIGHTS[key] : 3;
}

export function riskScore(impact, likelihood) {
  return impact * likelihood;
}

export function riskLevel(score) {
  if (score >= 16) return 'critical';
  if (score >= 9) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

export function riskLevelLabel(score) {
  if (score >= 16) return 'Critical';
  if (score >= 9) return 'High';
  if (score >= 4) return 'Medium';
  return 'Low';
}

/**
 * Derives virtual risk items from a completed assessment's domain scores.
 * Only surfaces domains with maturity score < 3 (gap domains).
 * @param {object} assessment - Assessment entity with framework_scores
 * @returns {Array} Array of derived risk objects (not stored in DB)
 */
export function deriveRisksFromAssessment(assessment) {
  if (!assessment?.framework_scores) return [];
  const derived = [];

  assessment.framework_scores.forEach(fs => {
    (fs.domain_scores || []).forEach(ds => {
      if (ds.score >= 3.5) return; // Only flag weak domains
      const weight = getDomainWeight(ds.domain);
      const likelihood = maturityToLikelihood(ds.score);
      const impact = maturityToImpact(ds.score, weight);
      const score = riskScore(impact, likelihood);

      derived.push({
        id: `derived-${assessment.id}-${fs.framework_code}-${ds.domain}`,
        title: `${ds.domain} Maturity Gap`,
        description: `${fs.framework_code} domain "${ds.domain}" has a maturity score of ${ds.score.toFixed(1)}/5.0, indicating a potential vulnerability.`,
        category: 'compliance',
        impact,
        likelihood,
        score,
        level: riskLevel(score),
        maturity_score: ds.score,
        framework_code: fs.framework_code,
        domain: ds.domain,
        customer_id: assessment.customer_id,
        customer_name: assessment.customer_name,
        assessment_id: assessment.id,
        status: 'open',
        isDerived: true,
      });
    });
  });

  // Sort by score descending
  return derived.sort((a, b) => b.score - a.score);
}

/**
 * Merges manual risks and derived risks, deduplicating by domain.
 * Manual risks for a domain take precedence.
 */
export function mergeRisks(manualRisks, derivedRisks) {
  const manualDomains = new Set(manualRisks.map(r => r.domain).filter(Boolean));
  const filtered = derivedRisks.filter(d => !manualDomains.has(d.domain));
  return [...manualRisks, ...filtered];
}

/**
 * Summarises risk distribution for dashboard display.
 */
export function summariseRisks(risks) {
  return {
    critical: risks.filter(r => riskScore(r.impact, r.likelihood) >= 16).length,
    high: risks.filter(r => { const s = riskScore(r.impact, r.likelihood); return s >= 9 && s < 16; }).length,
    medium: risks.filter(r => { const s = riskScore(r.impact, r.likelihood); return s >= 4 && s < 9; }).length,
    low: risks.filter(r => riskScore(r.impact, r.likelihood) < 4).length,
    total: risks.length,
  };
}