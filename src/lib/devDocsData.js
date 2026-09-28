/**
 * Documentação técnica interna — arquitetura da plataforma Securematurity.
 *
 * Conteúdo narrativo estático que alimenta a página /documentacao-tecnica.
 * Os papéis, a matriz de capacidades e o catálogo de módulos/tiers NÃO são
 * duplicados aqui: a página lê-os em runtime de `src/lib/rbac.js` e
 * `src/lib/licenseModules.js`, para que a documentação não divirja do código
 * que aplica as regras. Este ficheiro guarda só o que não é derivável do código.
 */

export const DOCS_META = {
  app: 'Securematurity',
  appId: '6ab5373e7f8f586c80cb9ed8',
  branch: 'migration-ankoraone-update',
  audience: 'Equipa de desenvolvimento, administradores de plataforma e integradores.',
  scope:
    'Documento interno de engenharia: descreve o estado desta branch. É a referência do separador «Dev» do sidebar, ao lado do Relatório de Validação.',
};

export const STACK = [
  {
    label: 'Frontend',
    value:
      'React 18 + Vite (SPA), React Router, TanStack Query, Tailwind e componentes shadcn/ui sobre o design system AnkoraOne (variáveis HSL).',
  },
  {
    label: 'Backend',
    value:
      'Base44 — funções em Deno (TypeScript), entidades declaradas em JSONC, workflows agendados, conectores e um agente de IA.',
  },
  {
    label: 'Identidade',
    value:
      'Base44 Auth. O papel guardado é normalizado para o conjunto canónico de 9 papéis (normalizeRole), aceitando as grafias legadas.',
  },
  {
    label: 'Multitenancy',
    value:
      'Customer (inquilino) + Workspace (árvore organizacional) + UserCustomerAssignment (delegação explícita entre pessoas e clientes).',
  },
  {
    label: 'Isolamento de dados',
    value:
      'RLS declarada por entidade (customer_id e arrays desnormalizados no User) — é a fronteira de segurança efetiva.',
  },
  {
    label: 'Licenciamento',
    value: '3 tiers comerciais cumulativos e 9 módulos; gating fail-closed no servidor e na interface.',
  },
  {
    label: 'Integridade de evidências',
    value:
      'Hash SHA-256 calculado no cliente no upload e validado na revisão; cada aprovação gera uma DocumentVersion.',
  },
];

/** As três camadas de controlo de acesso, em cascata (mais permissiva → mais restritiva). */
export const LAYERS = [
  {
    order: 1,
    title: 'RBAC — o que cada papel vê',
    location: 'src/lib/rbac.js (frontend)',
    detail:
      'Uma única matriz de capacidades (CAPABILITIES) decide as rotas e os itens de navegação de cada papel. O master_admin não tem atalho: só vê o que a matriz lhe concede, pelo que um URL de conformidade aberto directamente é redirecionado para o painel.',
  },
  {
    order: 2,
    title: 'Licenciamento — o que o cliente comprou',
    location: 'src/lib/license.js + src/lib/licenseModules.js (UI) e base44/shared/licenseGuard.ts (servidor)',
    detail:
      'Cada rota mapeia para um módulo; o módulo só é mostrado se a subscrição do tenant o incluir. Fail-closed: enquanto a licença não está resolvida, nenhum módulo é dado por licenciado.',
  },
  {
    order: 3,
    title: 'RLS — a fronteira de segurança',
    location: 'base44/entities/*.jsonc (rls.create / read / update / delete)',
    detail:
      'Filtra os dados por customer_id e pelos arrays de delegação guardados no User. É a única camada que o cliente não pode contornar — as duas primeiras são de experiência e de gating comercial.',
  },
];

