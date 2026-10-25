/**
 * Jornada de conformidade — Regime Jurídico da Cibersegurança (DL 125/2025) e Regulamento n.º 756/2026.
 * Cada tarefa indica a disposição oficial em que se baseia (texto integral na Biblioteca Legal).
 * Nota: os arts. 27.º, n.os 1 e 2, 28.º a 30.º e 33.º e as alíneas b), c) e f) do n.º 1 do art. 61.º do RJC produzem efeitos 24 meses após a regulamentação
 * (DL 125/2025, art. 10.º, n.º 2) — o Reg. 756/2026 (publicado a 22-06-2026) é essa regulamentação (art. 1.º).
 */
export const JOURNEY_FRAMEWORK = 'RJC_2026';
export const LEGACY_JOURNEY_FRAMEWORK = 'RJCS';

const EFF = ' — produz efeitos a 22-06-2028 (DL 125/2025, art. 10.º, n.º 2)';
const EFF_EN = ' — takes effect on 22-06-2028 (Decree-Law 125/2025, art. 10(2))';

export const JOURNEY_TEMPLATE_PT = [
  {
    section: 'A. Âmbito, autoidentificação e qualificação', section_order: 1,
    tasks: [
      '1. Verificar se a entidade está abrangida: setores e tipos de entidade dos Anexos I e II, dimensão e exclusões (RJC, arts. 3.º, 4.º, 6.º e 7.º; instrumento de apoio da plataforma — Reg. 756/2026, art. 4.º, n.os 6 e 7).',
      '2. Criar a conta da entidade na plataforma eletrónica do CNCS, com autenticação de nível de garantia elevado e perfis do representante legal, do responsável de cibersegurança e do ponto de contacto permanente (Reg. 756/2026, arts. 6.º e 7.º).',
      '3. Efetuar a autoidentificação na plataforma: 30 dias após o início da atividade ou, para entidades já em atividade, 60 dias após a disponibilização da plataforma (RJC, art. 8.º, n.º 1; Reg. 756/2026, art. 8.º).',
      '4. Pronunciar-se sobre o projeto de decisão de qualificação no prazo de 10 dias úteis (Reg. 756/2026, art. 9.º, n.os 1 a 3).',
      '5. Registar na AnkoraOne a qualificação (essencial, importante ou pública relevante — Grupo A ou B) e o nível de conformidade notificados pelo CNCS (RJC, art. 8.º, n.º 5; Reg. 756/2026, art. 9.º, n.os 4 a 6 e 10).',
      '6. Completar o registo definitivo com a informação do art. 35.º do RJC (Reg. 756/2026, art. 10.º).',
      '7. Manter os dados permanentemente atualizados e comunicar alterações no prazo de 30 dias úteis — 3 meses para os prestadores de serviços digitais (RJC, art. 35.º, n.os 3 e 4; Reg. 756/2026, art. 11.º).',
    ],
  },
  {
    section: 'B. Governação e responsáveis', section_order: 2,
    tasks: [
      '1. Os órgãos de gestão aprovam as medidas de gestão dos riscos de cibersegurança e supervisionam a sua aplicação (RJC, art. 25.º, n.º 1, alíneas a) e b)).',
      '2. Os órgãos de gestão asseguram a realização, com periodicidade regular, de ações de formação em cibersegurança (RJC, art. 25.º, n.º 1, alínea d)).',
      '3. Designar o responsável de cibersegurança e comunicá-lo na plataforma no prazo de 20 dias úteis; entidades já em atividade: a contar da notificação da qualificação (RJC, art. 31.º, n.os 1, 3 e 4; Reg. 756/2026, art. 14.º).',
      '4. Comunicar sem demora injustificada a substituição do responsável de cibersegurança (RJC, art. 31.º, n.º 5).',
      '5. Indicar o ponto de contacto permanente (24/7 em períodos de ativação) no prazo de 20 dias úteis e comunicar imediatamente quaisquer alterações (RJC, art. 32.º; Reg. 756/2026, art. 15.º).',
    ],
  },
  {
    section: 'C. Gestão dos riscos', section_order: 3,
    tasks: [
      '1. Implementar o sistema de gestão de riscos de cibersegurança (RJC, art. 26.º, n.os 1 a 3).',
      '2. Analisar e gerir os riscos de todos os ativos, pelo menos uma vez por ano e após alerta do CNCS, e documentar a análise (RJC, art. 29.º; Reg. 756/2026, art. 31.º, n.os 1 a 3)' + EFF + '.',
      '3. Analisar o risco residual após a adoção das medidas de cibersegurança (RJC, art. 29.º, n.º 2; Reg. 756/2026, art. 31.º, n.º 4)' + EFF + '.',
    ],
  },
  {
    section: 'D. Medidas de cibersegurança', section_order: 4,
    tasks: [
      '1. Aplicar as medidas mínimas do nível de conformidade (Reg. 756/2026, Anexo III) ou do grupo da entidade pública relevante (Anexo IV), incluindo as dos níveis inferiores (art. 30.º) — acompanhar em Biblioteca Legal › Conformidade. Para as entidades públicas relevantes, a obrigação consta do art. 33.º do RJC' + EFF + '.',
      '2. Cobrir as medidas do art. 27.º, n.º 1, do RJC: tratamento de incidentes; continuidade (cópias de segurança, recuperação de desastres, gestão de crises); cadeia de abastecimento; aquisição, desenvolvimento e manutenção, incluindo vulnerabilidades; avaliação da eficácia; ciber-higiene e formação; criptografia; recursos humanos, controlo de acessos e gestão de ativos; autenticação multifator e comunicações seguras' + EFF + '.',
      '3. Adotar sem demora injustificada as medidas corretivas necessárias (RJC, art. 27.º, n.º 2)' + EFF + '.',
      '4. Elaborar e comunicar a lista de ativos diretamente acessíveis através da Internet: versão inicial até 31 de janeiro do ano seguinte à notificação da qualificação ou em 6 meses, o que ocorrer primeiro; depois, anualmente (Reg. 756/2026, art. 32.º).',
      '5. Adaptar-se a uma nova qualificação ou a novas medidas mínimas no prazo de 6 meses (RJC, art. 26.º, n.º 8).',
    ],
  },
  {
    section: 'E. Cadeia de abastecimento', section_order: 5,
    tasks: [
      '1. Identificar os fornecedores e prestadores de serviços críticos e avaliar os riscos da cadeia de abastecimento pelo menos uma vez por ano (QNRCS GR.CA-7, Reg. 756/2026, Anexo III).',
      '2. Considerar as vulnerabilidades específicas de cada fornecedor, a qualidade dos produtos e as práticas de cibersegurança dos fornecedores, incluindo o desenvolvimento seguro (RJC, art. 28.º, alíneas a) a c))' + EFF + '.',
      '3. Considerar as avaliações coordenadas de riscos e as decisões de restrição ou exclusão de equipamentos (RJC, art. 28.º, alíneas d) e e))' + EFF + '.',
    ],
  },
  {
    section: 'F. Incidentes', section_order: 6,
    tasks: [
      '1. Definir os critérios de incidente significativo (RJC, art. 40.º, n.os 3 e 4; Reg. 756/2026, art. 20.º, n.º 3).',
      '2. Preparar as notificações na plataforma: inicial em 24 h, atualização até 72 h, fim de impacto em 24 h e relatório final em 30 dias úteis (RJC, arts. 41.º a 44.º; Reg. 756/2026, art. 20.º).',
      '3. Prever os canais alternativos em caso de indisponibilidade (correio eletrónico ou telefone) (Reg. 756/2026, art. 17.º e art. 20.º, n.º 4).',
      '4. Comunicar os incidentes significativos aos destinatários dos serviços, quando aplicável (RJC, art. 48.º).',
      '5. Cumprir as restantes obrigações de notificação (Ministério Público, Polícia Judiciária, CNPD, GNS) (RJC, art. 40.º, n.º 5).',
    ],
  },
  {
    section: 'G. Formação e sensibilização', section_order: 7,
    tasks: [
      '1. Definir e executar o plano de sensibilização e formação em cibersegurança de todo o pessoal (QNRCS PR.FC-1 e PR.FC-2).',
      '2. Assegurar formação específica do pessoal com funções especializadas em cibersegurança e dos órgãos de gestão, direção e administração (QNRCS PR.FC-2).',
      '3. Realizar testes e exercícios de cibersegurança e incorporar as melhorias identificadas (QNRCS ID.MC-2).',
    ],
  },
  {
    section: 'H. Relatórios, certificação e supervisão', section_order: 8,
    tasks: [
      '1. Relatório anual: entidades essenciais até ao último dia útil de janeiro; entidades importantes quando solicitado — segundo os modelos obrigatórios (RJC, art. 30.º; Reg. 756/2026, art. 13.º)' + EFF + '.',
      '2. Comunicar a revogação de certificações em 72 horas e a suspensão, renovação ou alteração de âmbito em 10 dias úteis (Reg. 756/2026, art. 27.º, n.º 6).',
      '3. Organizar as evidências para a supervisão: ex ante para entidades essenciais, ex post para importantes e públicas relevantes (RJC, arts. 54.º e 55.º).',
      '4. Notificar a participação em acordos de partilha de informações sobre cibersegurança (RJC, art. 24.º, n.os 6 e 7).',
    ],
  },
];

