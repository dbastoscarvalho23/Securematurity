/**
 * Relatório de Validação Funcional e de Segurança — Core NIS2.
 *
 * Dados estáticos (sem chamadas a entidades nem a funções de backend) que
 * alimentam a página temporária /validacao-seguranca. Documento de validação,
 * não é conteúdo de produção: retirar quando as correções forem aplicadas.
 */

export const REPORT_META = {
  app: 'Securematurity',
  appId: '6ab5373e7f8f586c80cb9ed8',
  branch: 'migration-ankoraone-update',
  commit:
    '39fc046 — «Migrar papéis para grafia canónica em todo o sistema» (2026-09-28): as 29 entidades de catálogo/tenant, o frontend (~84 comparações em 41 ficheiros, via src/lib/rbac.js) e a persistência (logUserLogin / adminUpdateUser) passam a usar a grafia canónica, sobre a uniformização do backend de 2c2932e',
  backend:
    'base44 dev local (funções em Deno; entidades em base de dados em memória), servido por docker compose -f docker-compose.base44.yml, serviço web (node:22-slim) + vite → host 3000',
  persistence: 'Nenhuma — estado em memória, perdido em cada restart do container ou alteração de schema.',
  auth: 'Real (token CLI `base44 login`) e, no local, identidade explícita por invocação: o cabeçalho `x-base44-dev-actor` só é honrado com `BASE44_DEV_IDENTITY=1`, variável que existe apenas no docker-compose local.',
  identities:
    'As nove identidades canónicas são injectadas pelo harness (`tools/validation-harness`), no limite das funções de backend e na camada de decisão do frontend. A sessão continua a ser uma só: a conta CLI (`admin` → `normalizeRole()` → `master_admin`), com `User` create/delete e a escrita de `User.role` ignorados localmente.',
  isolation:
    'Ambiente isolado e descartável (estado em memória, topologia criada por `seedTestEnvironment`), mas as RLS das entidades só são avaliáveis pela sessão autenticada: o isolamento real entre tenants exige backend real.',
  scope:
    'Inspeção de código e de configuração no ambiente de preview, complementada pelo harness multi-identidade, que executa os casos de RBAC, âmbito de carteira, delegação e licenciamento. Onde não há ambiente válido para testar, o cenário fica marcado como «Não executado» — nunca convertido em aprovação por simulação visual de papel.',
};

export const VERDICT = {
  classification: 'Correções aplicadas em código — validação multi-identidade por fechar em backend real',
  summary:
    'As correções de F1–F15 foram implementadas em código (escopo de carteira do parceiro, âmbito de módulos da delegação, guarda de auto-escalada, RLS canónica, licenciamento fail-closed) e as verificações de papel do backend foram uniformizadas. Nesta ronda a validação multi-identidade deixou de ser uma lacuna: o harness (`npm run validate:harness`) corre as nove identidades contra o backend local — 46 casos ok, 0 falhas, 2 não verificáveis localmente — no limite das funções e na camada de decisão do frontend, e foi ele que expôs e fechou quatro defeitos (carteira do parceiro vazia, módulos abertos depois da suspensão, condições de teste não impostas pelo seed e avaliações semeadas em rascunho). O Core continua sem parecer positivo: as RLS das entidades só são avaliáveis por sessão autenticada e a conta local permanece `admin`, pelo que a confirmação ponta-a-ponta (e F15) exige backend real.',
  blockers: [
    {
      text: 'A migração está em código, mas o emulador local ignora a escrita de `User.role` (na mesma chamada grava `language` e descarta `role`), pelo que a conta local continua `admin` e o efeito ponta-a-ponta não é verificável aqui; num backend real a conta passa a `master_admin` no primeiro login.',
      finding: 'F2',
    },
    {
      text: 'Fechado em código: nenhuma comparação de papel do frontend usa literais; falta a confirmação com contas reais das personas.',
      finding: 'F7',
    },
    {
      text: 'A leitura de entidades não revalida expires_at; a delegação expirada só é retirada no arranque da sessão ou numa listagem.',
      finding: 'F15',
    },
    {
      text: 'Validação multi-identidade executada no emulador local, com limites: as funções e a camada de decisão do frontend aceitam a identidade injectada, mas as RLS das entidades são avaliadas pela sessão autenticada (uma só) — o isolamento real entre tenants e o ramo `delegated_edit_customer_ids` exigem backend real.',
    },
    {
      text: 'Semântica de user_condition no backend de produção por confirmar (localmente é igualdade exacta, sem normalização de papel).',
    },
  ],
  positives: [
    'Matriz de capacidades coerente e sem atalho para admins de plataforma/parceiro nas capacidades de conformidade.',
    'Ciclo de delegação com motivo, prazo, proibição de auto-aprovação e aprovação reservada ao cliente.',
    'Break-glass removido; cálculo de resultados, cobertura e metodologia sempre no servidor, com o ator retirado de `base44.auth.me()`.',
    'F1–F9, F11, F13 e F14 aplicadas em código; F15 com residual identificado (revalidação de expires_at na camada de entidades).',
    'Harness multi-identidade: 46 casos ok, 0 falhas, 2 não verificáveis localmente — isolamento e âmbito de carteira, provisionamento de licenças com tolerância e fecho fail-closed, estados da delegação, matriz de capacidades por papel e contrato de tenant.',
  ],
};

