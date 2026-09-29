import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { FRAMEWORK_CATALOGUE } from "../../shared/frameworkCatalogue.ts";
import {
  assertRepositoryWriter,
  checkOfficialLink,
  reviewDueFrom,
  writeLegalAuditLog,
} from "../../shared/legalRepository.ts";

/**
 * seedLegalRepository — carrega o Layer 1 da base de conhecimento: entidade
 * competente, ficha «at a glance» e documento oficial versionado de cada
 * framework do catálogo único. Complementar a `seedKnowledgeBase` (que semeia
 * os artigos editoriais, o layer 4).
 *
 * Idempotente por chave natural — `code` nas entidades competentes,
 * `framework_code` nas fichas e `framework_code` + `version_label` nas versões
 * —, pelo que re-executar nunca duplica nem reescreve conteúdo já revisto.
 *
 * **Frescura.** As versões novas entram por verificar (`verified_at` a null) e a
 * confirmação é humana: a ação `verify` de `manageLegalRepository`, que regista
 * quem verificou e quando. Nunca se declara verificada uma ligação que ninguém
 * confirmou.
 *
 * A verificação automática da ligação (`check_links: true`) só corre quando é
 * pedida: as funções correm em workerd sem saída de rede para servidores
 * externos, pelo que um `fetch` a uma ligação oficial falha o TLS e enche o log
 * de erros do runtime sem verificar coisa nenhuma. Fica disponível para quem
 * correr a seed num ambiente com saída de rede.
 *
 * Direitos de autor (§7 do plano): NIS2, RGPD, NIST, QNRC e ENISA são de
 * reprodução livre e podem ser arquivados com hash; ISO/IEC 27001 e CIS Controls
 * guardam **só** metadados, ligação oficial e resumo redigido por nós. Nenhuma
 * versão deste seed reproduz o texto de uma norma.
 *
 * Escrita restrita à administração da plataforma (`master_admin`).
 */

const REVIEW_CYCLE_MONTHS = 12;

// ─── Entidades competentes ────────────────────────────────────
const AUTHORITIES = [
  {
    code: "CNCS",
    name: "Centro Nacional de Cibersegurança",
    name_en: "Portuguese National Cybersecurity Centre",
    country: "PT",
    role: "regulador",
    website_url: "https://www.cncs.gov.pt/",
    legal_basis: "Decreto-Lei n.º 125/2025 (RJCS) e Decreto-Lei n.º 65/2021",
    legal_basis_en: "Decree-Law 125/2025 (RJCS) and Decree-Law 65/2021",
    contact: "cncs@cncs.gov.pt",
    enforcement_register_url: null,
    frameworks: ["NIS2", "QNRC"],
    notes: "Autoridade nacional de cibersegurança e autor do QNRC; supervisiona a aplicação do RJCS às entidades essenciais e importantes.",
    notes_en: "National cybersecurity authority and author of the QNRC; supervises the application of the RJCS to essential and important entities.",
  },
  {
    code: "CNPD",
    name: "Comissão Nacional de Proteção de Dados",
    name_en: "Portuguese Data Protection Authority",
    country: "PT",
    role: "supervisor",
    website_url: "https://www.cnpd.pt/",
    legal_basis: "Lei n.º 58/2019 e Regulamento (UE) 2016/679",
    legal_basis_en: "Law 58/2019 and Regulation (EU) 2016/679",
    contact: "geral@cnpd.pt",
    enforcement_register_url: null,
    frameworks: ["GDPR"],
    notes: "Autoridade de controlo nacional; aplica coimas e delibera sobre as reclamações dos titulares.",
    notes_en: "National supervisory authority; issues fines and rules on data subject complaints.",
  },
  {
    code: "ISO_IEC",
    name: "Organização Internacional de Normalização / Comissão Eletrotécnica Internacional",
    name_en: "International Organization for Standardization / International Electrotechnical Commission",
    country: "INT",
    role: "organismo_normalizador",
    website_url: "https://www.iso.org/standard/27001.html",
    legal_basis: "Norma internacional ISO/IEC 27001:2022",
    legal_basis_en: "International standard ISO/IEC 27001:2022",
    contact: null,
    enforcement_register_url: null,
    frameworks: ["ISO27001"],
    notes: "Publica a norma, que é paga: o repositório guarda metadados, ligação oficial e resumo próprio, nunca o texto.",
    notes_en: "Publishes the standard, which is paid: the repository holds metadata, the official link and an own summary, never the text.",
  },
  {
    code: "IPAC",
    name: "Instituto Português de Acreditação",
    name_en: "Portuguese Accreditation Body",
    country: "PT",
    role: "acreditacao",
    website_url: "https://www.ipac.pt/",
    legal_basis: "Regulamento (CE) n.º 765/2008 e Decreto-Lei n.º 23/2016",
    legal_basis_en: "Regulation (EC) No 765/2008 and Decree-Law 23/2016",
    contact: "geral@ipac.pt",
    enforcement_register_url: null,
    frameworks: ["ISO27001"],
    notes: "Acredita os organismos que emitem e mantêm a certificação ISO/IEC 27001 em Portugal.",
    notes_en: "Accredits the bodies that issue and maintain ISO/IEC 27001 certification in Portugal.",
  },
  {
    code: "NIST",
    name: "National Institute of Standards and Technology",
    name_en: "National Institute of Standards and Technology",
    country: "INT",
    role: "organismo_normalizador",
    website_url: "https://www.nist.gov/cyberframework",
    legal_basis: "Publicação federal dos Estados Unidos (domínio público)",
    legal_basis_en: "United States federal publication (public domain)",
    contact: null,
    enforcement_register_url: null,
    frameworks: ["NIST_CSF"],
    notes: "Publica o CSF e os perfis de referência; o documento é de domínio público.",
    notes_en: "Publishes the CSF and reference profiles; the document is in the public domain.",
  },
  {
    code: "CIS",
    name: "Center for Internet Security",
    name_en: "Center for Internet Security",
    country: "INT",
    role: "organismo_normalizador",
    website_url: "https://www.cisecurity.org/controls",
    legal_basis: "Publicação do Center for Internet Security (licença de utilização restrita)",
    legal_basis_en: "Center for Internet Security publication (restricted use licence)",
    contact: null,
    enforcement_register_url: null,
    frameworks: ["CIS_V8"],
    notes: "Publica os CIS Critical Security Controls; o repositório guarda metadados, ligação oficial e resumo próprio.",
    notes_en: "Publishes the CIS Critical Security Controls; the repository holds metadata, the official link and an own summary.",
  },
  {
    code: "ENISA",
    name: "Agência da União Europeia para a Cibersegurança",
    name_en: "European Union Agency for Cybersecurity",
    country: "EU",
    role: "organismo_normalizador",
    website_url: "https://www.enisa.europa.eu/",
    legal_basis: "Regulamento (UE) 2019/881 (Cybersecurity Act) e Diretiva (UE) 2022/2555",
    legal_basis_en: "Regulation (EU) 2019/881 (Cybersecurity Act) and Directive (EU) 2022/2555",
    contact: null,
    enforcement_register_url: null,
    frameworks: ["ENISA"],
    notes: "Produz as orientações técnicas que operacionalizam as medidas do artigo 21.º do NIS2; não aplica sanções.",
    notes_en: "Produces the technical guidance operationalising the measures of NIS2 Article 21; it does not impose sanctions.",
  },
];