/** Modelo de dados do isolamento entre inquilinos. */
export const TENANCY_MODELS = [
  {
    name: 'Customer',
    description: 'O inquilino. É a unidade de isolamento dos dados operacionais e de licenciamento.',
    fields: ['name', 'nif', 'sector', 'workspace_id', 'status'],
  },
  {
    name: 'Workspace',
    description:
      'Árvore organizacional (root / organization / division / subsidiary / department) com rastreio da cadeia de ascendentes, usada para a carteira dos parceiros.',
    fields: ['type', 'parent_id', 'ancestor_ids', 'customer_id', 'path'],
  },
  {
    name: 'User',
    description:
      'Identidade. Além do papel, guarda arrays desnormalizados que alimentam a RLS das entidades operacionais.',
    fields: ['role', 'customer_id', 'workspace_id', 'delegated_view_customer_ids', 'delegated_edit_customer_ids', 'onboarding_customer_ids'],
  },
  {
    name: 'UserCustomerAssignment',
    description:
      'A delegação explícita entre uma pessoa e um cliente — o único mecanismo que abre acesso operacional a quem não pertence ao tenant.',
    fields: ['assignment_type', 'access_level', 'authorized_modules', 'status', 'expires_at', 'requested_by', 'approved_by', 'reason'],
  },
];

export const DELEGATION_FLOW = [
  'Um pedido de delegação exige motivo e um prazo no futuro (no máximo 365 dias), e só pode referir clientes dentro do âmbito de quem o faz.',
  'A aprovação é reservada ao master_admin ou ao customer_admin do próprio cliente; a auto-aprovação é recusada.',
  'A aprovação escreve o cliente no array desnormalizado do User conforme o access_level (viewer → delegated_view_customer_ids; contributor/admin → delegated_edit_customer_ids) e marca a atribuição como «active».',
  'O onboarding é apenas configuração de conta: nunca concede acesso a dados operacionais.',
  'As delegações expiradas são retiradas de forma preguiçosa no arranque de sessão (prune) e nas listagens/resoluções (dropExpired).',
];

