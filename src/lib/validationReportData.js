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
    '2c2932e — «Refatorar RLS de entidades e implementar restrições de onboarding e licenciamento» (2026-09-28), com uniformização das verificações de papel do backend aplicada nesta ronda',
  backend:
    'base44 dev local (funções em Deno; entidades em base de dados em memória), servido por docker compose -f docker-compose.base44.yml, serviço web (node:22-slim) + vite → host 3000',
  persistence: 'Nenhuma — estado em memória, perdido em cada restart do container ou alteração de schema.',
  auth: 'Real (token CLI `base44 login`), mas uma única identidade.',
  identities:
    'Apenas a conta CLI (papel `admin` → `normalizeRole()` → `master_admin`). `User` create/delete são ignorados localmente.',
  isolation: 'Não existe ambiente isolado/descartável multi-identidade.',
  scope:
    'Inspeção de código e de configuração no ambiente de preview. Onde não havia ambiente válido para testar, o cenário ficou marcado como «Não executado» — nunca convertido em aprovação por simulação visual de papel.',
};

export const VERDICT = {
  classification: 'Correções aplicadas em código — validação live por executar',
  summary:
    'As correções de F1–F15 foram implementadas em código (escopo de carteira do parceiro, âmbito de módulos da delegação, guarda de auto-escalada, RLS canónica, licenciamento fail-closed) e as verificações de papel do backend foram uniformizadas nesta ronda. O Core continua sem parecer positivo: as correções são dadas como aplicadas e revistas por inspeção, não como verificadas, porque a validação executada — onboarding, escopo de delegação, escrita por papel — exige várias identidades reais, que o ambiente local não tem. Ficam residuais por fechar (F2, F7 e F15).',
  blockers: [
    'F2 — a RLS canónica não aceita a grafia legada guardada nas contas: o administrador de plataforma local perde a leitura de Customer, Workspace e AuditLog (lista de Clientes vazia) e o mesmo acontece em produção enquanto as contas tiverem role "admin".',
    'F7 parcial — o backend foi uniformizado, mas ~84 comparações de papel do frontend continuam na grafia legada e são o que fixa a grafia que pode ser guardada.',
    'F15 parcial — a leitura de entidades não revalida expires_at; a delegação expirada só é retirada no arranque da sessão ou numa listagem.',
    'Validação multi-identidade não executada — o backend local tem uma única identidade (master_admin) e ignora a criação de utilizadores; cada percurso tem de correr num backend real com contas das personas.',
    'Semântica de user_condition no backend de produção por confirmar (localmente é igualdade exacta, sem normalização de papel).',
  ],
  positives: [
    'Matriz de capacidades coerente e sem atalho para admins de plataforma/parceiro nas capacidades de conformidade.',
    'Ciclo de delegação com motivo, prazo, proibição de auto-aprovação e aprovação reservada ao cliente.',
    'Break-glass removido; cálculo de resultados, cobertura e metodologia sempre no servidor, com o ator retirado de `base44.auth.me()`.',
    'F1, F3–F6, F8, F9, F11, F13 e F14 aplicadas em código; F2, F7 e F15 com residual identificado.',
  ],
};