// Ordem = prioridade. As classes seguem os tokens semânticos e a escala --risk-* (FC2).
export const SEVERITIES = [
  { id: 'critica', label: 'Crítica', classes: 'bg-status-danger/10 text-status-danger border-status-danger/20' },
  { id: 'alta', label: 'Alta', classes: 'bg-status-warning/10 text-status-warning border-status-warning/20' },
  { id: 'media', label: 'Média', classes: 'bg-chart-3/10 text-chart-3 border-chart-3/20' },
  { id: 'baixa', label: 'Baixa', classes: 'bg-status-success/10 text-status-success border-status-success/20' },
  { id: 'verificar', label: 'A verificar', classes: 'bg-status-info/10 text-status-info border-status-info/20' },
];

// Estado das correções aplicadas em código (a validação live continua pendente —
// ver FOLLOW_UPS). Não altera a severidade original de cada problema.
export const STATUSES = [
  // «Concluído» é o estado de uma tarefa do to-do (trabalho combinado), não de um achado:
  // um achado fecha-se com «corrigido», uma tarefa entrega-se com «concluído».
  { id: 'concluido', label: 'Concluído', classes: 'bg-status-success/10 text-status-success border-status-success/20' },
  { id: 'corrigido', label: 'Corrigido', classes: 'bg-status-success/10 text-status-success border-status-success/20' },
  { id: 'parcial', label: 'Parcial', classes: 'bg-status-warning/10 text-status-warning border-status-warning/20' },
  { id: 'pendente', label: 'Pendente', classes: 'bg-status-danger/10 text-status-danger border-status-danger/20' },
];

