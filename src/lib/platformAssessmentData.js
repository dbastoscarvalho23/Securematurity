/**
 * Avaliação técnica, funcional e de administração — Securematurity.
 *
 * Conteúdo estático (sem leituras a entidades nem a funções de backend) da ronda
 * de avaliação funcional + administração da plataforma + UX/UI. Cada achado tem
 * área, severidade, evidência no código, impacto e recomendação.
 *
 * As severidades são as mesmas do relatório de segurança (`SEVERITIES` em
 * `validationReportData.js`): crítica, alta, média, baixa e a verificar.
 *
 * A ronda nasceu de inspeção (todos os achados «pendente») e os que foram
 * entretanto trabalhados trazem `status` próprio — `corrigido` ou `parcial` —
 * com `statusNote` a dizer o que ficou feito e o que falta. Quem não tem nota
 * continua «pendente» (recomendação por aplicar).
 *
 * As lacunas de cada área (`gaps`) são estruturas com o texto e o achado que as
 * fecha (`finding`), e não texto solto: o estado e a nota de cada lacuna são
 * resolvidos pelo modelo (`validationReportModel.js`) a partir desse achado, para
 * que a lista não possa voltar a contradizer os cartões da mesma área. Uma lacuna
 * sem achado correspondente fica «pendente».
 *
 * A área «Gestão comercial» (FM1–FM6) nasce de uma auditoria comercial e não de
 * uma inspeção de defeitos: os achados abertos registam a lacuna e o desenho
 * proposto das capacidades em falta (utilização e quotas, inteligência
 * comercial) e o FM6 regista a fronteira de âmbito — sem faturação nem
 * pagamentos nesta fase. A oferta, o preço e os packs (FM1/FM2) e o ciclo de
 * vida da subscrição (FM3) estão implementados e exercitados, pelo que esses
 * achados ficam «corrigido» com a nota do que continua deliberadamente fora
 * (os módulos por tier vivem no catálogo de código); as restantes capacidades
 * continuam «parcial» e o parecer da área é um plano em execução, não um estado.
 */

/** Âmbito e método desta ronda (mostrado no cabeçalho do relatório). */
export const ROUND_META = {
  round: 'Ronda 3 — avaliação funcional, de administração, comercial e de UX/UI',
  date: '2026-09-28',
  method:
    'Inspeção de código e de configuração: rotas e matriz de capacidades (src/lib/rbac.js), páginas e componentes, entidades e funções de backend, automações agendadas (base44/workflows) e tokens do design system AnkoraOne (src/index.css, tailwind.config.js). Para a área «Gestão comercial», a mesma inspeção sobre o catálogo de licenciamento (src/lib/licenseModules.js, base44/shared/licenseGuard.ts), as entidades de licenciamento e de consumo (TenantSubscription, TenantModule, TenantStandard, LicenseChangeLog, LicenseUsageRecord), provisionTenantLicense e as superfícies onde a operação comercial acontece (/licensing, /admin e o painel de plataforma).',
  scope:
    'Funcionalidades e fluxos de trabalho; administração da plataforma, workspaces, tenants e conteúdos; consistência visual entre páginas e com o design system. A área «Gestão comercial» (FM1–FM6) audita a oferta (tiers, packs e normas), o preço e a vigência, o ciclo de vida da subscrição, a utilização face a quotas contratuais e os indicadores de negócio, e planeia as capacidades em falta — sem faturação nem pagamentos em nenhuma fase. A validação de segurança da ronda anterior mantém-se como área própria, sem alteração de conteúdo.',
  limitation:
    'A inspeção que originou esta ronda não tinha execução multi-identidade. Entretanto existe o harness `tools/validation-harness` (`npm run validate:harness`), que corre as nove identidades contra o backend local — no limite das funções (RBAC, âmbito de carteira, delegações, licenciamento) e na camada de decisão do frontend (Sidebar/RouteGuard, matriz de capacidades, contrato de tenant) — e é ele que sustenta as notas de correção. Continua por verificar em backend real o que o emulador local não honra: as RLS das entidades sobre sessões distintas (inclusive o ramo `delegated_edit_customer_ids`, escondido na leitura) e a leitura da trilha de auditoria. Na área «Gestão comercial» a oferta, o preço e os packs (FM1/FM2) e o ciclo de vida da subscrição com as quotas contratuais (FM3/FM4) estão implementados e exercitados de ponta a ponta — consola e funções, incluindo a publicação por substituição, a decisão comercial sobre os packs a mandar na contratação, o registo da oferta e do preço vigentes no provisionamento e o histórico com filtros e antes/depois. As verificações desta área encontraram três defeitos reais e corrigiram-nos: o filtro do histórico colidia com o comando da função multiplexada, o preço do pack era aceite e descartado na escrita da tabela de preços, e a lista de subscrições a expirar lia um campo que a subscrição não tem. FM1, FM2 e FM3 estão «corrigido» e FM4/FM5 «parcial»; o que falta em cada achado está no próprio cartão.',
};

/**
 * Áreas da avaliação. A área `seguranca` (ronda anterior) é acrescentada pelo
 * modelo `validationReportModel.js`, a partir de `validationReportData.js`.
 *
 * `accent` é o triplo RGB da paleta — usado em estilo inline (interface e PDF),
 * tal como em `src/lib/docsModel.js`.
 */
export const ASSESSMENT_AREAS = [
  {
    id: 'funcional',
    label: 'Funcionalidades e fluxos',
    description:
      'Percursos do núcleo NIS2 e dos módulos ativos: cobertura por papel, contexto de tenant, estados de erro e exportações.',
    accent: [37, 99, 235],
    summary:
      'O núcleo NIS2 está completo em páginas e funções (avaliações, riscos, evidências, documentos, planos de ação, relatórios e pacote de auditoria) e as escritas passam por funções de backend com verificação de papel. Os quatro achados desta área estão corrigidos: o contexto de tenant passou a ser um só para todas as páginas, o consultor tem leitura delegada sem escrita, a exportação prometida pela matriz existe e os erros de leitura deixaram de se confundir com listas vazias. O que resta é confirmação, não trabalho: a leitura das entidades por identidade delegada (consultor e auditor) e a reprodução do estado de erro com a rede cortada, ambas fora do alcance do emulador local.',
    solid: [
      'Ciclo de avaliação ponta-a-ponta em servidor: completeAssessment calcula resultados, cobertura e metodologia sem confiar no cliente.',
      'Riscos, tarefas, documentos, evidências, fornecedores, incidentes, DSR/RoPA e formação têm página, entidade com RLS e função de escrita dedicada.',
      'Exportações reais em Relatórios, Avaliações e Pacote de auditoria (PDF/JSON).',
      'Automações agendadas por evento e por calendário (8 workflows) para tarefas, riscos, documentos, relatórios mensais e conservação de dados.',
    ],
    gaps: [
      { text: 'Confirmação em backend real da leitura das entidades por identidade delegada (consultor e auditor) — o emulador local avalia a RLS sobre a sessão autenticada, uma só.', finding: 'FA1' },
      { text: 'Reprodução manual, no browser, do estado de erro com a rede cortada.', finding: 'FA4' },
    ],
  },
  {
    id: 'administracao',
    label: 'Administração da plataforma',
    description:
      'Workspaces, clientes/tenants, utilizadores e atribuições, licenças e tiers, conteúdos e operação corrente da plataforma.',
    accent: [124, 58, 237],
    summary:
      'Existem recursos de administração para clientes, utilizadores, atribuições, workspaces, catálogo de conteúdo e manutenção programada, e a operação comercial da plataforma está fechada: o provisionamento de licenças tem painel (nível, lugares, validade, exceções por módulo e standards, com histórico das alterações), as três páginas de gestão entraram na navegação, as automações e a política de conservação têm consola e execução registada, os indicadores ficaram num só painel com o /admin como área de operações e existe canal de anúncios para os tenants. Restam dois pontos, ambos de confirmação e não de construção: a troca de workspace — o seletor já alimenta o contexto de tenant e todas as páginas leem o mesmo — e o âmbito do papel auditor na trilha de auditoria, que o emulador local não distingue.',
    solid: [
      'Gestão de clientes com formulário, detalhe e auditoria (Customers + CustomerForm/CustomerDetailPanel).',
      'Gestão de utilizadores e convites, com normalização de papel no servidor (Settings + adminUpdateUser/adminDeleteUser/logUserLogin).',
      'Árvore de workspaces com criação/edição/eliminação e migração (Workspaces + getWorkspaceTree/resolveWorkspaceAccess).',
      'Delegações e onboarding de externos com motivo, prazo e aprovação do cliente (ExternalAccess + manageAssignment).',
      'Catálogo de conteúdo gerível: pergunta-resposta (QuestionBank), base de conhecimento com fluxo editorial (ArticleEditorialPanel + transitionArticleStatus) e frameworks.',
      'Janela de manutenção com bloqueio aos não administradores (MaintenanceWindowPanel + MaintenanceGuard) e configuração de armazenamento/fornecedores.',
      'Consola de plataforma com métricas de tenants, uso de IA, adoção de módulos e subscrições a expirar.',
    ],
    gaps: [
      { text: 'Provisionamento de licenças (nível, lugares, módulos, estado) sem interface.', finding: 'FB1' },
      { text: 'Três páginas de administração inalcançáveis pelo menu.', finding: 'FB2' },
      { text: 'Seletor de workspace sem efeito no contexto de dados.', finding: 'FB3' },
      { text: 'Sem política de conservação configurável nem histórico de execução das automações.', finding: 'FB4' },
      { text: 'Trilha de auditoria sem filtros de servidor nem exportação.', finding: 'FB5' },
      { text: 'Duas consolas de plataforma sobrepostas (/admin e o dashboard).', finding: 'FB6' },
      { text: 'Sem canal de comunicação da plataforma para os tenants.', finding: 'FB8' },
    ],
  },
  {
    id: 'ux',
    label: 'UX/UI e consistência visual',
    description:
      'Consistência entre páginas e com os tokens do design system AnkoraOne: títulos, cor, idioma, estados, acessibilidade e responsividade.',
    accent: [8, 145, 178],
    summary:
      'A base é sólida: páginas construídas sobre shadcn/ui, tipografia e raios vindos dos tokens AnkoraOne, tabelas com scroll horizontal próprio e quase nenhuma cor rígida nas páginas. As divergências estavam nos detalhes que se repetem em todas elas — título duplicado, paletas de gráficos fora dos tokens, mensagens em inglês, bloqueio de escrita por heurística, padrões de carregamento diferentes e acessibilidade fraca em ações de ícone — e quatro das seis estão corrigidas: o título tem uma só fonte, a cor resolve-se em `palette.js`, as cadeias visíveis passaram a chaves de tradução e as ações de ícone têm nome acessível. Restam duas parciais: a confirmação no browser do bloqueio de escrita durante a simulação de papel e as três tabelas que ainda mostram a linha própria em vez do indicador partilhado.',
    solid: [
      'Tokens semânticos (HSL) para superfícies, texto, bordas e gráficos, com tema claro/escuro no ThemeContext.',
      'Componentes partilhados reutilizados: PageHeader, EmptyState, LoadingState, StatCard, StatusBadge, ConfirmDialog, BulkActionBar.',
      'Tabelas embrulham o conteúdo em overflow próprio (ui/table.jsx) e os filtros de listagem seguem o mesmo padrão visual.',
      'Interface integralmente em português de Portugal nas páginas principais, com i18n por chaves (translations-*.js).',
    ],
    gaps: [
      { text: 'Título da página duplicado (TopBar + PageHeader).', finding: 'FC1' },
      { text: 'Paletas de gráficos e de pesquisa fora da paleta de tokens.', finding: 'FC2' },
      { text: 'Mensagens de retorno em inglês numa interface PT-PT.', finding: 'FC3' },
      { text: 'Bloqueio de escrita por heurística durante a simulação de papel.', finding: 'FC4' },
      { text: 'Padrões de carregamento e de vazio divergentes.', finding: 'FC5' },
      { text: 'Acessibilidade: poucos nomes acessíveis em ações de ícone.', finding: 'FC6' },
    ],
  },
  {
    id: 'comercial',
    label: 'Gestão comercial',
    description:
      'Oferta (tiers, packs e normas), preço e vigência, ciclo de vida da subscrição, utilização face a quotas contratuais e indicadores de negócio. Auditoria dos fluxos existentes e plano das capacidades em falta.',
    accent: [217, 119, 6],
    summary:
      'A base de licenciamento está construída e é auditável — provisionamento por cliente com motivo e histórico, catálogo dos três tiers curado em código com espelho semeado, gating fail-closed — e a camada comercial existe hoje de ponta a ponta: a oferta, o preço e os packs têm registo versionado com vigência (`OfferVersion` com tiers e packs, `PriceTable` com o preço por tier e por pack, escritos por `manageCommercialOffer` e visíveis na consola de /licensing), a subscrição regista a versão, o valor e as quotas vigentes à data do provisionamento, a contratação de um pack segue a decisão comercial da oferta em vigor, o ciclo de vida tem renovação, mudança de nível com decisão explícita sobre o que sai e fecho com trabalho a tratar (`SubscriptionLifecycleCard`), as quotas contratuais sinalizam excedente sem bloquear (`QuotaSignal` + `QuotaConsole`) e o painel de plataforma mostra receita contratada, movimento do período, churn, conversão e coortes (`getCommercialMetrics` + `CommercialMetricsWidget`). FM1, FM2 e FM3 estão «corrigido» com o residual dito em cada cartão — os módulos por tier continuam no catálogo de código, deliberadamente (FB7) — e o que resta é a quota no painel do próprio cliente e o drill-down número a número dos indicadores (FM4/FM5, «parcial»). A fronteira é deliberada: sem faturação nem pagamentos nesta fase — o excedente é sinalizado, nunca cobrado.',
    solid: [
      'A oferta e o preço têm versão e vigência: `OfferVersion` (tiers com estado comercializável/preparado e normas por tier, e os packs com o mesmo estado) e `PriceTable` (preço por tier, lugares incluídos, lugar adicional, desconto anual e preço por pack com a quota de IA que ele acrescenta) são escritos por função com motivo obrigatório e antes/depois no `CommercialChangeLog` — incluindo um campo por pack (`addon_price:<código>`) —, publicados por substituição (a versão anterior fica retirada com data de fim) e apresentados na consola de /licensing, que assinala quando o código em execução já não coincide com a versão publicada.',
      'A decisão comercial sobre os packs é operacional: só se contrata (`set_addon`) o pack que a versão da oferta em vigor põe à venda — 422 `addon_not_for_sale` nos restantes, que existem no código mas não estão comercializados —, o pack abre os módulos do catálogo de código e fica registado na subscrição com o preço da tabela em vigor, e retirar é sempre possível.',
      'Provisionamento por cliente com motivo obrigatório, snapshot antes/depois e histórico consultável (provisionTenantLicense + LicenseChangeLog + listLicenseChanges), com o âmbito resolvido no servidor: dono da plataforma = tudo, administrador de parceiro = a sua carteira.',
      'Três tiers cumulativos (Core ⊂ Profissional ⊂ Avançado) curados em código (src/lib/licenseModules.js e base44/shared/licenseGuard.ts) e espelhados nas entidades pelas funções de semente — a fonte de verdade não pode divergir por edição de dados.',
      'Gating fail-closed: sem licença resolvida, suspensa fora da tolerância ou com payload inválido, nenhum módulo nem standard abre; o cliente nunca decide o tier efetivo.',
      'Contadores já existentes: lugares por subscrição (seat_limit / seats_used) e consumo de IA por mês (monthly_usage_count + LicenseUsageRecord, escrito por enforceUsageLimit).',
      'Ciclo de vida da subscrição como operação registada: renovação por período (com registo da renovação), mudança de nível que só aplica depois de o administrador reconhecer o que o novo nível deixa de cobrir (e nada apaga), suspensão com tolerância, reativação e fecho que fecha o gating e devolve o trabalho a tratar — motivo obrigatório, antes/depois e auditoria em todos os caminhos.',
      'Quotas contratuais por cliente (lugares e consumo de IA por mês, com limiar de aviso) lidas da tabela de preços em vigor, sinalizadas por período em `QuotaSignal` — idempotente e reversível — e visíveis na consola (`QuotaConsole`): a quota sinaliza, nunca bloqueia.',
      'Indicadores comerciais calculados no servidor (`getCommercialMetrics`): receita contratada MRR/ARR, movimento do período com o período anterior, churn, conversão por nível, coortes e sinalizações — no painel de plataforma, que os mostra num widget próprio.',
      'Painel de plataforma com adoção por tier, estado das subscrições, maiores consumidores de IA e subscrições a expirar e suspensas (FB6 deixou uma só consola de indicadores) — a lista de expirações lê `expires_date`, o campo que a subscrição tem.',
    ],
    gaps: [
      { text: 'Oferta sem packs: tiers, packs/add-ons e normas decididos só em código, sem forma de vender a privacidade como acréscimo.', finding: 'FM1' },
      { text: 'Sem preço versionado: nenhum preço por tier, por lugar adicional ou por pack/acréscimo, nem vigência que permita reconstruir o que foi vendido a uma data.', finding: 'FM2' },
      { text: 'Ciclo de vida completo e registado (renovação, mudança de nível com decisão explícita, fecho com trabalho a tratar); falta a verificação em backend real das RLS das entidades e do âmbito de um delegado.', finding: 'FM3' },
      { text: 'Quotas contratuais já sinalizam excedente na consola comercial; falta o cliente ver a sua própria quota no seu painel e a quota por pack/acréscimo.', finding: 'FM4' },
      { text: 'Indicadores comerciais já existem no painel de plataforma com o período anterior ao lado; falta o drill-down de cada número para o tenant e para o registo que o produziu.', finding: 'FM5' },
    ],
  },
];