// ─── Fichas «at a glance» (PT + EN) ───────────────────────────
const PROFILES = {
  NIS2: {
    display_name: "NIS2 / DL 125/2025",
    display_name_en: "NIS2 / Decree-Law 125/2025",
    acronym: "NIS2",
    mission:
      "Elevar o nível comum de cibersegurança na União, impondo às entidades essenciais e importantes medidas de gestão de risco, reporte de incidentes e responsabilidade da direção.",
    mission_en:
      "Raise the common level of cybersecurity across the Union by imposing risk-management measures, incident reporting and management accountability on essential and important entities.",
    scope_areas: [
      "Governança e responsabilidade da direção",
      "Gestão de risco e políticas de segurança dos sistemas de informação",
      "Tratamento e notificação de incidentes",
      "Continuidade de negócio e gestão de crises",
      "Segurança da cadeia de abastecimento",
      "Vulnerabilidades e higiene cibernética",
      "Criptografia e comunicações seguras",
    ],
    scope_areas_en: [
      "Governance and management-body accountability",
      "Risk management and information system security policies",
      "Incident handling and notification",
      "Business continuity and crisis management",
      "Supply chain security",
      "Vulnerability handling and cyber hygiene",
      "Cryptography and secure communications",
    ],
    objectives: [
      "Aprovar e supervisionar as medidas de gestão de risco ao nível da direção",
      "Garantir a notificação atempada de incidentes significativos",
      "Reduzir o risco introduzido pela cadeia de abastecimento",
      "Assegurar a continuidade e a recuperação dos serviços essenciais",
    ],
    objectives_en: [
      "Approve and oversee risk-management measures at management-body level",
      "Ensure timely notification of significant incidents",
      "Reduce the risk introduced by the supply chain",
      "Ensure continuity and recovery of essential services",
    ],
    applicability:
      "Entidades essenciais e importantes dos setores dos anexos I e II (energia, transportes, saúde, água, infraestruturas digitais, serviços TIC, administração pública, entre outros) que excedam os limiares de dimensão (≥ 50 trabalhadores ou volume de negócios anual > 10 M€), e certas entidades independentemente da dimensão; há exceções para micro e pequenas empresas em setores específicos.",
    applicability_en:
      "Essential and important entities in the sectors of Annexes I and II (energy, transport, health, water, digital infrastructure, ICT services, public administration and others) exceeding the size thresholds (≥ 50 staff or annual turnover > €10m), plus certain entities regardless of size; exceptions apply to micro and small enterprises in specific sectors.",
    obligations: [
      { label_pt: "Aviso inicial de incidente significativo à autoridade competente", label_en: "Early warning of a significant incident to the competent authority", deadline: "24 h" },
      { label_pt: "Notificação do incidente com avaliação inicial de gravidade e impacto", label_en: "Incident notification with an initial severity and impact assessment", deadline: "72 h" },
      { label_pt: "Relatório final do incidente", label_en: "Final incident report", deadline: "1 mês" },
      { label_pt: "Aprovação e supervisão das medidas de gestão de risco pela direção", label_en: "Management-body approval and oversight of risk-management measures", deadline: null },
      { label_pt: "Avaliação do risco da cadeia de abastecimento e das vulnerabilidades", label_en: "Assessment of supply chain and vulnerability risk", deadline: null },
    ],
    penalties:
      "Coimas até 10 M€ ou 2 % do volume de negócios mundial anual (entidades essenciais) e até 7 M€ ou 1,4 % (entidades importantes); a direção pode ser responsabilizada, incluindo inibição temporária do exercício de funções.",
    penalties_en:
      "Fines up to €10m or 2 % of worldwide annual turnover (essential entities) and up to €7m or 1.4 % (important entities); the management body may be held accountable, including temporary disqualification.",
    certifiability:
      "Não é certificável: a conformidade é atestada por auditoria ou autoavaliação e supervisionada pelo CNCS. Uma certificação ISO/IEC 27001 é aceite como evidência das medidas técnicas.",
    certifiability_en:
      "Not certifiable: compliance is attested through audit or self-assessment and supervised by the CNCS. An ISO/IEC 27001 certification is accepted as evidence of the technical measures.",
    related_frameworks: ["ENISA", "ISO27001", "QNRC"],
    references: [
      { label: "Diretiva (UE) 2022/2555 (EUR-Lex)", url: "https://eur-lex.europa.eu/eli/dir/2022/2555/oj" },
      { label: "CNCS — Regime Jurídico da Cibersegurança", url: "https://www.cncs.gov.pt/pt/regime-juridico/" },
    ],
    copyright_notice: null,
  },
  GDPR: {
    display_name: "RGPD / Lei 58/2019",
    display_name_en: "GDPR / Law 58/2019",
    acronym: "RGPD",
    mission:
      "Proteger os dados pessoais das pessoas singulares e a livre circulação desses dados, impondo às organizações deveres de licitude, transparência e responsabilidade.",
    mission_en:
      "Protect the personal data of natural persons and the free movement of such data, imposing duties of lawfulness, transparency and accountability on organisations.",
    scope_areas: [
      "Princípios e bases de licitude do tratamento",
      "Direitos dos titulares dos dados",
      "Registo das atividades de tratamento (RoPA)",
      "Avaliação de impacto sobre a proteção de dados",
      "Segurança do tratamento e violações de dados pessoais",
      "Encarregado de proteção de dados",
      "Transferências internacionais de dados",
    ],
    scope_areas_en: [
      "Principles and lawful bases for processing",
      "Data subject rights",
      "Records of processing activities (RoPA)",
      "Data protection impact assessment",
      "Security of processing and personal data breaches",
      "Data protection officer",
      "International data transfers",
    ],
    objectives: [
      "Estabelecer a licitude, lealdade e transparência do tratamento",
      "Garantir o exercício efetivo dos direitos dos titulares",
      "Demonstrar responsabilidade através de registos, avaliações de impacto e políticas",
      "Assegurar a segurança e a gestão de violações de dados pessoais",
    ],
    objectives_en: [
      "Establish lawfulness, fairness and transparency of processing",
      "Ensure the effective exercise of data subject rights",
      "Demonstrate accountability through records, impact assessments and policies",
      "Ensure the security of processing and the handling of personal data breaches",
    ],
    applicability:
      "Qualquer responsável pelo tratamento ou subcontratante que trate dados pessoais de titulares na União Europeia, independentemente da dimensão ou do setor; a Lei n.º 58/2019 executa o regulamento na ordem jurídica portuguesa e cria o regime de contracordenações aplicável em Portugal.",
    applicability_en:
      "Any controller or processor handling personal data of data subjects in the European Union, regardless of size or sector; Law 58/2019 implements the regulation in Portuguese law and sets the applicable administrative offences regime.",
    obligations: [
      { label_pt: "Notificação de violação de dados pessoais à CNPD", label_en: "Notification of a personal data breach to the CNPD", deadline: "72 h" },
      { label_pt: "Comunicação da violação aos titulares, quando haja risco elevado", label_en: "Communication of the breach to data subjects where there is a high risk", deadline: "sem demora injustificada" },
      { label_pt: "Resposta a pedidos de exercício de direitos", label_en: "Response to data subject rights requests", deadline: "1 mês (prorrogável por 2)" },
      { label_pt: "Manutenção do registo das atividades de tratamento", label_en: "Keeping the record of processing activities", deadline: null },
      { label_pt: "Nomeação de encarregado de proteção de dados quando aplicável", label_en: "Appointment of a data protection officer where applicable", deadline: null },
    ],
    penalties:
      "Coimas até 20 M€ ou 4 % do volume de negócios mundial anual do exercício anterior (princípios, direitos e transferências) e até 10 M€ ou 2 % (restantes obrigações).",
    penalties_en:
      "Fines up to €20m or 4 % of total worldwide annual turnover (principles, rights and transfers) and up to €10m or 2 % (remaining obligations).",
    certifiability:
      "Não é certificável. A conformidade demonstra-se por registos, avaliações de impacto e auditorias; a certificação (art. 42.º) e os códigos de conduta podem ser usados como garantia adicional.",
    certifiability_en:
      "Not certifiable. Compliance is demonstrated through records, impact assessments and audits; certification (Art. 42) and codes of conduct may be used as additional assurances.",
    related_frameworks: ["NIS2", "ISO27001"],
    references: [
      { label: "Regulamento (UE) 2016/679 (EUR-Lex)", url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj" },
      { label: "Lei n.º 58/2019 (Diário da República)", url: "https://diariodarepublica.pt/dr/detalhe/lei/58-2019-123815982" },
      { label: "CNPD", url: "https://www.cnpd.pt/" },
    ],
    copyright_notice: null,
  },
  ISO27001: {
    display_name: "ISO/IEC 27001:2022",
    display_name_en: "ISO/IEC 27001:2022",
    acronym: "ISO 27001",
    mission:
      "Definir os requisitos de um sistema de gestão da segurança da informação que permita proteger a informação de forma sistemática e melhorar continuamente.",
    mission_en:
      "Define the requirements for an information security management system that protects information systematically and improves continually.",
    scope_areas: [
      "Contexto da organização e partes interessadas",
      "Liderança, políticas e papéis",
      "Avaliação e tratamento do risco",
      "Anexo A — controlos organizacionais, de pessoas, físicos e tecnológicos",
      "Declaração de aplicabilidade",
      "Avaliação de desempenho e melhoria",
    ],
    scope_areas_en: [
      "Organisational context and interested parties",
      "Leadership, policies and roles",
      "Risk assessment and treatment",
      "Annex A — organisational, people, physical and technological controls",
      "Statement of Applicability",
      "Performance evaluation and improvement",
    ],
    objectives: [
      "Estabelecer, implementar, manter e melhorar um SGSI documentado",
      "Determinar e tratar os riscos de segurança da informação",
      "Selecionar e justificar os controlos aplicáveis no Anexo A",
      "Demonstrar conformidade a clientes, reguladores e partes interessadas",
    ],
    objectives_en: [
      "Establish, implement, maintain and improve a documented ISMS",
      "Determine and treat information security risks",
      "Select and justify the applicable Annex A controls",
      "Demonstrate conformity to customers, regulators and interested parties",
    ],
    applicability:
      "Voluntária: qualquer organização, de qualquer dimensão ou setor, que pretenda estabelecer, implementar, manter e melhorar um sistema de gestão da segurança da informação. O âmbito concreto é declarado pela própria organização.",
    applicability_en:
      "Voluntary: any organisation of any size or sector wishing to establish, implement, maintain and improve an information security management system. The concrete scope is declared by the organisation itself.",
    obligations: [
      { label_pt: "Definir o âmbito do SGSI e demonstrar a sua aplicabilidade", label_en: "Define the ISMS scope and demonstrate its applicability", deadline: null },
      { label_pt: "Manter a avaliação e o tratamento do risco documentados", label_en: "Keep risk assessment and treatment documented", deadline: null },
      { label_pt: "Declaração de aplicabilidade dos controlos do Anexo A", label_en: "Statement of Applicability for the Annex A controls", deadline: null },
      { label_pt: "Auditoria interna e revisão pela direção", label_en: "Internal audit and management review", deadline: "pelo menos anual" },
      { label_pt: "Tratamento de não conformidades e ações corretivas", label_en: "Handling of nonconformities and corrective actions", deadline: null },
    ],
    penalties:
      "Norma voluntária: não tem regime sancionatório. A consequência é a perda ou a suspensão da certificação e a emissão de não conformidades maiores em auditoria.",
    penalties_en:
      "Voluntary standard: no sanctions regime. The consequence is the loss or suspension of certification and major nonconformities in an audit.",
    certifiability:
      "Certificável por organismos acreditados — em Portugal, acreditados pelo IPAC — com validade de três anos e auditorias de acompanhamento anuais.",
    certifiability_en:
      "Certifiable by accredited certification bodies — in Portugal, accredited by IPAC — valid for three years with annual surveillance audits.",
    related_frameworks: ["NIS2", "NIST_CSF", "CIS_V8"],
    references: [
      { label: "ISO/IEC 27001:2022 (iso.org)", url: "https://www.iso.org/standard/27001.html" },
      { label: "IPAC — acreditação de organismos de certificação", url: "https://www.ipac.pt/" },
    ],
    copyright_notice:
      "Norma paga: esta ficha é a nossa interpretação do âmbito da ISO/IEC 27001:2022. O texto da norma não é reproduzido — consulte a fonte oficial.",
  },
  NIST_CSF: {
    display_name: "NIST CSF 2.0",
    display_name_en: "NIST CSF 2.0",
    acronym: "NIST CSF",
    mission:
      "Ajudar as organizações de qualquer dimensão a compreender, avaliar, priorizar e comunicar o risco de cibersegurança com um vocabulário comum.",
    mission_en:
      "Help organisations of any size understand, assess, prioritise and communicate cybersecurity risk using a common vocabulary.",
    scope_areas: [
      "Governar (GV)",
      "Identificar (ID)",
      "Proteger (PR)",
      "Detetar (DE)",
      "Responder (RS)",
      "Recuperar (RC)",
      "Perfis organizacionais e níveis de implementação",
    ],
    scope_areas_en: [
      "Govern (GV)",
      "Identify (ID)",
      "Protect (PR)",
      "Detect (DE)",
      "Respond (RS)",
      "Recover (RC)",
      "Organisational profiles and implementation tiers",
    ],
    objectives: [
      "Descrever o estado atual e o estado-alvo da gestão do risco",
      "Priorizar investimentos a partir das lacunas entre perfis",
      "Comunicar o risco a direção, clientes e reguladores",
      "Integrar a cibersegurança na gestão do risco organizacional",
    ],
    objectives_en: [
      "Describe the current and target state of risk management",
      "Prioritise investments from the gaps between profiles",
      "Communicate risk to management, customers and regulators",
      "Integrate cybersecurity into organisational risk management",
    ],
    applicability:
      "Voluntário e independente do setor: aplica-se a qualquer organização, incluindo pequenas empresas e organismos públicos. É recomendado nos Estados Unidos para infraestruturas críticas e muito usado como referência contratual.",
    applicability_en:
      "Voluntary and sector-agnostic: applies to any organisation, including small businesses and public bodies. It is recommended in the United States for critical infrastructure and widely used as a contractual reference.",
    obligations: [
      { label_pt: "Adotar um perfil de estado atual e um perfil de estado-alvo", label_en: "Adopt a current profile and a target profile", deadline: null },
      { label_pt: "Definir a estratégia de gestão do risco de cibersegurança na governança", label_en: "Define the cybersecurity risk management strategy at governance level", deadline: null },
      { label_pt: "Documentar os resultados por função e categoria", label_en: "Document results by function and category", deadline: null },
      { label_pt: "Rever o perfil e a priorização", label_en: "Review the profile and the prioritisation", deadline: "anual (recomendado)" },
    ],
    penalties:
      "Enquadramento voluntário: não tem regime sancionatório próprio. Ganha efeito obrigatório quando é incorporado em contratos, regulação setorial ou requisitos de clientes.",
    penalties_en:
      "Voluntary framework: no sanctions regime of its own. It becomes binding when incorporated into contracts, sector regulation or customer requirements.",
    certifiability:
      "Não é certificável: o resultado é um perfil e um plano de melhoria. É frequentemente usado como referência de mapeamento para a certificação ISO/IEC 27001.",
    certifiability_en:
      "Not certifiable: the output is a profile and an improvement plan. It is often used as a mapping reference for ISO/IEC 27001 certification.",
    related_frameworks: ["QNRC", "ISO27001", "CIS_V8"],
    references: [
      { label: "NIST Cybersecurity Framework (nist.gov)", url: "https://www.nist.gov/cyberframework" },
    ],
    copyright_notice: null,
  },
  CIS_V8: {
    display_name: "CIS Controls v8.1",
    display_name_en: "CIS Controls v8.1",
    acronym: "CIS v8",
    mission:
      "Priorizar as ações defensivas com maior efeito imediato, começando pela higiene básica que remove a maior parte da superfície de ataque comum.",
    mission_en:
      "Prioritise the defensive actions with the greatest immediate effect, starting with the basic hygiene that removes most of the common attack surface.",
    scope_areas: [
      "Inventário e controlo de ativos e de software",
      "Proteção de dados",
      "Configuração segura",
      "Gestão de contas e de acessos",
      "Gestão contínua de vulnerabilidades",
      "Gestão de registos e monitorização",
      "Resposta a incidentes e recuperação",
    ],
    scope_areas_en: [
      "Inventory and control of enterprise and software assets",
      "Data protection",
      "Secure configuration",
      "Account and access management",
      "Continuous vulnerability management",
      "Audit log management and monitoring",
      "Incident response and recovery",
    ],
    objectives: [
      "Reduzir a superfície de ataque com medidas de higiene verificáveis",
      "Estabelecer uma ordem de implementação por grupos (IG1 a IG3)",
      "Aproximar a defesa das ameaças mais comuns e documentadas",
      "Dar uma base de mapeamento para normas de gestão como a ISO/IEC 27001",
    ],
    objectives_en: [
      "Reduce the attack surface with verifiable hygiene measures",
      "Establish an implementation order through groups (IG1 to IG3)",
      "Move defences closer to the most common and documented threats",
      "Provide a mapping base for management standards such as ISO/IEC 27001",
    ],
    applicability:
      "Voluntário: aplicável a organizações de qualquer dimensão, com três grupos de implementação que escalam a partir de equipas sem especialização dedicada em segurança.",
    applicability_en:
      "Voluntary: applicable to organisations of any size, with three implementation groups that scale from teams without dedicated security expertise.",
    obligations: [
      { label_pt: "Implementar os controlos do Grupo de Implementação 1", label_en: "Implement the Implementation Group 1 safeguards", deadline: null },
      { label_pt: "Manter o inventário de ativos e de software atualizado", label_en: "Keep asset and software inventories up to date", deadline: null },
      { label_pt: "Aplicar configuração segura e gestão contínua de vulnerabilidades", label_en: "Apply secure configuration and continuous vulnerability management", deadline: null },
      { label_pt: "Rever os controlos", label_en: "Review the safeguards", deadline: "anual ou quando o risco mude" },
    ],
    penalties:
      "Sem regime sancionatório próprio. Os controlos são frequentemente exigidos em contratos e usados como base de avaliação por clientes e seguradoras.",
    penalties_en:
      "No sanctions regime of its own. The safeguards are frequently required in contracts and used as an assessment basis by customers and insurers.",
    certifiability:
      "Não é certificável. Existem autoavaliações do CIS e mapeamentos para a ISO/IEC 27001 e o NIST CSF.",
    certifiability_en:
      "Not certifiable. CIS self-assessments exist, along with mappings to ISO/IEC 27001 and the NIST CSF.",
    related_frameworks: ["NIST_CSF", "ISO27001", "NIS2"],
    references: [
      { label: "CIS Critical Security Controls (cisecurity.org)", url: "https://www.cisecurity.org/controls" },
    ],
    copyright_notice:
      "Publicação com licença de utilização restrita: esta ficha é a nossa interpretação do âmbito dos CIS Controls. O texto dos controlos não é reproduzido — consulte a fonte oficial.",
  },
  QNRC: {
    display_name: "QNRC",
    display_name_en: "QNRC — Portuguese National Cybersecurity Reference Framework",
    acronym: "QNRC",
    mission:
      "Dar às organizações portuguesas um referencial nacional, em língua portuguesa e alinhado com o NIST CSF, para avaliar e melhorar a postura de cibersegurança.",
    mission_en:
      "Give Portuguese organisations a national, Portuguese-language framework, aligned with the NIST CSF, to assess and improve their cybersecurity posture.",
    scope_areas: [
      "Identificar",
      "Proteger",
      "Detetar",
      "Responder",
      "Recuperar",
      "Mapeamento com o NIST CSF e com o RJCS",
    ],
    scope_areas_en: [
      "Identify",
      "Protect",
      "Detect",
      "Respond",
      "Recover",
      "Mapping to the NIST CSF and the RJCS",
    ],
    objectives: [
      "Oferecer um referencial de autoavaliação em português",
      "Alinhar as organizações portuguesas com as boas práticas internacionais",
      "Servir de base à preparação para as obrigações do RJCS",
      "Uniformizar o vocabulário entre setor público e privado",
    ],
    objectives_en: [
      "Provide a Portuguese-language self-assessment framework",
      "Align Portuguese organisations with international good practice",
      "Serve as a basis for preparing for RJCS obligations",
      "Standardise vocabulary across the public and private sectors",
    ],
    applicability:
      "Voluntário mas recomendado pelo CNCS a todas as organizações, com prioridade para as entidades abrangidas pelo RJCS e para os operadores de infraestruturas críticas.",
    applicability_en:
      "Voluntary but recommended by the CNCS to all organisations, with priority for entities covered by the RJCS and for critical infrastructure operators.",
    obligations: [
      { label_pt: "Autoavaliação por domínio e controlo", label_en: "Self-assessment by domain and control", deadline: null },
      { label_pt: "Plano de melhoria a partir das lacunas identificadas", label_en: "Improvement plan from the identified gaps", deadline: null },
      { label_pt: "Mapeamento dos controlos para as obrigações do RJCS", label_en: "Mapping of the controls to RJCS obligations", deadline: null },
      { label_pt: "Revisão da autoavaliação", label_en: "Review of the self-assessment", deadline: "anual" },
    ],
    penalties:
      "Referencial voluntário: não tem coimas próprias. As obrigações legais aplicáveis decorrem do RJCS (NIS2) e do regime da segurança do ciberespaço.",
    penalties_en:
      "Voluntary framework: no fines of its own. The applicable legal obligations arise from the RJCS (NIS2) and the cybersecurity legal regime.",
    certifiability:
      "Não é certificável: é um quadro de autoavaliação. Serve de base à preparação para auditorias do CNCS e para a certificação ISO/IEC 27001.",
    certifiability_en:
      "Not certifiable: it is a self-assessment framework. It supports preparation for CNCS audits and for ISO/IEC 27001 certification.",
    related_frameworks: ["NIST_CSF", "NIS2", "ISO27001"],
    references: [
      { label: "CNCS — Quadro Nacional de Referência para a Cibersegurança", url: "https://www.cncs.gov.pt/pt/quadro-nacional/" },
    ],
    copyright_notice: null,
  },
  ENISA: {
    display_name: "ENISA — NIS2 Art. 21.º",
    display_name_en: "ENISA — NIS2 Art. 21",
    acronym: "ENISA",
    mission:
      "Operacionalizar as medidas mínimas de gestão de risco do artigo 21.º do NIS2 em domínios verificáveis, harmonizando a implementação entre Estados-Membros.",
    mission_en:
      "Operationalise the minimum risk-management measures of NIS2 Article 21 into verifiable domains, harmonising implementation across Member States.",
    scope_areas: [
      "Governança e gestão do risco (art. 21.º/2 a)",
      "Tratamento de incidentes (b)",
      "Continuidade de negócio e gestão de crises (c)",
      "Segurança da cadeia de abastecimento (d)",
      "Segurança na aquisição, desenvolvimento e manutenção de sistemas (e)",
      "Avaliação da eficácia das medidas (f)",
      "Higiene cibernética e formação (g)",
      "Criptografia e encriptação (h)",
      "Recursos humanos e controlo de acessos (i)",
      "Autenticação multifator e comunicações seguras (j)",
    ],
    scope_areas_en: [
      "Governance and risk management (Art. 21(2)(a))",
      "Incident handling (b)",
      "Business continuity and crisis management (c)",
      "Supply chain security (d)",
      "Security in acquisition, development and maintenance (e)",
      "Assessing the effectiveness of measures (f)",
      "Cyber hygiene and training (g)",
      "Cryptography and encryption (h)",
      "Human resources and access control (i)",
      "Multi-factor authentication and secure communications (j)",
    ],
    objectives: [
      "Traduzir o artigo 21.º do NIS2 em requisitos técnicos verificáveis",
      "Harmonizar a interpretação entre Estados-Membros",
      "Dar exemplos de evidência aceitáveis em auditoria",
      "Mapear os requisitos para normas europeias e internacionais",
    ],
    objectives_en: [
      "Translate NIS2 Article 21 into verifiable technical requirements",
      "Harmonise interpretation across Member States",
      "Provide examples of evidence acceptable in an audit",
      "Map the requirements to European and international standards",
    ],
    applicability:
      "Referência técnica para as entidades abrangidas pelo NIS2 em toda a União; útil também a organizações que queiram alinhar a gestão de risco com o artigo 21.º e com o Regulamento de Execução (UE) 2024/2690.",
    applicability_en:
      "Technical reference for entities covered by NIS2 across the Union; also useful to organisations wishing to align risk management with Article 21 and with Implementing Regulation (EU) 2024/2690.",
    obligations: [
      { label_pt: "Adotar as medidas mínimas de gestão de risco do artigo 21.º", label_en: "Adopt the minimum risk-management measures of Article 21", deadline: null },
      { label_pt: "Reportar incidentes segundo as obrigações do NIS2", label_en: "Report incidents according to NIS2 obligations", deadline: "24 h / 72 h / 1 mês" },
      { label_pt: "Considerar as avaliações coordenadas de risco da cadeia de abastecimento (art. 22.º)", label_en: "Consider coordinated supply chain risk assessments (Art. 22)", deadline: null },
      { label_pt: "Desenvolver competências alinhadas com o ECSF", label_en: "Develop skills aligned with the ECSF", deadline: null },
    ],
    penalties:
      "A ENISA não sanciona: as consequências legais decorrem da transposição nacional do NIS2 — em Portugal, do RJCS.",
    penalties_en:
      "ENISA does not impose sanctions: legal consequences arise from the national transposition of NIS2 — in Portugal, from the RJCS.",
    certifiability:
      "Não é certificável. Serve de base técnica à conformidade com o NIS2 e de mapeamento com a ISO/IEC 27001 e o NIST CSF.",
    certifiability_en:
      "Not certifiable. It provides the technical basis for NIS2 compliance and for mapping to ISO/IEC 27001 and the NIST CSF.",
    related_frameworks: ["NIS2", "QNRC", "ISO27001"],
    references: [
      { label: "ENISA — NIS2 Technical Implementation Guidance", url: "https://www.enisa.europa.eu/publications/nis2-technical-implementation-guidance" },
      { label: "Regulamento de Execução (UE) 2024/2690 (EUR-Lex)", url: "https://eur-lex.europa.eu/eli/reg_impl/2024/2690/oj" },
    ],
    copyright_notice: null,
  },
};

// ─── Versões dos documentos oficiais ──────────────────────────
// `summary` é sempre resumo próprio: nenhum texto oficial é copiado.
const VERSIONS = {
  NIS2: [
    {
      version_label: "DL 125/2025",
      version_type: "transposicao",
      status: "current",
      effective_from: "2025-12-04",
      document_title: "Decreto-Lei n.º 125/2025, de 4 de dezembro — aprova o regime jurídico da cibersegurança",
      legal_reference: "Decreto-Lei n.º 125/2025",
      issuing_authority: "Governo de Portugal",
      official_source: "Diário da República (ELI)",
      official_url: "https://diariodarepublica.pt/dr/detalhe/decreto-lei/125-2025-962603401",
      language: "pt-PT",
      summary:
        "Regime jurídico da cibersegurança: transposição nacional do NIS2, com as obrigações de gestão de risco, reporte de incidentes e supervisão pelo CNCS.",
      summary_en:
        "Cybersecurity legal regime: national transposition of NIS2, with the risk-management, incident-reporting and supervision duties exercised by the CNCS.",
      change_note: "Substitui o regime anterior da segurança do ciberespaço (DL 65/2021) e passa a ser a referência nacional do NIS2.",
    },
    {
      version_label: "Diretiva (UE) 2022/2555",
      version_type: "original",
      status: "current",
      effective_from: "2023-01-16",
      document_title: "Diretiva (UE) 2022/2555 do Parlamento Europeu e do Conselho, de 14 de dezembro de 2022 (NIS2)",
      legal_reference: "Diretiva (UE) 2022/2555",
      issuing_authority: "Parlamento Europeu e Conselho",
      official_source: "EUR-Lex (ELI)",
      official_url: "https://eur-lex.europa.eu/eli/dir/2022/2555/oj",
      language: "pt-PT",
      summary:
        "Ato europeu de origem: fixa as dez medidas mínimas de gestão de risco, as obrigações de reporte e o regime de supervisão e sanções a transpor pelos Estados-Membros.",
      summary_en:
        "The originating European act: sets the ten minimum risk-management measures, the reporting obligations and the supervision and sanctions regime to be transposed by Member States.",
      change_note: null,
    },
    {
      version_label: "DL 65/2021",
      version_type: "transposicao",
      status: "superseded",
      effective_from: "2021-07-30",
      effective_to: "2025-12-04",
      document_title: "Decreto-Lei n.º 65/2021, de 30 de julho — regulamenta o regime jurídico da segurança do ciberespaço",
      legal_reference: "Decreto-Lei n.º 65/2021",
      issuing_authority: "Governo de Portugal",
      official_source: "Diário da República (ELI)",
      official_url: "https://diariodarepublica.pt/dr/detalhe/decreto-lei/65-2021-168697988",
      language: "pt-PT",
      summary:
        "Regime anterior da segurança do ciberespaço, que operacionalizava a Lei n.º 46/2018 e as obrigações de reporte ao CNCS.",
      summary_en:
        "Previous cybersecurity legal regime, operating the obligations of Law 46/2018 and the reporting duties to the CNCS.",
      change_note: "Revogado pelo DL 125/2025, que aprova o novo regime jurídico da cibersegurança.",
    },
  ],
  GDPR: [
    {
      version_label: "Regulamento (UE) 2016/679",
      version_type: "original",
      status: "current",
      effective_from: "2018-05-25",
      document_title: "Regulamento (UE) 2016/679 do Parlamento Europeu e do Conselho, de 27 de abril de 2016 (RGPD)",
      legal_reference: "Regulamento (UE) 2016/679",
      issuing_authority: "Parlamento Europeu e Conselho",
      official_source: "EUR-Lex (ELI)",
      official_url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
      language: "pt-PT",
      summary:
        "Regulamento diretamente aplicável: princípios, bases de licitude, direitos dos titulares, obrigações do responsável e do subcontratante, e regime de coimas até 20 M€ ou 4 % do volume de negócios.",
      summary_en:
        "Directly applicable regulation: principles, lawful bases, data subject rights, controller and processor duties, and fines of up to €20m or 4 % of turnover.",
      change_note: null,
    },
    {
      version_label: "Lei 58/2019",
      version_type: "transposicao",
      status: "current",
      effective_from: "2019-08-08",
      document_title: "Lei n.º 58/2019, de 8 de agosto — assegura a execução, na ordem jurídica nacional, do RGPD",
      legal_reference: "Lei n.º 58/2019",
      issuing_authority: "Assembleia da República",
      official_source: "Diário da República (ELI)",
      official_url: "https://diariodarepublica.pt/dr/detalhe/lei/58-2019-123815982",
      language: "pt-PT",
      summary:
        "Execução nacional do RGPD: estatuto da CNPD, regras específicas de tratamento e o regime das contracordenações aplicável em Portugal.",
      summary_en:
        "National implementation of the GDPR: status of the CNPD, specific processing rules and the administrative offences regime applicable in Portugal.",
      change_note: null,
    },
  ],
  ISO27001: [
    {
      version_label: "ISO/IEC 27001:2022",
      version_type: "norma_tecnica",
      status: "current",
      effective_from: "2022-10-25",
      document_title: "ISO/IEC 27001:2022 — Information security, cybersecurity and privacy protection — Information security management systems — Requirements",
      legal_reference: "ISO/IEC 27001:2022",
      issuing_authority: "ISO/IEC",
      official_source: "iso.org (norma paga)",
      official_url: "https://www.iso.org/standard/27001.html",
      language: "en",
      summary:
        "Edição em vigor: requisitos do SGSI com o Anexo A reorganizado em quatro temas (organizacional, pessoas, físico e tecnológico) e 93 controlos.",
      summary_en:
        "Edition in force: ISMS requirements with Annex A reorganised into four themes (organisational, people, physical and technological) and 93 controls.",
      change_note: "Substitui a edição de 2013, com o Anexo A reorganizado em quatro temas.",
    },
    {
      version_label: "ISO/IEC 27001:2013",
      version_type: "norma_tecnica",
      status: "superseded",
      effective_from: "2013-10-01",
      effective_to: "2022-10-25",
      document_title: "ISO/IEC 27001:2013 — Information technology — Security techniques — Information security management systems — Requirements",
      legal_reference: "ISO/IEC 27001:2013",
      issuing_authority: "ISO/IEC",
      official_source: "iso.org (norma paga)",
      official_url: null,
      language: "en",
      summary:
        "Edição anterior: 114 controlos organizados em 14 domínios do Anexo A. As certificações emitidas contra esta edição terminaram o período de transição.",
      summary_en:
        "Previous edition: 114 controls organised into 14 Annex A domains. Certifications issued against it have completed their transition period.",
      change_note: "Substituída pela edição de 2022.",
    },
  ],
  NIST_CSF: [
    {
      version_label: "NIST CSF 2.0",
      version_type: "norma_tecnica",
      status: "current",
      effective_from: "2024-02-26",
      document_title: "The NIST Cybersecurity Framework (CSF) 2.0",
      legal_reference: "NIST CSWP 29",
      issuing_authority: "NIST",
      official_source: "nist.gov (domínio público)",
      official_url: "https://www.nist.gov/cyberframework",
      language: "en",
      summary:
        "Edição em vigor: acrescenta a função Governar (GV) às cinco funções anteriores e passa a ser aplicável a qualquer organização, não apenas a infraestruturas críticas.",
      summary_en:
        "Edition in force: adds the Govern (GV) function to the previous five and becomes applicable to any organisation, not only critical infrastructure.",
      change_note: "Introduz a função Governar e alarga explicitamente o âmbito a todas as organizações.",
    },
    {
      version_label: "NIST CSF 1.1",
      version_type: "norma_tecnica",
      status: "superseded",
      effective_from: "2018-04-16",
      effective_to: "2024-02-26",
      document_title: "Framework for Improving Critical Infrastructure Cybersecurity, Version 1.1",
      legal_reference: "NIST CSF 1.1",
      issuing_authority: "NIST",
      official_source: "nist.gov (domínio público)",
      official_url: null,
      language: "en",
      summary:
        "Versão anterior: cinco funções (Identificar, Proteger, Detetar, Responder, Recuperar) e categorias orientadas a infraestruturas críticas.",
      summary_en:
        "Previous version: five functions (Identify, Protect, Detect, Respond, Recover) and categories aimed at critical infrastructure.",
      change_note: "Substituída pela versão 2.0.",
    },
  ],
  CIS_V8: [
    {
      version_label: "CIS Controls v8.1",
      version_type: "norma_tecnica",
      status: "current",
      effective_from: "2024-06-25",
      document_title: "CIS Critical Security Controls Version 8.1",
      legal_reference: "CIS Controls v8.1",
      issuing_authority: "Center for Internet Security",
      official_source: "cisecurity.org",
      official_url: "https://www.cisecurity.org/controls/cis-controls-list",
      language: "en",
      summary:
        "Edição em vigor: 18 controlos e 153 salvaguardas, com o mapeamento revisto para o NIST CSF 2.0 e orientações de implementação por grupo.",
      summary_en:
        "Edition in force: 18 controls and 153 safeguards, with the mapping revised for NIST CSF 2.0 and per-group implementation guidance.",
      change_note: "Atualiza os mapeamentos para o NIST CSF 2.0 e a documentação de implementação.",
    },
    {
      version_label: "CIS Controls v8",
      version_type: "norma_tecnica",
      status: "superseded",
      effective_from: "2021-05-18",
      effective_to: "2024-06-25",
      document_title: "CIS Critical Security Controls Version 8",
      legal_reference: "CIS Controls v8",
      issuing_authority: "Center for Internet Security",
      official_source: "cisecurity.org",
      official_url: "https://www.cisecurity.org/controls",
      language: "en",
      summary:
        "Edição anterior: primeira versão alinhada com o NIST CSF 1.1 e organizada em três grupos de implementação.",
      summary_en:
        "Previous edition: the first version aligned with NIST CSF 1.1 and organised into three implementation groups.",
      change_note: "Substituída pela v8.1.",
    },
  ],
  QNRC: [
    {
      version_label: "QNRC 2019",
      version_type: "norma_tecnica",
      status: "current",
      effective_from: "2019",
      document_title: "Quadro Nacional de Referência para a Cibersegurança (QNRC)",
      legal_reference: "QNRC — CNCS, 2019",
      issuing_authority: "CNCS",
      official_source: "cncs.gov.pt",
      official_url: "https://www.cncs.gov.pt/pt/quadro-nacional/",
      language: "pt-PT",
      summary:
        "Referencial nacional de autoavaliação, alinhado com o NIST CSF 1.1, organizado em domínios e controlos em português para as cinco funções.",
      summary_en:
        "National self-assessment framework, aligned with NIST CSF 1.1, organised into Portuguese-language domains and controls across the five functions.",
      change_note: null,
    },
  ],
  ENISA: [
    {
      version_label: "ENISA Guidance v1.0 (2025)",
      version_type: "norma_tecnica",
      status: "current",
      effective_from: "2025-06-26",
      document_title: "Technical Implementation Guidance on Commission Implementing Regulation (EU) 2024/2690 (version 1.0)",
      legal_reference: "ENISA, June 2025",
      issuing_authority: "ENISA",
      official_source: "enisa.europa.eu",
      official_url: "https://www.enisa.europa.eu/publications/nis2-technical-implementation-guidance",
      language: "en",
      summary:
        "Orientação técnica não vinculativa que detalha as medidas do artigo 21.º em requisitos técnicos e metodológicos, com exemplos de evidência e mapeamentos para normas europeias e internacionais.",
      summary_en:
        "Non-binding technical guidance detailing the Article 21 measures into technical and methodological requirements, with examples of evidence and mappings to European and international standards.",
      change_note: "Primeira versão publicada da orientação técnica.",
    },
    {
      version_label: "Reg. Execução (UE) 2024/2690",
      version_type: "norma_tecnica",
      status: "current",
      effective_from: "2024-10-17",
      document_title: "Regulamento de Execução (UE) 2024/2690 da Comissão, de 17 de outubro de 2024",
      legal_reference: "Regulamento de Execução (UE) 2024/2690",
      issuing_authority: "Comissão Europeia",
      official_source: "EUR-Lex (ELI)",
      official_url: "https://eur-lex.europa.eu/eli/reg_impl/2024/2690/oj",
      language: "pt-PT",
      summary:
        "Ato vinculativo que fixa os requisitos técnicos e metodológicos das medidas do artigo 21.º/2 para determinados setores e tipos de entidades.",
      summary_en:
        "Binding act setting the technical and methodological requirements of Article 21(2) measures for certain sectors and types of entity.",
      change_note: null,
    },
  ],
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    assertRepositoryWriter(user);
    const actor = user.email || "unknown";
    const now = new Date();
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // ─── 1. Entidades competentes (idempotente por `code`) ────────
    const existingAuthorities = await base44.asServiceRole.entities.CompetentAuthority.list("-created_date", 200);
    const authorityByCode = new Map<string, any>(existingAuthorities.map((a: any) => [a.code, a]));
    const authoritiesCreated: string[] = [];

    for (const authority of AUTHORITIES) {
      if (authorityByCode.has(authority.code)) continue;
      const saved = await base44.asServiceRole.entities.CompetentAuthority.create({ ...authority, is_active: true });
      authorityByCode.set(authority.code, saved);
      authoritiesCreated.push(authority.code);
    }

    // ─── 2. Fichas «at a glance» (idempotente por `framework_code`) ───
    const existingProfiles = await base44.asServiceRole.entities.FrameworkProfile.list("-created_date", 200);
    const profileByCode = new Map<string, any>(existingProfiles.map((p: any) => [p.framework_code, p]));
    const profilesCreated: string[] = [];

    for (const framework of FRAMEWORK_CATALOGUE) {
      if (profileByCode.has(framework.code)) continue;
      const profile = PROFILES[framework.code];
      if (!profile) continue;
      const saved = await base44.asServiceRole.entities.FrameworkProfile.create({
        ...profile,
        framework_code: framework.code,
        catalogue_key: framework.key,
        competent_authority_codes: framework.authority_codes,
        review_cycle_months: REVIEW_CYCLE_MONTHS,
        verified_at: null,
        verified_by: null,
        verification_method: null,
        is_active: true,
        archived_at: null,
      });
      profileByCode.set(framework.code, saved);
      profilesCreated.push(framework.code);
    }

    // ─── 3. Versões dos documentos (idempotente por framework + rótulo) ───
    const existingVersions = await base44.asServiceRole.entities.LegalDocumentVersion.list("-created_date", 500);
    const versionKey = (code: string, label: string) => `${code}::${label}`;
    const versionsByKey = new Map<string, any>(
      existingVersions.map((v: any) => [versionKey(v.framework_code, v.version_label), v]),
    );

    // A cadeia de substituição liga-se depois de todas as linhas existirem: uma
    // versão só pode apontar para a anterior da mesma framework.
    const pending: Array<{ created: any; replacesLabel: string | null; code: string }> = [];
    let previousLabelByFramework: Record<string, string> = {};

    for (const framework of FRAMEWORK_CATALOGUE) {
      const known = (VERSIONS[framework.code] || [])
        .slice()
        .sort((a, b) => String(a.effective_from).localeCompare(String(b.effective_from)));

      // Cadeia das versões que já existem (para a nova poder apontar à anterior).
      const all = known
        .map((v) => versionsByKey.get(versionKey(framework.code, v.version_label)))
        .filter(Boolean);
      previousLabelByFramework[framework.code] = all.length
        ? all[all.length - 1].version_label
        : "";

      for (const version of known) {
        const key = versionKey(framework.code, version.version_label);
        if (versionsByKey.has(key)) {
          previousLabelByFramework[framework.code] = version.version_label;
          continue;
        }
        const created = await base44.asServiceRole.entities.LegalDocumentVersion.create({
          ...version,
          framework_code: framework.code,
          supersedes_id: null,
          page_count: null,
          mirror_url: null,
          attachment_name: null,
          content_hash: null,
          copyright_regime: framework.copyright,
          withdrawn_reason: null,
          verified_at: null,
          verified_by: null,
          verification_method: null,
          review_due_at: null,
        });
        versionsByKey.set(key, created);
        pending.push({
          created,
          replacesLabel: previousLabelByFramework[framework.code] || null,
          code: framework.code,
        });
        previousLabelByFramework[framework.code] = version.version_label;
      }
    }

    // ─── 4. Frescura das versões novas ────────────────────────────
    // Por omissão ninguém contacta a rede: as versões novas ficam por verificar
    // e a confirmação é humana. A verificação automática só corre a pedido
    // explícito (`check_links: true`), num ambiente com saída de rede.
    // Só as versões criadas agora são tocadas: re-executar o seed não reescreve
    // a verificação de uma versão já revista por uma pessoa.
    const wantLinkCheck = body?.check_links === true;

    let linkOk = 0;
    let linkInconclusive = 0;
    const linkNotes: string[] = [];
    for (const entry of pending) {
      const check = wantLinkCheck ? await checkOfficialLink(entry.created.official_url || "") : null;
      const patch: Record<string, any> = {
        verified_at: null,
        verified_by: null,
        verification_method: check ? (check.ok ? "link_check" : "link_check_failed") : null,
        review_due_at: check?.ok ? reviewDueFrom(now.toISOString(), REVIEW_CYCLE_MONTHS) : null,
      };
      if (check?.ok) {
        patch.verified_at = now.toISOString();
        patch.verified_by = actor;
        linkOk += 1;
      } else if (check) {
        linkInconclusive += 1;
        linkNotes.push(`${entry.code} ${entry.created.version_label}: ${check.reason}`);
      }

      // `supersedes_id` fecha a cadeia de substituição no mesmo passo.
      if (entry.replacesLabel) {
        const previous = versionsByKey.get(versionKey(entry.code, entry.replacesLabel));
        if (previous?.id) patch.supersedes_id = previous.id;
      }
      await base44.asServiceRole.entities.LegalDocumentVersion.update(entry.created.id, patch);
    }

    // ─── 5. Ligar as linhas de Framework ao repositório ──────────
    // A entidade Framework continua a ser o que o agente e o guia de controlos
    // leem; passa a apontar para a ficha e para a versão em vigor.
    const frameworks = await base44.asServiceRole.entities.Framework.list("-created_date", 200);
    let frameworksLinked = 0;
    for (const row of frameworks) {
      const catalogueEntry = FRAMEWORK_CATALOGUE.find((f: any) => f.code === row.code);
      const profile = profileByCode.get(row.code);
      if (!catalogueEntry || !profile) continue;
      const current = (VERSIONS[row.code] || []).find((v: any) => v.status === "current" && v.official_url);
      const patch: Record<string, any> = {
        catalogue_key: catalogueEntry.key,
        profile_id: profile.id,
      };
      if (current?.official_url) patch.reference_url = current.official_url;
      if (row.catalogue_key !== patch.catalogue_key || row.profile_id !== patch.profile_id) {
        await base44.asServiceRole.entities.Framework.update(row.id, patch);
        frameworksLinked += 1;
      }
    }

    // ─── 6. Ligar os artigos editoriais à versão do layer 1 ──────
    // Regra do plano (§2): nada nos layers 2+ cita uma norma sem apontar para a
    // versão concreta. Um artigo que já nomeia um framework ganha a referência à
    // versão em vigor; um artigo que já tem `legal_refs` não é tocado, para
    // re-executar o seed não reescrever uma citação já revista por uma pessoa.
    const articles = await base44.asServiceRole.entities.KnowledgeArticle.list("-created_date", 500);
    let articlesLinked = 0;
    for (const article of articles) {
      const code = article.framework;
      if (!code || (article.legal_refs || []).length) continue;
      const inForce = (VERSIONS[code] || []).find((v: any) => v.status === "current" && v.official_url);
      const versionRow = inForce ? versionsByKey.get(versionKey(code, inForce.version_label)) : null;
      if (!versionRow?.id) continue;
      await base44.asServiceRole.entities.KnowledgeArticle.update(article.id, {
        legal_refs: [
          { framework_code: code, version_id: versionRow.id, version_label: versionRow.version_label },
        ],
      });
      articlesLinked += 1;
    }

    const summary = {
      authorities: { created: authoritiesCreated.length, reused: AUTHORITIES.length - authoritiesCreated.length },
      profiles: { created: profilesCreated.length, reused: FRAMEWORK_CATALOGUE.length - profilesCreated.length },
      versions: {
        created: pending.length,
        reused: existingVersions.length,
        links_verified: linkOk,
        links_not_conclusive: linkInconclusive,
        awaiting_manual_verification: pending.length - linkOk,
        notes: linkNotes,
      },
      frameworks_linked: frameworksLinked,
      articles_linked: articlesLinked,
    };

    await writeLegalAuditLog(
      base44,
      "legal_repository_seeded",
      JSON.stringify(summary),
      "LegalDocumentVersion",
      "",
      actor,
    );

    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status || 500 });
  }
});
