/**
 * Cross-framework control mappings.
 * Each entry maps a source control_id to equivalent controls in other frameworks.
 * Relationships are bidirectional — both sides reference each other.
 */
export const CONTROL_MAPPINGS = [
  // ── Access Control / IAM ─────────────────────────────────────────────────
  {
    group: 'Access Control & Identity Management',
    controls: [
      { framework: 'ISO27001', id: 'A.5.15' },
      { framework: 'ISO27001', id: 'A.5.16' },
      { framework: 'ISO27001', id: 'A.5.18' },
      { framework: 'ISO27001', id: 'A.8.2' },
      { framework: 'NIS2',     id: 'NIS2-GOV-01' },
      { framework: 'NIST_CSF', id: 'PR.AC-1' },
      { framework: 'CIS_V8',   id: 'CIS-5' },
      { framework: 'CIS_V8',   id: 'CIS-6' },
      { framework: 'QNRC',     id: 'PR.GA-1' },
      { framework: 'QNRC',     id: 'PR.GA-4' },
      { framework: 'ENISA',    id: 'ENISA-AC-01' },
      { framework: 'ENISA',    id: 'ENISA-MFA-01' },
    ],
  },
  // ── Risk Management ───────────────────────────────────────────────────────
  {
    group: 'Risk Assessment & Management',
    controls: [
      { framework: 'ISO27001', id: 'A.5.1' },
      { framework: 'NIS2',     id: 'NIS2-RM-01' },
      { framework: 'NIS2',     id: 'NIS2-RM-02' },
      { framework: 'NIST_CSF', id: 'ID.RA-1' },
      { framework: 'NIST_CSF', id: 'GV.OC-1' },
      { framework: 'QNRC',     id: 'ID.AR-1' },
      { framework: 'QNRC',     id: 'ID.AR-4' },
      { framework: 'QNRC',     id: 'ID.GR-1' },
      { framework: 'ENISA',    id: 'ENISA-GV-02' },
    ],
  },
  // ── Governance & Policy ───────────────────────────────────────────────────
  {
    group: 'Governance & Security Policy',
    controls: [
      { framework: 'ISO27001', id: 'A.5.2' },
      { framework: 'NIS2',     id: 'NIS2-GOV-02' },
      { framework: 'NIST_CSF', id: 'GV.OC-1' },
      { framework: 'QNRC',     id: 'ID.GV-1' },
      { framework: 'QNRC',     id: 'ID.GV-2' },
      { framework: 'ENISA',    id: 'ENISA-GV-01' },
      { framework: 'ENISA',    id: 'ENISA-GV-03' },
    ],
  },
  // ── Incident Response ────────────────────────────────────────────────────
  {
    group: 'Incident Detection & Response',
    controls: [
      { framework: 'ISO27001', id: 'A.5.24' },
      { framework: 'ISO27001', id: 'A.5.25' },
      { framework: 'ISO27001', id: 'A.5.26' },
      { framework: 'NIS2',     id: 'NIS2-IR-01' },
      { framework: 'NIS2',     id: 'NIS2-IR-02' },
      { framework: 'NIST_CSF', id: 'RS.RP-1' },
      { framework: 'QNRC',     id: 'RS.PR-1' },
      { framework: 'QNRC',     id: 'RS.CO-2' },
      { framework: 'QNRC',     id: 'RS.AN-1' },
      { framework: 'QNRC',     id: 'RS.MI-1' },
      { framework: 'ENISA',    id: 'ENISA-IH-01' },
      { framework: 'ENISA',    id: 'ENISA-IH-02' },
      { framework: 'ENISA',    id: 'ENISA-IH-03' },
    ],
  },
  // ── Asset Management ─────────────────────────────────────────────────────
  {
    group: 'Asset Inventory & Management',
    controls: [
      { framework: 'ISO27001', id: 'A.5.9' },
      { framework: 'ISO27001', id: 'A.5.10' },
      { framework: 'NIST_CSF', id: 'ID.AM-1' },
      { framework: 'CIS_V8',   id: 'CIS-1' },
      { framework: 'CIS_V8',   id: 'CIS-2' },
      { framework: 'QNRC',     id: 'ID.GA-1' },
      { framework: 'QNRC',     id: 'ID.GA-2' },
      { framework: 'QNRC',     id: 'ID.GA-5' },
      { framework: 'ENISA',    id: 'ENISA-AC-02' },
    ],
  },
  // ── Cryptography ─────────────────────────────────────────────────────────
  {
    group: 'Cryptography & Encryption',
    controls: [
      { framework: 'ISO27001', id: 'A.8.24' },
      { framework: 'QNRC',     id: 'PR.SD-1' },
      { framework: 'QNRC',     id: 'PR.SD-2' },
      { framework: 'ENISA',    id: 'ENISA-CR-01' },
      { framework: 'ENISA',    id: 'ENISA-CR-02' },
      { framework: 'ENISA',    id: 'ENISA-CR-03' },
    ],
  },
  // ── Vulnerability Management ──────────────────────────────────────────────
  {
    group: 'Vulnerability & Patch Management',
    controls: [
      { framework: 'ISO27001', id: 'A.8.8' },
      { framework: 'NIST_CSF', id: 'ID.RA-1' },
      { framework: 'CIS_V8',   id: 'CIS-7' },
      { framework: 'QNRC',     id: 'PR.PI-12' },
      { framework: 'ENISA',    id: 'ENISA-NS-02' },
      { framework: 'ENISA',    id: 'ENISA-HT-02' },
    ],
  },
  // ── Business Continuity ───────────────────────────────────────────────────
  {
    group: 'Business Continuity & Recovery',
    controls: [
      { framework: 'NIS2',     id: 'NIS2-BC-01' },
      { framework: 'NIST_CSF', id: 'RC.RP-1' },
      { framework: 'QNRC',     id: 'RC.PR-1' },
      { framework: 'QNRC',     id: 'RC.ME-1' },
      { framework: 'QNRC',     id: 'RC.CO-3' },
      { framework: 'ENISA',    id: 'ENISA-BC-01' },
      { framework: 'ENISA',    id: 'ENISA-BC-02' },
      { framework: 'ENISA',    id: 'ENISA-BC-03' },
      { framework: 'ENISA',    id: 'ENISA-BC-04' },
    ],
  },
  // ── Supply Chain Security ─────────────────────────────────────────────────
  {
    group: 'Supply Chain Security',
    controls: [
      { framework: 'NIS2',     id: 'NIS2-SC-01' },
      { framework: 'QNRC',     id: 'ID.GL-2' },
      { framework: 'ENISA',    id: 'ENISA-SC-01' },
      { framework: 'ENISA',    id: 'ENISA-SC-02' },
      { framework: 'ENISA',    id: 'ENISA-SC-03' },
    ],
  },
  // ── Awareness & Training ──────────────────────────────────────────────────
  {
    group: 'Security Awareness & Training',
    controls: [
      { framework: 'NIST_CSF', id: 'PR.AT-1' },
      { framework: 'CIS_V8',   id: 'CIS-14' },
      { framework: 'QNRC',     id: 'PR.FC-1' },
      { framework: 'ENISA',    id: 'ENISA-HT-01' },
      { framework: 'ENISA',    id: 'ENISA-HT-03' },
    ],
  },
  // ── Monitoring & Logging ──────────────────────────────────────────────────
  {
    group: 'Security Monitoring & Logging',
    controls: [
      { framework: 'ISO27001', id: 'A.8.15' },
      { framework: 'ISO27001', id: 'A.8.16' },
      { framework: 'NIST_CSF', id: 'DE.CM-1' },
      { framework: 'CIS_V8',   id: 'CIS-8' },
      { framework: 'QNRC',     id: 'DE.AE-1' },
      { framework: 'QNRC',     id: 'DE.AE-3' },
      { framework: 'QNRC',     id: 'DE.MC-1' },
      { framework: 'QNRC',     id: 'PR.TP-1' },
      { framework: 'ENISA',    id: 'ENISA-MD-01' },
      { framework: 'ENISA',    id: 'ENISA-MD-02' },
      { framework: 'ENISA',    id: 'ENISA-MD-03' },
    ],
  },
  // ── Network Security ─────────────────────────────────────────────────────
  {
    group: 'Network & System Security',
    controls: [
      { framework: 'ISO27001', id: 'A.8.20' },
      { framework: 'ISO27001', id: 'A.8.22' },
      { framework: 'NIST_CSF', id: 'PR.AC-1' },
      { framework: 'QNRC',     id: 'PR.TP-4' },
      { framework: 'ENISA',    id: 'ENISA-NS-01' },
      { framework: 'ENISA',    id: 'ENISA-NS-04' },
    ],
  },
  // ── Data Protection ──────────────────────────────────────────────────────
  {
    group: 'Data Protection & Classification',
    controls: [
      { framework: 'ISO27001', id: 'A.5.12' },
      { framework: 'ISO27001', id: 'A.5.13' },
      { framework: 'CIS_V8',   id: 'CIS-3' },
      { framework: 'QNRC',     id: 'PR.SD-1' },
      { framework: 'ENISA',    id: 'ENISA-AC-02' },
    ],
  },
  // ── Secure Configuration ─────────────────────────────────────────────────
  {
    group: 'Secure Configuration & Hardening',
    controls: [
      { framework: 'ISO27001', id: 'A.8.9' },
      { framework: 'CIS_V8',   id: 'CIS-4' },
      { framework: 'ENISA',    id: 'ENISA-NS-01' },
      { framework: 'ENISA',    id: 'ENISA-NS-03' },
    ],
  },
  // ── Backup ───────────────────────────────────────────────────────────────
  {
    group: 'Backup & Data Integrity',
    controls: [
      { framework: 'ISO27001', id: 'A.8.13' },
      { framework: 'QNRC',     id: 'PR.PI-4' },
      { framework: 'ENISA',    id: 'ENISA-BC-02' },
    ],
  },
  // ── Physical Security ────────────────────────────────────────────────────
  {
    group: 'Physical Security',
    controls: [
      { framework: 'ISO27001', id: 'A.7.1' },
      { framework: 'ISO27001', id: 'A.7.2' },
      { framework: 'QNRC',     id: 'PR.MA-1' },
    ],
  },
  // ── HR Security ──────────────────────────────────────────────────────────
  {
    group: 'Human Resources Security',
    controls: [
      { framework: 'ISO27001', id: 'A.6.1' },
      { framework: 'ISO27001', id: 'A.6.5' },
      { framework: 'ENISA',    id: 'ENISA-AC-03' },
    ],
  },
];

/**
 * Build a lookup: controlId -> { group, peers: [{framework, id}] }
 */
const _lookup = new Map();
for (const mapping of CONTROL_MAPPINGS) {
  for (const ctrl of mapping.controls) {
    const key = `${ctrl.framework}::${ctrl.id}`;
    _lookup.set(key, {
      group: mapping.group,
      peers: mapping.controls.filter(c => !(c.framework === ctrl.framework && c.id === ctrl.id)),
    });
  }
}

/**
 * Given a control_id and its framework, return peer controls from other frameworks.
 * @param {string} framework
 * @param {string} controlId
 * @returns {{ group: string, peers: Array<{framework: string, id: string}> } | null}
 */
export function getCrossMappings(framework, controlId) {
  if (!framework || !controlId) return null;
  return _lookup.get(`${framework}::${controlId}`) || null;
}