export const ISSUE_STATUS = {
  F1: {
    status: 'corrigido',
    note: 'manageAccess deixou de escrever onboarding_customer_ids na criação e nenhuma regra rls.read o lê; o array só é escrito na aceitação e é limpo na expiração/revogação.',
  },
  F2: {
    status: 'corrigido',
    note: 'Papéis migrados para a grafia canónica em três frentes. (a) RLS: os 106 literais role: "admin" das 29 entidades de catálogo/tenant (Comment, Training, Notification, licenciamento, KnowledgeArticle, …) foram substituídos por master_admin — substituição fiel, porque normalizeRole mapeia admin → master_admin — mantendo intactos os restantes ramos (tenant, delegação, customer_admin). (b) Frontend: as ~84 comparações de papel em 41 ficheiros passaram a usar isPlatformOwner/hasRole de src/lib/rbac.js, as consultas filtradas por papel resolvem o valor guardado pelo normalizador e a UI de atribuição (Settings, EditUserDialog, CustomerSeatSection, CustomerUsersPanel) escreve papéis canónicos. (c) Persistência: logUserLogin grava normalizeRole(role) no arranque de sessão e audita a alteração; adminUpdateUser normaliza o papel que persiste. Residual de verificação: o emulador local ignora a escrita de User.role — na mesma chamada grava language e descarta role — pelo que a conta local permanece admin e o efeito ponta-a-ponta só é observável num backend real.',
  },
  F3: {
    status: 'corrigido',
    note: 'isPartnerAdmin + resolveScopeCustomerIds aplicam o escopo de carteira em list, resolve, request/create/revoke de onboarding e adminUpdateUser; só o master_admin age plataforma-larga.',
  },
  F4: {
    status: 'corrigido',
    note: 'authorizeAssessmentOperational e resolveAuthority passaram a exigir o módulo na authorized_modules da delegação; lista vazia = nenhum módulo e o diálogo obriga a escolher pelo menos um.',
  },
  F5: {
    status: 'corrigido',
    note: 'create/update das entidades operacionais passam a exigir papel (customer_admin / grc_analyst / control_owner) além do tenant; a leitura mantém-se por tenant/delegação.',
  },
  F6: {
    status: 'corrigido',
    note: 'adminUpdateUser bloqueia a auto-edição de role/customer_id antes de qualquer outro check e limita o workspace_admin a papéis de cliente dentro da sua carteira.',
  },
  F15: {
    status: 'parcial',
    note: 'O prune no arranque de sessão e o dropExpired em list/resolve retiram as delegações expiradas e os seus arrays. A camada de entidades continua a ler delegated_* sem revalidar expires_at; a janela fecha-se no arranque da sessão seguinte.',
  },
  F7: {
    status: 'corrigido',
    note: 'Fechado nas duas metades. Backend: as verificações de papel deixaram de comparar literais e usam normalizeRole (adminDeleteUser, adminUpdateUser, dataRetentionPurge, documentNotifications, generateMonthlyAnnualReport, getPlatformMetrics, getStorageProviders, getWorkspaceTree, listUsers, manageAssignment, migrateExistingLicenses, migrateExistingWorkspaces, riskDueDateReminders, seedLicenseData, updateCustomerStorage, getEffectiveLicense e resolveWorkspaceAccess); adminUpdateUser passou também a normalizar o papel que persiste e a comparar o papel do alvo pelo normalizador. Frontend: as ~84 comparações em 41 ficheiros passaram por isPlatformOwner/hasRole/normalizeRole de src/lib/rbac.js — nenhuma comparação de papel usa literais.',
  },
  F8: {
    status: 'corrigido',
    note: 'resolveWorkspaceAccess exige workspace_id próprio para quem não é platform owner e recusa 403 fora da subárvore.',
  },
  F13: {
    status: 'corrigido',
    note: 'fetchEffectiveLicense devolve status "error" e isModuleLicensed é fail-closed (sem licença, em erro, ou lista malformada = nenhum módulo).',
  },
  F9: {
    status: 'corrigido',
    note: 'request_delegation valida o customer_id contra o escopo de quem pede e recusa pedidos sobre o próprio tenant.',
  },
  F11: {
    status: 'corrigido',
    note: 'AGENTS.md corrigido: canAccessRoute não faz short-circuit de master_admin — a decisão resulta sempre da matriz.',
  },
  F14: {
    status: 'corrigido',
    note: 'User.jsonc passou a declarar rls.read (master_admin / workspace_admin, o próprio registo e o próprio cliente).',
  },
};

const INSPECTION_ONLY =
  'Inspeção de código — não reproduzível no backend local, que tem uma única identidade (ver «Testes não executados»).';

