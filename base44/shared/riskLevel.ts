/** Shared risk scoring helpers (impact × likelihood). */
export function riskScore(impact, likelihood) {
  return (impact || 0) * (likelihood || 0);
}

export function scoreLevel(score) {
  if (score >= 16) return 'Critical';
  if (score >= 9) return 'High';
  if (score >= 4) return 'Medium';
  return 'Low';
}

export const RISK_STATUS_LABELS = {
  open: 'Open',
  in_treatment: 'In Treatment',
  accepted: 'Accepted',
  closed: 'Closed',
};