/** Áreas funcionais — espelham a organização do sidebar. */
export const FEATURE_AREAS = [
  {
    area: 'Painel e clientes',
    description: 'Entrada da aplicação, com um painel próprio por papel e a gestão da carteira de clientes.',
    items: [
      { name: 'Painel', route: '/', resource: 'dashboard', summary: 'Cinco variantes (plataforma, parceiro, tenant, executivo, colaborador) escolhidas pelo papel efetivo.' },
      { name: 'Clientes', route: '/customers', resource: 'customers', summary: 'Inquilinos, a sua subscrição e ocupação de lugares.' },
    ],
  },
  {
    area: 'Jornada NIS2',
    description: 'Percurso de conformidade com o RJCS/NIS2, passo a passo.',
    items: [
      { name: 'Jornada de Conformidade', route: '/compliance-journey', resource: 'compliance_journey', summary: 'Checklist de conformidade com o estado de cada área.' },
      { name: 'Guia de Frameworks', route: '/framework-guide', resource: 'framework_guide', summary: 'Agente de IA que responde sobre os controlos e a metodologia.' },
    ],
  },
  {
    area: 'Avaliações e plano de ação',
    description: 'Ciclo completo de avaliação de maturidade, lacunas e ações corretivas.',
    items: [
      { name: 'Avaliações', route: '/assessments', resource: 'assessments', summary: 'Avaliações de maturidade, cálculo de resultados e geração de lacunas no servidor.' },
      { name: 'Plano de Ação', route: '/action-plan', resource: 'action_plan', summary: 'Recomendações e respetivas ações, derivadas das lacunas.' },
      { name: 'BD de Perguntas', route: '/question-bank', resource: 'question_bank', summary: 'Catálogo partilhado de perguntas e controlos.' },
      { name: 'Métricas de Conformidade', route: '/compliance-metrics', resource: 'compliance_metrics', summary: 'Cobertura e progresso por framework.' },
      { name: 'Tarefas', route: '/tasks', resource: 'tasks', summary: 'Execução das ações, com responsável, prazo e evidência exigida.' },
      { name: 'Análise de Tarefas', route: '/task-analytics', resource: 'task_analytics', summary: 'Carga e progresso das ações.' },
    ],
  },
  {
    area: 'Documentos e evidências',
    description: 'Prova documental da conformidade, com versionamento e integridade.',
    items: [
      { name: 'Documentos', route: '/security-documents', resource: 'documents', summary: 'Documentos de segurança, revisão e aprovação server-side.' },
      { name: 'Evidências', route: '/evidence', resource: 'evidence', summary: 'Evidências associadas a respostas e tarefas.' },
      { name: 'Trilha de Auditoria de Documentos', route: '/document-audit-trail', resource: 'document_audit', summary: 'Histórico de alterações e aprovações.' },
    ],
  },
  {
    area: 'Relatórios e auditoria',
    description: 'Comunicação de resultados e preparação de auditoria externa.',
    items: [
      { name: 'Relatórios', route: '/reports', resource: 'reports', summary: 'Relatórios de conformidade e exportação.' },
      { name: 'Pacote de Auditoria', route: '/audit-package', resource: 'audit_package', summary: 'Congela âmbito, controlos, evidências (com hashes) e decisões para revisão externa.' },
      { name: 'Relatório Estratégico', route: '/strategic-report', resource: 'strategic_report', summary: 'Visão executiva da postura de conformidade.' },
      { name: 'Relatório por E-mail', route: '/email-report', resource: 'email_report', summary: 'Envio periódico do estado a destinatários definidos.' },
    ],
  },
  {
    area: 'Risco e incidentes',
    description: 'Gestão de risco de cibersegurança e resposta a incidentes.',
    items: [
      { name: 'Gestão de Risco', route: '/risk-assessment', resource: 'risks', summary: 'Identificação, avaliação e tratamento de riscos.' },
      { name: 'Vulnerabilidades', route: '/vulnerabilities', resource: 'vulnerabilities', summary: 'Registo e acompanhamento de vulnerabilidades.' },
      { name: 'Incidentes', route: '/incidents', resource: 'incidents', summary: 'Registo de incidentes e notificação.' },
    ],
  },
  {
    area: 'Cadeia de abastecimento',
    description: 'Conformidade dos fornecedores e da cadeia de fornecimento.',
    items: [
      { name: 'Fornecedores', route: '/suppliers', resource: 'suppliers', summary: 'Registo e avaliação de fornecedores.' },
      { name: 'Cadeia de Fornecimento', route: '/supply-chain', resource: 'supply_chain', summary: 'Questionários e risco da cadeia.' },
    ],
  },
  {
    area: 'Conhecimento',
    description: 'Base de conhecimento editorial.',
    items: [
      { name: 'Base de Conhecimento', route: '/knowledge-base', resource: 'knowledge_base', summary: 'Artigos com fluxo editorial (rascunho → revisão → publicado), versionados e auditados.' },
    ],
  },
  {
    area: 'Privacidade',
    description: 'Módulo de privacidade (preservado no código, fora da oferta comercial).',
    items: [
      { name: 'Registo de Atividades de Tratamento', route: '/ropa', resource: 'ropa', summary: 'Inventário de tratamentos de dados pessoais.' },
      { name: 'Pedidos de Titulares', route: '/dsr', resource: 'dsr', summary: 'Pedidos de acesso, retificação ou eliminação.' },
    ],
  },
  {
    area: 'Transversal',
    description: 'Funcionalidades disponíveis em todos os tiers, sem gating de módulo.',
    items: [
      { name: 'Formação', route: '/training', resource: 'training', summary: 'Atribuição de formação e acompanhamento de conclusão.' },
      { name: 'Atestação de Políticas', route: '/policy-attestation', resource: 'policy_attestation', summary: 'Pedido e registo de atestação de políticas pelos colaboradores.' },
      // «Acesso Externo» foi fundido em «Delegações» (/user-assignments); a rota antiga redireciona.
      { name: 'Delegações', route: '/user-assignments', resource: 'external_access', summary: 'Pedidos e aprovações de delegação, onboarding e atribuições diretas por utilizador e cliente.' },
    ],
  },
  {
    area: 'Gestão da plataforma',
    description: 'Administração da plataforma, da carteira e da configuração.',
    items: [
      { name: 'Organização', route: '/organization', resource: 'organization', summary: 'Estrutura de clientes e workspaces.' },
      { name: 'Licenciamento', route: '/licensing', resource: 'licensing', summary: 'Catálogo de tiers, módulos, standards e subscrições por cliente.' },
      { name: 'Configuração', route: '/configuration', resource: 'settings', summary: 'Parâmetros do tenant e preferências.' },
      { name: 'Estado do Sistema', route: '/system-status', resource: 'system_status', summary: 'Métricas de utilização, entidades e armazenamento.' },
      { name: 'Registo de Auditoria', route: '/audit-log', resource: 'audit_log', summary: 'Trilha de auditoria da plataforma.' },
    ],
  },
];

