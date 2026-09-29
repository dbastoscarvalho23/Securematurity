/**
 * Optimizações possíveis — ronda refinada de validação por área.
 *
 * Conteúdo estático (sem leituras a entidades nem a funções de backend) da ronda
 * que percorreu todas as áreas e fluxos à procura de pontos de optimização,
 * melhorias e funcionalidades novas. NÃO são achados: os achados dizem o que está
 * mal e vivem em `validationReportData.js` (F1–F15) e em
 * `platformAssessmentData.js` (as famílias FA, FB, FC e FM); aqui está o que vale
 * a pena fazer a seguir — incluindo o que já está sólido.
 *
 * Cada entrada liga-se à área pelo `area` (o mesmo id das áreas do relatório) e
 * diz o que se ganha (`opportunity`), a categoria (`optimizacao`, `melhoria` ou
 * `nova_funcionalidade`), o impacto, o esforço e a evidência que a sustenta
 * (rota, ficheiro, função ou caso do harness). Quando a oportunidade é o passo
 * seguinte de trabalho já registado, aponta-o em `ref` (um achado FA/FB/FC/FM/F ou
 * uma tarefa do to-do) em vez de o repetir aqui.
 *
 * A classificação impacto × esforço (quick win / projeto / candidato) NÃO é
 * escrita em nenhuma entrada: é derivada por `optimizationBand()` em
 * `validationReportModel.js`, para que mudar um impacto mude a etiqueta em todo o
 * relatório no mesmo instante.
 */

/**
 * Categorias de uma oportunidade. A categoria é texto secundário, não uma
 * insígnia, pelo que não leva classes de cor (`palette.js` só entra onde há cor).
 */
export const OPTIMIZATION_CATEGORIES = [
  { id: 'optimizacao', label: 'Optimização' },
  { id: 'melhoria', label: 'Melhoria' },
  { id: 'nova_funcionalidade', label: 'Nova funcionalidade' },
];

/**
 * Níveis de impacto e de esforço, com as classes das insígnias — as mesmas dos
 * tokens semânticos usados pelos achados (`validationReportData.js`), nunca um
 * valor literal (FC2).
 */
export const IMPACT_LEVELS = [
  { id: 'alto', label: 'Impacto alto', classes: 'bg-status-warning/10 text-status-warning border-status-warning/20' },
  { id: 'medio', label: 'Impacto médio', classes: 'bg-chart-3/10 text-chart-3 border-chart-3/20' },
  { id: 'baixo', label: 'Impacto baixo', classes: 'bg-status-info/10 text-status-info border-status-info/20' },
];

export const EFFORT_LEVELS = [
  { id: 'baixo', label: 'Esforço baixo', classes: 'bg-status-success/10 text-status-success border-status-success/20' },
  { id: 'medio', label: 'Esforço médio', classes: 'bg-chart-3/10 text-chart-3 border-chart-3/20' },
  { id: 'alto', label: 'Esforço alto', classes: 'bg-status-warning/10 text-status-warning border-status-warning/20' },
];

/**
 * Faixas da classificação impacto × esforço. A decisão é uma só, em
 * `optimizationBand()`: impacto alto com esforço baixo é quick win; esforço alto
 * é projeto; o resto fica candidato (impacto e esforço intermédios) e decide-se
 * depois das quick wins.
 */
export const OPTIMIZATION_BANDS = [
  {
    id: 'quick_win',
    label: 'Quick win',
    description: 'Impacto alto com esforço baixo: entra primeiro, sem plano à volta.',
    classes: 'bg-status-success/10 text-status-success border-status-success/20',
  },
  {
    id: 'projeto',
    label: 'Projeto',
    description: 'Esforço alto: precisa de desenho e de fases, não de uma arrumação.',
    classes: 'bg-status-info/10 text-status-info border-status-info/20',
  },
  {
    id: 'candidato',
    label: 'Candidato',
    description: 'Impacto ou esforço intermédios: decide-se depois das quick wins.',
    classes: 'bg-muted text-muted-foreground border-border',
  },
];

