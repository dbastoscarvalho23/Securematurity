// Cliente Base44 simulado, só para capturas de ecrã da AnkoraOne com dados de demonstração (entidades fictícias). v2
import { JOURNEY_TEMPLATE_PT, JOURNEY_FRAMEWORK } from '@/lib/legal/journeyTemplate';

const now = Date.now();
const h = (n) => new Date(now - n * 3600e3).toISOString();
const d = (n) => new Date(now + n * 86400e3).toISOString().slice(0, 10);

const C1 = { id: 'c1', name: 'Hidro Norte, S.A.', sector: 'energy', status: 'active', rjc_qualification: 'essencial', conformity_level: 'elevado', entity_size: 'grande', num_employees: '1001-5000', cybersecurity_manager: 'Marta Lopes', storage_provider: 'one_drive', dora_applicable: false, allowed_frameworks: ['QNRCS', 'ISO27001'] };
const C2 = { id: 'c2', name: 'Atlântico Crédito, S.A.', sector: 'financial_services', status: 'active', rjc_qualification: 'essencial', conformity_level: 'substancial', entity_size: 'media', num_employees: '251-1000', cybersecurity_manager: 'Rui Matos', storage_provider: 'google_drive', dora_applicable: true, allowed_frameworks: ['QNRCS', 'DORA', 'ISO27001'] };
const C3 = { id: 'c3', name: 'Clínica Ribeira Saúde, Lda.', sector: 'healthcare', status: 'active', rjc_qualification: 'importante', conformity_level: 'substancial', entity_size: 'media', num_employees: '51-250', cybersecurity_manager: 'Inês Faria', storage_provider: 'webdav', allowed_frameworks: ['QNRCS', 'ISO27001', 'ISO42001'] };
const C4 = { id: 'c4', name: 'TechNova Serviços, Lda.', sector: 'technology', status: 'onboarding', rjc_qualification: 'importante', conformity_level: 'basico', entity_size: 'pequena', num_employees: '51-250', cybersecurity_manager: 'Paulo Reis', storage_provider: 'base44', allowed_frameworks: ['QNRCS', 'TISAX'] };
const customers = [C1, C2, C3, C4];

