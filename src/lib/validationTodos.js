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
 *
 * O plano de fecho pós-validação (PL1) segue o mesmo padrão: a entrada-mãe
 * declara o âmbito — o que fica no plano e o que fica deliberadamente fora — e
 * cada fase (PL1.0 a PL1.4) traz a entrega e o critério de aceitação do plano,
 * transcritos aqui. Nenhum achado passa a «corrigido» por execução do plano: a
 * mudança de estado continua a exigir as duas metades da confirmação e o
 * registo em `validationArchive.js`.
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
  {
    id: 'PL1',
    status: 'pendente',
    title: 'Plano de fecho pós-validação (achados abertos e optimizações)',
    note:
      'Plano de execução em cinco fases, ordenado por «quick wins primeiro»: esforço baixo antes do que exige desenho, e só o que é executável neste ambiente. Cobre os cinco achados executáveis aqui (FB3, FC4, FC5, FM4, FM5) e as oportunidades OP-* que não dependem de backend real — OP-F1/F2/F3/F4, OP-B1, OP-C1/C2/C3/C4/C5/C6, OP-M2/M3/M4 e OP-S1/S2 —, distribuídas pelas fases. Ficam deliberadamente fora, registadas como tal: OP-B3 (verificação por identidade fora do emulador de sessão única), OP-B4 (retenção e pedidos de titular) e OP-S3 (revalidação da expiração da delegação na leitura), tal como o residual de F15, o caso RLS1, o âmbito do auditor na trilha (residual de FB5) e a confirmação em backend real das RLS das entidades. A ordem das fases é a decisão única do plano e a etiqueta de cada oportunidade continua a ser derivada por optimizationBand() — o plano não reclassifica nada. Nenhum achado passa a «corrigido» por execução do plano: a mudança de estado continua a exigir as duas metades da confirmação e o registo em validationArchive.js. As fases 4 e 5 mantêm as dependências ditas: o segundo fator depende do fluxo de autenticação gerido pela plataforma e a limitação de ritmo vive em base44/shared/ (ponto único, coerente com o fail-closed do licenciamento).',
    next: 'Executar a PL1.1 (fechar os parciais que só dependem daqui) e remedir a evidência de cada item onde ela nasceu.',
    source: 'src/lib/platformAssessmentData.js · src/lib/platformOptimizationData.js',
  },
  {
    id: 'PL1.0',
    status: 'concluido',
    title: 'Fase 1 — quick wins (esforço baixo)',
    note:
      'Entrega: limitação de ritmo por ator nas funções de escrita e nos caminhos de IA (OP-S2, a única faixa «Quick win» que o modelo já classifica), dependências instaladas sem import removidas do package.json (OP-F1), política de cache por família de dados no query-client (OP-F3), listas cortadas com total e «ver mais» (OP-F4), páginas de acesso em PT-PT por chaves de tradução (OP-C1), aria-label/title nos botões só com ícone (OP-C2), ConfirmDialog em vez de confirm() (OP-C3) e markdown pelos componentes que a app já traz (OP-C6). Critério de aceitação: a fase fecha quando a evidência de cada item é remedida onde ela nasceu — package.json, query-client.js, contagem de aria-label, literais das páginas de acesso, confirm( e translations*.js — e o harness multi-identidade (npm run validate:harness) volta verde.',
    next:
      'Nada em aberto nesta fase. Entregue na ronda 7 a última peça, OP-S2: base44/shared/rateLimit.ts é o ponto único da limitação de ritmo (baldes ai, ai_extract, write e write_sensitive), aplicada às dezanove funções de escrita e aos dois caminhos que chamam IA (searchDocuments, extractQuestionBank), com a resposta 429 e o Retry-After; medido em execução (21.ª chamada do mesmo ator recusada) e com o harness verde (as contagens vivem no cartão «Parecer de prontidão do Core»). Ficam de fora, por serem automação e trabalho de uma só vez, as funções agendadas, os seeds e as migrações.',
    source: 'src/lib/platformOptimizationData.js (OP-S2, OP-F1, OP-F3, OP-F4, OP-C1, OP-C2, OP-C3, OP-C6)',
  },
  {
    id: 'PL1.1',
    status: 'parcial',
    title: 'Fase 2 — fechar os parciais que só dependem daqui',
    note:
      'Entrega: as três tabelas passam a LoadingState variant="skeleton" em vez da linha própria (FC5); o bloqueio de escrita durante a simulação de papel é confirmado no browser com o rótulo/data-capability a decidir o controlo (FC4); e o indicador de contexto ativo aparece na troca de workspace (FB3). Critério de aceitação: cada achado só muda de estado quando as duas metades da confirmação fecharem — a evidência remedida e o percurso exercido no preview com a identidade que o alcança. Estado: as três peças estão em código (as tabelas usam o esqueleto partilhado, a decisão de escrita passa pela matriz e o cabeçalho mostra o contexto ativo), o percurso de FC4 foi exercido no preview — o clique e a submissão com a simulação ativa são recusados, sem nenhum pedido, e a navegação continua livre — e essa verificação expôs um defeito real, corrigido: a app avisa por `toast` (sonner) mas o contentor nunca estava montado, pelo que nenhuma mensagem aparecia (ver `App.jsx`). Confirmado no browser em 2026-09-29: com a simulação do `auditor` ativa, o clique em «Guardar» e a submissão do formulário são recusados sem nenhum pedido e o aviso «Esta ação não faz parte do papel simulado.» aparece (o contentor do sonner está montado), a navegação continua livre e o esqueleto das tabelas de `Organization` e `Licensing` foi visto durante o carregamento — o FC4 fecha assim as duas metades e passa a «corrigido», com o registo em `validationArchive.js`.',
    next: 'Confirmar no browser o esqueleto da tabela do Admin (as de Organization e Licensing já se viram) e exercer a troca de workspace onde houver carteira, para ver o indicador de contexto mudar (FB3).',
    source: 'src/lib/platformAssessmentData.js (FB3, FC4, FC5)',
  },
  {
    id: 'PL1.2',
    status: 'pendente',
    title: 'Fase 3 — valor comercial',
    note:
      'Entrega: o customer_admin passa a ver a quota do próprio tenant no seu painel e a quota por pack/acréscimo (FM4, via OP-M2); cada número da consola comercial abre a lista que o compõe (FM5, via OP-M4); e a proposta comercial sai em PDF a partir da tabela de preços em vigor (OP-M3), reaproveitando a moldura dos exportadores existentes. Critério de aceitação: o percurso exercido no preview com a identidade que o alcança (o customer_admin vê a sua quota) e a evidência remedida nos exportadores e na consola.',
    next: 'Abrir ao customer_admin a leitura da quota do próprio tenant (OP-M2), retirando o residual que FM4 registou.',
    source: 'src/lib/platformAssessmentData.js (FM4, FM5) · src/lib/platformOptimizationData.js (OP-M2, OP-M3, OP-M4)',
  },
  {
    id: 'PL1.3',
    status: 'pendente',
    title: 'Fase 4 — operação e segurança',
    note:
      'Entrega: a lista de assinaturas e o histórico de licenciamento ganham pesquisa, filtros e paginação por cursor no servidor (OP-B1); e os papéis que administram tenants e o dono da plataforma passam a exigir segundo fator, com códigos de recuperação (OP-S1). Critério de aceitação: o segundo fator declara a dependência do fluxo de autenticação da plataforma — é uma capacidade que a plataforma ainda não expõe — e a evidência dos filtros/cursor é remedida onde nasceu (listTenantLicenses e listLicenseChanges), com o percurso exercido no preview.',
    next: 'Adicionar pesquisa, filtros e paginação por cursor por servidor a listTenantLicenses e à lista de assinaturas (OP-B1).',
    source: 'src/lib/platformOptimizationData.js (OP-B1, OP-S1)',
  },
  {
    id: 'PL1.4',
    status: 'pendente',
    title: 'Fase 5 — dívida estruturante',
    note:
      'Entrega: o inventário do backend deixa de viajar no arranque, por import dinâmico, em /documentacao-tecnica (OP-F2); as famílias de tradução são consolidadas por área e idioma (OP-C4); e os quatro exportadores PDF passam a uma moldura única (OP-C5). Critério de aceitação: a fase fecha com a exportação do PDF e as páginas de conteúdo verificadas no preview, e com o harness verde.',
    next: 'Passar o inventário do backend a import dinâmico na página de documentação técnica (OP-F2).',
    source: 'src/lib/platformOptimizationData.js (OP-F2, OP-C4, OP-C5)',
  },
];