/**
 * Achados desta ronda. Severidades iguais às do relatório de segurança.
 * `status` refere-se à recomendação: pendente = por aplicar.
 */
export const ASSESSMENT_FINDINGS = [
  // ─── Funcionalidades e fluxos ────────────────────────────────
  {
    id: 'FA1',
    area: 'funcional',
    severity: 'alta',
    status: 'corrigido',
    statusNote:
      'Decisão tomada e alinhada nas duas camadas: o consultor passa a ter LEITURA nos percursos que a delegação cobre (avaliações, riscos, evidências, documentos, tarefas e relatórios) por `T_DELEGATED_READ` em `src/lib/rbac.js`, sem qualquer capacidade de escrita — quem limita os dados continua a ser a RLS, que só devolve os clientes delegados; as rotas derivam da mesma matriz, pelo que o menu e o RouteGuard acompanham. Verificado no harness local: FA1.1–FA1.5 (percursos delegados acessíveis, nenhuma escrita nesses recursos, acesso externo mantido, nada fora do âmbito alcançável — administração e restantes módulos fechados — e o contexto do consultor a vir apenas de delegações vivas) e, no limite das funções, DEL1–DEL10 (leitura do cliente delegado a 200; escrita recusada a 403 na delegação de leitura, expirada, revogada e restrita por módulo). Residual assumido: a leitura das entidades numa sessão de consultor não é reproduzível no emulador local, que avalia a RLS sobre a sessão autenticada (uma só) — confirma-se em backend real.',
    title: 'Papel consultant sem cobertura funcional fora do acesso externo',
    persona: 'Consultor convidado a trabalhar num tenant de cliente (delegação ativa)',
    flow: 'Delegação e trabalho por conta do cliente',
    evidence: [
      'src/lib/rbac.js — em CAPABILITIES, `consultant` aparece apenas em external_access: { view: [...] }. Nenhuma outra capacidade (assessments, risks, documents, evidence, tasks, reports, compliance_metrics) o inclui.',
      'src/lib/rbac.js — ROUTE_RESOURCE/canAccessRoute derivam da mesma matriz, pelo que qualquer rota de conformidade é negada ao consultor.',
      'src/pages/ExternalAccess.jsx:339 — é a única página que trata o papel consultant.',
    ],
    impact:
      'O consultor é uma das personas do modelo de 9 papéis e existe precisamente para trabalhar em tenants de clientes por delegação — a RLS concede-lhe leitura delegada, mas a matriz de capacidades fecha todas as rotas operacionais. O papel fica reduzido a pedir e aceitar delegações: não vê avaliações, riscos, evidências, documentos, tarefas nem relatórios do cliente.',
    recommendation:
      'Decidir o âmbito do consultor e alinhar as duas camadas: ou uma capacidade de consultoria explícita (leitura por delegação em assessments, risks, evidence, documents, tasks e reports, sem escrita), mapeada a partir de delegated_*_customer_ids; ou assumir que o papel é apenas de acesso externo, retirá-lo da narrativa dos papéis operacionais e documentá-lo assim na documentação técnica.',
    check:
      'Um consultor com delegação ativa de leitura abre as listas do cliente (riscos, evidências, relatórios) e vê os dados do tenant, sem qualquer ação de escrita.',
  },
  {
    id: 'FA2',
    area: 'funcional',
    severity: 'media',
    status: 'corrigido',
    statusNote:
      'Regra única e sem exceções. Todas as páginas que resolviam o tenant por si passaram a ler `useActiveCustomer()` (`tenantResolver.js` — workspace selecionado → tenant próprio → delegações vivas): além das cinco migradas na fase anterior (RiskAssessment, AuditPackage, Recommendations, Tasks, ActionPlan), fecharam-se nesta fase as duas últimas que ainda filtravam por `user.customer_id` na visão do `customer_admin` — Organization (lista de utilizadores) e UserAssignments (atribuições). O contrato é exercido pelo harness (TEN1–TEN5: tenant próprio, delegação viva, delegações expirada/revogada/pendente excluídas, workspace selecionado a mudar mesmo o contexto e workspace fora do âmbito ignorado) e a regra deixou de poder divergir em silêncio: o caso TEN6 percorre `src/pages` e falha se alguma página voltar a ler `user.customer_id`. O cabeçalho (TopBar) mostra o tenant ativo. Residual: a leitura dos dados do tenant delegado em cada página exige backend real (ver FA1).',
    title: 'Contexto de tenant resolvido de forma divergente entre páginas',
    evidence: [
      'src/pages/RiskAssessment.jsx:57 — `const customerId = user?.customer_id;` e a lista é filtrada por igualdade estrita (linha 138), pelo que quem não tem customer_id próprio vê a lista vazia mesmo com leitura delegada.',
      'src/pages/AuditPackage.jsx — resolveCustomerId() próprio, que considera customer_id e depois delegated_edit/view_customer_ids.',
      'src/pages/Recommendations.jsx, Tasks.jsx e ActionPlan.jsx — leem `user.customer_id` diretamente.',
      'src/lib/RoleSimulationContext.jsx — useEffectiveRole só é consumido em 4 ficheiros (Sidebar, RouteGuard, Dashboard, KnowledgeBase).',
    ],
    impact:
      'O mesmo utilizador tem comportamentos diferentes de página para página (lista preenchida numa, vazia na seguinte) e cada nova página repete a mesma decisão. É também a origem de parte dos relatos de «não vejo dados» em contas delegadas, porque o filtro do cliente sobrepõe-se à leitura permitida pela RLS.',
    recommendation:
      'Criar um único contexto de tenant no frontend (por exemplo `useActiveCustomer()`), que combine customer_id próprio, workspace selecionado e delegações ativas, e passar todas as páginas a ler daí. O mesmo hook serve o seletor de workspace e o cabeçalho, eliminando as resoluções paralelas.',
    check:
      'Todas as páginas operacionais mostram o mesmo tenant para a mesma conta, incluindo contas com delegação e sem customer_id próprio.',
  },
  {
    id: 'FA3',
    area: 'funcional',
    severity: 'media',
    status: 'corrigido',
    statusNote:
      'As duas exportações passaram a existir e são o controlo que a matriz já prometia: `src/lib/exportAnalyticsPdf.js` gera o PDF das métricas (`exportComplianceMetricsPdf`) e o do relatório estratégico (`exportStrategicReportPdf`), no mesmo padrão de `exportReportPdf.js` — capa, rodapé, texto em PT-PT e a escala de risco dos tokens. O botão de /compliance-metrics mostra-se a quem `can(role, \"export\", \"compliance_metrics\")` e o de /strategic-report a quem `can(role, \"export\", \"strategic_report\")`, pelo que a capacidade deixa de estar declarada sem recurso e o recurso não existe sem a capacidade. Um único gerador serve as duas páginas (sem código de desenho duplicado). Verificado no preview com o papel que a matriz atribui à exportação.',
    title: 'Capacidades de exportação declaradas na matriz sem recurso na interface',
    evidence: [
      'src/lib/rbac.js:148 e :156 — compliance_metrics declara export para T_EDIT/executive/auditor e strategic_report declara export para executive.',
      'src/pages/ComplianceMetrics.jsx e src/pages/StrategicReport.jsx — nenhuma exportação (sem jsPDF, sem download, sem CSV). As exportações existem em Reports, Assessments e AuditPackage (JSON).',
      'A documentação técnica (/documentacao-tecnica, via src/lib/docsModel.js) lê a matriz em runtime e por isso apresenta estas capacidades como existentes.',
    ],
    impact:
      'A matriz é a fonte de verdade da documentação e é usada para decidir percursos por persona. Prometer uma exportação que não existe faz o auditor ou o executivo procurar um botão inexistente e desvaloriza a matriz como contrato.',
    recommendation:
      'Implementar a exportação nas duas páginas (PDF de métricas e de relatório estratégico, no mesmo padrão de exportReportPdf) ou remover a capacidade `export` da matriz até existir. O mesmo teste deve ser aplicado às restantes capacidades declaradas: cada capacidade deve ter um recurso visível que a execute.',
    check:
      'Cada capacidade declarada na matriz tem pelo menos um controlo visível na página correspondente com o papel indicado.',
  },
  {
    id: 'FA4',
    area: 'funcional',
    severity: 'media',
    status: 'corrigido',
    statusNote:
      'O estado de erro passou a cobrir todas as listas das três famílias, sem exceções. `ErrorState` (variante `inline`) — distinto do `EmptyState`, com mensagem própria de falha e botão de repetir que chama o `refetch` da consulta — cobre agora também AssessmentDetail, ComplianceJourney, EmailReport, ExternalAccess, IncidentManagement, SecurityDocuments, SupplyChain, SystemStatus, TaskAnalytics, UserAssignments, Settings, QuestionBank e Configuration, além das sete consultas que já o tinham (ComplianceMetrics, StrategicReport, Reports, Assessments, RiskAssessment, AuditPackage, AuditLog) e das restantes listas entretanto cobertas (ActionPlan, Admin, Customers, DSRManagement, DocumentAuditTrail, EvidenceOverview, Licensing, Organization, PlatformOperations, PolicyAttestation, Recommendations, RoPA, Suppliers, Tasks, Training, VulnerabilityManagement, Workspaces). O carregamento das listas passou a `LoadingState variant="skeleton"`, que reserva o espaço em vez de o fazer saltar, e a fronteira de erro do `AppLayout` (chave por rota) mantém menu e cabeçalho utilizáveis quando uma página rebenta. Verificado por inspeção e no preview (render normal e estado vazio das páginas alcançáveis pela sessão local); a reprodução com a rede cortada fica na lista de testes por executar, porque exige uma execução manual no browser.',
    title: 'Erros de leitura apresentados como listas vazias e sem possibilidade de repetir',
    evidence: [
      'Nenhuma página trata `isError` do useQuery (verificação em src/pages: só existem onError de mutações); uma falha de função/RLS deixa `data` vazio e a interface mostra o EmptyState de «sem dados».',
      'src/App.jsx — o ErrorBoundary só envolve 6 rotas lazy (strategic-report, knowledge-base, policy-attestation, external-access, documentacao-tecnica, validacao-seguranca); as restantes rotas não têm fronteira de erro, pelo que uma exceção de renderização sobe até à raiz e deixa o ecrã em branco.',
      'É o sintoma registado no /audit-package (falha sem mensagem), que a inspeção estática não reproduz.',
    ],
    impact:
      'O utilizador não distingue «não há registos» de «falhou a carregar», não pode tentar de novo e não tem indicação do que fazer; falhas tornam-se silenciosas e chegam por reporte em vez de aparecerem na interface. Uma exceção numa página sem fronteira de erro derruba toda a aplicação, não apenas a página.',
    recommendation:
      'Dois passos distintos: (a) estado de erro explícito com repetição (`isError` + `refetch`) nos hooks de listagem, com mensagem própria e distinta do vazio; (b) mover a fronteira de erro para o layout (AppLayout), de modo a que uma página que rebente mostre um painel de erro e mantenha navegação e cabeçalho, deixando de derrubar a aplicação.',
    check:
      'Com a rede cortada, a lista mostra erro e botão de repetir; uma exceção numa página mantém o menu lateral e o cabeçalho utilizáveis.',
  },
  {
    id: 'FA5',
    area: 'funcional',
    severity: 'alta',
    status: 'corrigido',
    statusNote:
      'O percurso deixou de poder falhar em silêncio e passou a ser exercido por identidade. Na página: a leitura dos pacotes expõe o próprio erro (painel com mensagem e repetição, diferente do `EmptyState`), o tenant é resolvido pelo contexto único e, sem cliente resolvido, mostra o estado vazio próprio; a rota está sob a fronteira de erro do `AppLayout`, pelo que uma exceção mantém navegação e cabeçalho em vez do ecrã em branco. No servidor, o harness fecha o que estava por reproduzir: FA5.1 gera o pacote com a identidade do editor do tenant (200 — pacote v1.0 do cliente Alfa, com âmbito e entradas), FA5.2 confirma que o auditor, papel de leitura, é recusado na criação (403) e consome o que o tenant gerou, e FA5.3 confirma que a leitura da trilha pelo auditor fica dentro do seu tenant. Residual assumido: a leitura das entidades `AuditPackage` por uma sessão de auditor real (a RLS é avaliada sobre a sessão autenticada, uma só no emulador) confirma-se em backend real.',
    title: 'Pacote de auditoria com falha de página registada e não reproduzida por inspeção',
    persona: 'Auditor autorizado a /audit-package',
    flow: 'Preparação de auditoria — geração e consulta de pacotes',
    evidence: [
      'Registo da ronda anterior: /audit-package falha ao carregar para o papel autorizado (Auditor), sem mensagem tratada na interface.',
      'src/pages/AuditPackage.jsx — a inspeção estática não revela a causa: resolveCustomerId() devolve "" quando não há tenant próprio nem delegações (a query fica desligada e packages = []), o que devia conduzir ao EmptyState; os restantes acessos a `selected`, `scope` e `sections` estão protegidos com valores por omissão.',
      'src/App.jsx — a rota não tem ErrorBoundary, pelo que o sintoma visível é o ecrã em branco descrito em FA4.',
    ],
    impact:
      'É o percurso de entrega ao auditor externo — o que dá valor ao produto na véspera de uma auditoria — e está inutilizável para quem tem esse papel, sem mensagem que permita ao utilizador ou ao suporte perceber o que se passou.',
    recommendation:
      'Reproduzir com uma sessão real de auditor (dados de um tenant com pacotes e sem customer_id próprio) e instrumentar o erro; enquanto a causa não estiver identificada, cobrir a rota com ErrorBoundary e mensagem de erro para não deixar o ecrã em branco. Tratar este percurso como bloqueador do parecer do Core para o papel auditor.',
    check:
      'Um auditor abre /audit-package num tenant com pacotes, vê o pacote mais recente e gera um novo sem erro de runtime.',
  },

  // ─── Administração da plataforma ─────────────────────────────
  {
    id: 'FB1',
    area: 'administracao',
    severity: 'critica',
    status: 'corrigido',
    statusNote:
      'Existe provisionamento: `provisionTenantLicense` (create/update/suspend/resume/set_module/set_standard, só master_admin ou o administrador de parceiro dentro da carteira) e `listTenantLicenses` para a leitura com o âmbito resolvido no servidor — nenhuma entidade de licenciamento é escrita pelo frontend. O painel TenantLicensePanel cobre agora todas as operações da recomendação: nível, lugares, validade, notas, excepções por módulo com motivo e validade e standards por cliente. O histórico deixou de faltar: `provisionTenantLicense` escreve `LicenseChangeLog` (autor, papel, motivo, campos alterados e o antes/depois da subscrição, dos módulos e dos standards) e `listLicenseChanges` é a única porta de leitura, com o âmbito no servidor (dono da plataforma = tudo, administrador de parceiro = carteira) e filtros de cliente, tipo e intervalo de datas aplicados antes da paginação; o cartão «Histórico de licenciamento» em /licensing mostra-o. Os casos FB1.1–FB1.13 do harness verificam autorização, criação, tier inválido, duplicação, excepção por módulo com validade, suspensão com tolerância e fecho fail-closed no fim dela, reactivação, recusa fora da carteira, o conteúdo do histórico (autor e antes/depois em cada alteração) e o 403 de quem não tem competência para o ler. O enum `action` do `AuditLog` foi corrigido para incluir as acções `license_*` que já eram escritas — num backend real a trilha era inválida. Verificado localmente: o histórico deixou de depender da entidade `AuditLog`, que a sessão do emulador não consegue ler.',
    title: 'Sem provisionamento de licenças: o master_admin não consegue ativar nem alterar um tenant',
    evidence: [
      'src/pages/Licensing.jsx:64 e src/components/dashboard/PlatformAdminDashboard.jsx:32 — TenantSubscription é apenas lido (list). Não existe qualquer create/update em src/ para TenantSubscription.',
      'O mesmo para TenantModule, TenantEntitlementOverride e LicenseStandard: só leitura (Licensing.jsx).',
      'As únicas escritas de licenciamento estão em funções sem interface: base44/functions/seedLicenseData e base44/functions/migrateExistingLicenses.',
      'src/lib/license.js — o gating é fail-closed: sem licença resolvida (status "error") nenhum módulo abre (isModuleLicensed devolve false).',
    ],
    impact:
      'Provisionar, suspender, mudar de tier, ajustar módulos/assentos ou emitir um override por cliente exige executar funções internas ou escrever na base de dados. Com o fail-closed já aplicado, um cliente novo fica com todos os módulos fechados e não há forma de os abrir pela plataforma — a operação comercial depende de suporte técnico e a plataforma não se mantém sozinha.',
    recommendation:
      'Construir o painel de licenciamento por cliente: estado da subscrição, tier, assentos, módulos e standards, overrides com motivo e validade, histórico de alterações e auditoria. Expor funções de backend dedicadas (criar/renovar/suspender/atribuir tier, ajustar assentos, override de módulo) com verificação de papel master_admin e registo em AuditLog, mantendo o frontend sem escrita direta em entidades de licenciamento.',
    check:
      'O master_admin cria a subscrição de um cliente novo, escolhe o tier e os assentos, e o cliente passa a ver exatamente os módulos contratados sem intervenção técnica.',
  },
  {
    id: 'FB2',
    area: 'administracao',
    severity: 'alta',
    status: 'corrigido',
    statusNote:
      'As três páginas passaram a estar no grupo «Gestão da plataforma» de `src/lib/sidebarGroups.js`, com o mesmo recurso `organization` que o `RouteGuard` já lhes aplicava — `/workspaces`, `/user-assignments` e `/admin` —, sem duplicar a entrada de Organização. Verificado no preview com o `master_admin`: os três itens aparecem no menu (Workspaces, Delegações, Administração) e a visibilidade continua a ser decidida pela matriz, pelo que os restantes papéis não os vêem.',
    title: 'Páginas de administração inalcançáveis pela navegação',
    evidence: [
      'src/lib/sidebarGroups.js — BASE_GROUPS não inclui /admin, /workspaces nem /user-assignments (verificação por item devolve zero ocorrências).',
      'src/App.jsx:103,127,131 — as três rotas existem, com RouteGuard mapeado para a capacidade organization (src/lib/rbac.js).',
      'A única porta de entrada é um atalho de texto em src/pages/Organization.jsx:97 (→ /workspaces).',
    ],
    impact:
      'A gestão da árvore de workspaces, a gestão de delegações e a consola de plataforma existem mas não se encontram: o grupo «Gestão da plataforma» parece completo e não é. Quem não conhecer os URLs não descobre os recursos, e o master_admin perde ferramentas que a plataforma já tem.',
    recommendation:
      'Incluir os três itens no grupo de gestão da plataforma (ou no grupo Dev, no caso da consola interna), com o mesmo gating por capacidade que já usam, e ajustar o grupo para não duplicar a entrada de Organização. Manter a regra de espelhar a lista de RouteGuard no Sidebar, já seguida no resto da aplicação.',
    check:
      'Um master_admin encontra workspaces, delegações e consola de plataforma no menu, sem conhecer URLs; os restantes papéis não os vêem.',
  },
  {
    id: 'FB3',
    area: 'administracao',
    severity: 'alta',
    status: 'parcial',
    statusNote:
      'O seletor de workspace passou a ter consumidor: `tenantResolver.js` lê `selected_workspace_id` com prioridade sobre o tenant próprio e resolve o cliente do workspace escolhido, e o harness verifica o contrato (TEN4 muda mesmo o contexto, TEN5 ignora um workspace fora do âmbito). As páginas leem o mesmo contexto (FA2), pelo que a troca já não fica só num controlo decorativo e nenhuma resolve o tenant por si — o caso TEN6 impede que isso volte a acontecer; falta a confirmação no browser do indicador de contexto.',
    title: 'Seletor de workspace não altera o contexto de dados',
    evidence: [
      'src/components/layout/WorkspaceSwitcher.jsx — grava `selected_workspace_id` com base44.auth.updateMe e filtra a lista de workspaces acessíveis.',
      'Nenhum ficheiro de src/ ou base44/ lê `selected_workspace_id` (verificação global: zero consumidores fora do próprio componente).',
      'As páginas operacionais e src/lib/workspace.js continuam a resolver o âmbito por user.workspace_id / customer_id.',
    ],
    impact:
      'O administrador de plataforma ou de parceiro troca de workspace e nada muda nos dados apresentados — funciona como controlo decorativo. Pior: cria a expectativa de que se está a operar num tenant diferente do real, o que num contexto de conformidade é uma fonte direta de erro operacional.',
    recommendation:
      'Ligar a troca de workspace a um contexto efetivo: um único resolvedor (o mesmo `useActiveCustomer()` de FA2) que derive do workspace selecionado os customer_ids em âmbito e o tenant mostrado no cabeçalho, com indicação visível de qual o contexto ativo. Se a ligação não for feita nesta fase, retirar o controlo para não prometer o que não faz.',
    check:
      'Trocar de workspace altera as listas e o indicador de contexto, e o que se vê corresponde ao workspace escolhido.',
  },
  {
    id: 'FB4',
    area: 'administracao',
    severity: 'media',
    status: 'corrigido',
    statusNote:
      'Existe consola: `/platform-operations` (automações e conservação), ligada ao grupo «Gestão da Plataforma» com o recurso `system_status` — o mesmo que o RouteGuard já aplicava —, pelo que só o master_admin a alcança. Mostra a última execução, a duração, o estado e o erro de cada uma das oito automações (a partir de `WorkflowRun`, escrito pelo `withWorkflowRun`), guarda a política de conservação por entidade e por tenant (com as acções suportadas por entidade — um pedido de titular não tem arquivo: 422) e simula a purga sem apagar nada. A política deixou de ser decorativa: `dataRetentionPurge` passou a aplicá-la com a mesma regra da simulação (prazo contado desde a entrada do registo, política do tenant sobre a global) e mantém a regra por registo quando não há política. Verificado no preview: oito automações listadas, execução da automação de purga registada (Sucesso, 11 ms), política gravada e simulação apresentada. Ao fechar o achado apareceu um defeito maior: as oito automações envolvidas pelo `withWorkflowRun` referenciavam `req` fora do âmbito do pedido (`Deno.serve(withWorkflowRun(…, req, …))`), pelo que falhavam ao carregar e **nunca corriam nem registavam execução** — a assinatura passou a `Deno.serve((req) => withWorkflowRun(…, req, …))`. Residual: a aplicação da política a registos reais não é reproduzível no emulador local, que recusa a criação de `DataProcessingActivity`/`DataSubjectRequest` (403 Permission denied) — confirma-se em backend real.',
    title: 'Conservação de dados e automações agendadas sem configuração nem visibilidade',
    evidence: [
      'base44/workflows/Data Retention Purge.jsonc — trigger agendado (cron 0 2 * * *) que chama dataRetentionPurge.',
      'base44/functions/dataRetentionPurge/entry.ts — purga/arquiva/anonimiza DataProcessingActivity e DataSubjectRequest com base em retention_expiry_date / retention_purge_date / retention_action de cada registo.',
      'Não existe interface (nem capacidade declarada) para definir prazos por entidade ou tenant, simular a execução ou consultar o resultado; SystemStatus.jsx mostra apenas utilizadores ativos, eventos de auditoria, logins falhados, contagem de entidades e armazenamento estimado.',
      'Os restantes 7 workflows (lembretes de documentos e riscos, notificações, snapshot mensal) também não têm visibilidade de execução nem de falha.',
    ],
    impact:
      'O master_admin não consegue demonstrar nem ajustar requisitos de conservação e eliminação (RGPD/NIS2) sem acesso técnico à automação, e não tem como saber se uma automação correu, falhou ou está parada — uma falha silenciosa de purga ou de lembretes só se descobre pelo impacto no cliente.',
    recommendation:
      'Um painel de automação e conservação: última execução, duração e erro de cada workflow; política de prazos por entidade e por tenant; execução simulada (dry-run) antes de aplicar; e registo consultável de purgas/anonimizações no AuditLog. É a contrapartida operacional das automações que já existem.',
    check:
      'O master_admin vê a última execução de cada automação, define o prazo de conservação de um tenant e simula a purga sem apagar dados.',
  },
  {
    id: 'FB5',
    area: 'administracao',
    severity: 'media',
    status: 'parcial',
    statusNote:
      'A decisão passou para o servidor: `base44/functions/listAuditLog` resolve o âmbito (master_admin vê tudo, auditor vê o seu tenant e as delegações vivas — registos sem `customer_id`, isto é de plataforma, só ao master_admin), aplica os filtros de ação, entidade, utilizador e intervalo de datas antes da paginação, devolve as facetas do âmbito inteiro (e não da página carregada), pagina por cursor opaco e devolve o total. /audit-log passou a usar a função: os seletores deixam de ser derivados da janela de 500 registos, há recorte temporal, a pesquisa livre é refinamento local do resultado já filtrado, o estado de erro da leitura é próprio e a exportação em CSV leva o resultado filtrado. Verificado localmente por chamada directa à função (200 com registos, facetas e intervalo de datas vazio a devolver zero), que é também o caminho que faz o master_admin voltar a ler a trilha no emulador; falta confirmar em backend real o âmbito do papel auditor, que o emulador de sessão única não distingue.',
    title: 'Trilha de auditoria sem filtros de servidor nem exportação',
    evidence: [
      'src/pages/AuditLog.jsx — useInfiniteQuery com páginas de 500 registos e filtragem em memória por ação/utilizador/entidade/texto; os filtros só abrangem a janela já carregada, a lista de valores possíveis (uniqueActions/uniqueUsers) é derivada desses mesmos registos e não há intervalo de datas.',
      'Não existe exportação da trilha (sem CSV/PDF; «report_exported» aparece apenas como cor de ação no mapa de estilos).',
    ],
    impact:
      'Num tenant com histórico grande, os filtros dão respostas incompletas sem o dizer e o utilizador pode concluir que um evento não existe quando apenas não está na janela carregada. Para efeitos de auditoria e de resposta a incidentes falta o essencial: recorte temporal fiável e prova exportável.',
    recommendation:
      'Filtros de servidor (intervalo de datas, ação, entidade, utilizador) na consulta da entidade, com paginação por cursor, e exportação do resultado filtrado (CSV e, se necessário, PDF com o mesmo gerador dos relatórios). Manter a pesquisa livre apenas como refinamento local do resultado já filtrado.',
    check:
      'Filtrar por um intervalo de datas antigo devolve eventos fora da primeira página e a exportação contém exatamente o resultado filtrado.',
  },
  {
    id: 'FB6',
    area: 'administracao',
    severity: 'media',
    status: 'corrigido',
    statusNote:
      'Consolidação feita por divisão de papéis: o dashboard de plataforma (`PlatformAdminDashboard`, rota `/`) é a única consola de indicadores e o `/admin` é a área de operações administrativas. Os quatro gráficos duplicados do `/admin` (maturidade por setor, estado dos clientes, uso de frameworks e quebra de riscos — os mesmos que o `PlatformOverview` desenha a partir das mesmas entidades) foram removidos com os cálculos que os alimentavam; ficaram os cartões com drill-down, o ranking por cliente e a gestão de lugares. Cada página liga à outra e o AGENTS.md regista qual é a consola de plataforma. Verificado no preview: `/admin` não desenha nenhum gráfico (0 superfícies de gráfico) e mantém os cartões de indicadores como botões com drill-down; a ligação «Abrir o painel de indicadores» abre mesmo o dashboard, que é onde ficam os quatro gráficos e a ligação «Operações administrativas» de volta ao `/admin`.',
    title: 'Duas consolas de plataforma sobrepostas',
    evidence: [
      'src/pages/Admin.jsx (678 linhas) — dashboards de clientes, utilizadores e avaliações com drill-down, sobre os mesmos dados.',
      'src/components/dashboard/PlatformAdminDashboard.jsx — widgets de distribuição por tier, estado de subscrições, adoção de módulos, crescimento de tenants, volume de auditoria, consumo de IA e subscrições a expirar.',
      'As duas páginas leem as mesmas entidades (Customer, User, Assessment, TenantSubscription) em consultas separadas.',
    ],
    impact:
      'Há duas respostas para «onde está a consola da plataforma?», com consultas e cálculos duplicados e risco de números divergentes. Qualquer evolução das métricas tem de ser feita duas vezes, e a duplicação já produziu uma página fora da navegação (FB2).',
    recommendation:
      'Consolidar numa única consola: o dashboard de plataforma como vista de indicadores e a página /admin como área de operações administrativas (ou removida, absorvendo os drill-downs no dashboard). Registar no AGENTS.md qual é a consola de plataforma, para não voltar a divergir.',
    check:
      'Existe um único ponto de entrada para as métricas de plataforma e um único local onde as alterar.',
  },
  {
    id: 'FB7',
    area: 'administracao',
    severity: 'media',
    status: 'corrigido',
    statusNote:
      'Decisão explicitada e documentada: o catálogo (tiers, módulos, standards) mantém-se curado em código — `src/lib/licenseModules.js` no frontend, `base44/shared/licenseGuard.ts` no backend — e as entidades de catálogo passam a estar documentadas como espelho semeado por `seedLicenseData`/`migrateExistingLicenses`, que reescrevem tudo a partir de `modulesForTier`. A secção «Módulos e licenciamento» de `/documentacao-tecnica` (e o PDF que sai do mesmo modelo) ganhou o bloco «Catálogo comercial: onde vive e como se altera», e a página `/licensing` mostra o mesmo aviso. A gestão diária é a atribuição por cliente, que já existe na interface (FB1); a curadoria continua a passar por código revisto, não por edição de dados.',
    title: 'Catálogo comercial (tiers, módulos, standards) apenas de leitura',
    evidence: [
      'src/pages/Licensing.jsx — lê LicenseTier, LicenseModule, LicenseStandard e TenantSubscription e apresenta-os; não há criação nem edição.',
      'O conteúdo do catálogo vive em src/lib/licenseModules.js (MODULE_META, TIER_MODULES, COMMERCIALLY_AVAILABLE_TIERS) e nas funções seedLicenseData / migrateExistingLicenses.',
    ],
    impact:
      'Criar um tier, renomear um módulo, mudar o que um pacote inclui ou acrescentar um standard obriga a alterar código e a reimplementar — não é gestão de plataforma. Em contrapartida, a atribuição desses mesmos tiers aos clientes é que está ausente (FB1), o que inverte as prioridades: o catálogo é estável, a atribuição é operação diária.',
    recommendation:
      'Separar explicitamente as duas coisas: manter o catálogo (tiers/módulos/standards) em código e versão controlada, tratando as entidades de catálogo como espelho semeado — e documentá-lo —, e investir primeiro na atribuição por cliente (FB1). Se o catálogo tiver de ser gerido pela plataforma, acrescentar edição com validação de coerência entre tiers cumulativos e módulos em oferta.',
    check:
      'A documentação técnica diz onde vive o catálogo e qual é o caminho para o alterar; a gestão diária (atribuir tiers) é feita na interface.',
  },
  {
    id: 'FB8',
    area: 'administracao',
    severity: 'media',
    status: 'corrigido',
    statusNote:
      'Canal de anúncios implementado: entidade `PlatformAnnouncement` (título, mensagem, severidade, âmbito, janela, estado) e uma única porta de escrita, `manageAnnouncements` — `active` resolve o âmbito no servidor (global / tier / cliente) a partir das subscrições e dos clientes que o utilizador pode ler, `overview`/`publish`/`update`/`archive` são master_admin e todas as escritas ficam na trilha de auditoria. No layout, `AnnouncementBanner` mostra a faixa por severidade (informação/aviso/manutenção), revalida a cada 5 min, e só com sessão iniciada, e dispensa por sessão; a publicação e o histórico vivem em `/platform-operations`. A entidade só é legível por master_admin, pelo que o âmbito nunca é decidido no browser. Os três âmbitos passaram a ser exercidos pelo harness (ANN1–ANN7): um anúncio global chega a um utilizador de tenant; um anúncio do tier `advanced` não aparece a quem só tem subscrição `core` (e o de `core` aparece-lhe, enquanto o dono da plataforma vê ambos); um anúncio de cliente chega a esse cliente e não a outro; uma janela de exibição futura mantém-no escondido; arquivá-lo retira-o da faixa; publicar é recusado a um `customer_admin` (403) e um âmbito por tier sem `tier_code` é rejeitado (422). No preview, o ciclo publicar → faixa no layout → arquivar foi exercido pela própria consola, ficando a linha arquivada no histórico.',
    title: 'Sem canal de comunicação da plataforma para os tenants',
    evidence: [
      'src/components/layout/NotificationBell.jsx — lê base44.entities.Notification filtradas por user_email (notificações individuais) e faz polling de 60 s.',
      'Não existe entidade nem capacidade de anúncio/aviso de serviço dirigido a tenants; a única comunicação global é o bloqueio temporário de MaintenanceWindow via MaintenanceGuard e os emails de relatório.',
    ],
    impact:
      'O master_admin não tem forma de avisar os clientes dentro da aplicação sobre manutenção programada, mudanças de funcionalidades, incidentes ou novos módulos — depende de email externo à plataforma. Num produto de conformidade, avisos de indisponibilidade são informação operacional que deve ficar registada no produto.',
    recommendation:
      'Anúncios da plataforma com âmbito (global, tier, cliente), janela de exibição e severidade (informação, aviso, manutenção), apresentados como faixa no layout e a reutilizar a janela de manutenção já existente; histórico consultável e auditoria de publicação.',
    check:
      'Um anúncio publicado para um tier aparece aos utilizadores desse tier, dentro do período definido, e não a quem não pertence ao âmbito.',
  },

  // ─── UX/UI e consistência visual ─────────────────────────────
  {
    id: 'FC1',
    area: 'ux',
    severity: 'media',
    status: 'corrigido',
    statusNote:
      'Fonte única de título. A duplicação real era a barra de contexto (TopBar) mais o `<h1>` do AppLayout com o mesmo texto — o título da página passa a existir só na barra de contexto, agora como `h1`, e o AppLayout deixou de o repetir. O PageHeader deixou de renderizar títulos de página: reserva-se à descrição e às ações e, quando usado dentro de uma secção ou aba (Formação), dá um título de secção em `h2`. `PAGE_TITLE_KEYS` foi completado com as rotas que faltavam (/audit-package, /documentacao-tecnica, /validacao-seguranca), para que nenhuma página caia no título genérico. Verificado no preview em /admin e /customers: exactamente um `h1` visível por página. Residual: /assessments/:id, /framework-guide e /knowledge-base mantêm um `h1` de conteúdo (nome do registo) além do título da página.',
    title: 'Título da página duplicado (TopBar e PageHeader)',
    evidence: [
      'src/components/layout/TopBar.jsx — o cabeçalho global apresenta sempre o título da rota (PAGE_TITLE_KEYS → pageTitle) num h2.',
      '33 páginas repetem o título em PageHeader (h1) — ActionPlan, Admin, Assessments, AuditLog, AuditPackage, ComplianceJourney, ComplianceMetrics, Configuration, Customers, DSRManagement, DocumentAuditTrail, EmailReport, ExternalAccess, IncidentManagement, Licensing, Organization, PolicyAttestation, QuestionBank, Recommendations, Reports, RiskAssessment, RoPA, Settings, StrategicReport, Suppliers, SupplyChain, SystemStatus, Tasks, TechnicalDocs, Training, UserAssignments, VulnerabilityManagement, Workspaces.',
      'Em Organization.jsx:53 e noutros casos o PageHeader é usado apenas com descrição, prova de que o padrão tem duas variantes conviventes.',
    ],
    impact:
      'Duas hierarquias de título na mesma página: o mesmo texto aparece duas vezes, um em contexto de navegação e outro em corpo de página, o que se lê como ruído e desalinha a estrutura de cabeçalhos (acessibilidade). Consome também altura útil no topo de todas as páginas.',
    recommendation:
      'Escolher uma fonte única para o título: manter o TopBar como barra de contexto (título + breadcrumb) e reservar o PageHeader para descrição e ações, removendo-lhe o título — ou o inverso, retirando o título do TopBar. Aplicar a decisão em bloco, com verificação visual de duas ou três páginas, em vez de corrigir caso a caso.',
    check:
      'Cada página tem exatamente um título visível e a mesma distância entre o topo e o primeiro conteúdo.',
  },
  {
    id: 'FC2',
    area: 'ux',
    severity: 'media',
    status: 'corrigido',
    statusNote:
      'A cor deixou de ter um ponto de decisão por página: `src/lib/palette.js` é o único sítio onde uma cor de UI se resolve — a escala `chart-1..5`, a escala de risco `--risk-*` com o texto legível que lhe corresponde e o nível de risco derivado do par impacto × probabilidade — e `tailwind.config.js` passou a expor `risk-*` e `status-*` como cores do tema, para que um chip escreva `bg-risk-high/10 text-risk-high` em vez de um literal. Passaram a ler os tokens: as quatro séries do painel de plataforma (PlatformOverview — setores, estados de cliente e estados de risco, agora com a cor presa ao dado em vez do índice da célula), a tendência de exposição (RiskExposureTrend, pontos incluídos), os dois mapas de calor (RiskHeatmap e TaskHeatmap — as células passaram a seguir as quatro zonas da legenda, com o texto sempre legível sobre a cor), o emblema de papel da documentação técnica, as paletas de estado em código (`complianceUtils`, `validationReportData`, `WORKSPACE_TYPES`), os emblemas de papel e a barra de lugares (`CustomerSeatSection`), os avisos do assistente de avaliação e do relatório de validação, o catálogo de cores dos frameworks da base de conhecimento (`kbFrameworks`, com a mancha do chip derivada do mesmo token) e as páginas de erro e indicadores de carregamento (`PageNotFound`, `UserNotRegisteredError`, `App`, `ProtectedRoute`). Medição com a mesma pesquisa da ronda anterior: as classes de paleta rígida em `src/` deixaram de existir fora da prosa deste próprio relatório. Verificado no preview com o tema escuro ativo: os emblemas de severidade de `/validacao-seguranca` resolvem para `--status-warning` (rgb(251,197,35) a 10% do mesmo token) e para `--chart-3` (rgb(232,140,48)), o painel e a base de conhecimento continuam a render sem erros novos de consola (só os dois timeouts conhecidos do websocket do SDK). Por confirmar no browser: os mapas de calor e a tendência de risco, que vivem em `/risk-assessment` — rota fechada nesta sessão local, porque o master_admin não tem rotas de conformidade e o gating de licença fecha o módulo; e a mancha dos chips de framework da base de conhecimento, porque nenhum artigo semeado localmente traz `framework`. Excepções deliberadas, onde um token CSS não se aplica: os triplos RGB de `SCOPE_ACCENTS`/`TIER_ACCENTS` (`TechnicalDocs`/`docsModel`) alimentam também o jsPDF da exportação, que não resolve variáveis CSS; e os corpos HTML dos e-mails de questionário e de formação, que os clientes de correio renderizam sem as folhas de estilo da aplicação.',
    title: 'Paletas de gráficos e de pesquisa fora dos tokens do design system',
    evidence: [
      'src/pages/Admin.jsx:30 — COLORS com seis valores hsl() rígidos, usados nas séries dos gráficos.',
      'src/pages/ComplianceMetrics.jsx:16 — CHART_COLORS com hex (#ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7).',
      'src/pages/TaskAnalytics.jsx:17 — COLORS com hex (#2563eb, #10b981, #f59e0b, #ef4444).',
      'src/components/layout/GlobalSearch.jsx — cores e fundos Tailwind fixos por tipo de resultado (text-orange-500/bg-orange-50, text-blue-500, text-green-500, text-purple-500).',
      'Em contraste, SystemStatus.jsx e EmailReport.jsx usam hsl(var(--chart-1..5)).',
    ],
    impact:
      'A mesma grandeza (por exemplo, risco alto) pode ter cores diferentes conforme a página, e nenhuma dessas paletas acompanha o tema escuro por não passar pelos tokens. São também os únicos pontos onde a cor não se altera num só sítio — exatamente o que o design system existe para evitar.',
    recommendation:
      'Substituir as três paletas rígidas pelas variáveis chart-1..chart-5 já definidas em src/index.css e usar os tokens semânticos (destructive, accent, primary, chart-*) na pesquisa global. Onde houver escala de risco, mapear às variáveis --risk-low/--risk-medium/--risk-high/--risk-critical, que já existem e já estão validadas em contraste.',
    check:
      'Nenhum gráfico ou chip da interface declara cor fora dos tokens, e todos continuam legíveis com o tema escuro ativo.',
  },
  {
    id: 'FC3',
    area: 'ux',
    severity: 'media',
    status: 'corrigido',
    statusNote:
      'Todas as mensagens visíveis encontradas passaram a chaves de tradução PT/EN, novas em `src/lib/translations-phase1.js`. O ExternalAccess estava integralmente em inglês — não só as sete mensagens de retorno: diálogos, rótulos, notas de apoio, estados vazios e cabeçalhos de secção foram todos traduzidos. Além dele: QuestionBank (três mensagens e os dois diálogos de confirmação), Customers (três mensagens de erro), NominationsPanel, ReminderSettingsPanel, SystemStatus (os 13 ENTITY_LABELS), TaskAnalytics (estados de tarefa e vazios), StatCard («vs last period»), StrategicReport (escala de maturidade) e os rótulos de nível de acesso e estado de `src/lib/delegation.js`, que passaram a `labelKey`/`descriptionKey` e são usados em ExternalAccess e UserAssignments. Verificação: não resta nenhum `toast.*`/`confirm()` com texto literal em inglês em src/pages e src/components (fora do ui/).',
    title: 'Mensagens de retorno em inglês numa interface em português',
    evidence: [
      'src/pages/ExternalAccess.jsx:84,181,287,293,299,305,311 — toast.success com «Delegation request sent», «Onboarding created», «Delegation approved/rejected/revoked», «Onboarding accepted/revoked».',
      'src/pages/QuestionBank.jsx:101,173 — «All questions already have a Portuguese translation!», «No duplicates found — your question bank is clean!».',
      'src/pages/Customers.jsx:50,64,76 — «Failed to create customer» / «Failed to update customer» / «Failed to delete customer».',
      'src/components/documents/NominationsPanel.jsx:110 e src/components/settings/ReminderSettingsPanel.jsx:57 — mensagens em inglês.',
      'src/pages/SystemStatus.jsx — ENTITY_LABELS em inglês («Security Documents», «Knowledge Articles») apresentados em lista.',
    ],
    impact:
      'São mensagens de retorno e de erro — o momento em que o utilizador mais precisa de perceber o que aconteceu — na língua errada, no meio de uma interface integralmente PT-PT. Quebra a consistência linguística, que é um requisito explícito do produto, e é o tipo de detalhe que aparece primeiro numa demonstração a um cliente.',
    recommendation:
      'Passar as cadeias encontradas para chaves de tradução (translations-ui.js e afins) com entradas PT/EN, como já acontece no resto da aplicação, e acrescentar ao guia interno a regra de nunca escrever texto de interface fora do sistema de traduções. Verificar também rótulos técnicos (ENTITY_LABELS) e nomes de tipos em mensagens de erro.',
    check:
      'Nenhuma mensagem visível ao utilizador está em inglês nas páginas listadas, com a aplicação em português.',
  },
  {
    id: 'FC4',
    area: 'ux',
    severity: 'media',
    status: 'parcial',
    statusNote:
      'A decisão deixou de ser só heurística: o rótulo (ou o atributo explícito `data-capability`) apenas indica *que ação* o controlo representa, e quem decide é a matriz — `can(effectiveRole, ação, recurso)`, com o recurso vindo da rota atual. Sem recurso identificado não há bloqueio (era o falso positivo da heurística), a navegação nunca é bloqueada, e a submissão de formulário é intercetada no evento `submit` (por captura), pelo que o envio por teclado também é recusado. Falta a verificação no preview com uma simulação ativa a submeter um formulário (e a confirmar que a navegação continua livre), que é o critério do achado.',
    title: 'Bloqueio de escrita na simulação de papel por heurística de texto e ícone',
    evidence: [
      'src/components/layout/AppLayout.jsx — WriteBlocker interceta cliques por captura e decide pelo texto do botão (lista de palavras PT+EN: novo, editar, guardar, eliminar, criar, save, delete, edit, new, create, update, send, submit, upload, import, approve, reject) ou pela classe do ícone.',
      'src/lib/RoleSimulationContext.jsx documenta que a simulação é «view-only» e que «bloqueia ações de escrita na UI», mas useEffectiveRole é consumido em apenas 4 ficheiros (Sidebar, RouteGuard, Dashboard, KnowledgeBase) — as restantes páginas decidem pelo papel real.',
    ],
    impact:
      'O bloqueio falha nos dois sentidos: deixa passar escrita por ícone não mapeado, por tecla Enter em formulário ou por componente que não seja um botão, e bloqueia navegação legítima cujo rótulo contenha uma dessas palavras. Um master_admin a inspecionar a plataforma «como» outro papel não tem garantia de estar a ver o comportamento real desse papel — o que enfraquece o valor da própria ferramenta de simulação.',
    recommendation:
      'Substituir a heurística por uma decisão de capacidade: um wrapper de mutação/ação que consulta a matriz (can(effectiveRole, ação, recurso)) e recusa a operação, mais o uso de useEffectiveRole nas páginas que hoje leem o papel real. Enquanto o bloqueio for heurístico, dizer na faixa de simulação que a simulação é visual e não impede toda a escrita.',
    check:
      'Com a simulação ativa, submeter um formulário por teclado também é recusado, e continuar a navegar não é bloqueado.',
  },
  {
    id: 'FC5',
    area: 'ux',
    severity: 'baixa',
    status: 'parcial',
    statusNote:
      'Passa a haver um indicador de carregamento só: `LoadingState`, que ganhou `variant="skeleton"` — linhas pulsantes que reservam o espaço da lista em vez de um spinner que a faz saltar. Substituiu os indicadores próprios das páginas (Workspaces, UserAssignments, PolicyAttestation, ExternalAccess, SystemStatus, Training e a tabela de Customers), e o vazio passa por `EmptyState` com mensagem específica da página. Residual: três tabelas (Admin, Organization, Licensing) mostram ainda uma linha própria com a mensagem traduzida em vez do componente partilhado.',
    title: 'Padrões de carregamento e de vazio divergentes entre páginas',
    evidence: [
      'src/components/shared/LoadingState.jsx é usado em 16 páginas (Customers, Assessments, Reports, ComplianceJourney, AuditPackage…), mas há spinners inline em 26 páginas (SystemStatus, Customers, Admin…) e textos próprios noutras (KnowledgeBase usa a chave kb_loading).',
      'O vazio também varia: EmptyState em 18 páginas, listas vazias sem mensagem noutras, e a página /admin apresenta zero em cartões em vez de um estado vazio.',
    ],
    impact:
      'O utilizador vê três formas diferentes de «a carregar» e de «não há dados» conforme a página, o que torna a aplicação mais lenta do que é (o spinner inline não reserva espaço) e faz com que falhas reais passem por «página vazia» (ver FA4).',
    recommendation:
      'Concentrar carregamento e vazio em LoadingState/EmptyState com um par de props (mensagem, ação) e substituir os spinners inline por esqueletos que reservem o espaço da lista; fixar o padrão no guia interno para as próximas páginas.',
    check:
      'Todas as listas usam o mesmo indicador de carregamento e o mesmo componente de vazio, com mensagem específica da página.',
  },
  {
    id: 'FC6',
    area: 'ux',
    severity: 'baixa',
    status: 'corrigido',
    statusNote:
      'Nome acessível nas ações de ícone e operação por teclado: Workspaces (expandir/recolher com aria-label e aria-expanded; adicionar, editar e eliminar nó com aria-label e title, e as ações passam a aparecer quando recebem foco), Customers (menu de ações do cliente e fecho do painel com nome acessível; a linha abre o detalhe com Enter/Espaço, com foco visível e nome próprio) e Admin (o StatCard é agora `role="button"` com `tabIndex` e nome, abrindo o detalhe por Enter — verificado no preview: o cartão recebe foco e a tecla abre o diálogo de detalhe). Os badges de estado e severidade já levavam rótulo textual além da cor (StatusBadge). Percorrer Customers e Workspaces só com teclado dá nome e ordem previsível a cada ação.',
    title: 'Acessibilidade fraca em ações de ícone e em tabelas interativas',
    evidence: [
      'Verificação sobre 45 páginas: 14 aria-label no total; botões só de ícone sem nome acessível em Workspaces (adicionar/editar/eliminar nó), Customers (abrir detalhe), Admin (drill-down e fecho) e nas barras de ações de listagem.',
      'Os ícones de estado e de severidade não têm texto alternativo consistente e dependem apenas da cor em vários cartões (badges de severidade e StatusBadge).',
    ],
    impact:
      'Quem usa leitor de ecrã ouve «botão» sem função; quem não distingue cor perde a informação de estado. São as ações destrutivas e de contexto (eliminar nó de workspace, abrir cliente) que ficam sem nome — precisamente as que exigem mais confirmação.',
    recommendation:
      'Nome acessível (aria-label ou texto visível) em todas as ações de ícone, sobretudo nas destrutivas; nos badges de estado e severidade, juntar o rótulo textual ao símbolo de cor; verificar o contraste das variantes de badge em tema claro e escuro. Um teste de teclado e leitor de ecrã em três páginas-chave (Customers, Workspaces, AuditLog) serve de referência.',
    check:
      'Percorrer Customers e Workspaces apenas com teclado e leitor de ecrã: cada ação tem nome e ordem previsível.',
  },

  // ─── Observação de segurança desta ronda ─────────────────────
  {
    id: 'FS1',
    area: 'seguranca',
    severity: 'baixa',
    status: 'corrigido',
    statusNote:
      '`isStandardLicensed` (src/lib/license.js) passou a fechar por omissão, exactamente como `isModuleLicensed`: sem licença resolvida, com a licença em estado de erro ou com um payload sem `standards` válido, nenhum standard fica licenciado. O helper continua sem consumidores na interface, mas deixou de haver um caminho permissivo com o nome da política de licenciamento. A política fica descrita num único sítio: AGENTS.md («Licensing is fail-closed») com os dois helpers lado a lado.',
    title: 'isStandardLicensed continua fail-open, ao contrário do gating de módulos',
    evidence: [
      'src/lib/license.js:71 — isStandardLicensed devolve true quando não há licença, quando `standards` não é array e quando a licença está em erro; só nega se o código estiver ausente de um array válido.',
      'src/lib/license.js:51 (isModuleLicensed) foi o mesmo padrão corrigido para fail-closed na ronda anterior — a política uniforme não foi aplicada ao gating por standard.',
      'Verificação de consumidores: nenhuma página ou componente chama isStandardLicensed/hasEntitlement atualmente (a restrição por standard não é aplicada na UI).',
    ],
    impact:
      'Não há risco ativo porque o helper está sem consumidores, mas fica na base de código um caminho fail-open com o nome da política de licenciamento: a primeira página que precise de restringir por standard herda um default permissivo e ninguém dá por isso — é assim que um gating se perde. A contradição com isModuleLicensed torna também a regra difícil de explicar a quem entrar no projeto.',
    recommendation:
      'Alinhar isStandardLicensed com a política fail-closed já aplicada aos módulos (sem licença resolvida ou payload inválido → não licenciado) ou removê-lo, se a restrição por standard não estiver no roteiro; em qualquer caso, deixar escrito em AGENTS.md qual é a política de licenciamento e onde se aplica.',
    check:
      'Uma licença em erro não deixa passar nenhum standard; a política de licenciamento está descrita num único sítio.',
  },

  // ─── Gestão comercial (auditoria dos fluxos comerciais + plano) ──
  {
    id: 'FM1',
    area: 'comercial',
    severity: 'critica',
    status: 'corrigido',
    statusNote:
      'A oferta passou a ter registo comercial versionado, com packs. Entidade `OfferVersion` (tiers com estado comercializável/preparado e normas por tier, packs com o mesmo estado, vigência e assinatura do catálogo de código em execução), consola «Oferta comercial» em /licensing e função `manageCommercialOffer` — criar rascunho a partir do catálogo em execução, ajustar a decisão comercial de cada tier e de cada pack, publicar (retirando a versão anterior com data de fim) e retirar, sempre com motivo obrigatório —, com histórico próprio `CommercialChangeLog` (o `LicenseChangeLog` é por cliente e não serve uma alteração de plataforma) mostrado no cartão «Histórico comercial». O `provisionTenantLicense` regista na subscrição a versão da oferta e o preço vigentes à data **e obedece à decisão comercial dos packs**: só se contrata (`set_addon`) o pack que a versão em vigor põe à venda — 422 `addon_not_for_sale` nos restantes, que existem no código mas não estão comercializados —, o pack abre os módulos do catálogo e fica na subscrição com o preço da tabela, e a retirada é sempre possível; o painel de provisionamento só oferece os packs à venda, mantendo os contratados para retirada. Verificado no preview (criação do rascunho a partir do catálogo — Core 4 / Profissional 6 / Avançado 8 módulos —, publicação com vigência e consola a mostrar os packs) e no harness: `FM1.1`–`FM1.5` (composição, decisão sobre os packs com recusa de um pack fora do catálogo, publicação com vigência, substituição da versão anterior e contratação só do pack à venda, com o preço da tabela e a retirada a fechar os módulos) e `FM2.3`. Residual deliberado: os módulos de cada tier e de cada pack **não** se editam na consola — continuam no catálogo de código, que é quem decide os acessos (FB7) — e uma versão publicada cuja assinatura já não coincide com o código é assinalada como divergente, não corrigida.',
    title: 'Oferta comercial gerida só em código: tiers, packs/add-ons e normas',
    persona: 'Administrador de plataforma que compõe e comercializa a oferta',
    flow: 'Oferta e preços — compor tiers, packs e normas com versão e vigência',
    evidence: [
      'src/lib/licenseModules.js — MODULE_CODES (9 módulos) e ROUTE_MODULE; base44/shared/licenseGuard.ts:13 TIER_MODULES e :26 COMMERCIALLY_AVAILABLE_TIERS = ["core"] — só o Core é comercializável.',
      'src/pages/Licensing.jsx:160,277,331 — a página apresenta o catálogo de tiers, o de módulos e o de normas; nenhuma criação nem edição (FB7).',
      'base44/entities/LicenseTier.jsonc / LicenseModule.jsonc / LicenseStandard.jsonc — o conteúdo é reescrito por seedLicenseData / migrateExistingLicenses a partir de modulesForTier; as entidades são espelho semeado, não a fonte.',
      'Não existe entidade de pack/acréscimo nem de composição da oferta: a privacidade (RoPA/DSR) está fora de todos os tiers (tier_code "outside_offering", is_active false) e não há caminho para a vender como acréscimo.',
    ],
    impact:
      'A oferta não se compõe sem alterar código e voltar a semear: criar um pack, mover um módulo de tier, marcar Profissional ou Avançado como comercializáveis ou vender a privacidade como acréscimo é trabalho de desenvolvimento. Comercialmente a plataforma tem um só produto — o Core — e não consegue empacotar o que já construiu.',
    recommendation:
      'Consola de oferta na secção «Gestão da Plataforma»: tiers cumulativos (Core ⊂ Profissional ⊂ Avançado), packs/add-ons e normas, com versão e vigência (data de início e de fim) e estado preparado/comercializável. O catálogo de módulos por tier continua curado em código como fonte de verdade e o espelho semeado continua a ser reescrito a partir dele; toda a escrita é feita por função backend com ator real, snapshot antes/depois e registo no histórico de licenciamento (LicenseChangeLog), à imagem de provisionTenantLicense. A oferta passa a versionar-se por vigência, nunca por edição de entidades, e o provisionamento de um cliente usa a versão vigente nessa data.',
    check:
      'O administrador de plataforma cria uma versão de oferta com preço e vigência, marca um pack como comercializável, e o provisionamento seguinte de um cliente usa a versão vigente nessa data — sem alteração de código.',
  },
  {
    id: 'FM2',
    area: 'comercial',
    severity: 'alta',
    status: 'corrigido',
    statusNote:
      'Existe tabela de preços versionada, com preço dos packs. Entidade `PriceTable` — preço base por tier, lugares incluídos, lugar adicional, desconto de pré-pagamento anual, moeda e periodicidade mensal/anual, e **preço por pack/acréscimo** com a quota de IA que ele acrescenta —, escrita pela mesma função (`create_price_table` / `update_price_table` / `publish_price_table` / `retire_price_table`), publicada obrigatoriamente contra uma versão de oferta publicada e substituindo com data de fim a tabela anterior da mesma versão, com o antes/depois no `CommercialChangeLog` (um campo por pack: `addon_price:<código>`). A subscrição regista a tabela e o valor vigentes à data do provisionamento (`price_table_id` / `price_amount_cents`), e o pack contratado fica com o preço da tabela em vigor, pelo que o preço contratado a uma data é reconstruível. Duas verificações encontraram aqui **defeitos reais**, ambos corrigidos: (a) o histórico comercial não devolvia uma linha porque o filtro por acção usava o nome do comando da função multiplexada (passou a `change_action`); (b) `addon_entries` era aceite no corpo do pedido e **silenciosamente descartado** — `normalizeAddonEntries` existia e nunca era chamada, pelo que a tabela gravava sem preço de pack nenhum e sem erro —, agora ligado em `buildPricePatch`. Exercitado pela consola e no harness (`FM2.1`–`FM2.8`: a tabela criada pela consola, publicada contra a oferta publicada, 422 `offer_version_not_published` com a oferta em rascunho, substituição com data de fim, preço do pack na tabela publicada e na edição, 422 para um pack fora do catálogo e o registo na subscrição). Residual: continua sem faturação nem pagamentos (FM6) — o excedente é sinalizado, nunca cobrado.',
    persona: 'Responsável pela oferta da plataforma',
    flow: 'Oferta e preços — preço, versão e vigência',
    evidence: [
      'base44/entities/TenantSubscription.jsonc — os campos são de estado (customer_id, tier_code, status, started_date, expires_date, trial_ends_at, seat_limit, seats_used, monthly_usage_count, grace_until, notes): nenhum preço, valor mensal ou anual, moeda ou desconto.',
      'Nenhuma entidade de preço ou tabela de preços existe em base44/entities (48 entidades); o histórico LicenseChangeLog regista alterações de subscrição, não de oferta nem de preço.',
      'src/lib/licenseModules.js — os tiers têm código e lista de módulos, sem qualquer atributo comercial (preço, periodicidade, unidade de lugares).',
      'Não há versão de oferta: o que um tier inclui só se sabe pelo código da branch em execução, o que impossibilita reconstruir o que foi vendido numa data passada.',
    ],
    impact:
      'Não existe oferta quantificada: não se sabe quanto vale um tier, não há preço por lugar adicional nem por acréscimo, não há versão de preço com vigência nem histórico de alterações de preço. Sem preço não há proposta, nem comparação entre tenants, nem qualquer indicador de receita (FM5) que não seja inventado — e uma alteração de preço não deixa rasto do que estava em vigor antes.',
    recommendation:
      'Tabela de preços versionada por vigência: preço base por tier (periodicidade mensal/anual), preço por lugar adicional e por pack/acréscimo, moeda e estado (preparado/comercializável). Cada alteração entra como versão nova com data de início (e data de fim quando substituída), escrita por função backend com snapshot antes/depois e registo no histórico de licenciamento — nunca uma edição in-place, para que o preço vigente a qualquer data seja reconstruível quando a faturação vier a ser decidida (FM6).',
    check:
      'Um preço novo entra como versão com data de início, a oferta anterior continua consultável e o histórico mostra quem alterou, quando e de que valor para que valor.',
  },
  {
    id: 'FM3',
    area: 'comercial',
    severity: 'alta',
    status: 'corrigido',
    statusNote:
      'Fase 3 aplicada e verificada: o ciclo de vida passou a ter operações próprias em `provisionTenantLicense` — `renew`, `change_tier` e `close` (com `suspend`/`resume` por tolerância, como antes) — todas com motivo obrigatório, registo no `LicenseChangeLog` (antes → depois) e linha de auditoria. Renovar acrescenta um período contratado e regista `renewal_count`/`last_renewed_at`, em vez de reescrever a data, e recusa contratar outro nível pela renovação (422 `use_change_tier`); descer de nível só se aplica depois de o administrador reconhecer explicitamente os módulos excecionais e as normas que o novo nível deixa de cobrir (422 `removals_required` com a lista, e nada é apagado — as exceções ficam inativas com data); fechar fecha o gating sem apagar nada (o contrato fica como histórico, com `closed_at`/`closed_reason`) e devolve o trabalho a tratar do lado do cliente — delegações vivas e pacotes de auditoria em rascunho —, e repetir o fecho dá 409. Na consola, `SubscriptionLifecycleCard` (/licensing) mostra por cliente o nível, a vigência (com o estado `expiring` da janela de 30 dias), o número de renovações, o trabalho a tratar e as ações renovar/mudar de nível/fechar; no painel de plataforma, o `ExpiringSubscriptionsWidget` passou a ler `expires_date` — lia `end_date`, que a subscrição não tem, e por isso a lista de expirações e suspensões estava sempre vazia (defeito corrigido nesta ronda). Verificado no harness: `FM3.1`–`FM3.6`. Residual: a leitura das entidades por RLS e o âmbito de um delegado continuam a exigir backend real (`RLS1`).',
    title: 'Ciclo de vida da subscrição incompleto: sem renovação, upgrade/downgrade, fecho nem trabalho a tratar',
    persona: 'Administrador de plataforma (todo o âmbito) e administrador de parceiro (a sua carteira)',
    flow: 'Subscrições — provisionar, renovar, subir/descer de tier, suspender, reativar e fechar',
    evidence: [
      'base44/functions/provisionTenantLicense/entry.ts:79-89 — as seis ações existentes: create, update, suspend, resume, set_module, set_standard. Não há renovação por período, upgrade/downgrade com decisão sobre módulos excecionais e normas, nem fecho.',
      'Renovar é indistinguível de corrigir: a validade muda por `update` de expires_date e o LicenseChangeLog regista a alteração de campo, não uma renovação.',
      'src/components/licensing/TenantLicensePanel.jsx — cobre nível, lugares, validade, notas, exceções por módulo (com motivo e validade) e normas por cliente; não oferece a operação de ciclo (renovar, fechar) nem assinala o que o novo tier deixa de cobrir.',
      'src/components/dashboard/platform/ExpiringSubscriptionsWidget.jsx — as subscrições a expirar aparecem como indicador num widget, sem lista de trabalho nem ação a partir dele.',
    ],
    impact:
      'A operação comercial é manual e indistinta: renovar reescreve a data sem deixar registo de renovação, descer de tier pode deixar módulos excecionais e normas incoerentes com o que passou a estar contratado, e não há fecho — uma subscrição termina por decurso do prazo (`expired`), não por decisão registada. Sem renovação nem fecho registados também não há base para o churn de FM5, e as expirações próximas não chegam a quem tem de agir.',
    recommendation:
      'Completar o ciclo de vida em provisionTenantLicense, com motivo obrigatório em todos os caminhos: renovar por período, subir/descer de tier com reconhecimento explícito dos módulos excecionais e normas que o novo tier deixa de cobrir, suspender com tolerância, reativar e fechar com nota — cada ação com LicenseChangeLog (antes → after legível) e AuditLog. No painel do tenant, mostrar estado, tier, vigência, tolerância e módulos ativos; na consola comercial, transformar as renovações e expirações próximas numa lista de trabalho a tratar com ação direta.',
    check:
      'Renovar gera um registo de renovação e não uma correção de data; descer de tier obriga a decidir sobre os módulos excecionais; fechar um tenant é uma ação registada; e as renovações dos próximos 30 dias aparecem como trabalho a tratar.',
  },
  {
    id: 'FM4',
    area: 'comercial',
    severity: 'alta',
    status: 'parcial',
    statusNote:
      'Fase 4 aplicada: as quotas passaram a ser contratuais e de negócio. A subscrição ganhou `seat_limit`, `ai_quota_monthly`, o limiar de aviso (`quota_warn_pct`, 80 % por omissão) e a origem (`quota_source_price_table_id`), com os valores por omissão lidos da tabela de preços em vigor (`included_seats`, lugar adicional e `included_ai_calls`); `provisionTenantLicense` ganhou `set_quotas` (motivo obrigatório), `quota_overview` (âmbito resolvido no servidor) e `record_quota_signals`, e a entidade nova `QuotaSignal` guarda por cliente, período e grandeza o nível (`ok`/`warning`/`excess`), a quota, o consumo, a percentagem e o excedente — o registo é idempotente (repetir não duplica) e reversível (a linha volta a `ok`, com o excedente a zero, quando o consumo desce), pelo que a marcação é auditável. A quota sinaliza e nunca bloqueia: o gating continua a abrir os módulos de quem está acima do contratado e não há cobrança automática (FM6). Na consola, `QuotaConsole` (/licensing) mostra por cliente o consumo face ao contratado, o limiar e o excedente, com o `QuotaDialog` para contratar. Verificado no harness: `FM4.1`–`FM4.4` (o registo idempotente é medido num período novo a cada execução — um período fixo só devolvia linhas na primeira execução e o caso acabava a medir a execução anterior). A quota soma o que os packs contratados acrescentam: o `included_ai_calls` de cada pack com preço na tabela em vigor entra na quota contratual do cliente (`addonIncludedAiCalls`). Residual: o cliente ainda não vê a sua própria quota — a leitura vive na consola de plataforma/parceiro, porque a função recusa quem não é dono da plataforma nem administrador de parceiro.',
    title: 'Utilização sem quotas contratuais: lugares e consumo de IA são limites técnicos',
    persona: 'Administrador de plataforma, administrador de parceiro e cliente (leitura da sua própria subscrição)',
    flow: 'Utilização e quotas — consumo face ao contratado, com alertas',
    evidence: [
      'base44/shared/licenseGuard.ts:190,259 — o teto de 1000 invocações de IA por mês é uma constante de código (salvaguarda técnica), não uma quota contratada.',
      'base44/entities/LicenseUsageRecord.jsonc — contador mensal por cliente (customer_id, month, usage_count, reset_date) escrito por enforceUsageLimit; não há valor contratado com que comparar.',
      'base44/entities/TenantSubscription.jsonc — seat_limit e seats_used existem como número de lugares incluídos, sem valor contratado por tier nem limite de aviso.',
      'src/components/dashboard/platform/TopAIConsumersWidget.jsx — mostra os maiores consumidores de IA; não compara com quota nem sinaliza excedente.',
    ],
    impact:
      'O consumo já é medido, mas não é lido como negócio: nenhum tier ou pack define lugares e consumo incluídos, ninguém é avisado antes de esgotar o incluído e um tenant acima do contratado não aparece em lado nenhum. Um lugar a mais ou mil invocações a mais são invisíveis até alguém fazer a conta à mão, e o único limite que o cliente vê é o corte técnico — o que transforma uma conversa comercial num incidente.',
    recommendation:
      'Quotas contratuais por tier e por pack (lugares e consumo de IA por mês) com limites de aviso, e leitura de consumo face à quota no painel do tenant (cliente) e na consola comercial (administrador), com alerta antes do limite e sinalização de excedente. O teto técnico de 1000/mês mantém-se como salvaguarda, distinto e declarado como tal face à quota contratada, e a evolução do consumo por mês fica visível a partir de LicenseUsageRecord. Sem faturação (FM6): o excedente é sinalizado, nunca cobrado.',
    check:
      'Um tenant que passa a quota contratada aparece sinalizado na consola comercial e no seu próprio painel, com alerta antes do limite e o valor excedido legível — sem qualquer cobrança automática.',
  },
  {
    id: 'FM5',
    area: 'comercial',
    severity: 'media',
    status: 'parcial',
    statusNote:
      'Fase 5 aplicada: existe leitura de negócio no painel de plataforma. `getCommercialMetrics` (só o dono da plataforma — 403 a qualquer outro papel) calcula no servidor a receita **contratada**: MRR e ARR a partir do preço vigente de cada subscrição ativa, com as subscrições sem preço contadas à parte (`unpriced_subscriptions`) e a fronteira dita na própria resposta (`contracted_not_invoiced`, porque não há faturação nesta fase); o movimento do período (novos, renovações, upgrades, downgrades e fechos) com o período anterior ao lado; o churn; a conversão e o peso de cada nível, com a variação em pontos percentuais; as coortes de utilização e as sinalizações de quota já registadas. `CommercialMetricsWidget` mostra cada bloco no painel de plataforma (não duplicado em /admin, como FB6 exige) e liga à consola comercial, onde a operação acontece. Verificado no harness: `FM5.1` — a receita reconcilia-se com as subscrições (58 000 cêntimos de MRR contratado, 5 subscrições sem preço declaradas) e o movimento traz o período anterior — e `FM5.2` (403 ao administrador de parceiro e ao do cliente). Residual: o drill-down de cada número para o tenant e para o registo que o produziu (subscrição, alteração de licença, consumo, preço) está hoje no link único para a consola e não número a número, e as coortes não abrem a lista de tenants que as compõem.',
    title: 'Sem inteligência comercial: receita recorrente, churn, conversão, upsell e coortes',
    persona: 'Administração da plataforma',
    flow: 'Inteligência comercial — evolução do negócio e comparação com o período anterior',
    evidence: [
      'src/components/dashboard/PlatformAdminDashboard.jsx:14-20 — os sete widgets existentes: distribuição por tier, estado das subscrições, adoção de módulos, crescimento de tenants, volume de auditoria, maiores consumidores de IA e subscrições a expirar. Nenhum indicador de receita, churn, conversão, upsell ou coortes.',
      'Não existe MRR, ARR nem qualquer valor de receita no código; a receita depende do preço vigente, que não existe (FM2).',
      'src/components/dashboard/platform/TenantGrowthWidget.jsx — o crescimento é contado por data de criação dos clientes, sem comparação com o período anterior nem distinção entre novo, renovado, descido e perdido.',
      'A adoção por tier existe (TierDistributionWidget), mas não é lida por coorte nem cruzada com o consumo.',
    ],
    impact:
      'A plataforma não responde às perguntas de negócio: quanto vale a carteira (MRR/ARR), quantos clientes entraram, renovaram, subiram ou saíram no mês, que tier converte e retém, e que coortes de utilização anunciam churn ou upsell. Sem isso não há decisão fundamentada de preço nem de empacotamento, e a evolução do negócio não é comparável com o período anterior.',
    recommendation:
      'Painel de indicadores comerciais no painel de plataforma (não duplicado no /admin — FB6): receita recorrente (MRR/ARR a partir do preço vigente × subscrições ativas), churn e renovação por período, conversão e adoção por tier, upsell (upgrades e pedidos por tenant) e coortes de utilização. Cada indicador com drill-down para o tenant e para o registo que o sustenta (subscrição, alteração de licença, consumo) e comparação com o período anterior, sempre a partir das subscrições, do histórico de licenciamento e do consumo reais — nunca de valores escritos à mão.',
    check:
      'O MRR/ARR mostrado reconcilia-se com as subscrições ativas e os preços vigentes, cada número abre o tenant e o registo que o produziu, e a evolução mês a mês é comparada com o período anterior.',
  },
  {
    id: 'FM6',
    area: 'comercial',
    severity: 'baixa',
    status: 'corrigido',
    statusNote:
      'Fronteira de âmbito registada, não lacuna: a plataforma não integra fornecedor de pagamentos, não guarda dados de pagamento nem emite documento de faturação nesta fase, e as capacidades de FM1–FM5 estão desenhadas para essa fronteira — preços e quotas são valores de negócio declarados (o teto técnico de 1000 usos mensais mantém-se salvaguarda, não quota), o excedente é sinalizado ao administrador e ao cliente e nunca gera cobrança, e o preço vigente de FM2 fica versionado para que uma decisão futura de faturação possa reconstruí-lo a qualquer data. O que resta é não deixar a fronteira ser ultrapassada por arrasto: cada capacidade comercial nova que peça cobrança é uma decisão própria, não um requisito implícito.',
    title: 'Sem faturação nem pagamentos na plataforma — fronteira de âmbito declarada',
    persona: 'Equipa de produto e administração da plataforma',
    flow: 'Fronteira do âmbito comercial',
    evidence: [
      'Não existe entidade de faturação, pagamento, método de pagamento, fatura ou recibo em base44/entities (48 entidades) nem integração de pagamentos no repositório.',
      'Nenhuma função de backend processa cobranças: a única noção de utilização é o contador LicenseUsageRecord (mês e usage_count) e o teto técnico de base44/shared/licenseGuard.ts:190,259.',
      'base44/functions/provisionTenantLicense/entry.ts — o provisionamento escreve subscrição, módulos e normas e audita a alteração; não gera qualquer obrigação financeira.',
    ],
    impact:
      'Sem esta fronteira escrita, cada capacidade comercial nova tende a pedir faturação por arrasto — cobrar o excedente, faturar a renovação, integrar um gateway —, o que traz dados de pagamento, ciclo de faturação e obrigações fiscais para um produto de conformidade que não os quer nesta fase.',
    recommendation:
      'Manter a fronteira declarada e documentada no relatório e no parecer comercial: sem fornecedor de pagamentos, sem dados de pagamento e sem documento de faturação; preços e quotas são valores de negócio declarados, não derivados de limites técnicos. O excedente de consumo é sinalizado (consola comercial e painel do cliente) e nunca cobrado. Se a faturação vier a ser necessária, entra como decisão própria sobre o preço vigente que FM2 deixa versionado.',
    check:
      'Nenhuma capacidade comercial cobra: o excedente aparece sinalizado e nunca gera cobrança, e não existem na plataforma dados de pagamento nem documento de faturação.',
  },
];

