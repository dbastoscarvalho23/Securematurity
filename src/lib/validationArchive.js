/**
 * Registo de arquivo dos achados de validação CONFIRMADOS e CORRIGIDOS.
 *
 * Um achado que a inspeção confirma como corrigido sai do relatório
 * (`/validacao-seguranca`) e fica registado aqui: o relatório passa a mostrar
 * apenas o que continua aberto, e este ficheiro guarda a memória do que foi
 * feito e do que o confirmou — o achado, a correção e a confirmação, com a data
 * e o método. Os dados originais do achado (evidência, impacto, recomendação)
 * não são duplicados: continuam nas duas fontes do relatório, e esta entrada
 * aponta para eles pelo `id`.
 *
 * A confirmação tem duas metades, ambas obrigatórias antes de arquivar:
 *  1. inspeção do código — cada afirmação da nota de correção confrontada com o
 *     ficheiro que a sustenta;
 *  2. execução do harness multi-identidade (`npm run validate:harness`).
 * O que o emulador local não alcança fica dito na confirmação, e não conta como
 * verificado. Nenhum achado é arquivado por decurso de tempo nem por confiança
 * na nota: só depois de as duas metades fecharem, e nunca um achado «parcial».
 *
 * Para arquivar outro achado: mudar o `status` do achado na sua fonte
 * (`validationReportData.js` / `platformAssessmentData.js`) para «corrigido»,
 * acrescentar aqui a entrada com a confirmação e não tocar na página — o modelo
 * (`validationReportModel.js`) retira-o do relatório no mesmo instante.
 */

export const ARCHIVE_META = {
  date: '2026-09-29',
  method:
    'Confirmação por inspeção do código (cada afirmação da nota de correção confrontada com o ficheiro que a sustenta) e pela execução do harness multi-identidade (`npm run validate:harness`) sobre o backend local — 88 casos, 87 ok, 0 falhas e 1 não verificável no emulador (RLS1). As confirmações que se apoiam só na inspeção dizem-no; nenhuma delas substitui a confirmação em backend real do que o emulador de sessão única não honra.',
  note:
    'Registo à parte do relatório de validação: o relatório mostra os achados abertos, este ficheiro é a memória dos que já foram confirmados e corrigidos, com o que os confirmou.',
};

/**
 * Achados confirmados e corrigidos. `area` é o id da área do relatório;
 * `severity` é a severidade original do achado (não sobe nem desce ao ser
 * corrigido); `correction` resume o que ficou feito, `confirmation` diz o que o
 * confirmou e `harness` lista os casos que o exerceram.
 */