/** Notas por papel (a lista de papéis e as capacidades vêm do RBAC, não daqui). */
export const ROLE_NOTES = [
  {
    code: 'master_admin',
    scope: 'Plataforma',
    summary:
      'Equipa AnkoraOne. Administra clientes, organização, licenciamento, estado do sistema, registo de auditoria e o catálogo de conteúdo. Não tem capacidades de conformidade por omissão: acede aos dados de um cliente apenas por delegação explícita.',
  },
  {
    code: 'workspace_admin',
    scope: 'Parceiro',
    summary:
      'Administrador de parceiro. Mesma família de administração que o master_admin, mas limitado à carteira do seu workspace e descendentes. Não aprova delegações em nome do cliente.',
  },
  {
    code: 'customer_admin',
    scope: 'Cliente',
    summary:
      'Administrador do cliente. Gere acessos e configuração do tenant e é o nível mais alto de escrita operacional (cria, elimina, aprova).',
  },
  {
    code: 'grc_analyst',
    scope: 'Cliente',
    summary:
      'Analista de GRC. Conduz avaliações, plano de ação, riscos, fornecedores e documentos; também cura o catálogo de conteúdo.',
  },
  {
    code: 'control_owner',
    scope: 'Cliente',
    summary: 'Responsável de controlo. Executa tarefas, documentos, evidências, incidentes e vulnerabilidades.',
  },
  {
    code: 'executive',
    scope: 'Cliente',
    summary: 'Executivo. Leitura estratégica de relatórios, métricas e riscos, sem escrita.',
  },
  {
    code: 'auditor',
    scope: 'Cliente',
    summary: 'Auditor. Lê evidências, trilhas de auditoria, pacotes de auditoria e registos de privacidade.',
  },
  {
    code: 'employee',
    scope: 'Cliente',
    summary: 'Colaborador. Portal pessoal: tarefas, incidentes, formação, atestação de políticas e base de conhecimento.',
  },
  {
    code: 'consultant',
    scope: 'Externo',
    summary:
      'Consultor externo. Sem capacidades próprias: recebe acesso por delegação, limitado aos módulos autorizados.',
  },
];

export const SECURITY_MODEL = [
  {
    title: 'Matriz de capacidades',
    items: [
      'Fonte única no frontend (CAPABILITIES) e espelhada nos gates do backend; a tabela abaixo é gerada diretamente dessa matriz.',
      'Os tiers de conformidade são exclusivos do tenant (T_*): um administrador de plataforma ou de parceiro não recebe, por omissão, nenhuma capacidade de conformidade — só por delegação explícita.',
      'O master_admin não é atalho em nenhum ponto: nem em can() nem em canAccessRoute().',
    ],
  },
  {
    title: 'Delegação e onboarding',
    items: [
      'A delegação tem motivo, prazo (≤ 365 dias) e âmbito de módulos (authorized_modules); lista vazia significa nenhum módulo.',
      'Só o master_admin ou o customer_admin do próprio cliente aprova; a auto-aprovação é recusada.',
      'O onboarding é só configuração de conta e não abre leitura de dados operacionais.',
    ],
  },
  {
    title: 'Escrita e integridade',
    items: [
      'As mutações de utilizadores passam por funções com service role (adminUpdateUser), com validação de âmbito e registo de auditoria.',
      'A auto-edição de papel ou de cliente está bloqueada; um administrador de parceiro só atribui papéis de cliente dentro da sua carteira.',
      'O cálculo de resultados, cobertura e metodologia é sempre feito no servidor, com o ator retirado de base44.auth.me().',
      'Cada evidência guarda um hash SHA-256; a aprovação de um documento cria uma versão imutável.',
    ],
  },
  {
    title: 'Licenciamento',
    items: [
      'O gating é fail-closed: sem licença resolvida, em erro, ou com lista malformada, nenhum módulo é dado por licenciado.',
      'Os gates de servidor mantêm-se independentes dos gates de interface.',
    ],
  },
];

