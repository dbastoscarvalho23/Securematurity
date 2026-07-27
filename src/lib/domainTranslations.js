/**
 * Static English → European Portuguese domain translation mapping.
 * Used as a fallback when a Question record has no `domain_pt` field set.
 */
export const DOMAIN_TRANSLATIONS = {
  // NIS2
  'Governance': 'Governança',
  'Risk Management': 'Gestão de Risco',
  'Incident Response': 'Resposta a Incidentes',
  'Business Continuity': 'Continuidade de Negócio',
  'Supply Chain': 'Cadeia de Fornecimento',
  'Access Control': 'Controlo de Acessos',
  'Cryptography': 'Criptografia',
  'Physical Security': 'Segurança Física',
  'Vulnerability Management': 'Gestão de Vulnerabilidades',

  // ISO 27001
  'Information Security Policies': 'Políticas de Segurança da Informação',
  'Organization of Information Security': 'Organização da Segurança da Informação',
  'Human Resource Security': 'Segurança de Recursos Humanos',
  'Asset Management': 'Gestão de Ativos',
  'Operations Security': 'Segurança Operacional',
  'Communications Security': 'Segurança das Comunicações',
  'System Acquisition': 'Aquisição de Sistemas',
  'Supplier Relationships': 'Relações com Fornecedores',
  'Incident Management': 'Gestão de Incidentes',
  'Compliance': 'Conformidade',
  'Risk Assessment and Treatment': 'Avaliação e Tratamento de Risco',

  // NIST CSF
  'Identify (ID)': 'Identificar (ID)',
  'Protect (PR)': 'Proteger (PR)',
  'Detect (DE)': 'Detetar (DE)',
  'Respond (RS)': 'Responder (RS)',
  'Recover (RC)': 'Recuperar (RC)',

  // CIS Controls v8
  'Inventory and Control of Enterprise Assets': 'Inventário e Controlo de Ativos da Empresa',
  'Inventory and Control of Software Assets': 'Inventário e Controlo de Ativos de Software',
  'Data Protection': 'Proteção de Dados',
  'Data Security': 'Segurança de Dados',
  'Secure Configuration': 'Configuração Segura',
  'Account Management': 'Gestão de Contas',
  'Access Control Management': 'Gestão de Controlo de Acessos',
  'Audit Log Management': 'Gestão de Registos de Auditoria',
  'Email & Web Browser': 'Email e Navegador Web',
  'Malware Defenses': 'Defesas contra Malware',
  'Network Infrastructure': 'Infraestrutura de Redes',
  'Network Monitoring': 'Monitorização de Redes',
  'Network Security': 'Segurança de Redes',
  'Data Recovery': 'Recuperação de Dados',
  'Security Awareness': 'Sensibilização para Segurança',
  'Service Provider Management': 'Gestão de Fornecedores de Serviços',
  'Application Security': 'Segurança de Aplicações',
  'Penetration Testing': 'Testes de Intrusão',
  'Continuous Vulnerability Management': 'Gestão Contínua de Vulnerabilidades',

  // GDPR
  'Lawfulness & Transparency': 'Licitude e Transparência',
  'Data Subject Rights': 'Direitos dos Titulares dos Dados',
  'Consent Management': 'Gestão de Consentimento',
  'Data Minimisation': 'Minimização de Dados',
  'Purpose Limitation': 'Limitação das Finalidades',
  'Storage Limitation': 'Limitação de Conservação',
  'Accuracy': 'Exatidão',
  'Security of Processing': 'Segurança do Tratamento',
  'Data Breach Notification': 'Notificação de Violação de Dados',
  'Data Protection by Design': 'Proteção de Dados desde a Conceção',
  'Data Protection Officer': 'Encarregado pela Proteção de Dados',
  'International Transfers': 'Transferências Internacionais',
  'Records of Processing': 'Registos de Tratamento',
  'Data Processor Management': 'Gestão de Subcontratantes',

  // ENISA
  'Governance & Risk Management': 'Governança e Gestão de Risco',
  'Incident Handling': 'Tratamento de Incidentes',
  'Business Continuity & Crisis Management': 'Continuidade de Negócio e Gestão de Crises',
  'Supply Chain Security': 'Segurança da Cadeia de Fornecimento',
  'Network & System Security': 'Segurança de Redes e Sistemas',
  'Cyber Hygiene & Training': 'Higiene Cibernética e Formação',
  'Cryptography & Encryption': 'Criptografia e Encriptação',
  'Access Control & HR Security': 'Controlo de Acessos e Segurança de RH',
  'Authentication & Secure Communications': 'Autenticação e Comunicações Seguras',
  'Monitoring & Detection': 'Monitorização e Deteção',

  // QNRC — already in Portuguese, kept for completeness
  'Identificar — Gestão de Ativos (ID.GA)': 'Identificar — Gestão de Ativos (ID.GA)',
  'Identificar — Avaliação de Risco (ID.AR)': 'Identificar — Avaliação de Risco (ID.AR)',
  'Identificar — Ambiente de Negócio (ID.AO)': 'Identificar — Ambiente de Negócio (ID.AO)',
  'Identificar — Governança (ID.GV)': 'Identificar — Governança (ID.GV)',
  'Identificar — Governação (ID.GV)': 'Identificar — Governação (ID.GV)',
  'Identificar — Estratégia de Gestão de Risco (ID.GR)': 'Identificar — Estratégia de Gestão de Risco (ID.GR)',
  'Identificar — Gestão de Risco na Cadeia de Fornecimento (ID.GL)': 'Identificar — Gestão de Risco na Cadeia de Fornecimento (ID.GL)',
  'Proteger — Gestão de Identidades e Acessos (PR.GA)': 'Proteger — Gestão de Identidades e Acessos (PR.GA)',
  'Proteger — Consciencialização e Formação (PR.FC)': 'Proteger — Consciencialização e Formação (PR.FC)',
  'Proteger — Segurança dos Dados (PR.SD)': 'Proteger — Segurança dos Dados (PR.SD)',
  'Proteger — Processos e Procedimentos (PR.PI)': 'Proteger — Processos e Procedimentos (PR.PI)',
  'Proteger — Manutenção (PR.MA)': 'Proteger — Manutenção (PR.MA)',
  'Proteger — Tecnologia de Proteção (PR.TP)': 'Proteger — Tecnologia de Proteção (PR.TP)',
  'Detetar — Anomalias e Eventos (DE.AE)': 'Detetar — Anomalias e Eventos (DE.AE)',
  'Detetar — Monitorização Contínua (DE.MC)': 'Detetar — Monitorização Contínua (DE.MC)',
  'Detetar — Processos de Deteção (DE.PD)': 'Detetar — Processos de Deteção (DE.PD)',
  'Responder — Planeamento de Resposta (RS.PR)': 'Responder — Planeamento de Resposta (RS.PR)',
  'Responder — Comunicações (RS.CO)': 'Responder — Comunicações (RS.CO)',
  'Responder — Análise (RS.AN)': 'Responder — Análise (RS.AN)',
  'Responder — Mitigação (RS.MI)': 'Responder — Mitigação (RS.MI)',
  'Responder — Melhorias (RS.ME)': 'Responder — Melhorias (RS.ME)',
  'Recuperar — Planeamento de Recuperação (RC.PR)': 'Recuperar — Planeamento de Recuperação (RC.PR)',
  'Recuperar — Melhorias (RC.ME)': 'Recuperar — Melhorias (RC.ME)',
  'Recuperar — Comunicações (RC.CO)': 'Recuperar — Comunicações (RC.CO)',

  // NIST CSF 2.0 functions
  'Govern (GV)': 'Governar (GV)',

  // Other / General
  'Organizational Controls': 'Controlos Organizacionais',
  'People Controls': 'Controlos de Pessoas',
  'Technological Controls': 'Controlos Tecnológicos',
  'Physical Controls': 'Controlos Físicos',
  'Physical and Environmental Security': 'Segurança Física e Ambiental',
  'Threat Intelligence': 'Inteligência de Ameaças',
  'Compliance and Legal': 'Conformidade e Legal',
  'Compliance and Monitoring': 'Conformidade e Monitorização',
  'Mobile Device Management': 'Gestão de Dispositivos Móveis',
  'Information Sharing': 'Partilha de Informação',
};

/**
 * Returns the Portuguese translation for a domain string.
 * Falls back to the original string if no translation is found.
 */
export function translateDomain(domain, language = 'pt') {
  if (language !== 'pt' || !domain) return domain;
  return DOMAIN_TRANSLATIONS[domain] || domain;
}