export const OPTIMIZATIONS = [
  // ─── Funcionalidades e fluxos ───────────────────────────────
  {
    id: 'OP-F1',
    area: 'funcional',
    category: 'melhoria',
    impact: 'medio',
    effort: 'baixo',
    title: 'Nove dependências instaladas que nenhum ficheiro importa',
    opportunity:
      'Retirar do package.json os pacotes sem um único import: menos peso na instalação e no build, e menos código de terceiros para manter e auditar.',
    evidence: [
      'package.json: three, react-leaflet, moment, react-quill, html2canvas, canvas-confetti, @stripe/react-stripe-js, @stripe/stripe-js e lodash',
      "grep de `from '<pacote>'` em src/: 0 ficheiros para todos eles",
    ],
  },
  {
    id: 'OP-F2',
    area: 'funcional',
    category: 'melhoria',
    impact: 'alto',
    effort: 'medio',
    title: 'O inventário do backend viaja no arranque da aplicação',
    opportunity:
      'Carregar a documentação técnica só quando a página abre (import dinâmico): o texto das entidades, funções, automações e agente deixa de entrar no bundle de quem nunca visita /documentacao-tecnica.',
    evidence: [
      "src/lib/repoInventory.js:18-34 — import.meta.glob(..., { query: '?raw', eager: true }) sobre base44/entities, base44/functions, base44/workflows e base44/agents",
      'O inventário conta as entidades e funções do repositório (61 e 44 à data da ronda 5) lidas em texto no build',
      'Os consumidores são /documentacao-tecnica (master_admin) e o exportador do PDF',
    ],
  },
  {
    id: 'OP-F3',
    area: 'funcional',
    category: 'optimizacao',
    impact: 'medio',
    effort: 'baixo',
    title: 'Política de cache das leituras por omissão',
    opportunity:
      'Dar staleTime/gcTime por família de dados — catálogo e configuração quase estáticos, listas operacionais curtas — em vez da mesma regra para tudo, para cortar refetch repetido a cada navegação.',
    evidence: [
      'src/lib/query-client.js — só refetchOnWindowFocus: false e retry: 1',
      '36 páginas usam useQuery',
    ],
  },
  {
    id: 'OP-F4',
    area: 'funcional',
    category: 'melhoria',
    impact: 'medio',
    effort: 'baixo',
    title: 'Listas cortadas sem dizer quanto ficou de fora',
    opportunity:
      'Paginar ou dar «ver mais» com o total em cada lista que hoje mostra só as primeiras linhas — quem lê não sabe se está a ver tudo.',
    evidence: [
      'src/pages/Reports.jsx:167 — slice(0, 10)',
      'src/pages/StrategicReport.jsx:177 e :352 — slice(0, 12) e slice(0, 8)',
      'src/pages/PolicyAttestation.jsx:227 — slice(0, 20)',
      'src/pages/ExternalAccess.jsx:486 — delegações revogadas, slice(0, 20)',
    ],
  },

  // ─── Administração da plataforma ────────────────────────────
  {
    id: 'OP-B1',
    area: 'administracao',
    category: 'melhoria',
    impact: 'medio',
    effort: 'medio',
    title: 'Licenciamento sem pesquisa nem paginação',
    opportunity:
      'Filtro por cliente e por estado (e paginação por cursor no servidor) na lista de assinaturas e no histórico, como já existe na trilha de auditoria e no histórico de licenciamento.',
    evidence: [
      '/licensing — 12 linhas de assinaturas e nenhum campo de pesquisa na página (grep por Input/placeholder: 0)',
      'listTenantLicenses devolve todos os clientes do âmbito, sem filtros nem cursor',
    ],
  },  {
    id: 'OP-B3',
    area: 'administracao',
    category: 'melhoria',
    impact: 'alto',
    effort: 'alto',
    title: 'Verificação por identidade fora do emulador de sessão única',
    opportunity:
      'Correr o harness contra um backend com sessões distintas — e, se o modo local vier a suportar multi-sessão, também aí — para fechar o que o emulador não honra: as RLS das entidades por identidade, o ramo delegated_edit_customer_ids e a leitura da trilha.',
    evidence: [
      'O caso RLS1 é reportado n/a: as RLS são avaliadas sobre a única sessão autenticada do emulador, e um tenant só em delegated_edit_customer_ids fica oculto na leitura',
      'FA1.4/FA1.5 provam o âmbito do consultor (rotas e contexto), não a leitura das entidades por delegação',
      'FA5.1–FA5.3 e as auditorias de anúncios vivem numa sessão só',
    ],
  },
  {
    id: 'OP-B4',
    area: 'administracao',
    category: 'melhoria',
    impact: 'baixo',
    effort: 'medio',
    title: 'Retenção e pedidos de titular não exercitáveis localmente',
    opportunity:
      'Preparar um conjunto de dados com registos antigos e pedidos de titular num ambiente real, para percorrer a purga de ponta a ponta em vez de a ver apenas simulada na consola de operações.',
    evidence: [
      'O emulador recusa criar RoPA/DataSubjectRequest (403), pelo que a purga de registos envelhecidos não corre localmente',
      'managePlatformOperations simula a política, mas a execução de dataRetentionPurge sobre dados antigos fica por verificar',
    ],
  },

  // ─── UX/UI e consistência visual ────────────────────────────
  {
    id: 'OP-C1',
    area: 'ux',
    category: 'melhoria',
    impact: 'medio',
    effort: 'baixo',
    title: 'Páginas de acesso ainda em inglês',
    opportunity:
      'Levar os literais das quatro páginas de autenticação às famílias de tradução, como já foi feito nas restantes páginas.',
    evidence: [
      'src/pages/Login.jsx:114 — «Password»',
      'src/pages/Register.jsx:100 e :195 — «Verification code» e «Password»',
      'src/pages/ForgotPassword.jsx:46 — «Email address»',
      'src/pages/ResetPassword.jsx — mesmo padrão',
    ],
  },
  {
    id: 'OP-C2',
    area: 'ux',
    category: 'optimizacao',
    impact: 'medio',
    effort: 'baixo',
    title: 'Botões só com ícone sem nome acessível',
    opportunity:
      'Fechar a cobertura de aria-label/title em todos os botões só com ícone: a correção da FC6 chegou às ações que o achado nomeava, não a todas.',
    evidence: [
      '64 ocorrências de size="icon" em src/ contra 39 ocorrências de aria-label em todos os componentes e páginas',
      'src/components/agents/ChatPanel.jsx:52 — botão de enviar, sem nome',
      'src/components/assessments/AssessmentResults.jsx:178 — voltar para a lista, sem nome',
      'src/components/compliance/ChecklistItemRow.jsx:141 — editar o item, sem nome',
    ],
  },
  {
    id: 'OP-C3',
    area: 'ux',
    category: 'optimizacao',
    impact: 'baixo',
    effort: 'baixo',
    title: 'Diálogo nativo do browser em duas páginas',
    opportunity:
      'Trocar os dois confirm() pelo ConfirmDialog do resto da aplicação: mesma aparência em toda a plataforma e fluxo verificável em teste.',
    evidence: [
      'src/pages/RoPA.jsx:127 — confirm(...)',
      'src/pages/SupplyChain.jsx:62 — confirm(...)',
      'As restantes páginas usam ConfirmDialog',
    ],
  },
  {
    id: 'OP-C4',
    area: 'ux',
    category: 'optimizacao',
    impact: 'medio',
    effort: 'medio',
    title: 'Vinte e cinco famílias de tradução',
    opportunity:
      'Consolidar as famílias num módulo por área e por idioma, com um só ponto de junção: cada ecrã novo deixa de acrescentar mais um ficheiro translations-*.',
    evidence: [
      'src/lib/translations*.js — 25 ficheiros (phase1, phase3, phase7, nav, license, seats, …)',
      'O mesmo tipo de texto vive em famílias diferentes conforme a ronda que o introduziu',
    ],
  },
  {
    id: 'OP-C5',
    area: 'ux',
    category: 'optimizacao',
    impact: 'medio',
    effort: 'medio',
    title: 'Quatro exportadores PDF com a mesma moldura',
    opportunity:
      'Extrair a moldura comum (capa, cabeçalho corrente, rodapé, numeração e logótipo) e deixar cada exportador só com o seu conteúdo: uma mudança de marca passa a ser uma só.',
    evidence: [
      'src/lib/exportReportPdf.js, exportAnalyticsPdf.js, exportTechnicalDocsPdf.js e exportTrainingReportPdf.js',
      'A rasterização do logótipo e o cabeçalho corrente estão repetidos em cada um',
    ],
  },
  {
    id: 'OP-C6',
    area: 'ux',
    category: 'optimizacao',
    impact: 'baixo',
    effort: 'baixo',
    title: 'Markdown da base de conhecimento desenhado à mão',
    opportunity:
      'Reutilizar o renderizador de markdown que a aplicação já traz, para títulos, listas, ligações e ênfase deixarem de sair como texto cru.',
    evidence: [
      'src/pages/KnowledgeBase.jsx:53-54 — trata apenas «# » e «## »',
      'react-markdown já é dependência e já é usado em src/components/agents/MessageBubble.jsx',
    ],
  },

  // ─── Gestão comercial ───────────────────────────────────────
  {
    id: 'OP-M2',
    area: 'comercial',
    category: 'nova_funcionalidade',
    impact: 'medio',
    effort: 'medio',
    title: 'O cliente não vê a sua própria quota',
    opportunity:
      'Abrir a leitura da quota ao customer_admin para o próprio tenant (sem expor a carteira): o cliente sabe onde está antes de ser avisado de que passou o contratado.',
    evidence: [
      'quota_overview recusa quem não é dono da plataforma nem administrador de parceiro (403 a grc_analyst, harness FM4.3)',
      'O achado FM4 está «parcial» precisamente por esta fronteira de autorização',
    ],
    ref: 'FM4',
  },
  {
    id: 'OP-M3',
    area: 'comercial',
    category: 'nova_funcionalidade',
    impact: 'alto',
    effort: 'medio',
    title: 'Proposta comercial gerada a partir da tabela em vigor',
    opportunity:
      'Produzir um PDF de proposta — tiers, lugares incluídos, packs e preço da tabela vigente — reaproveitando a moldura dos exportadores: o orçamento deixa de ser escrito à mão e não pode divergir do que a plataforma vai contratar.',
    evidence: [
      'OfferVersion e PriceTable já guardam tiers, lugares, packs e vigência com preço publicado',
      'Os exportadores existentes são todos de conformidade (relatório, métricas, documentação, formação) — não há nenhum documento comercial',
    ],
    ref: 'FM6',
  },
  {
    id: 'OP-M4',
    area: 'comercial',
    category: 'melhoria',
    impact: 'medio',
    effort: 'medio',
    title: 'Indicadores comerciais sem drill-down número a número',
    opportunity:
      'Cada número da consola abre a lista que o compõe (as subscrições que somam a receita, a coorte de origem do churn), em vez do link único para a consola.',
    evidence: [
      'getCommercialMetrics devolve receita contratada, movimento, churn, conversão e coortes',
      'O achado FM5 está «parcial» com o drill-down registado como residual',
    ],
    ref: 'FM5',
  },
  // ─── Segurança e RBAC ───────────────────────────────────────
  {
    id: 'OP-S1',
    area: 'seguranca',
    category: 'nova_funcionalidade',
    impact: 'alto',
    effort: 'medio',
    title: 'Acesso sem segundo fator',
    opportunity:
      'TOTP ou código por email obrigatório para os papéis que administram tenants e para o dono da plataforma, com códigos de recuperação — é o controlo que falta a um produto de conformidade.',
    evidence: [
      'src/pages/Login.jsx — email e password, sem segundo passo',
      'grep de mfa/totp/2fa em src e base44: só texto de demonstração (RiskExcelImportDialog.jsx:155) e a primitiva ui/input-otp.jsx, sem uso em páginas',
    ],
  },
  {
    id: 'OP-S2',
    area: 'seguranca',
    category: 'optimizacao',
    impact: 'alto',
    effort: 'baixo',
    title: 'Funções sem limitação de ritmo',
    opportunity:
      'Contador por ator e por janela nas funções de escrita e nos caminhos que chamam IA, a responder 429: o custo e o dano de uma conta mal comportada deixam de ser ilimitados.',
    evidence: [
      'Nenhum ficheiro de src/ ou base44/ implementa limitação de taxa (grep de rate.?limit/throttl: só comentários)',
      'As escritas passam todas por funções, que são o ponto único onde a regra pode viver',
      'enforceUsageLimit conta chamadas de IA por cliente e por mês — é quota, não ritmo',
    ],
  },
  {
    id: 'OP-S3',
    area: 'seguranca',
    category: 'optimizacao',
    impact: 'alto',
    effort: 'medio',
    title: 'Expiração da delegação não é revalidada na leitura',
    opportunity:
      'Revalidar expires_at na leitura das entidades delegadas (ou marcar as delegações vencidas por job), para o acesso deixar de depender do momento em que a sessão arrancou.',
    evidence: [
      'F15 «parcial»: as leituras honram delegated_*_customer_ids sem revalidar expires_at',
      'prune no arranque de sessão e dropExpired em list/resolve fecham a janela na prática — não na entidade',
    ],
    ref: 'F15',
  },
];