const fw = (code, name) => ({ id: `f-${code}`, code, name, status: 'active', version: '' });
const QD = ['Gerir', 'Identificar', 'Proteger', 'Detetar', 'Responder', 'Recuperar'];
const fsc = (code, score, domains, base) => ({ framework_code: code, score, domain_scores: domains.map((domain, i) => ({ domain, score: Math.max(1, Math.min(5, +(base[i % base.length]).toFixed(1))) })) });
const assessments = [
  { id: 'a1', customer_id: 'c1', customer_name: C1.name, title: 'Avaliação QNRCS — nível Elevado', period: '2026-T4', frameworks: ['QNRCS'], status: 'in_progress', overall_score: 2.9, framework_scores: [fsc('QNRCS', 2.9, QD, [3.4, 3.1, 2.6, 2.2, 3.0, 2.8])], created_date: h(240) },
  { id: 'a2', customer_id: 'c2', customer_name: C2.name, title: 'DORA e QNRCS — revisão anual', period: '2026', frameworks: ['DORA', 'QNRCS'], status: 'completed', overall_score: 3.4, framework_scores: [fsc('DORA', 3.2, ['Governação', 'Risco TIC', 'Incidentes', 'Testes', 'Terceiros TIC'], [3.6, 3.3, 3.5, 2.6, 2.9]), fsc('QNRCS', 3.6, QD, [3.9, 3.7, 3.6, 3.2, 3.8, 3.4])], completed_date: d(-12), created_date: h(900) },
  { id: 'a3', customer_id: 'c3', customer_name: C3.name, title: 'ISO/IEC 27001 e 42001 — análise de lacunas', period: '2026-T4', frameworks: ['ISO27001', 'ISO42001'], status: 'in_progress', overall_score: 2.4, framework_scores: [fsc('ISO27001', 2.6, ['Organizacionais', 'Pessoas', 'Físicos', 'Tecnológicos'], [2.8, 2.5, 3.0, 2.2]), fsc('ISO42001', 2.1, ['Políticas de IA', 'Avaliação de impacto', 'Dados', 'Terceiros'], [2.4, 1.6, 2.2, 2.0])], created_date: h(120) },
  { id: 'a4', customer_id: 'c4', customer_name: C4.name, title: 'Diagnóstico inicial QNRCS — nível Básico', period: '2026-T4', frameworks: ['QNRCS'], status: 'draft', overall_score: null, created_date: h(30) },
];
const incidents = [
  { id: 'i1', incident_id: 'INC-2026-014', customer_id: 'c1', customer_name: C1.name, title: 'Cifra de servidores de telemetria por ransomware', category: 'malware_ransomware', severity: 'critical', status: 'contained', reporting_regime: 'rjc', detected_at: h(30), significant_verified_at: h(29), contained_at: h(20), early_warning_sent: true, early_warning_sent_at: h(26), personal_data_affected: false, affected_systems: 'SCADA — servidores de telemetria' },
  { id: 'i2', incident_id: 'INC-2026-015', customer_id: 'c2', customer_name: C2.name, title: 'Indisponibilidade do homebanking', category: 'ddos', severity: 'high', status: 'investigating', reporting_regime: 'dora', detected_at: h(6), dora_classified_major_at: h(3), personal_data_affected: false },
  { id: 'i3', incident_id: 'INC-2026-012', customer_id: 'c3', customer_name: C3.name, title: 'Acesso indevido a caixa de correio clínica', category: 'unauthorized_access', severity: 'medium', status: 'resolved', reporting_regime: 'rjc', detected_at: h(200), significant_verified_at: h(199), early_warning_sent: true, early_warning_sent_at: h(190), impact_ended_at: h(150), end_of_impact_notification_sent: true, end_of_impact_notification_sent_at: h(140), personal_data_affected: true, supervisor_authority_notified: true, supervisor_authority_notified_at: h(160) },
];
const risks = [
  ['Ransomware na rede industrial', 5, 4, 'in_treatment', 'c1'], ['Falha de fornecedor de telemetria', 4, 3, 'open', 'c1'], ['Indisponibilidade de serviços críticos', 5, 3, 'in_treatment', 'c2'],
  ['Acesso indevido a dados clínicos', 4, 3, 'in_treatment', 'c3'], ['Phishing direcionado à gestão', 3, 4, 'open', 'c2'], ['Uso de IA sem avaliação de impacto', 3, 3, 'open', 'c3'],
  ['Cópias de segurança não testadas', 4, 2, 'closed', 'c4'], ['Contas privilegiadas sem MFA', 4, 4, 'open', 'c4'],
].map(([title, impact, likelihood, status, cid], i) => ({ id: `r${i}`, risk_id: `R-${100 + i}`, title, impact, likelihood, status, customer_id: cid, customer_name: customers.find((c) => c.id === cid).name, category: 'Cibersegurança', due_date: d(10 + i * 7) }));
const tasks = [
  ['Aprovar política de cópias de segurança', 'high', 'in_progress', 'c1', 5], ['Testar plano de continuidade', 'critical', 'todo', 'c1', 12], ['Ativar MFA em contas privilegiadas', 'critical', 'in_progress', 'c4', 3],
  ['Rever contratos de fornecedores TIC', 'high', 'todo', 'c2', 20], ['Formação de ciber-higiene para a gestão', 'medium', 'done', 'c3', -4], ['Inventário de sistemas de IA', 'high', 'in_progress', 'c3', 9],
  ['Lista de ativos expostos (art. 32.º)', 'high', 'todo', 'c1', 30], ['Registo de informação DORA', 'high', 'in_progress', 'c2', 15],
].map(([title, priority, status, cid, due], i) => ({ id: `t${i}`, title, priority, status, customer_id: cid, customer_name: customers.find((c) => c.id === cid).name, due_date: d(due), framework_code: 'QNRCS', assigned_to: 'consultor@neora.pt' }));
const journey = [];
for (const cust of [C1, C2, C3]) {
  let k = 0;
  for (const s of JOURNEY_TEMPLATE_PT) {
    s.tasks.forEach((t, j) => {
      k += 1;
      const r = (k * 7 + cust.id.charCodeAt(1)) % 10;
      journey.push({ id: `j-${cust.id}-${k}`, customer_id: cust.id, customer_name: cust.name, framework: JOURNEY_FRAMEWORK, section: s.section, section_order: s.section_order, task_text: t.title, requirement_ref: t.basis, task_order: j + 1, status: s.section_order <= 2 ? (r < 8 ? 'done' : 'in_progress') : r < 4 ? 'done' : r < 7 ? 'in_progress' : 'pending', due_date: d(10 + k), owner: cust.cybersecurity_manager });
    });
  }
}
const recommendations = [
  ['Implementar MFA para acessos remotos', 'critical', 'PR.GA-1'], ['Formalizar testes ao plano de continuidade', 'high', 'RC.PR-1'], ['Rever segregação da rede industrial', 'high', 'PR.SR-5'],
].map(([title_pt, priority, control_id], i) => ({ id: `rec${i}`, title: title_pt, title_pt, priority, control_id, framework_code: 'QNRCS', customer_id: 'c1', status: 'pending', current_level: 1, target_level: 3, assessment_id: 'a1' }));
const vulns = [
  ['CVE-2026-31201', 'Execução remota no VPN de acesso remoto', 'critical', 9.8, 'open'], ['CVE-2026-28877', 'Escalada de privilégios no hipervisor', 'high', 8.1, 'in_progress'], ['CVE-2026-19054', 'Fuga de informação no servidor web', 'medium', 5.3, 'remediated'],
].map(([cve_id, title, severity, cvss_score, status], i) => ({ id: `v${i}`, cve_id, title, severity, cvss_score, status, customer_id: 'c1', customer_name: C1.name, discovered_date: d(-i * 3 - 1), due_date: d(7 - i * 3) }));