/**
 * Áreas comerciais da plataforma (FM1–FM6) — a prontidão comercial lida como uma
 * escala 0–5 por área.
 *
 * Cada área aponta para os achados que a descrevem (`findings`), pelo que a nota
 * é calculada pelo mesmo modelo do relatório (`validationReportModel.js`) a
 * partir do estado e da severidade desses achados — nenhuma nota é escrita à mão.
 * A área FM6 não tem achado aberto porque é uma decisão de âmbito registada
 * (sem faturação nem pagamentos nesta fase), e é isso que a nota reflete.
 */
export const COMMERCIAL_AREAS = [
  {
    id: 'fm_oferta',
    label: 'Oferta: tiers, packs e normas',
    description: 'Versão de oferta com vigência, tiers cumulativos, packs/add-ons e normas por tier.',
    findings: ['FM1'],
  },
  {
    id: 'fm_preco',
    label: 'Preço e vigência',
    description: 'Preço por tier, por lugar adicional e por pack, com versão que permite reconstruir o que foi vendido a uma data.',
    findings: ['FM2'],
  },
  {
    id: 'fm_ciclo',
    label: 'Ciclo de vida da subscrição',
    description: 'Renovação, mudança de nível com decisão explícita sobre o que sai, suspensão com tolerância e fecho com trabalho a tratar.',
    findings: ['FM3'],
  },
  {
    id: 'fm_quotas',
    label: 'Utilização e quotas contratuais',
    description: 'Lugares e consumo de IA lidos da tabela em vigor, sinalizados ao cliente sem bloquear o acesso.',
    findings: ['FM4'],
  },
  {
    id: 'fm_indicadores',
    label: 'Indicadores de negócio',
    description: 'Receita contratada, movimento do período, churn, conversão e coortes, calculados no servidor.',
    findings: ['FM5'],
  },
  {
    id: 'fm_fronteira',
    label: 'Fronteira de âmbito: sem faturação',
    description: 'Decisão registada de não integrar fornecedor de pagamentos nem emitir documento de faturação nesta fase.',
    findings: ['FM6'],
  },
];