export const ISSUES = [
  {
    id: 'F1',
    severity: 'critica',
    title: 'Acesso operacional de leitura durante o onboarding',
    persona: 'Utilizador em onboarding (novo membro do cliente/parceiro)',
    flow: '§8.2 (onboarding), §17.9',
    location: [
      'base44/functions/manageAccess/entry.ts — handleCreateOnboarding escreve onboarding_customer_ids no momento da criação, antes da aceitação.',
      'rls.read de Assessment, AssessmentResponse, Task, SecurityDocument, RiskItem e AuditPackage — ramos data.customer_id: {{user.data.onboarding_customer_ids}}.',
    ],
    impact:
      'Qualquer utilizador em onboarding lê avaliações, respostas, tarefas, riscos, documentos/evidências e pacotes de auditoria do tenant, sem delegação aprovada. A aceitação não retira o array (o acesso só termina com revogação manual), pelo que o onboarding se converte em acesso permanente, contrariando o §8.2 e o próprio desenho documentado («onboarding is account set-up only»).',
    reproduction:
      'Criar um onboarding (ou observar o ramo de RLS) e consultar Assessment/AssessmentResponse do tenant como utilizador em onboarding.',
    fix:
      'Manter onboarding_customer_ids fora dos ramos rls.read das entidades operacionais; escrever o array apenas na aceitação e removê-lo no fim do onboarding (concluído, expirado ou revogado); aplicar expires_at ao onboarding.',
    regression:
      'O onboarding não lê nenhuma entidade operacional; após aceitar continua sem acesso; só uma delegação aprovada abre leitura.',
  },
  {
    id: 'F2',
    severity: 'alta',
    title: 'RLS ancorada no literal legado role: "admin"',
    persona: 'Todos os papéis (isolamento entre tenants); admins guardados como master_admin ou workspace_admin',
    flow: 'Isolamento entre tenants — Customer, Workspace, AuditLog, User, UserCustomerAssignment',
    location: [
      'Customer, Workspace e AuditLog — user_condition.role: "admin".',
      'User — create/update/delete limitado a admin/master_admin.',
      'UserCustomerAssignment — admin, master_admin, workspace_admin, partner_admin.',
    ],
    impact:
      'Um administrador guardado como master_admin pode não satisfazer regras que só listam admin (quebra funcional no backend real); um papel legado admin mantém leitura/escrita transversal a todos os clientes; workspace_admin e partner_admin leem todas as UserCustomerAssignment da plataforma, sem escopo de parceiro — fuga de carteira pela API de entidades, mesmo onde a função escopeia.',
    reproduction:
      'Inspeção das regras rls.* das entidades. O emulador local só semeia o papel admin, pelo que mascara o caso master_admin: a semântica de user_condition tem de ser confirmada contra um backend real.',
    fix: 'Normalizar todas as regras para o conjunto dos 9 papéis e escopiar as atribuições por parceiro.',
    regression:
      'Cada papel vê apenas o que a matriz lhe concede; nenhum papel legado mantém leitura/escrita transversal a todos os clientes.',
  },
  {
    id: 'F3',
    severity: 'alta',
    title: 'Administrador de parceiro sem escopo de carteira',
    persona: 'workspace_admin (admin de parceiro) e clientes diretos de outros parceiros',
    flow: '§7 — gestão de acessos e carteira (manageAccess)',
    location: [
      'manageAccess → handleList — isPlatformAdmin(userRole) inclui workspace_admin e devolve todas as atribuições.',
      'manageAccess → handleResolve — resolve o user_id de qualquer utilizador.',
      'manageAccess → handleCreateOnboarding — aceita qualquer customer_id.',
    ],
    impact:
      '§7 violado — vê a carteira de outros parceiros e de clientes diretos e pode iniciar onboarding em tenants alheios.',
    reproduction: INSPECTION_ONLY,
    fix:
      'Separar «admin de plataforma» de «admin de parceiro» (isPartnerAdmin), com escopo de carteira em list, resolve e create_onboarding.',
    regression: 'Um workspace_admin só vê e só opera sobre a carteira do seu parceiro.',
  },
  {
    id: 'F4',
    severity: 'alta',
    title: 'Âmbito de módulos da delegação não é aplicado',
    persona: 'Delegado com authorized_modules restrito (ex.: consultor restrito a documentos)',
    flow: '§8.3, §8.4, §17.12 — delegação e módulos',
    location: [
      'base44/shared/assessmentAccess.ts — authorizeAssessmentOperational valida apenas access_level, estado e expiração.',
      'reviewDocument — resolveAuthority, com a mesma omissão.',
      'authorized_modules só é escrito (seedTestEnvironment cria o cenário module_restricted_tenant_beta) e nunca é lido.',
    ],
    impact:
      'Lista vazia significa «todos os módulos licenciados» e uma delegação restrita a documentos autoriza concluir avaliações e gerar pacotes de auditoria.',
    reproduction: INSPECTION_ONLY,
    fix:
      'Passar authorized_modules a authorizeAssessmentOperational e a resolveAuthority; lista vazia passa a significar nenhum módulo.',
    regression:
      'Uma delegação restrita a documentos é recusada ao concluir avaliações e ao gerar pacotes de auditoria.',
  },
  {
    id: 'F5',
    severity: 'alta',
    title: 'Escrita direta na entidade contorna o RBAC',
    persona: 'Qualquer membro do tenant (ex.: employee)',
    flow: '§11, §12, §17.5 — escrita de respostas, tarefas e documentos',
    location: [
      'rls.create / rls.update de Assessment, AssessmentResponse, Task, SecurityDocument e RiskItem — condição só por customer_id/arrays, sem papel.',
    ],
    impact:
      'Qualquer membro do tenant escreve respostas de avaliação, tarefas ou documentos via SDK, sem passar por completeAssessment, reviewDocument ou pela matriz de capacidades.',
    reproduction:
      'Escrita direta na entidade via SDK. No emulador local apenas o ramo de leitura está emulado, pelo que a escrita por papel tem de ser confirmada contra um backend real.',
    fix:
      'Introduzir verificação de papel nas regras de escrita das entidades operacionais, ou fechar a escrita direta e forçar as funções.',
    regression:
      'Toda a escrita passa por uma função com verificação de papel; nenhuma rota permite escrever diretamente na entidade.',
  },
  {
    id: 'F6',
    severity: 'alta',
    title: 'Auto-atribuição de papel/tenant em adminUpdateUser',
    persona: 'master_admin / workspace_admin autenticado',
    flow: '§6, §7 — administração de utilizadores',
    location: [
      'base44/functions/adminUpdateUser/entry.ts — sem guarda para userId === currentUser.id; workspace_admin pode definir role.',
    ],
    impact:
      '§6 («não se autoatribui um papel interno de cliente») e §7 («não transforma um consultor num administrador interno do cliente») violados por API. Mitigação existente: tudo é auditado e o customer_admin não pode alterar papéis.',
    reproduction: INSPECTION_ONLY,
    fix:
      'Proibir a auto-edição de role/customer_id e limitar o papel atribuível pelo workspace_admin ao seu âmbito.',
    regression: 'Nenhum utilizador altera o seu próprio papel ou tenant, por nenhuma via.',
  },
  {
    id: 'F15',
    severity: 'alta',
    title: 'Expiração não é aplicada ao nível das entidades',
    persona: 'Delegado com delegação expirada',
    flow: '§8.7 — expiração de delegações',
    location: [
      'Arrays delegated_*_customer_ids usados por rls.read; só são limpos em dropExpired(), invocada por list/resolve do manageAccess.',
    ],
    impact:
      'Depois de expirar, a leitura de entidades continua possível até alguém listar/resolver atribuições. As funções (completeAssessment, generateAuditPackage, reviewDocument) bloqueiam em tempo real; as leituras de página não.',
    reproduction: INSPECTION_ONLY,
    fix:
      'Aplicar expires_at na camada de entidades (revalidação por expires_at ou limpeza determinística).',
    regression: 'Uma delegação expirada deixa de dar leitura imediatamente, sem depender de uma listagem.',
  },
  {
    id: 'F7',
    severity: 'media',
    title: 'Verificações de papel com literais por normalizar',
    persona: 'Parceiro e papel legado admin',
    flow: 'Licenciamento e acesso a workspaces',
    location: [
      'getEffectiveLicense — user.role !== "admin".',
      'resolveWorkspaceAccess — user.role === "admin".',
    ],
    impact:
      'Comportamento divergente entre o admin legado e master_admin; pode quebrar a consulta de licença do parceiro e alargar a do legado.',
    reproduction: INSPECTION_ONLY,
    fix: 'Uniformizar normalizeRole em todas as funções.',
    regression: 'A licença do parceiro é resolvida corretamente para todos os papéis.',
  },
  {
    id: 'F8',
    severity: 'media',
    title: 'Enumeração da árvore de workspaces',
    persona: 'Utilizador autenticado sem workspace_id',
    flow: '§7 — herança da árvore de workspaces',
    location: [
      'resolveWorkspaceAccess — devolve customer_ids de todos os descendentes; a guarda de segurança só atua se o utilizador tiver workspace_id.',
    ],
    impact:
      'Um utilizador sem workspace pode passar qualquer workspace_id. Não dá dados operacionais (a RLS por arrays é a barreira), mas é o vetor de «herança da árvore» interdito no §7.',
    reproduction: INSPECTION_ONLY,
    fix: 'Corrigir a guarda do resolveWorkspaceAccess.',
    regression: 'Nenhum utilizador enumera a árvore fora do seu âmbito.',
  },
  {
    id: 'F13',
    severity: 'media',
    title: 'Fail-open do licenciamento na interface',
    persona: 'Utilizador de tenant com licença em erro ou ainda a carregar',
    flow: 'Gating de módulos na UI',
    location: [
      'src/lib/license.js — em erro devolve licensed: true, modules: [].',
      'isModuleLicensed devolve true quando modules não é array e true enquanto a licença não carregou.',
    ],
    impact:
      'Os gates de servidor mantêm-se nas funções, mas as páginas que leem entidades diretamente ficam sem gating.',
    reproduction: INSPECTION_ONLY,
    fix: 'Tornar o default de licença fail-closed (ou sinalizar um estado de erro explícito).',
    regression: 'Sem licença resolvida, a página não mostra conteúdo do módulo.',
  },
  {
    id: 'F9',
    severity: 'baixa',
    title: 'Pedido de delegação sem âmbito de carteira',
    persona: 'Qualquer utilizador autenticado',
    flow: '§8 — pedidos de delegação',
    location: ['request_delegation aceita qualquer customer_id de qualquer utilizador autenticado.'],
    impact: 'O estado pending não concede nada, mas gera ruído e sinalização entre parceiros.',
    reproduction: INSPECTION_ONLY,
    fix: 'Limitar os pedidos de delegação ao âmbito do requerente.',
    regression: 'Um pedido só pode referir clientes dentro do âmbito de quem o faz.',
  },
  {
    id: 'F11',
    severity: 'baixa',
    title: 'Deriva de documentação',
    persona: 'Equipa (decisões de segurança tomadas a partir da documentação)',
    flow: 'AGENTS.md e RouteGuard',
    location: [
      'AGENTS.md afirma que canAccessRoute() «short-circuits master_admin»; o código não faz short-circuit em nenhum dos caminhos — o efeito pretendido resulta da matriz.',
      'RouteGuard — a isenção de licença para isWorkspaceOrAbove significa que o catálogo de conteúdo nunca é licence-gated para admins.',
    ],
    impact:
      'A documentação descreve um comportamento que não existe, o que pode levar a decisões de segurança erradas.',
    reproduction: INSPECTION_ONLY,
    fix: 'Corrigir a afirmação sobre o short-circuit em AGENTS.md.',
    regression: 'Documentação e código descrevem o mesmo comportamento.',
  },
  {
    id: 'F14',
    severity: 'verificar',
    title: 'Regra de leitura não declarada em User',
    persona: 'Todos os utilizadores autenticados',
    flow: 'Isolamento entre tenants — leitura de utilizadores',
    location: ['base44/entities/User.jsonc — não declara rls.read.'],
    impact:
      'Não se assume que uma regra ausente seja restritiva: se for permissiva, qualquer utilizador autenticado lê nome, papel e customer_id de utilizadores de todos os clientes. Requer confirmação em backend real; se confirmado, passa a Crítica.',
    reproduction: INSPECTION_ONLY,
    fix: 'Declarar rls.read em User.',
    regression: 'Um utilizador só lê os utilizadores do seu tenant.',
  },
];

