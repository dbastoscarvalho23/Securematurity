/**
 * Estruturas dos rascunhos. As dos relatórios seguem, alínea a alínea, os artigos do Decreto-Lei n.º 125/2025
 * (RJC): a estrutura vem da lei e não do modelo; o modelo só redige o texto de cada secção.
 * `fixed: true` = secção preenchida pelo código (dados de contacto, estatísticas), nunca pela IA.
 */

export const MEASURE_TEMPLATES = {
  policy: { label: 'Política', sections: [
    ['objetivo', 'Objetivo e âmbito'], ['requisitos', 'Requisitos aplicáveis'], ['regras', 'Regras'],
    ['responsabilidades', 'Papéis e responsabilidades'], ['registos', 'Registos e evidências'], ['revisao', 'Revisão e aprovação'],
  ] },
  procedure: { label: 'Procedimento', sections: [
    ['objetivo', 'Objetivo'], ['ambito', 'Âmbito'], ['responsaveis', 'Responsáveis'], ['passos', 'Passos'],
    ['registos', 'Registos produzidos'], ['revisao', 'Revisão'],
  ] },
  record: { label: 'Modelo de registo', sections: [
    ['campos', 'Campos do registo'], ['instrucoes', 'Instruções de preenchimento'], ['periodicidade', 'Periodicidade e responsável'],
  ] },
  evidence_plan: { label: 'Plano de evidências', sections: [
    ['criterio', 'Critério de verificação'], ['evidencias', 'Evidências a recolher'], ['obtencao', 'Como obter cada evidência'],
    ['periodicidade', 'Periodicidade e validade'],
  ] },
};

const DL = 'Decreto-Lei n.º 125/2025';
export const REPORT_TEMPLATES = {
  incident_initial: { label: 'Notificação inicial (até 24 h)', articles: ['41.º', '42.º'], sections: [
    ['a', `${DL}, art. 42.º, n.º 2, alínea a)`, 'Representante da entidade para contacto', true],
    ['b', `${DL}, art. 42.º, n.º 2, alínea b)`, 'Data e hora do início ou da deteção do incidente'],
    ['c', `${DL}, art. 42.º, n.º 2, alínea c)`, 'Descrição do incidente (categoria da causa e efeitos, segundo a taxonomia do CNCS)'],
    ['d', `${DL}, art. 42.º, n.º 2, alínea d)`, 'Estimativa do impacto (utilizadores afetados, duração, distribuição geográfica e impacto transfronteiriço, outra informação)'],
  ] },
  incident_update: { label: 'Atualização da notificação inicial (até 72 h)', articles: ['42.º'], sections: [
    ['revisao', `${DL}, art. 42.º, n.º 3`, 'Revisão da informação da notificação inicial'],
    ['avaliacao', `${DL}, art. 42.º, n.º 3`, 'Avaliação inicial: gravidade, impacto e indicadores de exposição a riscos, se disponíveis'],
  ] },
  incident_end: { label: 'Notificação do fim de impacto significativo (até 24 h)', articles: ['43.º'], sections: [
    ['a', `${DL}, art. 43.º, n.º 2, alínea a)`, 'Atualização da informação da notificação inicial'],
    ['b', `${DL}, art. 43.º, n.º 2, alínea b)`, 'Medidas adotadas para a resolução do incidente'],
    ['c', `${DL}, art. 43.º, n.º 2, alínea c)`, 'Situação de impacto no momento da perda de impacto significativo (utilizadores, duração, distribuição geográfica, tempo estimado de recuperação)'],
  ] },
  incident_interim: { label: 'Relatório intercalar', articles: ['44.º'], sections: [
    ['a', `${DL}, art. 44.º, n.º 4, alínea a)`, 'Atualização da informação da notificação inicial'],
    ['b', `${DL}, art. 44.º, n.º 4, alínea b)`, 'Medidas adotadas para a resolução do incidente'],
    ['c', `${DL}, art. 44.º, n.º 4, alínea c)`, 'Situação de impacto atual (utilizadores, duração, distribuição geográfica, tempo estimado de recuperação)'],
  ] },
  incident_final: { label: 'Relatório final (30 dias úteis)', articles: ['44.º'], sections: [
    ['a', `${DL}, art. 44.º, n.º 2, alínea a)`, 'Data e hora em que o incidente assumiu impacto significativo'],
    ['b', `${DL}, art. 44.º, n.º 2, alínea b)`, 'Data e hora em que o incidente perdeu impacto significativo'],
    ['c', `${DL}, art. 44.º, n.º 2, alínea c)`, 'Impacto do incidente e descrição (utilizadores, duração, distribuição geográfica, categoria da causa e efeitos)'],
    ['d', `${DL}, art. 44.º, n.º 2, alínea d)`, 'Medidas adotadas para mitigar o incidente'],
    ['e', `${DL}, art. 44.º, n.º 2, alínea e)`, 'Situação residual do impacto e comunicações a outras autoridades (Ministério Público, CNPD, autoridades setoriais)'],
  ] },
  annual: { label: 'Relatório anual', articles: ['30.º'], sections: [
    ['a', `${DL}, art. 30.º, n.º 1, alínea a)`, 'Principais atividades em matéria de segurança das redes e dos serviços de informação'],
    ['b', `${DL}, art. 30.º, n.º 1, alínea b)`, 'Estatística trimestral dos incidentes (número e tipo)', true],
    ['c', `${DL}, art. 30.º, n.º 1, alínea c)`, 'Análise agregada dos incidentes com impacto significativo'],
    ['d', `${DL}, art. 30.º, n.º 1, alínea d)`, 'Recomendações de atividades, medidas ou práticas de melhoria'],
    ['e', `${DL}, art. 30.º, n.º 1, alínea e)`, 'Problemas identificados e medidas implementadas na sequência dos incidentes'],
    ['f', `${DL}, art. 30.º, n.º 1, alínea f)`, 'Outra informação relevante'],
  ] },
};

/** Expressões que não devem aparecer nos textos (guia de escrita, docs/style/pt-pt.md). */
export const BANNED_PHRASES = [
  'desbloqueie', 'potencie', 'eleve a', 'revolucion', 'transforme a sua', 'mergulh', 'de forma fácil e intuitiva', 'em poucos cliques',
  'solução robusta', 'abordagem holística', 'tudo num só lugar', 'aproveite ao máximo', 'sem complicações', 'parceiro de confiança',
  'no mundo atual', 'no panorama atual', 'é importante notar', 'é crucial', 'em suma', 'vale a pena salientar', 'usuário', 'tela',
];