/**
 * Catálogo comercial (FB7): onde vive e como se altera.
 *
 * As entidades LicenseTier/LicenseModule/LicenseStandard são um espelho semeado,
 * não a fonte: a oferta é curada em código para ficar versionada e revista com os
 * gates que a aplicam.
 */
export const LICENSE_CATALOG = [
  {
    title: 'Onde vive a fonte única',
    items: [
      'Frontend: src/lib/licenseModules.js (MODULE_CODES, MODULE_META, TIER_MODULES, COMMERCIALLY_AVAILABLE_TIERS) alimenta a navegação, o gating de rota e esta documentação.',
      'Backend: base44/shared/licenseGuard.ts (modulesForTier, TIER_MODULES, LEGACY_TIER_ALIASES) é a versão aplicada nos gates de servidor.',
      'LicenseTier, LicenseModule e LicenseStandard são o espelho semeado: seedLicenseData e migrateExistingLicenses reescrevem-nas a partir de modulesForTier.',
    ],
  },
  {
    title: 'Como se altera a oferta',
    items: [
      'Editar o conjunto no código dos dois lados (licenseModules.js e licenseGuard.ts) e correr seedLicenseData para reconciliar o espelho.',
      'O catálogo é cumulativo (Core ⊂ Profissional ⊂ Avançado) e modulesForTier é a única função que compõe cada conjunto.',
      'A alteração fica no Git, revista a par do código que a aplica — não escapa por edição de dados.',
    ],
  },
  {
    title: 'O que se faz na interface',
    items: [
      '/licensing lê o catálogo e é onde se atribui um tier a um cliente — a operação diária (FB1), não a curadoria.',
      'O provisioning por cliente passa por funções de backend (provisionTenantLicense), nunca por escrita directa às entidades de catálogo.',
    ],
  },
];

export const DEV_GUIDE = {
  commands: [
    { label: 'Arrancar a aplicação (sandbox)', command: 'docker compose -f docker-compose.base44.yml up -d' },
    { label: 'Ver o estado dos serviços', command: 'docker compose -f docker-compose.base44.yml ps' },
    { label: 'Seguir os registos', command: 'docker compose -f docker-compose.base44.yml logs -f web' },
    { label: 'Reautenticar a CLI Base44', command: 'docker compose -f docker-compose.base44.yml exec web base44 login' },
  ],
  quirks: [
    'O backend local corre esta branch: funções em Deno e entidades numa base em memória, sem necessidade de merge para main.',
    'Os dados locais são voláteis: perdem-se em cada reinício do contentor e sempre que um esquema de entidade muda.',
    'O ambiente local tem uma única identidade (a conta da CLI) e ignora a criação/eliminação de utilizadores.',
    'A escrita de User.role é ignorada localmente, pelo que a conta local fica na grafia legada e a RLS canónica não a encontra — num backend real o papel é normalizado no primeiro login.',
    'A RLS por arrays só está meio emulada: o ramo delegated_view_customer_ids é honrado, o delegated_edit_customer_ids não.',
    'Campos que o backend limpa com null têm de ser declarados com tipo de união (ex.: ["number", "null"]).',
    'As chaves de código têm de coincidir exatamente com o nome no esquema — chaves desconhecidas são descartadas.',
  ],
};

/**
 * Modelo de dados — agrupamento editorial.
 *
 * As LISTAS de entidades e funções destes grupos são o agrupamento por domínio,
 * não o inventário: o inventário é derivado do repositório
 * (`src/lib/repoInventory.js`) e a documentação confronta os dois. Uma peça que
 * exista no repositório e não esteja em nenhum grupo aparece na secção do modelo
 * de dados como «sem grupo» — a divergência fica à vista em vez de passar.
 */
