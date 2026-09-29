/**
 * Tarefas em aberto registadas no relatório de validação.
 *
 * Não são achados de validação (esses vivem em `validationReportData.js` e
 * `platformAssessmentData.js`) nem residuais de uma correção já aplicada
 * (`FOLLOW_UPS`): são trabalho combinado, fora das rondas de inspeção, que fica
 * registado aqui para não se perder. A lista é lida pelo modelo
 * (`validationReportModel.js`) e a página não escreve nenhuma entrada.
 */

export const TODO_LIST = [
  {
    id: 'KB1',
    status: 'pendente',
    title: 'Repositório legal versionado na base de conhecimento (Layer 1)',
    note:
      'Plano escrito e por executar: transformar /knowledge-base num repositório normativo da app, com links das plataformas das entidades competentes e versionamento. Três entidades novas (LegalDocumentVersion, FrameworkProfile, CompetentAuthority), catálogo único de frameworks (hoje há três listas divergentes), leitura para todos os autenticados e escrita só por master_admin através de manageLegalRepository, e a ficha «at a glance» por framework (entidade competente, missão, áreas de incidência, objetivos, aplicações, obrigações e coimas).',
    next:
      'P0 do plano: catálogo único de frameworks + CompetentAuthority + FrameworkProfile (entidades e seed).',
    source: 'docs/KB_LEGAL_REPOSITORY_PLAN.md',
  },
];
