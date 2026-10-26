/**
 * Jornada de conformidade — Regime Jurídico da Cibersegurança (DL 125/2025) e Regulamento n.º 756/2026.
 * Cada tarefa indica a disposição oficial em que se baseia (texto integral na Biblioteca Legal).
 * Nota: os arts. 27.º, n.os 1 e 2, 28.º a 30.º e 33.º e as alíneas b), c) e f) do n.º 1 do art. 61.º do RJC produzem efeitos 24 meses após a regulamentação
 * (DL 125/2025, art. 10.º, n.º 2) — o Reg. 756/2026 (publicado a 22-06-2026) é essa regulamentação (art. 1.º).
 */
export const JOURNEY_FRAMEWORK = 'RJC_2026';
export const LEGACY_JOURNEY_FRAMEWORK = 'RJCS';

/** Data em que os artigos do RJC marcados com `from2028` passam a produzir efeitos (DL 125/2025, art. 10.º, n.º 2). */
export const JOURNEY_EFFECTIVE_2028 = '2028-06-22';

/**
 * Cada tarefa tem um título simples (o que fazer e, quando existe, o prazo) e a base legal em `basis`,
 * com as disposições oficiais completas na Biblioteca Legal. `from2028` assinala as obrigações que só
 * produzem efeitos a 22-06-2028.
 */
export const JOURNEY_TEMPLATE_PT = [
  {
    section: 'A. Âmbito, autoidentificação e qualificação', section_order: 1,
    tasks: [
      { title: 'Confirmar se a entidade está abrangida pelo regime', basis: 'RJC, arts. 3.º, 4.º, 6.º e 7.º e Anexos I e II; Reg. 756/2026, art. 4.º, n.os 6 e 7' },
      { title: 'Criar a conta da entidade na plataforma do CNCS', basis: 'Reg. 756/2026, arts. 6.º e 7.º' },
      { title: 'Fazer a autoidentificação no CNCS (30 dias após iniciar atividade; 60 dias se já está em atividade)', basis: 'RJC, art. 8.º, n.º 1; Reg. 756/2026, art. 8.º' },
      { title: 'Responder ao projeto de qualificação do CNCS em 10 dias úteis', basis: 'Reg. 756/2026, art. 9.º, n.os 1 a 3' },
      { title: 'Registar na AnkoraOne a qualificação e o nível notificados pelo CNCS', basis: 'RJC, art. 8.º, n.º 5; Reg. 756/2026, art. 9.º, n.os 4 a 6 e 10' },
      { title: 'Completar o registo definitivo no CNCS', basis: 'RJC, art. 35.º; Reg. 756/2026, art. 10.º' },
      { title: 'Manter os dados do registo atualizados (alterações em 30 dias úteis)', basis: 'RJC, art. 35.º, n.os 3 e 4; Reg. 756/2026, art. 11.º' },
    ],
  },
  {
    section: 'B. Governação e responsáveis', section_order: 2,
    tasks: [
      { title: 'A gestão aprova as medidas de cibersegurança e acompanha a sua aplicação', basis: 'RJC, art. 25.º, n.º 1, alíneas a) e b)' },
      { title: 'A gestão garante formação regular em cibersegurança', basis: 'RJC, art. 25.º, n.º 1, alínea d)' },
      { title: 'Nomear o responsável de cibersegurança e comunicá-lo em 20 dias úteis', basis: 'RJC, art. 31.º, n.os 1, 3 e 4; Reg. 756/2026, art. 14.º' },
      { title: 'Comunicar logo a substituição do responsável de cibersegurança', basis: 'RJC, art. 31.º, n.º 5' },
      { title: 'Indicar o ponto de contacto permanente em 20 dias úteis', basis: 'RJC, art. 32.º; Reg. 756/2026, art. 15.º' },
    ],
  },
  {
    section: 'C. Gestão dos riscos', section_order: 3,
    tasks: [
      { title: 'Pôr em prática a gestão dos riscos de cibersegurança', basis: 'RJC, art. 26.º, n.os 1 a 3' },
      { title: 'Analisar os riscos de todos os ativos, pelo menos uma vez por ano', basis: 'RJC, art. 29.º; Reg. 756/2026, art. 31.º, n.os 1 a 3', from2028: true },
      { title: 'Avaliar o risco que fica depois de aplicar as medidas (risco residual)', basis: 'RJC, art. 29.º, n.º 2; Reg. 756/2026, art. 31.º, n.º 4', from2028: true },
    ],
  },
  {
    section: 'D. Medidas de cibersegurança', section_order: 4,
    tasks: [
      { title: 'Aplicar as medidas mínimas do seu nível (ver Biblioteca Legal › Conformidade)', basis: 'Reg. 756/2026, art. 30.º e Anexos III e IV; RJC, art. 33.º', from2028: true },
      { title: 'Cobrir as nove áreas obrigatórias: incidentes, continuidade, fornecedores, desenvolvimento, eficácia, formação, cifra, acessos e ativos, autenticação forte', basis: 'RJC, art. 27.º, n.º 1', from2028: true },
      { title: 'Corrigir sem demora as falhas encontradas', basis: 'RJC, art. 27.º, n.º 2', from2028: true },
      { title: 'Enviar ao CNCS a lista de ativos acessíveis pela Internet e atualizá-la todos os anos', basis: 'Reg. 756/2026, art. 32.º' },
      { title: 'Adaptar-se em 6 meses a uma nova qualificação ou a novas medidas', basis: 'RJC, art. 26.º, n.º 8' },
    ],
  },
  {
    section: 'E. Cadeia de abastecimento', section_order: 5,
    tasks: [
      { title: 'Identificar os fornecedores críticos e avaliar o seu risco todos os anos', basis: 'Reg. 756/2026, Anexo III (QNRCS GR.CA-7)' },
      { title: 'Avaliar as práticas de segurança e a qualidade dos produtos de cada fornecedor', basis: 'RJC, art. 28.º, alíneas a) a c)', from2028: true },
      { title: 'Ter em conta as avaliações coordenadas de risco e as restrições a equipamentos', basis: 'RJC, art. 28.º, alíneas d) e e)', from2028: true },
    ],
  },
  {
    section: 'F. Incidentes', section_order: 6,
    tasks: [
      { title: 'Definir quando um incidente é significativo', basis: 'RJC, art. 40.º, n.os 3 e 4; Reg. 756/2026, art. 20.º, n.º 3' },
      { title: 'Preparar as notificações ao CNCS: 24 h, 72 h, fim do impacto em 24 h e relatório final em 30 dias úteis', basis: 'RJC, arts. 41.º a 44.º; Reg. 756/2026, art. 20.º' },
      { title: 'Ter canais alternativos (email ou telefone) se a plataforma falhar', basis: 'Reg. 756/2026, art. 17.º e art. 20.º, n.º 4' },
      { title: 'Informar os clientes afetados por incidentes significativos', basis: 'RJC, art. 48.º' },
      { title: 'Cumprir as outras notificações obrigatórias (MP, PJ, CNPD, GNS)', basis: 'RJC, art. 40.º, n.º 5' },
    ],
  },
  {
    section: 'G. Formação e sensibilização', section_order: 7,
    tasks: [
      { title: 'Ter e cumprir um plano de formação em cibersegurança para todo o pessoal', basis: 'Reg. 756/2026, Anexo III (QNRCS PR.FC-1 e PR.FC-2)' },
      { title: 'Dar formação específica às equipas técnicas e à gestão', basis: 'Reg. 756/2026, Anexo III (QNRCS PR.FC-2)' },
      { title: 'Fazer testes e exercícios e aplicar as melhorias', basis: 'Reg. 756/2026, Anexo III (QNRCS ID.MC-2)' },
    ],
  },
  {
    section: 'H. Relatórios, certificação e supervisão', section_order: 8,
    tasks: [
      { title: 'Enviar o relatório anual (essenciais: até ao último dia útil de janeiro)', basis: 'RJC, art. 30.º; Reg. 756/2026, art. 13.º', from2028: true },
      { title: 'Comunicar alterações às certificações (revogação em 72 h; restantes em 10 dias úteis)', basis: 'Reg. 756/2026, art. 27.º, n.º 6' },
      { title: 'Ter as evidências organizadas para a supervisão do CNCS', basis: 'RJC, arts. 54.º e 55.º' },
      { title: 'Comunicar a adesão a acordos de partilha de informação', basis: 'RJC, art. 24.º, n.os 6 e 7' },
    ],
  },
];