const evid = [
  ['Política de segurança da informação', 'policy_procedure', 'accepted', 'QNRCS GV.PO-1 · Jornada RJC 3.1', -40, 325],
  ['Relatório de teste de restauro de cópias', 'test_audit_report', 'accepted', 'QNRCS RC.PR-1 · Tarefa T-112', -12, 170],
  ['Registo de acessos privilegiados (outubro)', 'log_record', 'pending', 'QNRCS PR.GA-1 · Risco R-107', -3, 60],
  ['Contrato com fornecedor de telemetria', 'contract_licence', 'accepted', 'Cadeia de abastecimento · art. 28.º', -90, 400],
  ['Relatório de análise de vulnerabilidades', 'tool_report', 'pending', 'QNRCS ID.AR-1 · CVE-2026-31201', -1, 89],
  ['Plano de resposta a incidentes v1', 'policy_procedure', 'accepted', 'QNRCS RS.PR-1', -200, -10, true],
].map(([title, evidence_type, status, label, col, val, sup], i) => ({ id: `e${i}`, customer_id: 'c1', title, evidence_type, status, links: [{ label }], link_keys: [], collected_at: d(col), valid_until: d(val), version: sup ? 1 : 1 + (i % 3), superseded: !!sup, sha256: ('9f2c4a7be1d0' + i).padEnd(64, '0'), created_date: h(i * 10) }));

const DATA = {
  Customer: customers,
  Framework: [fw('QNRCS', 'QNRCS (Reg. 756/2026)'), fw('NIS2', 'Diretiva NIS2'), fw('DORA', 'DORA'), fw('ISO27001', 'ISO/IEC 27001:2022'), fw('ISO42001', 'ISO/IEC 42001:2023'), fw('TISAX', 'TISAX / VDA ISA')],
  Assessment: assessments, Incident: incidents, RiskItem: risks, Task: tasks, ComplianceChecklist: journey, Recommendation: recommendations, Vulnerability: vulns, Evidence: evid,
  AiSettings: [],
};

const match = (row, q) => Object.entries(q || {}).every(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? true : Array.isArray(row[k]) ? row[k].includes(v) : row[k] === v));
const sorter = (sort) => (a, b) => {
  if (!sort) return 0;
  const desc = sort.startsWith('-'); const k = sort.replace(/^-/, '');
  return (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (desc ? -1 : 1);
};
const entityApi = (name) => {
  const rows = () => DATA[name] || [];
  return {
    list: async (sort, limit) => rows().slice().sort(sorter(sort)).slice(0, limit || 5000),
    filter: async (q, sort, limit) => rows().filter((r) => match(r, q)).sort(sorter(sort)).slice(0, limit || 5000),
    get: async (id) => rows().find((r) => r.id === id) || null,
    create: async (o) => ({ id: `n${Math.random()}`, ...o }),
    bulkCreate: async (a) => a,
    update: async (id, p) => ({ ...(rows().find((r) => r.id === id) || {}), ...p }),
    delete: async () => ({}),
    subscribe: () => () => {},
    schema: async () => ({}),
  };
};
const entities = new Proxy({}, { get: (_, name) => entityApi(String(name)) });
const user = { id: 'u1', email: 'consultor@neora.pt', full_name: 'Ana Ribeiro', role: 'admin', language: 'pt' };

const FUN = {
  licensing: () => ({ state: 'legacy', effective: true, modules: [] }),
  listUsers: () => ({ users: [user], total: 1 }),
  getStorageProviders: () => ({ providers: ['base44', 'google_drive', 'one_drive', 'webdav'] }),
};
export const base44 = {
  entities,
  auth: { me: async () => user, updateMe: async (p) => ({ ...user, ...p }), logout: () => {}, isAuthenticated: async () => true },
  functions: { invoke: async (name, payload) => ({ data: (window.__demoFns?.[name] || FUN[name] || (() => ({})))(payload) }) },
  integrations: { Core: new Proxy({}, { get: () => async () => ({}) }) },
  analytics: { track: () => {} },
  users: { inviteUser: async () => ({}) },
  agents: new Proxy({}, { get: () => async () => [] }),
  appLogs: new Proxy({}, { get: () => async () => ({}) }),
};
export default base44;
