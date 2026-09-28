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
 */

/** Âmbito e método desta ronda (mostrado no cabeçalho do relatório). */
export const ROUND_META = {
  round: 'Ronda 3 — avaliação funcional, de administração e de UX/UI',
  date: '2026-09-28',
  method:
    'Inspeção de código e de configuração: rotas e matriz de capacidades (src/lib/rbac.js), páginas e componentes, entidades e funções de backend, automações agendadas (base44/workflows) e tokens do design system AnkoraOne (src/index.css, tailwind.config.js).',
  scope:
    'Funcionalidades e fluxos de trabalho; administração da plataforma, workspaces, tenants e conteúdos; consistência visual entre páginas e com o design system. A validação de segurança da ronda anterior mantém-se como área própria, sem alteração de conteúdo.',
  limitation:
    'A inspeção que originou esta ronda não tinha execução multi-identidade. Entretanto existe o harness `tools/validation-harness` (`npm run validate:harness`), que corre as nove identidades contra o backend local — no limite das funções (RBAC, âmbito de carteira, delegações, licenciamento) e na camada de decisão do frontend (Sidebar/RouteGuard, matriz de capacidades, contrato de tenant) — e é ele que sustenta as notas de correção. Continua por verificar em backend real o que o emulador local não honra: as RLS das entidades sobre sessões distintas (inclusive o ramo `delegated_edit_customer_ids`, escondido na leitura) e a leitura da trilha de auditoria.',
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
      'O núcleo NIS2 está completo em páginas e funções (avaliações, riscos, evidências, documentos, planos de ação, relatórios e pacote de auditoria) e as escritas passam por funções de backend com verificação de papel. O que falha é a consistência do contexto: cada página resolve o tenant à sua maneira, o papel de consultor não tem cobertura funcional e os erros de leitura aparecem como listas vazias.',
    solid: [
      'Ciclo de avaliação ponta-a-ponta em servidor: completeAssessment calcula resultados, cobertura e metodologia sem confiar no cliente.',
      'Riscos, tarefas, documentos, evidências, fornecedores, incidentes, DSR/RoPA e formação têm página, entidade com RLS e função de escrita dedicada.',
      'Exportações reais em Relatórios, Avaliações e Pacote de auditoria (PDF/JSON).',
      'Automações agendadas por evento e por calendário (8 workflows) para tarefas, riscos, documentos, relatórios mensais e conservação de dados.',
    ],
    gaps: [
      'Cobertura funcional do papel consultant e do acesso delegado.',
      'Contexto de tenant resolvido de forma divergente entre páginas.',
      'Capacidades de exportação declaradas na matriz sem implementação.',
      'Erros de leitura indistinguíveis de «sem dados».',
      'Fluxo do pacote de auditoria (/audit-package) com falha registada por reproduzir.',
    ],
  },
  {
    id: 'administracao',
    label: 'Administração da plataforma',
    description:
      'Workspaces, clientes/tenants, utilizadores e atribuições, licenças e tiers, conteúdos e operação corrente da plataforma.',
    accent: [124, 58, 237],
    summary:
      'Existem recursos de administração para clientes, utilizadores, atribuições, workspaces, catálogo de conteúdo e manutenção programada, mas a operação comercial da plataforma não está fechada: não há interface para provisionar licenças, três páginas de gestão ficam fora da navegação, a troca de workspace não muda o contexto de dados e não há visibilidade nem configuração das automações e da conservação.',
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
      'Provisionamento de licenças (tier, assentos, módulos, estado) sem interface.',
      'Três páginas de administração inalcançáveis pelo menu.',
      'Seletor de workspace sem efeito no contexto de dados.',
      'Sem política de conservação configurável nem histórico de execução das automações.',
      'Trilha de auditoria sem filtros de servidor nem exportação.',
      'Duas consolas de plataforma sobrepostas (/admin e o dashboard).',
      'Sem canal de comunicação da plataforma para os tenants.',
    ],
  },
  {
    id: 'ux',
    label: 'UX/UI e consistência visual',
    description:
      'Consistência entre páginas e com os tokens do design system AnkoraOne: títulos, cor, idioma, estados, acessibilidade e responsividade.',
    accent: [8, 145, 178],
    summary:
      'A base é sólida: páginas construídas sobre shadcn/ui, tipografia e raios vindos dos tokens AnkoraOne, tabelas com scroll horizontal próprio e quase nenhuma cor rígida nas páginas. As divergências estão nos detalhes que se repetem em todas elas: título duplicado, paletas de gráficos fora dos tokens, mensagens em inglês, padrões de carregamento diferentes e acessibilidade fraca em ações de ícone.',
    solid: [
      'Tokens semânticos (HSL) para superfícies, texto, bordas e gráficos, com tema claro/escuro no ThemeContext.',
      'Componentes partilhados reutilizados: PageHeader, EmptyState, LoadingState, StatCard, StatusBadge, ConfirmDialog, BulkActionBar.',
      'Tabelas embrulham o conteúdo em overflow próprio (ui/table.jsx) e os filtros de listagem seguem o mesmo padrão visual.',
      'Interface integralmente em português de Portugal nas páginas principais, com i18n por chaves (translations-*.js).',
    ],
    gaps: [
      'Título da página duplicado (TopBar + PageHeader).',
      'Paletas de gráficos e de pesquisa fora da paleta de tokens.',
      'Mensagens de retorno em inglês numa interface PT-PT.',
      'Bloqueio de escrita por heurística durante a simulação de papel.',
      'Padrões de carregamento e de vazio divergentes.',
      'Acessibilidade: poucos nomes acessíveis em ações de ícone.',
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
    status: 'parcial',
    statusNote:
      'A matriz de capacidades passou a dar leitura ao consultor nos percursos operacionais (avaliações, riscos, evidências, documentos, tarefas e relatórios) sem lhe dar escrita, e o contexto único de tenant alarga o que ele vê às delegações vivas. Verificado na suíte de decisão do harness (FA1.1–FA1.3, ISO-UI2); falta a leitura real dos dados do cliente numa sessão de consultor — o emulador local não honra `delegated_edit_customer_ids` (esconde na leitura) e exige backend real.',
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
    status: 'parcial',
    statusNote:
      'As cinco páginas que resolviam o tenant por si (RiskAssessment, AuditPackage, Recommendations, Tasks, ActionPlan) passaram a ler o contexto único (`useActiveCustomer()` sobre `tenantResolver.js`), com prioridade ao workspace selecionado, depois o tenant próprio e por fim as delegações vivas (TEN1–TEN3 no harness). As restantes páginas operacionais continuam a ler `user.customer_id` diretamente — a migração é o que falta para a regra ser única.',
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
    status: 'parcial',
    statusNote:
      'Os dois passos estão feitos na estrutura: (a) `ErrorState` (variante `inline`) é o estado de erro único, distinto do vazio, com mensagem própria e botão de repetir que chama o `refetch` da consulta; (b) a fronteira de erro passou para o `AppLayout`, com chave por rota, pelo que uma exceção numa página mostra um painel de erro e mantém menu e cabeçalho utilizáveis — as rotas que tinham fronteira própria passaram a depender da do layout. Consultas que já expõem o erro: ComplianceMetrics, StrategicReport, Reports, Assessments, RiskAssessment, AuditPackage e AuditLog (esta também com o estado de erro da leitura de servidor). Falta a passagem pelas restantes listas (Customers, Tasks, ActionPlan, Recommendations, EvidenceOverview, DocumentAuditTrail, PolicyAttestation, DSU/RoPA, Suppliers, Vulnerabilities, Training, Workspaces, Organization, Licensing), que mantêm o vazio como única saída.',
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
    status: 'parcial',
    statusNote:
      'O percurso deixou de poder falhar em silêncio: a leitura dos pacotes passou a expor o próprio erro (painel de erro com mensagem e repetição, diferente do EmptyState) e a rota está coberta pela fronteira de erro do layout, que mostra um painel e mantém navegação e cabeçalho em vez do ecrã em branco. O contexto de tenant é resolvido pelo resolvedor único (workspace selecionado → tenant próprio → delegações vivas) e, sem cliente resolvido, a página mostra o estado vazio próprio — e não uma lista vazia nem um erro. Falta a reprodução com uma sessão real de auditor sobre um tenant com pacotes (o emulador local só tem uma sessão), que é o que confirma o fim do sintoma.',
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
    status: 'parcial',
    statusNote:
      'Existe provisionamento: `provisionTenantLicense` (create/update/suspend/resume/set_module/set_standard, só master_admin ou o administrador de parceiro dentro da carteira) e `listTenantLicenses` para a leitura com o âmbito resolvido no servidor, com o painel TenantLicensePanel em /licensing — nenhuma entidade de licenciamento é escrita pelo frontend. Os casos FB1.1–FB1.11 do harness verificam autorização, criação, tier inválido, duplicação, excepção por módulo com validade, suspensão com tolerância e fecho fail-closed no fim dela, reactivação e recusa fora da carteira. Falta o histórico visível das alterações (as acções são registadas em AuditLog, que a sessão do emulador local não consegue ler — FB1.12 fica como não verificável localmente).',
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
      'O seletor de workspace passou a ter consumidor: `tenantResolver.js` lê `selected_workspace_id` com prioridade sobre o tenant próprio e resolve o cliente do workspace escolhido, e o harness verifica o contrato (TEN4 muda mesmo o contexto, TEN5 ignora um workspace fora do âmbito). Falta a confirmação no browser do indicador de contexto e a migração das páginas ainda não abrangidas por FA2, que não acompanham a troca.',
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
      'Consolidação feita por divisão de papéis: o dashboard de plataforma (`PlatformAdminDashboard`, rota `/`) é a única consola de indicadores e o `/admin` é a área de operações administrativas. Os quatro gráficos duplicados do `/admin` (maturidade por setor, estado dos clientes, uso de frameworks e quebra de riscos — os mesmos que o `PlatformOverview` desenha a partir das mesmas entidades) foram removidos com os cálculos que os alimentavam; ficaram os cartões com drill-down, o ranking por cliente e a gestão de lugares. Cada página liga à outra e o AGENTS.md regista qual é a consola de plataforma.',
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
      'Canal de anúncios implementado: entidade `PlatformAnnouncement` (título, mensagem, severidade, âmbito, janela, estado) e uma única porta de escrita, `manageAnnouncements` — `active` resolve o âmbito no servidor (global / tier / cliente) a partir das subscrições e dos clientes que o utilizador pode ler, `overview`/`publish`/`update`/`archive` são master_admin e todas as escritas ficam na trilha de auditoria. No layout, `AnnouncementBanner` mostra a faixa por severidade (informação/aviso/manutenção), revalida a cada 60 s e dispensa por sessão; a publicação e o histórico vivem em `/platform-operations`. A entidade só é legível por master_admin, pelo que o âmbito nunca é decidido no browser. Residual: a faixa foi verificada localmente com âmbito global; os âmbitos por tier e por cliente dependem de subscrições reais para serem observados ponta a ponta.',
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
    status: 'parcial',
    statusNote:
      'As quatro superfícies apontadas passaram a usar os tokens: Admin.jsx (COLORS → chart-1..5, escala de risco para ankora-risk-*, badges de contagem para bg-chart-*/text-chart-*), ComplianceMetrics.jsx (CHART_COLORS → --risk-* na escala de severidade, ícones para chart-1/chart-3), TaskAnalytics.jsx (séries por estado em chart-1..3) e GlobalSearch.jsx (cor por tipo de resultado em chart-1..5). Foram também limpas as páginas que esta fase já tocava — ExternalAccess, SystemStatus, PolicyAttestation, Workspaces e StrategicReport (escala de maturidade e prioridades). Falta a passagem nas restantes superfícies (EmailReport, Organization, TechnicalDocs, LicenseUnavailable, banners de simulação e os componentes de risco). Medição: as classes de paleta rígida em src/ passaram de 127 ocorrências em 30 ficheiros para 106.',
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
];
