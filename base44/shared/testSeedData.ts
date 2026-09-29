/**
 * Catálogo determinístico do seed de validação (`seedTestEnvironment`).
 *
 * Toda a definição de dados vive aqui e é **fixa**: nomes, números e
 * deslocamentos de dias contados a partir de uma única data de referência. O
 * ponto de entrada só percorre esta definição, pelo que duas execuções produzem
 * o mesmo estado final — mesmos nomes, mesmos números e as mesmas datas —
 * sem `Math.random()` nem leituras do relógio em tempo de execução.
 *
 * As condições que o harness de validação exige (dois parceiros, os sete
 * clientes do cenário, as 12 perguntas NIS2 e os cenários de delegação) estão
 * declaradas tal como estavam; o portefólio alargado (8–12 clientes) e as
 * restantes áreas são acrescentados sem lhes tocar.
 */

export const MARKER = "[TESTE]";
export const CONFIRMATION = "create-test-conditions";

/**
 * Prefixo de NIF do portefólio de validação.
 *
 * Este seed cria e **apaga** registos. Num backend a sério não pode tocar em
 * nada que não seja seu, pelo que o âmbito tem de ser declarado e verificável:
 * todos os clientes do cenário usam um NIF deste prefixo (9000000xx), e é ele
 * que `seedTestEnvironment` exige e confere antes de escrever ou remover seja o
 * que for. Um cliente com o marcador do seed mas com NIF de fora do prefixo
 * bloqueia a execução em vez de ser apagado.
 */
export const VALIDATION_NIF_PREFIX = "9000000";

/** O identificador (um NIF ou o próprio prefixo) pertence ao âmbito de validação? */
export function isValidationIdentifier(value: string): boolean {
  return String(value || "").replace(/\s+/g, "").startsWith(VALIDATION_NIF_PREFIX);
}

/** O cliente pertence ao portefólio de validação? */
export function isValidationCustomer(row: { nif?: string } | null | undefined): boolean {
  return isValidationIdentifier(String(row?.nif || ""));
}

export interface SeedPartner {
  key: string;
  name: string;
}

export const PARTNERS: SeedPartner[] = [
  { key: "partner_alfa", name: `${MARKER} Parceiro Alfa` },
  { key: "partner_beta", name: `${MARKER} Parceiro Beta` },
];

/** Estado comercial declarado de um cliente (`none` = sem subscrição). */
export type LicenseState = "active" | "suspended" | "expired" | "cancelled" | "none";

/** Volume de dados operacionais semeado por cliente. */
export type DatasetKey = "full" | "partial" | "light" | "none";

export interface CustomerSpec {
  key: string;
  name: string;
  nif: string;
  sector: string;
  employees: string;
  partner: string;
  license: LicenseState;
  tier: string;
  seats: number;
  aiQuota: number | null;
  dataset: DatasetKey;
  /** Contrato registado antes de existir tabela de preços (conta como não precificado). */
  unpriced?: boolean;
  /** Meses desde o início do contrato — coortes e movimento do período. */
  startedMonthsAgo?: number;
  /** Dias até ao fim da vigência (valores negativos = já passou). */
  expiresInDays?: number;
  /** Deslocamento da escala de maturidade (0 = padrão declarado pelo cenário). */
  maturityOffset?: number;
}

/**
 * Clientes do seed.
 *
 * Os sete primeiros são as condições declaradas que o harness valida — não
 * alterar sem rever os casos: Delta não tem subscrição (porta do gating), Gama
 * só tem delegação de leitura, Beta tem avaliação de cobertura parcial e
 * Epsilon/Zeta são alcançáveis apenas pela sua delegação (expirada/revogada).
 * Os cinco seguintes alargam o portefólio para 8–12 clientes e trazem os
 * estados comerciais que faltavam (suspenso, expirado, fechado) e maturidades
 * diferentes.
 */