export const FIX_PLAN = [
  { id: 1, ref: 'F1', refNote: 'crítica', text: 'Retirar onboarding_customer_ids dos ramos rls.read operacionais; escrever o array só na aceitação e limpá-lo no fim do onboarding.' },
  { id: 2, ref: 'F2', refNote: '', text: 'Normalizar toda a RLS para os 9 papéis; escopiar UserCustomerAssignment por parceiro/tenant.' },
  { id: 3, ref: 'F3', refNote: '', text: 'Separar «admin de plataforma» de «admin de parceiro» (isPartnerAdmin), com escopo de carteira em list, resolve e create_onboarding.' },
  { id: 4, ref: 'F4', refNote: '', text: 'Passar authorized_modules a authorizeAssessmentOperational e a resolveAuthority; lista vazia = nenhum módulo.' },
  { id: 5, ref: 'F5', refNote: '', text: 'Introduzir verificação de papel nas regras de escrita das entidades operacionais, ou fechar a escrita direta e forçar as funções.' },
  { id: 6, ref: 'F6', refNote: '', text: 'Proibir a auto-edição de role/customer_id; limitar o papel atribuível pelo workspace_admin ao seu âmbito.' },
  { id: 7, ref: 'F15', refNote: '', text: 'Aplicar expires_at na camada de entidades (revalidação por expires_at ou limpeza determinística).' },
  { id: 8, ref: 'F7 / F8 / F9 / F13 / F14', refNote: '', text: 'Uniformizar normalizeRole em todas as funções; corrigir a guarda do resolveWorkspaceAccess; limitar pedidos de delegação; tornar o default de licença fail-closed (ou sinalizar estado de erro explícito); declarar rls.read em User.' },
  { id: 9, ref: 'F11', refNote: 'documentação', text: 'Corrigir a afirmação sobre short-circuit em AGENTS.md.' },
];