export const DATA_MODEL = {
  entities: [
    { group: 'Isolamento e identidade', items: ['Customer', 'Workspace', 'User', 'InvitedUser', 'UserCustomerAssignment', 'AuditLog'] },
    { group: 'Avaliações e ação', items: ['Assessment', 'AssessmentResponse', 'Question', 'Recommendation', 'Task', 'MitigationTask'] },
    { group: 'Documentos e evidências', items: ['SecurityDocument', 'DocumentVersion', 'NominationDocument'] },
    { group: 'Risco e incidentes', items: ['RiskItem', 'RiskHistory', 'Incident', 'Vulnerability'] },
    { group: 'Cadeia de abastecimento', items: ['Supplier', 'SupplierQuestion', 'SupplierQuestionnaire'] },
    { group: 'Conhecimento e formação', items: ['KnowledgeArticle', 'Training', 'TrainingEnrollment', 'TrainingReport', 'TrainingUser'] },
    { group: 'Privacidade', items: ['DataProcessingActivity', 'DataSubjectRequest'] },
    { group: 'Relatórios e auditoria', items: ['AuditPackage', 'ComplianceChecklist'] },
    { group: 'Licenciamento', items: ['LicenseTier', 'LicenseModule', 'LicenseEntitlement', 'LicenseStandard', 'TenantSubscription', 'TenantEntitlementOverride', 'TenantModule', 'TenantStandard', 'LicenseUsageRecord', 'LicenseChangeLog'] },
    { group: 'Camada comercial', items: ['OfferVersion', 'PriceTable', 'CommercialChangeLog', 'QuotaSignal'] },
    { group: 'Importação de perguntas', items: ['QuestionImportBatch', 'QuestionImportItem'] },
    { group: 'Frameworks', items: ['Framework', 'FrameworkControl'] },
    { group: 'Plataforma', items: ['Comment', 'Notification', 'MaintenanceWindow', 'ReminderSettings', 'StorageSettings', 'PolicyAttestation', 'PlatformAnnouncement', 'RetentionPolicy', 'WorkflowRun'] },
  ],
  functions: [
    { group: 'Identidade e acesso', items: ['logUserLogin', 'listUsers', 'adminUpdateUser', 'adminDeleteUser', 'manageAccess', 'manageAssignment', 'resolveWorkspaceAccess', 'getWorkspaceTree', 'migrateExistingWorkspaces'] },
    { group: 'Avaliações e ação', items: ['completeAssessment', 'manageActionPlan'] },
    { group: 'Documentos e evidências', items: ['reviewDocument', 'searchDocuments', 'storeFileToCloud', 'documentReviewReminders', 'documentNotifications'] },
    { group: 'Relatórios e auditoria', items: ['generateAuditPackage', 'generateMonthlyAnnualReport', 'getPlatformMetrics', 'listAuditLog', 'getCommercialMetrics'] },
    { group: 'Licenciamento e camada comercial', items: ['getEffectiveLicense', 'provisionTenantLicense', 'listTenantLicenses', 'listLicenseChanges', 'manageCommercialOffer', 'seedLicenseData', 'migrateExistingLicenses', 'updateCustomerStorage', 'getStorageProviders'] },
    { group: 'Notificações, automações e retenção', items: ['createNotifications', 'taskNotifications', 'riskNotifications', 'riskDueDateReminders', 'dataRetentionPurge', 'managePlatformOperations', 'manageAnnouncements'] },
    { group: 'Conteúdo', items: ['transitionArticleStatus', 'seedKnowledgeBase', 'manageQuestionImport', 'extractQuestionBank'] },
    { group: 'Ambiente de teste', items: ['seedTestEnvironment'] },
  ],
  workflows: [
    'Data Retention Purge',
    'Document Review Reminders',
    'Document Status Notifications',
    'Monthly Annual Report Snapshot',
    'Notify on Document Changes',
    'Notify on Risk Changes',
    'Notify on Task Changes',
    'Risk Due Date Reminders',
  ],
  shared: [
    { name: 'accessUtils.ts', note: 'Normalização de papéis, âmbito de carteira e arrays de acesso.' },
    { name: 'assessmentAccess.ts', note: 'Autorização partilhada das avaliações (módulo, delegação, leitura de perguntas/respostas).' },
    { name: 'assessmentScoring.ts', note: 'Cálculo de resultados e cobertura.' },
    { name: 'gapAnalysis.ts', note: 'Derivação de lacunas e mapeamento para recomendações e ações.' },
    { name: 'licenseGuard.ts', note: 'Tiers, módulos e verificação de licença no servidor.' },
    { name: 'contentUtils.ts', note: 'Fluxo editorial da base de conhecimento (papéis e transições).' },
    { name: 'automationSecret.ts', note: 'Segredo partilhado dos workflows.' },
    { name: 'escapeHtml.ts', note: 'Escape de HTML para conteúdo em e-mail e notificações.' },
  ],
  integrations: [
    { name: 'Conectores', note: 'Google Drive e OneDrive para armazenamento de evidências.' },
    { name: 'Agente de IA', note: 'framework_guide — apoio à interpretação dos controlos.' },
  ],
};

