import catalog from '@/data/legal/catalog.json';

/**
 * Referenciais suportados — designações oficiais (ver Biblioteca Legal: src/data/legal/catalog.json).
 * Os códigos mantêm-se estáveis para não quebrar avaliações e perguntas existentes.
 */
export const FRAMEWORK_NAMES = {
  NIS2: 'NIS2 — Diretiva (UE) 2022/2555 / RJC (DL 125/2025)',
  QNRC: 'QNRCS — Quadro Nacional de Referência para a Cibersegurança (Reg. 756/2026)',
  EU_2024_2690: 'Regulamento de Execução (UE) 2024/2690',
  DORA: 'DORA — Regulamento (UE) 2022/2554',
  ISO27001: 'ISO/IEC 27001:2022',
  NIST_CSF: 'NIST CSF',
  CIS_V8: 'CIS Controls v8.1.2',
  TISAX_ISA6: 'TISAX — VDA ISA 6.0.3',
  TISAX_ISA2027: 'TISAX — VDA ISA 2027',
  GDPR: 'RGPD — Regulamento (UE) 2016/679',
  // Descontinuado: não existe um referencial oficial com esta designação.
  // Substituído pelo Regulamento de Execução (UE) 2024/2690 (requisitos técnicos do art. 21.º da NIS2).
  ENISA: 'ENISA (descontinuado — ver Reg. Exec. (UE) 2024/2690)',
};

/** Referenciais que podem ser atribuídos a clientes (o ENISA fica fora por estar descontinuado). */
export const SELECTABLE_FRAMEWORKS = ['NIS2', 'QNRC', 'EU_2024_2690', 'DORA', 'ISO27001', 'NIST_CSF', 'CIS_V8', 'TISAX_ISA6', 'TISAX_ISA2027', 'GDPR'];

export const DEFAULT_CUSTOMER_FRAMEWORKS = ['NIS2', 'QNRC', 'ISO27001', 'NIST_CSF', 'CIS_V8', 'GDPR'];


// Domínios dos referenciais sem documento oficial na Biblioteca Legal (mantidos como estavam).
const LEGACY_DOMAINS = {
  // ISO/IEC 27001:2022 — os quatro temas do Anexo A (iguais a group_name em src/data/legal/iso27001.json).
  ISO27001: ['Controlos organizacionais', 'Controlos de pessoas', 'Controlos físicos', 'Controlos tecnológicos'],
  NIST_CSF: ['Identify', 'Protect', 'Detect', 'Respond', 'Recover'],
  CIS_V8: ['Inventory & Control', 'Data Protection', 'Secure Configuration', 'Account Management', 'Access Control', 'Vulnerability Management', 'Audit Log Management', 'Email & Web Browser', 'Malware Defenses', 'Network Infrastructure', 'Data Recovery', 'Network Monitoring', 'Security Awareness', 'Service Provider Management', 'Application Security', 'Incident Response', 'Penetration Testing'],
  GDPR: ['Lawfulness & Transparency', 'Data Subject Rights', 'Consent Management', 'Data Minimisation', 'Purpose Limitation', 'Storage Limitation', 'Accuracy', 'Security of Processing', 'Data Breach Notification', 'Data Protection by Design', 'Data Protection Officer', 'International Transfers', 'Records of Processing', 'Data Processor Management'],
};

/** Domínios por referencial: oficiais (gerados a partir da Biblioteca Legal) + os restantes. */
export const FRAMEWORK_DOMAINS = { ...LEGACY_DOMAINS, ...catalog.framework_domains };