export const ARCHIVED_FINDINGS = [
  // ─── Funcionalidades e fluxos ────────────────────────────────
  {
    id: 'FA1',
    area: 'funcional',
    severity: 'alta',
    title: 'Papel consultant sem cobertura funcional fora do acesso externo',
    correction:
      'O consultor passou a ter leitura delegada nos percursos que a delegação cobre (avaliações, riscos, evidências, documentos, tarefas e relatórios) por T_DELEGATED_READ, sem qualquer capacidade de escrita; quem limita os dados continua a ser a RLS.',
    confirmation:
      'Inspeção: T_DELEGATED_READ = ["consultant"] entra apenas nas capacidades view de src/lib/rbac.js (121–168) e em nenhuma capacidade de escrita. Harness: FA1.1–FA1.5 e DEL1–DEL10 ok.',
    harness: ['FA1.1–FA1.5', 'DEL1–DEL10'],
  },
  {
    id: 'FA2',
    area: 'funcional',
    severity: 'media',
    title: 'Contexto de tenant resolvido de forma divergente entre páginas',
    correction:
      'Regra única de tenant: todas as páginas leem useActiveCustomer() (workspace selecionado → tenant próprio → delegações vivas), incluindo as duas últimas que filtravam por user.customer_id.',
    confirmation:
      'Inspeção: as ocorrências de user.customer_id em src/pages são comentários (Reports, StrategicReport) e a porta única é tenantResolver/tenantContext. Harness: TEN1–TEN6 ok (TEN6 percorre src/pages e falha se uma página voltar a lê-lo).',
    harness: ['TEN1–TEN6'],
  },
  {
    id: 'FA3',
    area: 'funcional',
    severity: 'media',
    title: 'Capacidades de exportação declaradas na matriz sem recurso na interface',
    correction:
      'As duas exportações existem: exportAnalyticsPdf.js gera o PDF das métricas e o do relatório estratégico, e os botões nas duas páginas são governados pela capacidade export da matriz.',
    confirmation:
      'Inspeção: exportComplianceMetricsPdf e exportStrategicReportPdf estão definidas e são chamadas por ComplianceMetrics (113) e StrategicReport (165) sob can(role, "export", …).',
  },
  {
    id: 'FA4',
    area: 'funcional',
    severity: 'media',
    title: 'Erros de leitura apresentados como listas vazias e sem possibilidade de repetir',
    correction:
      'ErrorState (variante inline) com repetição cobre as listas das três famílias e a fronteira de erro do AppLayout (chave por rota) mantém menu e cabeçalho quando uma página rebenta.',
    confirmation:
      'Inspeção: ErrorState é importado em 37 páginas e a fronteira vive no AppLayout (141–153). Residual assumido: a reprodução com a rede cortada continua a exigir execução manual no browser.',
  },
  {
    id: 'FA5',
    area: 'funcional',
    severity: 'alta',
    title: 'Pacote de auditoria com falha de página registada e não reproduzida por inspeção',
    correction:
      'O percurso deixou de falhar em silêncio: a leitura dos pacotes expõe o próprio erro com repetição, o tenant vem do contexto único e a rota está sob a fronteira do AppLayout.',
    confirmation:
      'Inspeção: AuditPackage mostra ErrorState com repetição no erro da leitura (161). Harness: FA5.1–FA5.3 ok — geração pelo editor do tenant, 403 ao auditor na criação e leitura da trilha limitada ao seu tenant.',
    harness: ['FA5.1–FA5.3'],
  },

  // ─── Administração da plataforma ─────────────────────────────
  {
    id: 'FB1',
    area: 'administracao',
    severity: 'critica',
    title: 'Sem provisionamento de licenças: o master_admin não consegue ativar nem alterar um tenant',
    correction:
      'provisionTenantLicense e listTenantLicenses com o âmbito resolvido no servidor, painel TenantLicensePanel (nível, lugares, validade, exceções por módulo e standards) e histórico LicenseChangeLog com autor e antes/depois.',
    confirmation:
      'Inspeção: as duas funções existem, o painel está em uso e o enum de ações do AuditLog inclui as ações de licenciamento. Harness: os 13 casos FB1 ok (autorização, criação, tier inválido, duplicação, exceção por módulo, suspensão com tolerância e fecho fail-closed, reactivação, recusa fora da carteira e leitura do histórico).',
    harness: ['FB1.1–FB1.13'],
  },
  {
    id: 'FB2',
    area: 'administracao',
    severity: 'alta',
    title: 'Páginas de administração inalcançáveis pela navegação',
    correction:
      'As três páginas entraram no grupo «Gestão da plataforma» do Sidebar (/workspaces, /user-assignments e /admin), com o mesmo recurso que o RouteGuard já lhes aplicava.',
    confirmation:
      'Inspeção: src/lib/sidebarGroups.js lista as três entradas com o recurso de cada uma (124–128). Harness: os nove casos UI-* ok — Sidebar e RouteGuard coerentes em cada identidade.',
    harness: ['UI-<role>'],
  },
  {
    id: 'FB4',
    area: 'administracao',
    severity: 'media',
    title: 'Conservação de dados e automações agendadas sem configuração nem visibilidade',
    correction:
      '/platform-operations mostra a última execução, a duração, o estado e o erro das oito automações, guarda a política de conservação por entidade e por tenant e simula a purga sem apagar nada; dataRetentionPurge passou a aplicar a política.',
    confirmation:
      'Inspeção: a consola existe e as oito automações passaram à assinatura Deno.serve((req) => withWorkflowRun(…)), que era o defeito que as impedia de correr. Residual assumido: aplicar a política a registos reais (RoPA/DSR) exige backend real — o emulador recusa criar essas entidades.',
  },
  {
    id: 'FB6',
    area: 'administracao',
    severity: 'media',
    title: 'Duas consolas de plataforma sobrepostas',
    correction:
      'Divisão de papéis: o dashboard de plataforma é a única consola de indicadores e /admin é a área de operações; os quatro gráficos duplicados e os cálculos que os alimentavam saíram do /admin.',
    confirmation:
      'Inspeção: Admin.jsx não importa recharts nem PlatformOverview (zero ocorrências) e mantém os cartões com drill-down.',
  },
  {
    id: 'FB7',
    area: 'administracao',
    severity: 'media',
    title: 'Catálogo comercial (tiers, módulos, standards) apenas de leitura',
    correction:
      'Decisão explicitada: o catálogo mantém-se curado em código e as entidades de catálogo são espelho semeado; a documentação técnica (página e PDF) ganhou o bloco «Catálogo comercial: onde vive e como se altera».',
    confirmation:
      'Inspeção: o bloco existe em src/lib/devDocsData.js (311) e no exportador PDF, e ambos leem o mesmo modelo.',
  },
  {
    id: 'FB8',
    area: 'administracao',
    severity: 'media',
    title: 'Sem canal de comunicação da plataforma para os tenants',
    correction:
      'PlatformAnnouncement com âmbito resolvido no servidor (global / tier / cliente) e uma única porta de escrita (manageAnnouncements), faixa por severidade no layout e histórico em /platform-operations.',
    confirmation:
      'Inspeção: a entidade, a função e o AnnouncementBanner existem e só o master_admin lê a entidade. Harness: ANN1–ANN7 ok (âmbito por tier e por cliente, janela escondida, arquivo, 403 de escrita e 422 sem tier_code).',
    harness: ['ANN1–ANN7'],
  },

  // ─── UX/UI e consistência visual ─────────────────────────────
  {
    id: 'FC1',
    area: 'ux',
    severity: 'media',
    title: 'Título da página duplicado (TopBar e PageHeader)',
    correction:
      'Fonte única de título: o h1 é o da barra de contexto (TopBar) e o PageHeader deixou de renderizar títulos de página — o seu `title` é um h2 de secção.',
    confirmation:
      'Inspeção: PageHeader documenta e executa essa regra (só desenha h2 quando recebe `title`). Residual assumido: /assessments/:id, /framework-guide e /knowledge-base mantêm um h1 de conteúdo além do título da página.',
  },
  {
    id: 'FC2',
    area: 'ux',
    severity: 'media',
    title: 'Paletas de gráficos e de pesquisa fora dos tokens do design system',
    correction:
      'A cor passou a ter um único ponto de decisão — src/lib/palette.js (escalas chart-1..5 e risk-*) — e o tailwind.config.js expõe risk-* e status-* como cores do tema.',
    confirmation:
      'Inspeção: nenhuma classe de paleta rígida resta em src/ fora da prosa deste relatório. Residual assumido: os mapas de calor e a tendência de risco vivem em /risk-assessment, rota fechada na sessão local.',
  },
  {
    id: 'FC3',
    area: 'ux',
    severity: 'media',
    title: 'Mensagens de retorno em inglês numa interface em português',
    correction:
      'Todas as cadeias visíveis passaram a chaves de tradução (novas em translations-phase1.js) e o ExternalAccess, que estava escrito em inglês, deixou de ter literais.',
    confirmation:
      'Inspeção: ExternalAccess.jsx não tem cadeias literais em inglês (61 chamadas a t()) e delegation.js expõe labelKey/descriptionKey em vez de rótulos.',
  },
  {
    id: 'FC6',
    area: 'ux',
    severity: 'baixa',
    title: 'Acessibilidade fraca em ações de ícone e em tabelas interativas',
    correction:
      'As ações de ícone levam aria-label/title, o StatCard é um botão real quando abre drill-down (role, tabIndex, Enter/Espaço) e as linhas clicáveis de Customers são focáveis e nomeadas.',
    confirmation:
      'Inspeção: 17 ficheiros entre componentes e páginas declaram aria-label nas ações de ícone.',
  },

  // ─── Gestão comercial ────────────────────────────────────────
  {
    id: 'FM1',
    area: 'comercial',
    severity: 'critica',
    title: 'Oferta comercial gerida só em código: tiers, packs/add-ons e normas',
    correction:
      'OfferVersion com tiers, packs e normas escrito por manageCommercialOffer (motivo obrigatório e antes/depois no CommercialChangeLog), publicado por substituição e apresentado na consola de /licensing.',
    confirmation:
      'Inspeção: a entidade OfferVersion e a função existem e a consola lê ambas. Harness: FM1.1–FM1.5 ok (versão publicada com vigência, packs à venda e 422 fora do catálogo).',
    harness: ['FM1.1–FM1.5'],
  },
  {
    id: 'FM2',
    area: 'comercial',
    severity: 'alta',
    title: 'Sem preço versionado: nenhum preço por tier, lugar adicional ou pack, nem vigência',
    correction:
      'PriceTable versionada (preço por tier, lugares incluídos, lugar adicional, desconto de pré-pagamento anual e preço por pack com a quota de IA que ele acrescenta), publicada obrigatoriamente contra uma oferta publicada e substituída com data de fim; a subscrição regista a tabela e o valor vigentes à data.',
    confirmation:
      'Inspeção: a entidade PriceTable existe, normalizeAddonEntries ficou ligado a buildPricePatch (o preço do pack era aceite e descartado) e o filtro do histórico usa change_action (colidia com o nome do comando da função multiplexada). Harness: FM2.1–FM2.8 ok.',
    harness: ['FM2.1–FM2.8'],
  },
  {
    id: 'FM3',
    area: 'comercial',
    severity: 'alta',
    title: 'Ciclo de vida da subscrição incompleto: sem renovação, upgrade/downgrade, fecho nem trabalho a tratar',
    correction:
      'Ciclo de vida completo e registado: renovação por período, mudança de nível com decisão explícita sobre o que sai, suspensão com tolerância, reactivação e fecho que devolve o trabalho a tratar — motivo obrigatório, antes/depois e auditoria em todos os caminhos.',
    confirmation:
      'Inspeção: SubscriptionLifecycleCard e as ações da função existem, com o registo comercial anterior intacto. Harness: FM3.1–FM3.6 ok (motivo obrigatório, 422 use_change_tier, 403 ao analista GRC e fecho sem apagar nada).',
    harness: ['FM3.1–FM3.6'],
  },
  {
    id: 'FM6',
    area: 'comercial',
    severity: 'baixa',
    title: 'Sem faturação nem pagamentos na plataforma — fronteira de âmbito declarada',
    correction:
      'A fronteira ficou declarada como decisão: nada de faturação nem de pagamentos nesta fase — o excedente de quota é sinalizado na consola comercial, nunca cobrado.',
    confirmation:
      'Inspeção: nenhuma entidade, função ou página de faturação ou de pagamentos existe no repositório; o `billing_period` da tabela de preços é a periodicidade do preço, não a emissão de faturas.',
  },

  // ─── Segurança e RBAC (ronda anterior) ───────────────────────
  {
    id: 'F1',
    area: 'seguranca',
    severity: 'critica',
    title: 'Acesso operacional de leitura durante o onboarding',
    correction:
      'onboarding_customer_ids saiu dos ramos rls.read das entidades operacionais: só é escrito na aceitação e é removido na expiração e na revogação.',
    confirmation:
      'Inspeção: só User.jsonc declara o campo — nenhuma entidade o lê numa regra rls; manageAccess escreve-o na aceitação (562) e limpa-o na expiração/revogação (606).',
  },
  {
    id: 'F2',
    area: 'seguranca',
    severity: 'alta',
    title: 'RLS ancorada no literal legado role: "admin"',
    correction:
      'Papéis migrados para a grafia canónica nas três frentes (RLS das entidades, comparações do frontend e persistência), com normalizeRole a decidir no backend.',
    confirmation:
      'Inspeção: zero literais role: "admin" nas entidades e nenhuma comparação de papel com literais em src/ (a única ocorrência é a prosa deste relatório); 30 ficheiros de funções usam normalizeRole. Harness: UI-*, TEN*, DEL* e ISO-* sem falhas.',
    harness: ['UI-<role>', 'TEN1–TEN6', 'DEL1–DEL10'],
  },
  {
    id: 'F3',
    area: 'seguranca',
    severity: 'alta',
    title: 'Administrador de parceiro sem escopo de carteira',
    correction:
      'isPartnerAdmin e resolveScopeCustomerIds aplicam o escopo de carteira em list, resolve, pedidos/criação de onboarding e adminUpdateUser; só o master_admin age plataforma-larga.',
    confirmation:
      'Inspeção: manageAccess importa ambos (5–6) e resolve o escopo em 181, 237 e 310, devolvendo 403 fora da carteira.',
  },
  {
    id: 'F4',
    area: 'seguranca',
    severity: 'alta',
    title: 'Âmbito de módulos da delegação não é aplicado',
    correction:
      'authorizeAssessmentOperational e o resolveAuthority do reviewDocument passaram a exigir o módulo na lista authorized_modules da delegação; lista vazia significa nenhum módulo.',
    confirmation:
      'Inspeção: base44/shared/assessmentAccess.ts (61) e reviewDocument (151–153) recusam a delegação que não nomeie o módulo.',
  },
  {
    id: 'F5',
    area: 'seguranca',
    severity: 'alta',
    title: 'Escrita direta na entidade contorna o RBAC',
    correction:
      'As escritas das entidades operacionais passaram a exigir papel (customer_admin / grc_analyst / control_owner) além do tenant, mantendo a leitura por tenant ou delegação.',
    confirmation:
      'Inspeção: rls.create/update de Assessment, AssessmentResponse, Task, SecurityDocument e RiskItem nomeiam os papéis de tenant (5 a 7 ocorrências por entidade). Residual assumido: o emulador local só emula o ramo de leitura.',
  },
  {
    id: 'F6',
    area: 'seguranca',
    severity: 'alta',
    title: 'Auto-atribuição de papel/tenant em adminUpdateUser',
    correction:
      'adminUpdateUser bloqueia a auto-edição de role e customer_id antes de qualquer outro check e limita o workspace_admin a papéis de cliente dentro da sua carteira.',
    confirmation:
      'Inspeção: a guarda userId === currentUser.id corre à entrada do handler (adminUpdateUser:79).',
  },
  {
    id: 'F7',
    area: 'seguranca',
    severity: 'media',
    title: 'Verificações de papel com literais por normalizar',
    correction:
      'As verificações de papel do backend passaram a usar normalizeRole e o frontend deixou de comparar literais (isPlatformOwner / hasRole / normalizeRole).',
    confirmation:
      'Inspeção: normalizeRole em 30 ficheiros de funções e nenhuma comparação de papel com literais em src/. Harness: UI-* ok nas nove identidades.',
    harness: ['UI-<role>'],
  },
  {
    id: 'F8',
    area: 'seguranca',
    severity: 'media',
    title: 'Enumeração da árvore de workspaces',
    correction:
      'A guarda do resolveWorkspaceAccess deixou de depender de o chamador ter workspace_id: quem não é dono da plataforma e não indica alvo só obtém o próprio âmbito, e fora da subárvore a resposta é 403.',
    confirmation:
      'Inspeção: o alvo resolve-se por body.workspace_id || user.workspace_id (28) e o caminho sem alvo devolve apenas o customer_id do próprio. Harness: TEN4, TEN5 e UI-* ok.',
    harness: ['TEN4', 'TEN5', 'UI-<role>'],
  },
  {
    id: 'F9',
    area: 'seguranca',
    severity: 'baixa',
    title: 'Pedido de delegação sem âmbito de carteira',
    correction:
      'request_delegation valida o customer_id contra o escopo de quem pede e recusa pedidos sobre o próprio tenant.',
    confirmation:
      'Inspeção: handleRequestDelegation resolve o escopo e devolve 403 fora dele (310–313), recusando antes o pedido sobre o próprio customer (303).',
  },
  {
    id: 'F11',
    area: 'seguranca',
    severity: 'baixa',
    title: 'Deriva de documentação',
    correction:
      'A afirmação sobre um atalho de master_admin saiu do AGENTS.md: nenhum caminho da matriz está isento.',
    confirmation:
      'Inspeção: o AGENTS.md descreve a matriz sem exceções («NEITHER can() nor canAccessRoute() short-circuits master_admin»).',
  },
  {
    id: 'F13',
    area: 'seguranca',
    severity: 'media',
    title: 'Fail-open do licenciamento na interface',
    correction:
      'fetchEffectiveLicense devolve um estado de erro explícito e isModuleLicensed é fail-closed: sem licença, em erro ou com payload malformado, nenhum módulo abre.',
    confirmation:
      'Inspeção: o estado "error" é devolvido quando a licença não resolve (license.js:25) e isModuleLicensed devolve false nesse estado e com payload sem modules válido (60–65).',
  },
  {
    id: 'F14',
    area: 'seguranca',
    severity: 'verificar',
    title: 'Regra de leitura não declarada em User',
    correction:
      'User.jsonc passou a declarar rls.read (master_admin e workspace_admin, o próprio registo e o próprio cliente).',
    confirmation:
      'Inspeção: base44/entities/User.jsonc declara o bloco rls com as regras de leitura. Residual assumido: o emulador local avalia a RLS sobre a sessão autenticada, pelo que a confirmação por identidade exige backend real.',
  },
  {
    id: 'FS1',
    area: 'seguranca',
    severity: 'baixa',
    title: 'isStandardLicensed continua fail-open, ao contrário do gating de módulos',
    correction:
      'isStandardLicensed passou a fechar por omissão, exactamente como isModuleLicensed: sem licença resolvida, em erro ou com payload sem standards válido, nenhum standard fica licenciado.',
    confirmation:
      'Inspeção: src/lib/license.js devolve false nos três casos (70–85), com a política descrita num único sítio (AGENTS.md).',
  },
];

/** Ids arquivados — o que o relatório deixa de listar. */
export const ARCHIVED_IDS = ARCHIVED_FINDINGS.map((entry) => entry.id);

/** Um achado está arquivado? */
export function isArchived(id) {
  return ARCHIVED_IDS.includes(id);
}