/**
 * Modelo de dados — narrativa curada. O inventário (entidades, campos e
 * relações) é derivado do repositório em `src/lib/repoInventory.js`.
 */
export const DATA_MODEL_NOTES = {
  summary:
    'As entidades declaram-se em JSONC em `base44/entities` e trazem no próprio ficheiro o esquema, os campos obrigatórios e a RLS de leitura e escrita. As relações são por identificador (`customer_id`, `workspace_id`, `assessment_id`, `question_id`, …) — o motor não tem chaves estrangeiras — e é a RLS que faz o isolamento entre inquilinos. Os campos mostrados abaixo são as relações e os obrigatórios de cada entidade; a contagem total de campos vem do esquema.',
  rules: [
    'As entidades operacionais isolam-se por customer_id e pelos arrays desnormalizados de delegação guardados no User (delegated_view_customer_ids / delegated_edit_customer_ids).',
    'As entidades com regra de negócio (licenciamento, camada comercial, delegação, catálogo de conteúdo) não têm caminho de escrita no browser: escreve-as a função de backend, com o ator retirado da sessão.',
    'Um campo que o código limpa com null tem de ser declarado com tipo de união (ex.: ["number", "null"]) — o validador recusa null num tipo simples.',
    'Chaves desconhecidas são descartadas pelo backend: o nome do campo no código tem de coincidir exatamente com o do esquema.',
    'Um campo terminado em _id ou _ids que corresponda ao nome de uma entidade existente é apresentado como relação.',
  ],
};

/**
 * Arquitetura de serviços — narrativa curada. O inventário de workflows, código
 * partilhado, conectores e agente é derivado do repositório.
 */
export const SERVICE_MODEL = {
  summary:
    'O backend é feito de funções Deno sem servidor próprio: cada função é uma porta HTTP que resolve o ator, verifica papel e âmbito, confirma o módulo licenciado quando o percurso é comercial, escreve pelo cliente de serviço e responde JSON. As automações agendadas chamam essas mesmas funções, e o código partilhado é o que impede duas portas de divergirem.',
  layers: [
    {
      title: 'Funções de backend (Deno)',
      detail:
        'Cada função é um ponto de entrada autónomo. As funções multiplexadas recebem o comando no campo `action` do corpo; as restantes leem os campos que precisam. A autorização é sempre decidida no servidor.',
    },
    {
      title: 'Automações agendadas (workflows)',
      detail:
        'As automações declaram-se em `base44/workflows`, por calendário (cron) ou por evento de entidade, e chamam funções de backend com o segredo partilhado em vez da sessão do utilizador. Cada execução regista uma linha em WorkflowRun, que é o que a consola de operações mostra.',
    },
    {
      title: 'Código partilhado (base44/shared)',
      detail:
        'O que duas portas não podem repetir: normalização de papel e âmbito de carteira, autorização e pontuação de avaliações, derivação de lacunas, gating de licença, oferta comercial, fluxo editorial, regras da importação de perguntas, segredo das automações, execução de workflows e resolução do ator de teste.',
    },
    {
      title: 'Integrações e agente de IA',
      detail:
        'Conectores de armazenamento para as evidências e um agente que conduz o utilizador pelos controlos de um framework, analisa a resposta e regista-a (com leitura apenas sobre Framework, FrameworkControl e Question).',
    },
  ],
  conventions: [
    'Uma função multiplexada usa `action` como selector: nenhum filtro pode chamar-se `action`, ou sobrepõe-se ao comando e a chamada responde 400.',
    'As escritas de administração usam o cliente de serviço e ficam na trilha de auditoria com o ator real, retirado da sessão — nunca do corpo do pedido.',
    'Uma automação embrulha o handler com o pedido como parâmetro: `Deno.serve((req) => withWorkflowRun(…, req, …))`.',
    'O gating de licença é fail-closed: sem licença resolvida, em erro, ou com lista malformada, nenhum módulo nem standard abre.',
    'O cálculo de resultados, cobertura e metodologia é sempre do servidor; o browser só apresenta.',
  ],
};