/**
 * Categorias de requisitos NIS2 (art. 21.º/2 do RJCS) — a escala 0–5 lida sobre o
 * conjunto de requisitos que o produto serve.
 *
 * Cada categoria aponta para os achados da plataforma que tocam o suporte que ela
 * dá a essa medida (`findings`: o módulo/página que a serve e o que a limita), e a
 * nota sai da mesma função de cálculo. Uma categoria sem achados abertos fica a 5
 * — não tem lacunas registadas, e é isso que a nota diz.
 */
export const NIS2_AREAS = [
  {
    id: 'nis2_riscos',
    label: 'Políticas de análise de riscos e segurança',
    description: 'Medida a): políticas de análise dos riscos e de segurança dos sistemas de informação (Gestão de Risco, Métricas de Conformidade).',
    findings: ['FA4', 'FB6', 'FM5'],
  },
  {
    id: 'nis2_incidentes',
    label: 'Gestão de incidentes',
    description: 'Medida b): gestão de incidentes (registo e acompanhamento de incidentes, com notificação).',
    findings: ['FC3', 'FC6'],
  },
  {
    id: 'nis2_continuidade',
    label: 'Continuidade de atividade e crises',
    description: 'Medida c): continuidade das atividades e gestão de crises (automações agendadas, conservação e janela de manutenção).',
    findings: ['FB4'],
  },
  {
    id: 'nis2_cadeia',
    label: 'Segurança da cadeia de abastecimento',
    description: 'Medida d): segurança da cadeia de abastecimento (fornecedores e questionários da cadeia).',
    findings: ['FB2', 'FC5'],
  },
  {
    id: 'nis2_aquisicao',
    label: 'Aquisição, desenvolvimento e vulnerabilidades',
    description: 'Medida e): segurança na aquisição, desenvolvimento e manutenção, incluindo a gestão e divulgação de vulnerabilidades (registo de vulnerabilidades, revisão de documentos e catálogo curado em código).',
    findings: ['FB7'],
  },
  {
    id: 'nis2_eficacia',
    label: 'Avaliação da eficácia das medidas',
    description: 'Medida f): políticas e procedimentos para avaliar a eficácia das medidas de gestão de risco (trilha de auditoria, relatórios e consola de indicadores).',
    findings: ['FB5', 'FB6'],
  },
  {
    id: 'nis2_higiene',
    label: 'Ciber-higiene e formação',
    description: 'Medida g): práticas básicas de ciber-higiene e formação em cibersegurança (formação e atestação de políticas).',
    findings: ['FC3', 'FC4'],
  },
  {
    id: 'nis2_criptografia',
    label: 'Criptografia e encriptação',
    description: 'Medida h): práticas de utilização de criptografia e encriptação (hash SHA-256 das evidências e versões imutáveis de documentos).',
    findings: ['FA5'],
  },
  {
    id: 'nis2_acesso',
    label: 'Recursos humanos, controlo de acesso e ativos',
    description: 'Medida i): segurança dos recursos humanos, políticas de controlo de acesso e gestão de ativos (matriz de capacidades, delegações, licenciamento e auditoria do acesso).',
    findings: ['FA1', 'FB1', 'FB3', 'FB8'],
  },
  {
    id: 'nis2_autenticacao',
    label: 'Autenticação multifator e comunicações seguras',
    description: 'Medida j): autenticação multifator ou contínua, comunicações seguras e sistemas de emergência (sessão, normalização de papéis e expiração de delegações).',
    findings: ['F2', 'F7', 'F14', 'F15'],
  },
];
