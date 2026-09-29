/**
 * Catálogo único de frameworks — espelho do backend
 * (`base44/shared/frameworkCatalogue.ts`; o Deno não importa de `src/`).
 *
 * Substitui as três listas divergentes que existiam
 * (`kbFrameworks.js`, `frameworkConstants.js`, `frameworkSeed.js`): esses
 * ficheiros passam a ler daqui. Ao acrescentar um framework, acrescentar nos
 * dois espelhos e dar-lhe ficha em `seedLegalRepository`.
 *
 * A ficha «at a glance» e as versões dos documentos **não** vivem aqui: são
 * dados do repositório legal, lidos das entidades `FrameworkProfile` e
 * `LegalDocumentVersion`.
 */

export const FRAMEWORK_CATALOGUE = [
  {
    code: 'NIS2',
    key: 'nis2',
    acronym: 'NIS2',
    version: '2025',
    name: { pt: 'NIS2 / DL 125/2025', en: 'NIS2 / DL 125/2025' },
    full_name: {
      pt: 'Diretiva (UE) 2022/2555, transposta pelo Decreto-Lei n.º 125/2025 (RJCS)',
      en: 'Directive (EU) 2022/2555, transposed by Decree-Law 125/2025 (RJCS)',
    },
    description: {
      pt: 'Regime jurídico da cibersegurança: gestão de risco, reporte de incidentes e segurança da cadeia de abastecimento para entidades essenciais e importantes.',
      en: 'Cybersecurity legal regime: risk management, incident reporting and supply chain security for essential and important entities.',
    },
    authority_codes: ['CNCS'],
    copyright: 'archiveable',
  },
  {
    code: 'GDPR',
    key: 'gdpr',
    acronym: 'RGPD',
    version: '2019',
    name: { pt: 'RGPD / Lei 58/2019', en: 'GDPR / Law 58/2019' },
    full_name: {
      pt: 'Regulamento (UE) 2016/679 (RGPD) e Lei n.º 58/2019, de 8 de agosto',
      en: 'Regulation (EU) 2016/679 (GDPR) and Portuguese Law 58/2019',
    },
    description: {
      pt: 'Proteção de dados pessoais: princípios, bases de licitude, direitos dos titulares, registo de atividades de tratamento e regime de responsabilidade.',
      en: 'Personal data protection: principles, lawful bases, data subject rights, records of processing and accountability.',
    },
    authority_codes: ['CNPD'],
    copyright: 'archiveable',
  },
  {
    code: 'ISO27001',
    key: 'iso-27001',
    acronym: 'ISO 27001',
    version: '2022',
    name: { pt: 'ISO/IEC 27001:2022', en: 'ISO/IEC 27001:2022' },
    full_name: {
      pt: 'ISO/IEC 27001:2022 — Segurança da informação, cibersegurança e proteção da privacidade — Sistemas de gestão',
      en: 'ISO/IEC 27001:2022 — Information security, cybersecurity and privacy protection — Management systems',
    },
    description: {
      pt: 'Norma de sistema de gestão da segurança da informação (SGSI): contexto, liderança, avaliação e tratamento do risco, Anexo A e melhoria contínua.',
      en: 'Information security management system (ISMS) standard: context, leadership, risk assessment and treatment, Annex A and continual improvement.',
    },
    authority_codes: ['ISO_IEC', 'IPAC'],
    copyright: 'metadata_only',
  },
  {
    code: 'NIST_CSF',
    key: 'nist-csf',
    acronym: 'NIST CSF',
    version: '2.0',
    name: { pt: 'NIST CSF 2.0', en: 'NIST CSF 2.0' },
    full_name: {
      pt: 'NIST Cybersecurity Framework 2.0',
      en: 'NIST Cybersecurity Framework 2.0',
    },
    description: {
      pt: 'Quadro de gestão do risco de cibersegurança organizado por funções — Governar, Identificar, Proteger, Detetar, Responder e Recuperar — com perfis e níveis de implementação.',
      en: 'Cybersecurity risk management framework organised by functions — Govern, Identify, Protect, Detect, Respond and Recover — with profiles and implementation tiers.',
    },
    authority_codes: ['NIST'],
    copyright: 'archiveable',
  },
  {
    code: 'CIS_V8',
    key: 'cis-v8',
    acronym: 'CIS v8',
    version: '8.1',
    name: { pt: 'CIS Controls v8.1', en: 'CIS Controls v8.1' },
    full_name: {
      pt: 'CIS Critical Security Controls v8.1',
      en: 'CIS Critical Security Controls v8.1',
    },
    description: {
      pt: 'Controlos de segurança priorizados em 18 domínios e três grupos de implementação, do inventário de ativos à gestão de registos.',
      en: 'Prioritised safeguards across 18 controls and three implementation groups, from asset inventory to audit log management.',
    },
    authority_codes: ['CIS'],
    copyright: 'metadata_only',
  },
  {
    code: 'QNRC',
    key: 'qnrc',
    acronym: 'QNRC',
    version: '1.0',
    name: {
      pt: 'QNRC',
      en: 'QNRC (Portuguese national reference framework)',
    },
    full_name: {
      pt: 'Quadro Nacional de Referência para a Cibersegurança (CNCS)',
      en: 'Portuguese National Cybersecurity Reference Framework (CNCS)',
    },
    description: {
      pt: 'Quadro nacional, alinhado com o NIST CSF, que organiza as funções Identificar, Proteger, Detetar, Responder e Recuperar num referencial de domínios e controlos em português.',
      en: 'National framework aligned with the NIST CSF, organising the Identify, Protect, Detect, Respond and Recover functions into Portuguese-language domains and controls.',
    },
    authority_codes: ['CNCS'],
    copyright: 'archiveable',
  },
  {
    code: 'ENISA',
    key: 'enisa',
    acronym: 'ENISA',
    version: '2024',
    name: { pt: 'ENISA — NIS2 Art. 21.º', en: 'ENISA — NIS2 Art. 21' },
    full_name: {
      pt: 'Orientações técnicas da ENISA para as medidas de gestão de risco do artigo 21.º da Diretiva (UE) 2022/2555',
      en: 'ENISA technical guidance on the risk-management measures of Article 21 of Directive (EU) 2022/2555',
    },
    description: {
      pt: 'Referencial europeu que operacionaliza as dez medidas mínimas do artigo 21.º do NIS2 em domínios verificáveis, incluindo competências (ECSF) e comunicações de emergência.',
      en: 'European reference operationalising the ten minimum measures of NIS2 Article 21 into verifiable domains, including skills (ECSF) and emergency communications.',
    },
    authority_codes: ['ENISA'],
    copyright: 'archiveable',
  },
];

/** Índice por código — a leitura usada pelas páginas e componentes. */
export const FRAMEWORK_BY_CODE = Object.fromEntries(FRAMEWORK_CATALOGUE.map(f => [f.code, f]));

/** Códigos do catálogo, pela ordem de apresentação. */
export const FRAMEWORK_CODES = FRAMEWORK_CATALOGUE.map(f => f.code);

/** Nome do framework para um idioma, com o código como recurso final. */
export function frameworkName(code, lang = 'pt') {
  const entry = FRAMEWORK_BY_CODE[code];
  if (!entry) return code || '';
  return entry.name?.[lang] || entry.name?.pt || code;
}

/** Nome completo (norma + referência legal) para um idioma. */
export function frameworkFullName(code, lang = 'pt') {
  const entry = FRAMEWORK_BY_CODE[code];
  if (!entry) return '';
  return entry.full_name?.[lang] || entry.full_name?.pt || '';
}