export const NOT_EXECUTED = [
  { block: '§6–§16 (percursos por persona, ponta a ponta na interface)', reason: 'A camada de decisão (Sidebar, RouteGuard, matriz de capacidades, contexto de tenant) e as funções de backend são executadas pelo harness com as nove identidades, mas a interface a sério exige uma sessão por persona: o backend local ignora a criação de utilizadores e a escrita de User.role.' },
  { block: 'Escrita com delegação de edição (§8.5) na camada de entidades', reason: 'O emulador local não honra delegated_edit_customer_ids (esconde na leitura, 403 na escrita); a autorização das funções é executada pelo harness (DEL1–DEL10).' },
  { block: 'Isolamento real multi-tenant, caches, troca de contexto e operações em lote', reason: 'Exigem múltiplas sessões/identidades — as RLS das entidades são avaliadas sobre a sessão autenticada.' },
  { block: 'Notificações, pesquisa, ajuda contextual e IA', reason: 'Fora do âmbito desta ronda.' },
  { block: 'seedTestEnvironment na ronda original', reason: 'O pedido proibia seeds; o cenário ficou por materializar nesta ronda. Entretanto o harness usa-o (é ele que cria a topologia de teste), com confirmação explícita e só no ambiente local descartável.' },
  { block: 'Crash de /audit-package', reason: 'O percurso passou a ser exercido por identidade no harness (FA5.1–FA5.3: geração pelo editor do tenant, criação recusada ao auditor e leitura da trilha limitada ao seu tenant) e a página deixou de poder falhar em silêncio — erro com repetição, sob a fronteira do layout. A leitura das entidades `AuditPackage` por uma sessão de auditor real continua por confirmar: a RLS é avaliada sobre a sessão autenticada, uma só no emulador.' },
  { block: 'Rede cortada nas listas (FA4)', reason: 'O estado de erro com repetição passou a cobrir todas as listas das três famílias, mas a reprodução com a rede cortada exige uma execução manual no browser; o preview não a permite sem alterar o ambiente da página.' },
];