export const JOURNEY_TEMPLATE_EN = [
  {
    section: 'A. Scope, self-identification and qualification', section_order: 1,
    tasks: [
      { title: 'Confirm whether the entity is covered by the regime', basis: 'RJC arts. 3, 4, 6 and 7 and Annexes I and II; Reg. 756/2026, art. 4(6)-(7)' },
      { title: 'Create the entity account on the CNCS platform', basis: 'Reg. 756/2026, arts. 6 and 7' },
      { title: 'Self-identify with the CNCS (30 days after starting activity; 60 days if already operating)', basis: 'RJC art. 8(1); Reg. 756/2026, art. 8' },
      { title: 'Reply to the CNCS draft qualification within 10 working days', basis: 'Reg. 756/2026, art. 9(1)-(3)' },
      { title: 'Record in AnkoraOne the qualification and level notified by the CNCS', basis: 'RJC art. 8(5); Reg. 756/2026, art. 9(4)-(6) and (10)' },
      { title: 'Complete the definitive registration with the CNCS', basis: 'RJC art. 35; Reg. 756/2026, art. 10' },
      { title: 'Keep the registration data up to date (changes within 30 working days)', basis: 'RJC art. 35(3)-(4); Reg. 756/2026, art. 11' },
    ],
  },
  {
    section: 'B. Governance and accountable roles', section_order: 2,
    tasks: [
      { title: 'Management approves the cybersecurity measures and oversees them', basis: 'RJC art. 25(1)(a)-(b)' },
      { title: 'Management ensures regular cybersecurity training', basis: 'RJC art. 25(1)(d)' },
      { title: 'Appoint the cybersecurity officer and report them within 20 working days', basis: 'RJC art. 31(1), (3), (4); Reg. 756/2026, art. 14' },
      { title: 'Report a change of cybersecurity officer without delay', basis: 'RJC art. 31(5)' },
      { title: 'Designate the permanent point of contact within 20 working days', basis: 'RJC art. 32; Reg. 756/2026, art. 15' },
    ],
  },
  {
    section: 'C. Risk management', section_order: 3,
    tasks: [
      { title: 'Put cybersecurity risk management in place', basis: 'RJC art. 26(1)-(3)' },
      { title: 'Analyse the risks to all assets at least once a year', basis: 'RJC art. 29; Reg. 756/2026, art. 31(1)-(3)', from2028: true },
      { title: 'Assess the risk left after applying the measures (residual risk)', basis: 'RJC art. 29(2); Reg. 756/2026, art. 31(4)', from2028: true },
    ],
  },
  {
    section: 'D. Cybersecurity measures', section_order: 4,
    tasks: [
      { title: 'Apply the minimum measures for your level (see Legal Library › Compliance)', basis: 'Reg. 756/2026, art. 30 and Annexes III and IV; RJC art. 33', from2028: true },
      { title: 'Cover the nine mandatory areas: incidents, continuity, suppliers, development, effectiveness, training, encryption, access and assets, strong authentication', basis: 'RJC art. 27(1)', from2028: true },
      { title: 'Fix the gaps found without delay', basis: 'RJC art. 27(2)', from2028: true },
      { title: 'Send the CNCS the list of Internet-facing assets and update it every year', basis: 'Reg. 756/2026, art. 32' },
      { title: 'Adapt within 6 months to a new qualification or new measures', basis: 'RJC art. 26(8)' },
    ],
  },
  {
    section: 'E. Supply chain', section_order: 5,
    tasks: [
      { title: 'Identify critical suppliers and assess their risk every year', basis: 'Reg. 756/2026, Annex III (QNRCS GR.CA-7)' },
      { title: 'Assess each supplier’s security practices and product quality', basis: 'RJC art. 28(a)-(c)', from2028: true },
      { title: 'Take coordinated risk assessments and equipment restrictions into account', basis: 'RJC art. 28(d)-(e)', from2028: true },
    ],
  },
  {
    section: 'F. Incidents', section_order: 6,
    tasks: [
      { title: 'Define when an incident is significant', basis: 'RJC art. 40(3)-(4); Reg. 756/2026, art. 20(3)' },
      { title: 'Prepare the CNCS notifications: 24h, 72h, end of impact in 24h and final report in 30 working days', basis: 'RJC arts. 41-44; Reg. 756/2026, art. 20' },
      { title: 'Have alternative channels (email or phone) if the platform is down', basis: 'Reg. 756/2026, arts. 17 and 20(4)' },
      { title: 'Inform customers affected by significant incidents', basis: 'RJC art. 48' },
      { title: 'Meet the other mandatory notifications (Prosecutor, Judicial Police, CNPD, GNS)', basis: 'RJC art. 40(5)' },
    ],
  },
  {
    section: 'G. Training and awareness', section_order: 7,
    tasks: [
      { title: 'Have and follow a cybersecurity training plan for all staff', basis: 'Reg. 756/2026, Annex III (QNRCS PR.FC-1 and PR.FC-2)' },
      { title: 'Give specific training to technical teams and management', basis: 'Reg. 756/2026, Annex III (QNRCS PR.FC-2)' },
      { title: 'Run tests and exercises and apply the improvements', basis: 'Reg. 756/2026, Annex III (QNRCS ID.MC-2)' },
    ],
  },
  {
    section: 'H. Reporting, certification and supervision', section_order: 8,
    tasks: [
      { title: 'Send the annual report (essential entities: by the last working day of January)', basis: 'RJC art. 30; Reg. 756/2026, art. 13', from2028: true },
      { title: 'Report changes to certifications (revocation in 72h; others in 10 working days)', basis: 'Reg. 756/2026, art. 27(6)' },
      { title: 'Keep the evidence organised for CNCS supervision', basis: 'RJC arts. 54 and 55' },
      { title: 'Report joining information-sharing arrangements', basis: 'RJC art. 24(6)-(7)' },
    ],
  },
];

/** Normaliza uma tarefa (modelo atual em objeto, modelo anterior em texto). */
export function journeyTask(task) {
  if (!task) return null;
  return typeof task === 'string' ? { title: task, basis: '', from2028: false } : task;
}

/** Texto guardado em ComplianceChecklist.task_text: título e base legal. */
export function journeyTaskText(task) {
  const t = journeyTask(task);
  if (!t) return '';
  return t.basis ? `${t.title} (${t.basis})` : t.title;
}