/**
 * Notas curadas por função — usadas apenas para as funções que não trazem
 * cabeçalho de documentação no próprio ficheiro. Quando existe cabeçalho, é ele
 * que aparece (derivado); estas notas são a exceção, não a regra.
 */
export const FUNCTION_NOTES = {
  adminDeleteUser: 'Remove um utilizador — dono da plataforma ou administrador de parceiro dentro da sua carteira, com auditoria.',
  createNotifications: 'Cria notificações para os destinatários indicados; é a porta usada pelas automações e pelas funções de evento.',
  documentNotifications: 'Notifica os intervenientes quando um documento muda de estado ou de versão.',
  documentReviewReminders: 'Lembretes de revisão de documentos a vencer (automação de calendário).',
  generateMonthlyAnnualReport: 'Gera o retrato mensal/anual dos relatórios por cliente (automação de calendário).',
  getEffectiveLicense: 'Resolve a licença efetiva do inquilino (tier, módulos, standards e tolerância de suspensão); fail-closed.',
  getStorageProviders: 'Lista os fornecedores de armazenamento disponíveis e a configuração corrente.',
  listUsers: 'Lista utilizadores com o âmbito do papel: um administrador de parceiro vê apenas a sua carteira.',
  logUserLogin: 'Arranque de sessão: normaliza e persiste o papel canónico, retira delegações expiradas e audita a alteração.',
  migrateExistingLicenses: 'Reconcilia o licenciamento existente com o catálogo de tiers atual; idempotente.',
  migrateExistingWorkspaces: 'Cria o workspace raiz dos clientes que ainda não têm; idempotente.',
  riskDueDateReminders: 'Lembretes de prazos de risco a vencer (automação de calendário).',
  riskNotifications: 'Notifica os intervenientes quando um risco é criado, alterado ou fechado.',
  searchDocuments: 'Pesquisa documentos de segurança com os filtros de âmbito de quem chama.',
  storeFileToCloud: 'Guarda um ficheiro no fornecedor de armazenamento configurado e devolve a referência.',
  taskNotifications: 'Notifica responsáveis e donos quando uma tarefa muda de estado ou de prazo.',
  updateCustomerStorage: 'Atualiza a configuração de armazenamento de um cliente.',
};

/**
 * Estrutura da API — narrativa curada. As rotas, os módulos, as ações e os
 * campos de entrada/saída são derivados do código.
 */
export const API_MODEL = {
  summary:
    'A API tem duas faces: as rotas do frontend — cada uma com o recurso de capacidade que a autoriza e, quando é comercial, o módulo que a licencia — e as funções de backend, que são a única porta de escrita. As funções não são REST: o comando vai no corpo e a resposta é sempre JSON.',
  call: [
    'POST /api/apps/<appId>/functions/<nome-da-função>, com os cabeçalhos Base44-App-Id e Authorization: Bearer <token>.',
    'Nas funções multiplexadas, o comando é o campo `action` do corpo; os restantes campos são dados e filtros.',
    'As automações chamam as mesmas funções com o segredo partilhado, em vez da sessão do utilizador.',
    'As chaves de entrada e de saída listadas abaixo são extraídas do código de cada função (desestruturação do corpo e respostas Response.json): são o contrato praticado, não uma promessa.',
  ],
  errors: [
    '401 — sem sessão válida: a função resolveu o ator e não encontrou utilizador.',
    '403 — papel ou âmbito insuficiente (carteira, delegação, módulo não licenciado).',
    '409 — conflito de estado (ex.: publicar um lote já publicado, re-finalizar um pacote de auditoria).',
    '422 — pedido inválido (campo obrigatório em falta, motivo ausente ou valor fora do intervalo).',
  ],
};