export function severityMeta(id) {
  return SEVERITIES.find((s) => s.id === id) || SEVERITIES[SEVERITIES.length - 1];
}

export function countBySeverity() {
  return SEVERITIES.reduce((acc, s) => {
    acc[s.id] = ISSUES.filter((i) => i.severity === s.id).length;
    return acc;
  }, {});
}

/**
 * Estado da correção: aceita um id de problema (F1, que resolve por ISSUE_STATUS)
 * ou já um id de estado (`corrigido`/`parcial`/`pendente`, como os achados da
 * ronda funcional trazem no seu próprio campo `status`). Por omissão «pendente».
 */
export function statusMeta(idOrStatus) {
  const direct = STATUSES.find((s) => s.id === idOrStatus);
  if (direct) return direct;
  const entry = ISSUE_STATUS[idOrStatus] || {};
  return STATUSES.find((s) => s.id === entry.status) || STATUSES[STATUSES.length - 1];
}

/** Nota de correção de um problema. */
export function issueStatus(id) {
  return ISSUE_STATUS[id] || {};
}

export function countByStatus() {
  return ISSUES.reduce((acc, i) => {
    const s = (ISSUE_STATUS[i.id] || {}).status || 'pendente';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
}

// Residuais que as correções não fecham e que ficam como seguimento.
export const FOLLOW_UPS = [
  {
    ref: 'F2 residual',
    title: 'Gates de catálogo/tenant migrados por substituição fiel',
    note: 'As 29 entidades de catálogo/tenant (Comment, Training, Notification, licenciamento, KnowledgeArticle, …) passaram a nomear master_admin por substituição fiel de admin → master_admin, com os ramos de tenant, delegação e customer_admin intactos. Fica por revisar, entidade a entidade, se algum desses gates era na verdade de cliente (customer_admin) e ficou alargado à plataforma — a substituição preserva o comportamento legado (normalizeRole mapeia admin → master_admin), não decide o gate correto.',
  },
  {
    ref: 'F15 residual',
    title: 'Expiração não revalidada na camada de entidades',
    note: 'O prune no arranque de sessão e o dropExpired em list/resolve fecham a janela na prática, mas uma leitura de entidade continua a honrar delegated_*_customer_ids sem revalidar expires_at. Fechar isto exige revalidação por data na RLS ou uma limpeza determinística fora do arranque.',
  },
  {
    ref: 'F2/F7 — verificação local',
    title: 'Decisão tomada (migração de papéis); confirmação ponta-a-ponta pendente',
    note: 'A decisão foi a migração da grafia, não o alias: as contas passam a ser guardadas com o papel canónico no primeiro login (logUserLogin) e adminUpdateUser normaliza o que persiste, depois de o frontend deixar de comparar literais. O backend compara user_condition por igualdade exacta e não normaliza o papel (verificado), e o emulador local ignora a escrita de User.role — pelo que a conta local permanece admin e o efeito ponta-a-ponta, com a RLS canónica a casar a conta, só é observável num backend real.',
  },
  {
    ref: 'Harness multi-identidade',
    title: 'Validação executável por identidade — o que fecha e o que falta',
    note: 'O harness (`tools/validation-harness`, `npm run validate:harness`) injecta as nove identidades no limite das funções (cabeçalho `x-base44-dev-actor`, honrado só com `BASE44_DEV_IDENTITY=1`, variável que existe apenas no compose local) e corre a camada de decisão do frontend com o código real (`rbac.js`, `sidebarGroups.js`, `licenseModules.js`, `tenantResolver.js`). Estado: 61 ok, 0 falhas, 1 não verificável localmente (62 casos). Fecha: âmbito de leitura e de escrita de um administrador de parceiro sobre a sua carteira, provisionamento de licenças (criação, mudança de tier, exceção por módulo com motivo e validade, suspensão com tolerância e fecho fail-closed no fim dela, reactivação), estados da delegação (activa, expirada, revogada e restrita por módulo), coerência Sidebar↔RouteGuard nas nove identidades, o contrato do contexto de tenant (TEN1–TEN6, este último a garantir que nenhuma página volta a resolver o tenant por si), a cobertura de leitura do consultor (FA1.1–FA1.5) e o percurso do pacote de auditoria por identidade (FA5.1–FA5.3: geração pelo editor do tenant, 403 ao auditor e leitura da trilha limitada ao seu tenant). Não fecha: as RLS das entidades (avaliadas pela sessão autenticada, uma só) e o ramo `delegated_edit_customer_ids` (escondido na leitura pelo emulador) — ambos exigem backend real.',
  },
];
