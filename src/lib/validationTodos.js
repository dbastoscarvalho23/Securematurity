/**
 * Tarefas em aberto registadas no relatório de validação.
 *
 * Não são achados de validação (esses vivem em `validationReportData.js` e
 * `platformAssessmentData.js`) nem residuais de uma correção já aplicada
 * (`FOLLOW_UPS`): são trabalho combinado, fora das rondas de inspeção, que fica
 * registado aqui para não se perder. A lista é lida pelo modelo
 * (`validationReportModel.js`) e a página não escreve nenhuma entrada.
 *
 * Um trabalho por fases (como o repositório legal) entra como uma entrada-mãe
 * (o trabalho no seu todo) seguida de uma entrada por fase, com o id da mãe e o
 * número da fase (`KB1` + `KB1.0` … `KB1.4`). A entrega e o critério de
 * aceitação de cada fase são os do plano, transcritos aqui — a lista de fases
 * não se inventa no relatório.
 */

export const TODO_LIST = [
  {
    id: 'KB1',
    status: 'pendente',
    title: 'Repositório legal versionado na base de conhecimento (Layer 1)',
    note:
      'Plano escrito e por executar: transformar /knowledge-base num repositório normativo da app, com links das plataformas das entidades competentes e versionamento. Três entidades novas (LegalDocumentVersion, FrameworkProfile, CompetentAuthority), catálogo único de frameworks (hoje há três listas divergentes), leitura para todos os autenticados e escrita só por master_admin através de manageLegalRepository, e a ficha «at a glance» por framework (entidade competente, missão, áreas de incidência, objetivos, aplicações, obrigações e coimas). Quatro decisões continuam por confirmar antes de implementar (§7 do plano): direitos de autor (ISO/IEC 27001 e CIS Controls levam metadados e link oficial, nunca o texto integral), estabilidade dos links oficiais, idioma da ficha (só PT ou PT/EN) e âmbito de frameworks (os 5 dos artigos ou os 7 do catálogo, com QNRC e ENISA).',
    next: 'As fases KB1.0 a KB1.4, pela ordem do plano — a primeira é KB1.0.',
    source: 'docs/KB_LEGAL_REPOSITORY_PLAN.md',
  },
  {
    id: 'KB1.0',
    status: 'pendente',
    title: 'P0 — catálogo único de frameworks + CompetentAuthority + FrameworkProfile (entidades e seed)',
    note:
      'Entrega: consolidar as três listas divergentes (kbFrameworks.js, frameworkConstants.js, frameworkSeed.js) no par espelhado base44/shared/frameworkCatalogue.ts ↔ src/lib/frameworkCatalogue.js, no padrão do licenciamento, e criar as entidades CompetentAuthority (regulador, supervisor, auditor, normalizador, acreditação — com sítio oficial, base legal e registo de sanções) e FrameworkProfile (missão, áreas de incidência, objetivos, aplicabilidade, obrigações com prazos, coimas e certificabilidade), com seed idempotente. Critério de aceitação: a ficha existe para os frameworks do âmbito e é legível na app.',
    source: 'docs/KB_LEGAL_REPOSITORY_PLAN.md §3.6, §6, §8',
  },
  {
    id: 'KB1.1',
    status: 'pendente',
    title: 'P1 — LegalDocumentVersion + manageLegalRepository (versões, imutabilidade, auditoria)',
    note:
      'Entrega: entidade LegalDocumentVersion (uma linha por edição, cadeia de substituição por supersedes_id, vigência, link oficial, hash da cópia arquivada e ciclo de revisão) e a função manageLegalRepository com o selector de ações upsert_profile · add_version · supersede_version · verify · withdraw · archive. Nenhum caminho altera o texto de uma versão publicada — só metadados de verificação. Leitura para todos os autenticados, escrita master_admin (grc_analyst como revisor), AuditLog com o ator real por ação e nenhuma escrita a partir do browser. Critério de aceitação: uma nova versão substitui a anterior e a linha temporal reflete o histórico.',
    source: 'docs/KB_LEGAL_REPOSITORY_PLAN.md §3.1, §4, §8',
  },
  {
    id: 'KB1.2',
    status: 'pendente',
    title: 'P2 — interface do repositório: landing, ficha de framework e painel de versões',
    note:
      'Entrega: /knowledge-base com dois modos (Repositório legal por omissão e Artigos, o catálogo editorial atual) e a ficha /knowledge-base/framework/:code com o bloco «Em resumo», a linha temporal das versões (atual, substituídas, futuras) com link oficial e vigência, a entidade competente com ligação ao sítio e ao registo de sanções, e o conteúdo relacionado; o modo de edição (ficha + nova versão) para os papéis de conteúdo. Critério de aceitação: percorrer framework → versão → link oficial sem sair da base de conhecimento. Conformidade com a casa: título único do TopBar, cores por palette.js, strings por chaves de tradução e entradas coerentes em PAGE_TITLE_KEYS, rbac.js e sidebarGroups.js.',
    source: 'docs/KB_LEGAL_REPOSITORY_PLAN.md §5, §8',
  },
  {
    id: 'KB1.3',
    status: 'pendente',
    title: 'P3 — KnowledgeArticle.legal_refs[] e blocos de conteúdo relacionado',
    note:
      'Entrega: legal_refs[] nos artigos ({ framework_code, version_id, document_id }) e os blocos de conteúdo relacionado na ficha do framework (artigos editoriais e controlos do layer 2). Regra de dependência do plano: nada no layer 2+ cita uma norma sem apontar para a versão do layer 1, que é o que torna o histórico auditável. Critério de aceitação: um artigo editorial mostra a versão normativa a que se refere.',
    source: 'docs/KB_LEGAL_REPOSITORY_PLAN.md §2, §3.5, §8',
  },
  {
    id: 'KB1.4',
    status: 'pendente',
    title: 'P4 — frescura: alerta de revisão vencida e verificação periódica',
    note:
      'Entrega: sinal de revisão vencida na ficha e na grelha (review_due_at e verified_at, com «verificado em …» sempre visível) e a verificação periódica dos links e da versão oficial. Critério de aceitação: uma ficha com revisão vencida sinaliza o estado. Os layers 2 a 5 (requisitos mapeados, guias de implementação, editorial, apoio) ficam fora deste plano: só se especificam com o Layer 1 consolidado.',
    source: 'docs/KB_LEGAL_REPOSITORY_PLAN.md §4, §8',
  },
];