export const CUSTOMERS: CustomerSpec[] = [
  // Alfa: delegação de edição + subscrição Core → jornada completa
  { key: "tenant_alfa", name: `${MARKER} Cliente Alfa`, nif: "900000001", sector: "technology", employees: "251-1000", partner: "partner_alfa", license: "active", tier: "core", seats: 25, aiQuota: 1000, dataset: "full", startedMonthsAgo: 14 },
  // Beta: delegação de edição + subscrição Core → conclusão parcial
  { key: "tenant_beta", name: `${MARKER} Cliente Beta`, nif: "900000002", sector: "energy", employees: "1001-5000", partner: "partner_beta", license: "active", tier: "core", seats: 25, aiQuota: 1000, dataset: "partial", startedMonthsAgo: 11 },
  // Gama: delegação apenas de leitura → tentativa de escrita deve falhar
  { key: "tenant_gama", name: `${MARKER} Cliente Gama`, nif: "900000003", sector: "healthcare", employees: "251-1000", partner: "partner_alfa", license: "active", tier: "core", seats: 25, aiQuota: 1000, dataset: "light", startedMonthsAgo: 8 },
  // Delta: delegação de edição mas sem subscrição → módulo não licenciado
  { key: "tenant_delta", name: `${MARKER} Cliente Delta`, nif: "900000004", sector: "manufacturing", employees: "51-250", partner: "partner_beta", license: "none", tier: "core", seats: 10, aiQuota: null, dataset: "none" },
  // Epsilon e Zeta existem para os estados negativos da delegação: cada um só é
  // alcançável pela sua delegação, uma expirada e outra revogada, para que os
  // três estados obrigatórios (activa / expirada / revogada) sejam distinguíveis.
  { key: "tenant_epsilon", name: `${MARKER} Cliente Epsilon`, nif: "900000005", sector: "transport", employees: "51-250", partner: "partner_alfa", license: "active", tier: "core", seats: 15, aiQuota: 500, dataset: "light", startedMonthsAgo: 6 },
  { key: "tenant_zeta", name: `${MARKER} Cliente Zeta`, nif: "900000006", sector: "water", employees: "1-50", partner: "partner_beta", license: "active", tier: "core", seats: 10, aiQuota: 500, dataset: "light", startedMonthsAgo: 5 },
  // Eta: a única delegação é de edição mas nomeia apenas um módulo, para que a
  // recusa venha da delegação (F4) e não da licença — tem, por isso, subscrição.
  { key: "tenant_eta", name: `${MARKER} Cliente Eta`, nif: "900000007", sector: "digital", employees: "51-250", partner: "partner_beta", license: "active", tier: "core", seats: 15, aiQuota: 500, dataset: "light", startedMonthsAgo: 4 },
  // Portefólio alargado: setores, níveis e maturidades diferentes.
  { key: "tenant_theta", name: `${MARKER} Cliente Teta`, nif: "900000008", sector: "financial_services", employees: "5000+", partner: "partner_alfa", license: "active", tier: "professional", seats: 40, aiQuota: 5000, dataset: "full", startedMonthsAgo: 9, maturityOffset: 2 },
  { key: "tenant_iota", name: `${MARKER} Cliente Iota`, nif: "900000009", sector: "public_administration", employees: "1001-5000", partner: "partner_alfa", license: "active", tier: "core", seats: 30, aiQuota: 1000, dataset: "light", startedMonthsAgo: 7, maturityOffset: 1, unpriced: true },
  { key: "tenant_kappa", name: `${MARKER} Cliente Capa`, nif: "900000010", sector: "retail", employees: "251-1000", partner: "partner_beta", license: "suspended", tier: "advanced", seats: 60, aiQuota: 20000, dataset: "light", startedMonthsAgo: 10, maturityOffset: 3 },
  { key: "tenant_lambda", name: `${MARKER} Cliente Lambda`, nif: "900000011", sector: "education", employees: "251-1000", partner: "partner_beta", license: "expired", tier: "core", seats: 20, aiQuota: 1000, dataset: "light", startedMonthsAgo: 24, expiresInDays: -21, maturityOffset: 4 },
  { key: "tenant_mu", name: `${MARKER} Cliente Mi`, nif: "900000012", sector: "telecommunications", employees: "1-50", partner: "partner_alfa", license: "cancelled", tier: "core", seats: 5, aiQuota: 500, dataset: "none", startedMonthsAgo: 20 },
];

/** Cobertura da avaliação semeada por cliente ("full" completa, "partial" com confirmação). */
export const ASSESSMENT_MODE: Record<string, "full" | "partial"> = {
  tenant_alfa: "full",
  tenant_beta: "partial",
  tenant_gama: "full",
  tenant_delta: "full",
  tenant_epsilon: "full",
  tenant_zeta: "full",
  tenant_eta: "full",
  tenant_theta: "full",
  tenant_iota: "partial",
  tenant_kappa: "partial",
  tenant_lambda: "full",
};

