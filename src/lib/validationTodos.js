/**
 * Tarefas registadas no relatório de validação.
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
 *
 * O estado de cada entrada é o seu `status`, e é ele que o relatório mostra: a
 * ronda 5 auditou cada entrada contra o código e fechou as que já estavam
 * entregues (KB1.0 a KB1.3), deixando «parcial» só o que tem trabalho por fazer
 * (KB1.4).
 */

export const TODO_LIST = [
  {
    id: 'KB1',
    status: 'concluido',
    title: 'Repositório legal versionado na base de conhecimento (Layer 1)',
    note:
      'Plano executado pelas fases KB1.0 a KB1.4 e auditado na ronda 5. As quatro decisões que o §7 deixava por confirmar foram tomadas: direitos de autor (ISO/IEC 27001 e CIS Controls levam metadados, resumo e link oficial, nunca o texto integral), links oficiais (a verificação é um ato do revisor de conteúdo, registado na trilha, porque o sandbox bloqueia egress), idioma da ficha (PT e EN, por chaves de tradução) e âmbito de frameworks (os sete do catálogo único: NIS2, RGPD, ISO 27001, NIST CSF, CIS, QNRC e ENISA).',
    next: 'Nada em aberto neste trabalho; resta o que a KB1.4 deixou por fazer (a verificação periódica dos links oficiais).',
    source: 'docs/KB_LEGAL_REPOSITORY_PLAN.md',
  },
  {
    id: 'KB1.0',
    status: 'concluido',
    title: 'P0 — catálogo único de frameworks + CompetentAuthority + FrameworkProfile (entidades e seed)',
    note:
      'Entregue: as listas divergentes (kbFrameworks.js, frameworkConstants.js, frameworkSeed.js) foram consolidadas no par espelhado base44/shared/frameworkCatalogue.ts ↔ src/lib/frameworkCatalogue.js — sete frameworks, no padrão do licenciamento, com a mesma definição no backend e no frontend — e existem as entidades CompetentAuthority (regulador, supervisor, auditor, normalizador e acreditação, com sítio oficial, base legal e registo de sanções) e FrameworkProfile (missão, áreas de incidência, objetivos, aplicabilidade, obrigações com prazos, coimas e certificabilidade), semeadas por seedLegalRepository de forma idempotente. A ficha existe para os frameworks do âmbito e é legível na app.',
    source: 'docs/KB_LEGAL_REPOSITORY_PLAN.md §3.6, §6, §8',
  },
  {
    id: 'KB1.1',
    status: 'concluido',
    title: 'P1 — LegalDocumentVersion + manageLegalRepository (versões, imutabilidade, auditoria)',
    note:
      'Entregue: LegalDocumentVersion guarda uma linha por edição, com a cadeia de substituição (supersedes_id), vigência, link oficial, hash da cópia arquivada e ciclo de revisão, e manageLegalRepository é a única porta de escrita (upsert_profile, upsert_authority, add_version, supersede_version, verify, withdraw, archive), com leitura para todos os autenticados e escrita de master_admin, tendo o grc_analyst como revisor. Nenhum caminho altera o texto de uma versão publicada — só metadados de verificação —, cada ação fica na trilha de auditoria com o ator real e o browser não escreve as entidades.',
    source: 'docs/KB_LEGAL_REPOSITORY_PLAN.md §3.1, §4, §8',
  },
  {
    id: 'KB1.2',
    status: 'concluido',
    title: 'P2 — interface do repositório: landing, ficha de framework e painel de versões',
    note:
      'Entregue: /knowledge-base tem dois modos (Repositório legal, por omissão, e Artigos — o catálogo editorial) e a ficha /knowledge-base/framework/:code mostra o bloco «Em resumo», a linha temporal das versões (atual, substituídas e futuras) com link oficial e vigência, a entidade competente com ligação ao sítio oficial e ao registo de sanções, e o conteúdo relacionado; o modo de edição (ficha, nova versão e verificação) existe para os papéis de conteúdo. O percurso framework → versão → link oficial faz-se sem sair da base de conhecimento, e a conformidade com a casa mantém-se: título único do TopBar, cores por palette.js, strings por chaves de tradução e entradas em PAGE_TITLE_KEYS, rbac.js e sidebarGroups.js.',
    source: 'docs/KB_LEGAL_REPOSITORY_PLAN.md §5, §8',
  },
  {
    id: 'KB1.3',
    status: 'concluido',
    title: 'P3 — KnowledgeArticle.legal_refs[] e blocos de conteúdo relacionado',
    note:
      'Entregue: KnowledgeArticle declara legal_refs[] ({ framework_code, version_id, document_id }) e a ficha do framework mostra o conteúdo relacionado — os artigos editoriais que citam a versão e os controlos da camada de avaliação. O seed liga cada artigo à versão em vigor sem duplicar (um artigo que já traga referências não é tocado), pelo que um artigo editorial mostra a versão normativa a que se refere.',
    source: 'docs/KB_LEGAL_REPOSITORY_PLAN.md §2, §3.5, §8',
  },
  {
    id: 'KB1.4',
    status: 'parcial',
    title: 'P4 — frescura: alerta de revisão vencida e verificação periódica',
    note:
      'Sinal de frescura entregue e critério de aceitação cumprido: verified_at e review_due_at alimentam um estado derivado (RepositoryFreshnessBadge, com «verificado em …» sempre visível) na ficha e na grelha, e uma ficha com revisão vencida sinaliza o estado. Fica por fazer a verificação periódica automática dos links e da versão oficial: hoje a verificação é um ato do revisor de conteúdo (ação verify de manageLegalRepository, com method manual ou link_check), porque uma função de backend não pode contactar os sítios oficiais neste ambiente — e uma ligação que ninguém confirmou fica registada como não verificada, nunca como verificada. Os layers 2 a 5 continuam fora deste plano.',
    next: 'Decidir se a verificação periódica passa a automática num ambiente com egress, ou se se mantém como ato do revisor registado na trilha.',
    source: 'docs/KB_LEGAL_REPOSITORY_PLAN.md §4, §8',
  },
];