export const JOURNEY_TEMPLATE_EN = [
  {
    section: 'A. Scope, self-identification and qualification', section_order: 1,
    tasks: [
      '1. Check whether the entity is covered: sectors and types of entity in Annexes I and II, size and exclusions (RJC arts. 3, 4, 6 and 7; platform scope-checking tool — Reg. 756/2026, art. 4(6)-(7)).',
      '2. Create the entity account on the CNCS electronic platform, with high-assurance authentication and profiles for the legal representative, the cybersecurity officer and the permanent point of contact (Reg. 756/2026, arts. 6 and 7).',
      '3. Self-identify on the platform: within 30 days of starting activity or, for entities already operating, within 60 days of the platform becoming available (RJC art. 8(1); Reg. 756/2026, art. 8).',
      '4. Comment on the draft qualification decision within 10 working days (Reg. 756/2026, art. 9(1)-(3)).',
      '5. Record in AnkoraOne the qualification (essential, important or relevant public entity — Group A or B) and the conformity level notified by the CNCS (RJC art. 8(5); Reg. 756/2026, art. 9(4)-(6) and (10)).',
      '6. Complete the definitive registration with the information in RJC art. 35 (Reg. 756/2026, art. 10).',
      '7. Keep the data permanently up to date and report changes within 30 working days — 3 months for digital service providers (RJC art. 35(3)-(4); Reg. 756/2026, art. 11).',
    ],
  },
  {
    section: 'B. Governance and accountable roles', section_order: 2,
    tasks: [
      '1. Management bodies approve the cybersecurity risk-management measures and oversee their implementation (RJC art. 25(1)(a)-(b)).',
      '2. Management bodies ensure that cybersecurity training is carried out regularly (RJC art. 25(1)(d)).',
      '3. Appoint the cybersecurity officer and report them on the platform within 20 working days; entities already operating: counted from notification of the qualification (RJC art. 31(1), (3), (4); Reg. 756/2026, art. 14).',
      '4. Report the replacement of the cybersecurity officer without undue delay (RJC art. 31(5)).',
      '5. Designate the permanent point of contact (24/7 during activation periods) within 20 working days and report any change immediately (RJC art. 32; Reg. 756/2026, art. 15).',
    ],
  },
  {
    section: 'C. Risk management', section_order: 3,
    tasks: [
      '1. Implement the cybersecurity risk-management system (RJC art. 26(1)-(3)).',
      '2. Analyse and manage the risks to all assets, at least once a year and after a CNCS alert, and document the analysis (RJC art. 29; Reg. 756/2026, art. 31(1)-(3))' + EFF_EN + '.',
      '3. Analyse residual risk after adopting the cybersecurity measures (RJC art. 29(2); Reg. 756/2026, art. 31(4))' + EFF_EN + '.',
    ],
  },
  {
    section: 'D. Cybersecurity measures', section_order: 4,
    tasks: [
      '1. Apply the minimum measures for the conformity level (Reg. 756/2026, Annex III) or the relevant public entity group (Annex IV), including those of lower levels (art. 30) — track them in Legal Library › Compliance. For relevant public entities the obligation is in RJC art. 33' + EFF_EN + '.',
      '2. Cover the measures in RJC art. 27(1): incident handling; continuity (backups, disaster recovery, crisis management); supply chain; acquisition, development and maintenance, including vulnerabilities; effectiveness assessment; cyber hygiene and training; cryptography; human resources, access control and asset management; multi-factor authentication and secure communications' + EFF_EN + '.',
      '3. Take the necessary corrective measures without undue delay (RJC art. 27(2))' + EFF_EN + '.',
      '4. Prepare and submit the list of assets directly accessible from the Internet: initial version by 31 January of the year after the qualification notice or within 6 months, whichever comes first; then yearly (Reg. 756/2026, art. 32).',
      '5. Adapt to a new qualification or new minimum measures within 6 months (RJC art. 26(8)).',
    ],
  },
  {
    section: 'E. Supply chain', section_order: 5,
    tasks: [
      '1. Identify critical suppliers and service providers and assess supply-chain risks at least once a year (QNRCS GR.CA-7, Reg. 756/2026, Annex III).',
      '2. Take into account each supplier’s specific vulnerabilities, product quality and the suppliers’ cybersecurity practices, including secure development (RJC art. 28(a)-(c))' + EFF_EN + '.',
      '3. Take into account coordinated risk assessments and decisions restricting or excluding equipment (RJC art. 28(d)-(e))' + EFF_EN + '.',
    ],
  },
  {
    section: 'F. Incidents', section_order: 6,
    tasks: [
      '1. Define the criteria for a significant incident (RJC art. 40(3)-(4); Reg. 756/2026, art. 20(3)).',
      '2. Prepare the platform notifications: initial within 24h, update within 72h, end of impact within 24h and final report within 30 working days (RJC arts. 41-44; Reg. 756/2026, art. 20).',
      '3. Plan the alternative channels if the platform is unavailable (email or phone) (Reg. 756/2026, arts. 17 and 20(4)).',
      '4. Inform the recipients of the services of significant incidents, where applicable (RJC art. 48).',
      '5. Meet the other notification duties (Public Prosecutor, Judicial Police, CNPD, GNS) (RJC art. 40(5)).',
    ],
  },
  {
    section: 'G. Training and awareness', section_order: 7,
    tasks: [
      '1. Define and run the cybersecurity awareness and training plan for all staff (QNRCS PR.FC-1 and PR.FC-2).',
      '2. Provide specific training for staff with specialised cybersecurity roles and for management bodies (QNRCS PR.FC-2).',
      '3. Run cybersecurity tests and exercises and incorporate the improvements identified (QNRCS ID.MC-2).',
    ],
  },
  {
    section: 'H. Reporting, certification and supervision', section_order: 8,
    tasks: [
      '1. Annual report: essential entities by the last working day of January; important entities when requested — using the mandatory templates (RJC art. 30; Reg. 756/2026, art. 13)' + EFF_EN + '.',
      '2. Report revocation of certifications within 72 hours and suspension, renewal or change of scope within 10 working days (Reg. 756/2026, art. 27(6)).',
      '3. Organise the evidence for supervision: ex ante for essential entities, ex post for important and relevant public entities (RJC arts. 54 and 55).',
      '4. Notify participation in cybersecurity information-sharing arrangements (RJC art. 24(6)-(7)).',
    ],
  },
];
