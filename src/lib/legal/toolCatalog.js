/**
 * Catálogo de ferramentas e tecnologias → alíneas da NIS2 (art. 21.º, n.º 2), pontos do Anexo do
 * Regulamento de Execução (UE) 2024/2690 e controlos do QNRCS (Reg. 756/2026, Anexos I e III) cujas
 * medidas referem a ferramenta. A NIS2 não impõe produtos: exige medidas; a categoria indica o tipo de
 * ferramenta que habitualmente as concretiza. As alíneas por ponto vêm do próprio Reg. 2024/2690.
 * O mesmo catálogo está na folha «Catálogo de ferramentas» do modelo Excel (public/templates/).
 */
export const TOOL_CATALOG = [
  { id: 'asset_inventory', pt: 'Inventário e gestão de ativos (CMDB)', en: 'Asset inventory and management (CMDB)', nis2: ['i'], regexec: '12.4', qnrcs: ['ID.GA-1', 'ID.GA-2'], note: 'ID.GA-1 e ID.GA-2, nível elevado: utilizar ferramentas de gestão' },
  { id: 'vuln_scanning', pt: 'Gestão de vulnerabilidades (análise)', en: 'Vulnerability management (scanning)', nis2: ['e'], regexec: '6.10', qnrcs: ['ID.AR-1'], note: 'ID.AR-1, nível elevado: identificação e monitorização contínua' },
  { id: 'pentest', pt: 'Testes de intrusão', en: 'Penetration testing', nis2: ['e'], regexec: '6.5', qnrcs: ['ID.AR-1'], note: 'ID.AR-1, nível elevado: testes de intrusão regulares' },
  { id: 'firewall', pt: 'Firewall e proteção de perímetro', en: 'Firewall and perimeter protection', nis2: ['e'], regexec: '6.7', qnrcs: ['PR.RI-1', 'DE.MC-1'], note: 'PR.RI-1, nível básico: firewalls com regras atualizadas' },
  { id: 'edr', pt: 'Deteção e resposta em endpoints (EDR/antimalware)', en: 'Endpoint detection and response (EDR/anti-malware)', nis2: ['e'], regexec: '6.9', qnrcs: ['DE.MC-4'], note: 'DE.MC-4, nível básico: monitorização de endpoints' },
  { id: 'software_mgmt', pt: 'Gestão centralizada de software', en: 'Centralised software management', nis2: ['e'], regexec: '6.9', qnrcs: ['DE.MC-5'], note: 'DE.MC-5, nível elevado: ferramenta centralizada e alarmística' },
  { id: 'siem', pt: 'Registo e monitorização de eventos (SIEM/logs)', en: 'Logging and event monitoring (SIEM)', nis2: ['b'], regexec: '3.2', qnrcs: ['DE.AE-2', 'DE.MC-1'], note: 'DE.AE-2, nível básico: recolha de eventos ativa' },
  { id: 'backup', pt: 'Cópias de segurança', en: 'Backups', nis2: ['c'], regexec: '4.2', qnrcs: ['PR.SD-5', 'RC.PR-3'], note: 'PR.SD-5, nível básico: cópias regulares em sistema distinto' },
  { id: 'mfa', pt: 'Autenticação multifator (MFA)', en: 'Multi-factor authentication (MFA)', nis2: ['j'], regexec: '11.7', qnrcs: ['PR.GA-3'], note: 'PR.GA-3, nível básico: MFA nos acessos remotos e contas privilegiadas' },
  { id: 'iam', pt: 'Gestão de identidades e acessos (IAM/PAM)', en: 'Identity and access management (IAM/PAM)', nis2: ['i'], regexec: '11.2–11.6', qnrcs: ['PR.GA-1'], note: 'PR.GA-1, nível elevado: mecanismos automatizados' },
  { id: 'crypto', pt: 'Criptografia e cifra', en: 'Cryptography and encryption', nis2: ['h'], regexec: '9', qnrcs: ['PR.SD-1', 'PR.SD-2'], note: 'PR.SD-1 (dados em repouso) e PR.SD-2 (dados em trânsito)' },
  { id: 'awareness', pt: 'Plataforma de sensibilização e formação', en: 'Awareness and training platform', nis2: ['g'], regexec: '8.1–8.2', qnrcs: ['PR.FC-1'], note: 'PR.FC-1: todo o pessoal sensibilizado e formado' },
  { id: 'incident_mgmt', pt: 'Gestão de incidentes (ticketing/resposta)', en: 'Incident management (ticketing/response)', nis2: ['b'], regexec: '3', qnrcs: ['RS.GI-3'], note: 'RS.GI-3, nível elevado: ferramentas no plano de resposta' },
  { id: 'change_mgmt', pt: 'Gestão de alterações e configurações', en: 'Change and configuration management', nis2: ['e'], regexec: '6.3–6.4', qnrcs: ['ID.GA-9'], note: 'ID.GA-9, nível elevado: processo de gestão de alterações' },
];

export const toolById = (id) => TOOL_CATALOG.find((c) => c.id === id) || null;
export const toolName = (c, lang) => (c ? (lang === 'pt' ? c.pt : c.en) : '');