// Ordem = prioridade. As classes seguem os tokens semânticos usados na app.
export const SEVERITIES = [
  { id: 'critica', label: 'Crítica', classes: 'bg-destructive/10 text-destructive border-destructive/20' },
  { id: 'alta', label: 'Alta', classes: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'media', label: 'Média', classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'baixa', label: 'Baixa', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  { id: 'verificar', label: 'A verificar', classes: 'bg-blue-100 text-blue-700 border-blue-200' },
];

// Estado das correções aplicadas em código (a validação live continua pendente —
// ver FOLLOW_UPS). Não altera a severidade original de cada problema.
export const STATUSES = [
  { id: 'corrigido', label: 'Corrigido', classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'parcial', label: 'Parcial', classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'pendente', label: 'Pendente', classes: 'bg-destructive/10 text-destructive border-destructive/20' },
];

export const ISSUE_STATUS = {
  F1: {
    status: 'corrigido',
    note: 'manageAccess deixou de escrever onboarding_customer_ids na criação e nenhuma regra rls.read o lê; o array só é escrito na aceitação e é limpo na expiração/revogação.',
  },
  F2: {
    status: 'parcial',
    note: 'Customer, Workspace, AuditLog, User, UserCustomerAssignment e as entidades operacionais passaram a nomear os papéis canónicos. Ficam duas consequências por fechar: (a) a RLS compara user_condition por igualdade exacta e o backend não normaliza papéis (verificado no emulador local), pelo que uma conta guardada como `admin` deixa de satisfazer regras que só nomeiam `master_admin` — o administrador de plataforma local passou a ver a lista de Clientes vazia; (b) subsistem literais role: "admin" nas entidades de catálogo/tenant (Comment, Training, Notification, licenciamento, KnowledgeArticle, …), que aceitam a conta legada e recusam uma conta canónica. É preciso decidir entre aceitar a grafia legada como alias do mesmo papel ou migrar as contas para os papéis canónicos.',
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
    status: 'parcial',
    note: 'Backend uniformizado: 15 funções deixaram de comparar o papel a literais e usam normalizeRole (adminDeleteUser, adminUpdateUser, dataRetentionPurge, documentNotifications, generateMonthlyAnnualReport, getPlatformMetrics, getStorageProviders, getWorkspaceTree, listUsers, manageAssignment, migrateExistingLicenses, migrateExistingWorkspaces, riskDueDateReminders, seedLicenseData, updateCustomerStorage), além de getEffectiveLicense e resolveWorkspaceAccess. Falta o frontend: ~84 comparações role === "admin" / role === "user" em 41 ficheiros continuam na grafia legada e têm de passar pelo normalizador do RBAC.',
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
  { block: '§5 (fluxos comuns) e §6–§16 (percursos por persona)', reason: 'Não existe ambiente isolado com contas das personas; o backend local tem uma única identidade (master_admin) e ignora a criação de utilizadores.' },
  { block: 'Escrita com delegação de edição (§8.5)', reason: 'O emulador local não honra delegated_edit_customer_ids (esconde na leitura, 403 na escrita).' },
  { block: 'Isolamento real multi-tenant, caches, troca de contexto e operações em lote', reason: 'Exigem múltiplas sessões/identidades.' },
  { block: 'Notificações, pesquisa, ajuda contextual e IA', reason: 'Fora do âmbito desta ronda.' },
  { block: 'seedTestEnvironment', reason: 'O pedido proíbe seeds; é o caminho mais curto para materializar os 9 cenários, mas carece de autorização explícita.' },
  { block: 'Crash de /audit-package', reason: 'Não reproduzível sem execução de página; registado como issue separada.' },
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

/** Estado da correção de um problema (por omissão «pendente»). */
export function statusMeta(id) {
  const entry = ISSUE_STATUS[id] || {};
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
    title: 'Literais de papel legado nas entidades de catálogo/tenant',
    note: 'As entidades de isolamento (Customer, Workspace, AuditLog, User, UserCustomerAssignment) e as operacionais já usam os papéis canónicos. As restantes mantêm role: "admin", o que exige decidir por entidade se o gate era de plataforma (master_admin) ou de cliente (customer_admin) antes de substituir — uma troca mecânica atribuiria o gate errado.',
  },
  {
    ref: 'F15 residual',
    title: 'Expiração não revalidada na camada de entidades',
    note: 'O prune no arranque de sessão e o dropExpired em list/resolve fecham a janela na prática, mas uma leitura de entidade continua a honrar delegated_*_customer_ids sem revalidar expires_at. Fechar isto exige revalidação por data na RLS ou uma limpeza determinística fora do arranque.',
  },
  {
    ref: 'F2/F7 — papel canónico vs grafia legada',
    title: 'Decidir entre alias da grafia legada ou migração de papéis',
    note: 'O backend compara user_condition por igualdade exacta e não normaliza o papel (verificado). Ou as regras aceitam `admin` como alias do mesmo papel que `master_admin`, ou as contas passam a ser guardadas com os papéis canónicos — e nesse caso as ~84 comparações de papel do frontend têm de passar pelo normalizador do RBAC antes de a conta mudar, sob pena de o administrador perder os acessos de interface.',
  },
];