/** Domínios da grelha NIS2 semeada (3 requisitos por domínio = 12 perguntas). */
export const DOMAINS = [
  { domain: "Governance", domain_pt: "Governação" },
  { domain: "Risk Management", domain_pt: "Gestão de Risco" },
  { domain: "Incident Handling", domain_pt: "Gestão de Incidentes" },
  { domain: "Supply Chain", domain_pt: "Cadeia de Abastecimento" },
];

/**
 * Módulos que as delegações operacionais de teste autorizam.
 *
 * F4: uma delegação só autoriza os módulos que nomeia e uma lista vazia não
 * autoriza nenhum, pelo que as delegações que devem permitir operar têm de
 * nomear o conjunto Core. Sem isto, os cenários de delegação não autorizariam
 * nada e a suíte de validação estaria a testar a recusa, não a permissão.
 */
export const CORE_DELEGATION_MODULES = [
  "nis2_journey",
  "assessments_action_plan",
  "documents_evidence",
  "reporting_audit_prep",
];

// ─── Datas determinísticas ─────────────────────────────────────────────

/** Dia (AAAA-MM-DD) deslocado de `days` a partir da data de referência. */
export function dayOffset(reference: string, days: number): string {
  const date = new Date(`${reference}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

/** Instante ISO deslocado de `days`, à hora indicada. */
export function instantOffset(reference: string, days: number, hour = 9): string {
  const date = new Date(`${reference}T${String(hour).padStart(2, "0")}:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

/** Período AAAA-MM deslocado de `months` para trás. */
export function monthOffset(reference: string, months: number): string {
  const date = new Date(`${reference}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() - months, 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Hash determinístico de 64 dígitos hexadecimais.
 *
 * A integridade das evidências é mostrada a partir de um `content_hash`; o seed
 * não pode depender de aleatoriedade nem do relógio, pelo que gera um valor
 * estável a partir do próprio identificador da evidência.
 */
export function seedHash(seed: string): string {
  let value = 0x811c9dc5;
  let out = "";
  for (let round = 0; round < 8; round += 1) {
    for (const char of `${seed}#${round}`) {
      value ^= char.charCodeAt(0);
      value = Math.imul(value, 0x01000193) >>> 0;
    }
    out += value.toString(16).padStart(8, "0");
  }
  return out;
}

/** Roda uma lista de modelos `n` posições, para variar o conteúdo por cliente. */
export function rotate<T>(list: T[], n: number, offset: number): T[] {
  if (list.length === 0) return [];
  const take = Math.min(n, list.length);
  const out: T[] = [];
  for (let i = 0; i < take; i += 1) out.push(list[(offset + i) % list.length]);
  return out;
}

// ─── Volume semeado por cliente ────────────────────────────────────────

export interface AreaSize {
  risks: number;
  mitigations: number;
  riskHistory: number;
  documents: number;
  versions: number;
  incidents: number;
  suppliers: number;
  trainingUsers: number;
  trainings: number;
  enrollments: number;
  checklist: number;
  attestations: number;
  vulnerabilities: number;
  recommendations: number;
  tasks: number;
  quotaSignals: number;
  usageMonths: number;
  auditEntries: number;
  auditPackages: number;
}

const EMPTY_AREA: AreaSize = {
  risks: 0, mitigations: 0, riskHistory: 0, documents: 0, versions: 0, incidents: 0,
  suppliers: 0, trainingUsers: 0, trainings: 0, enrollments: 0, checklist: 0,
  attestations: 0, vulnerabilities: 0, recommendations: 0, tasks: 0,
  quotaSignals: 0, usageMonths: 0, auditEntries: 0, auditPackages: 0,
};

/** Volume por perfil: um cliente com a jornada completa, outro parcial, o resto leve. */
export const AREA_SIZES: Record<DatasetKey, AreaSize> = {
  full: {
    risks: 4, mitigations: 2, riskHistory: 3, documents: 3, versions: 3, incidents: 2,
    suppliers: 3, trainingUsers: 3, trainings: 2, enrollments: 4, checklist: 6,
    attestations: 3, vulnerabilities: 2, recommendations: 3, tasks: 3,
    quotaSignals: 2, usageMonths: 6, auditEntries: 4, auditPackages: 1,
  },
  partial: {
    risks: 3, mitigations: 1, riskHistory: 2, documents: 2, versions: 2, incidents: 1,
    suppliers: 2, trainingUsers: 2, trainings: 1, enrollments: 2, checklist: 4,
    attestations: 2, vulnerabilities: 1, recommendations: 2, tasks: 2,
    quotaSignals: 1, usageMonths: 4, auditEntries: 3, auditPackages: 1,
  },
  light: {
    risks: 2, mitigations: 1, riskHistory: 1, documents: 1, versions: 1, incidents: 1,
    suppliers: 1, trainingUsers: 2, trainings: 1, enrollments: 2, checklist: 3,
    attestations: 1, vulnerabilities: 1, recommendations: 1, tasks: 1,
    quotaSignals: 1, usageMonths: 3, auditEntries: 2, auditPackages: 0,
  },
  none: EMPTY_AREA,
};

// ─── Modelos por área ─────────────────────────────────────────────────

export const RISK_TEMPLATES = [
  { title: "Acesso privilegiado sem revisão periódica", category: "Identity & Access", impact: 4, likelihood: 4, status: "open", treatment: "Revisão trimestral das contas privilegiadas e retirada das que já não são necessárias." },
  { title: "Fornecedores críticos sem avaliação de segurança", category: "Supply Chain", impact: 5, likelihood: 3, status: "in_treatment", treatment: "Questionário de segurança a todos os fornecedores de tier 1 antes da renovação." },
  { title: "Cópias de segurança sem teste de restauro", category: "Resilience", impact: 4, likelihood: 2, status: "open", treatment: "Teste de restauro documentado por trimestre, com evidência arquivada." },
  { title: "Formação em cibersegurança desatualizada", category: "People", impact: 2, likelihood: 4, status: "closed", treatment: "Plano anual de formação com registo de participação por colaborador." },
  { title: "Segmentação de rede insuficiente", category: "Network Security", impact: 5, likelihood: 3, status: "in_treatment", treatment: "Separar a rede de gestão da rede de utilizadores e documentar as regras." },
  { title: "Registo de eventos sem retenção definida", category: "Detection", impact: 3, likelihood: 3, status: "accepted", treatment: "Risco aceite até à renovação da plataforma de registo." },
];

export const DOCUMENT_TEMPLATES = [
  { title: "Política de Segurança da Informação", level: "policy", status: "approved", note: "Aprovação anual pelo conselho de administração." },
  { title: "Norma de Gestão de Acessos", level: "standard", status: "approved", note: "Regra de menor privilégio e revisão trimestral." },
  { title: "Procedimento de Resposta a Incidentes", level: "procedure", status: "under_review", note: "Revisão após o exercício de continuidade." },
  { title: "Playbook de Ransomware", level: "playbook", status: "draft", note: "Rascunho com os passos de contenção." },
  { title: "Norma de Gestão de Fornecedores", level: "standard", status: "approved", note: "Exigências mínimas por tier de fornecedor." },
];

export const INCIDENT_TEMPLATES = [
  { title: "Mensagem de phishing dirigida à direção financeira", category: "phishing", severity: "medium", status: "closed", breach: false },
  { title: "Acessos indevidos a conta de serviço", category: "unauthorized_access", severity: "high", status: "investigating", breach: false },
  { title: "Pedido de resgate após infeção por ransomware", category: "malware_ransomware", severity: "critical", status: "contained", breach: true },
];

export const SUPPLIER_TEMPLATES = [
  { name: "Nuvem Atlântica, Lda.", tier: "tier_1", service: "Alojamento da plataforma de gestão documental", sector: "technology", country: "PT", access: true, critical: true, annual: 48000 },
  { name: "Consultoria Ibérica de Redes, S.A.", tier: "tier_1", service: "Operação e manutenção da rede", sector: "technology", country: "PT", access: false, critical: true, annual: 66000 },
  { name: "Transportes do Norte, Lda.", tier: "tier_2", service: "Logística e distribuição", sector: "transport", country: "PT", access: false, critical: false, annual: 21000 },
  { name: "Laboratório de Ensaios e Certificação", tier: "tier_2", service: "Ensaios laboratoriais acreditados", sector: "other", country: "ES", access: false, critical: true, annual: 34000 },
];

export const TRAINING_TEMPLATES = [
  { title: "Sensibilização para phishing", topic: "phishing_awareness", modality: "online", duration: 60, status: "completed" },
  { title: "Regulamento NIS2 e obrigações de reporte", topic: "nis2_awareness", modality: "presential", duration: 120, status: "scheduled" },
  { title: "Exercício de resposta a incidentes", topic: "incident_response", modality: "hybrid", duration: 180, status: "scheduled" },
];

export const TRAINING_USER_TEMPLATES = [
  { full_name: "Ana Ribeiro", position: "Responsável de Sistemas de Informação", department: "Tecnologia" },
  { full_name: "Bruno Sequeira", position: "Analista de Segurança", department: "Tecnologia" },
  { full_name: "Carla Nogueira", position: "Direção Financeira", department: "Financeiro" },
  { full_name: "Diogo Farias", position: "Gestor de Operações", department: "Operações" },
];

export const CHECKLIST_TEMPLATES = [
  { framework: "NIS2", section: "Governação", task_text: "Nomear formalmente o responsável pela cibersegurança e comunicar a nomeação." },
  { framework: "NIS2", section: "Governação", task_text: "Aprovar e divulgar a política de segurança da informação em vigor." },
  { framework: "NIS2", section: "Gestão de Risco", task_text: "Manter o registo de riscos atualizado com responsável e prazo por risco." },
  { framework: "NIS2", section: "Gestão de Risco", task_text: "Documentar a metodologia de avaliação de risco utilizada." },
  { framework: "NIS2", section: "Gestão de Incidentes", task_text: "Definir o percurso de notificação ao CSIRT com prazos por tipo de incidente." },
  { framework: "NIS2", section: "Cadeia de Abastecimento", task_text: "Inventariar fornecedores de tier 1 e tier 2 com o serviço prestado." },
  { framework: "NIS2", section: "Continuidade", task_text: "Testar o plano de continuidade e registar as lições aprendidas." },
  { framework: "NIS2", section: "Formação", task_text: "Registar a participação na formação anual de sensibilização." },
];

export const ATTESTATION_TEMPLATES = [
  { policy_title: "Política de Segurança da Informação", version: "3.1", status: "accepted" },
  { policy_title: "Código de Conduta e Utilização Aceitável", version: "2.0", status: "pending" },
  { policy_title: "Política de Proteção de Dados Pessoais", version: "1.4", status: "accepted" },
];

export const VULNERABILITY_TEMPLATES = [
  { title: "Biblioteca de compressão desatualizada no servidor de documentos", severity: "high", cve_id: "CVE-2024-3094", cvss: 8.4, status: "in_progress" },
  { title: "Certificado TLS prestes a expirar no portal de clientes", severity: "medium", cve_id: "", cvss: 5.3, status: "open" },
  { title: "Módulo de VPN sem atualização de segurança", severity: "critical", cve_id: "CVE-2024-21887", cvss: 9.1, status: "remediated" },
];

export const ACTION_TEMPLATES = [
  { title: "Formalizar a revisão trimestral de acessos privilegiados", description: "Definir o procedimento, o responsável e a evidência da revisão trimestral das contas com privilégios elevados.", priority: "high", domain: "Governance", evidence: "Ata da revisão trimestral assinada e registo de retirada de acessos." },
  { title: "Avaliar a segurança dos fornecedores críticos", description: "Aplicar o questionário de segurança aos fornecedores de tier 1 e arquivar as respostas no processo do fornecedor.", priority: "critical", domain: "Supply Chain", evidence: "Questionário respondido e plano de correção por fornecedor." },
  { title: "Testar o restauro das cópias de segurança", description: "Executar um teste de restauro documentado e arquivar o resultado com data e responsável.", priority: "medium", domain: "Resilience", evidence: "Relatório do teste de restauro com data e responsável." },
];

export const TASK_STATUS_CYCLE = ["todo", "in_progress", "done", "blocked"];

export const ANNOUNCEMENTS = [
  { title: `${MARKER} Manutenção programada da plataforma`, message: "A plataforma estará indisponível entre as 22h00 e as 23h00 de sábado para manutenção programada.", severity: "maintenance", scope: "global" },
  { title: `${MARKER} Novo ciclo de avaliação NIS2`, message: "O ciclo de avaliação NIS2 do trimestre está aberto. Confirme o responsável e os prazos do plano de ação.", severity: "info", scope: "tier", tier_code: "core" },
  { title: `${MARKER} Contrato a rever`, message: "O contrato deste cliente aproxima-se do fim de vigência. Reveja as condições antes da renovação.", severity: "warning", scope: "customer" },
];

export const AUDIT_ENTRIES = [
  { action: "customer_updated", entity_type: "Customer" },
  { action: "risk_created", entity_type: "RiskItem" },
  { action: "document_approved", entity_type: "SecurityDocument" },
  { action: "incident_created", entity_type: "Incident" },
  { action: "task_status_changed", entity_type: "Task" },
  { action: "assessment_completed", entity_type: "Assessment" },
];

/** Escala de maturidade (0–5) usada nas respostas semeadas. */
export const MATURITY_LEVELS = 5;
