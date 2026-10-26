/** Catálogo inicial (igual à produção + módulos novos do Securematurity). Editável na consola de licenças. */
// Chave de assinatura em uso (SPKI DER base64, Ed25519). A privada está só no segredo LICENSE_SIGNING_KEY da app.
export const LICENSE_PUBLIC_KEY = 'MCowBQYDK2VwAyEAHBk6/MhW+BYfC7x+UOBVFUC5siuVZhYhB1sk2KCQOeQ='; // app AnkoraOne_DC_Repo, out. 2026
export const LICENSE_KEY_ID = 'ank-c92053f30934';
// Chaves anteriores, só para verificar certificados já emitidos (identificadas pelo «kid» do cabeçalho).
export const LICENSE_PUBLIC_KEYS: Record<string, string> = {
  [LICENSE_KEY_ID]: LICENSE_PUBLIC_KEY,
  'ank-2dbab69654d4': 'MCowBQYDK2VwAyEApWBoyJSvmeCkOh4zgUwyfkhVPMIr8h0wd/ALA44CyeA=', // app Securematurity (importada), retirada
};

export const SEED_MODULES = [
  { code: 'nis2_journey', name: 'Jornada de Conformidade', description: 'Jornada RJC/NIS2 e checklist', tier_code: 'core', display_order: 1 },
  { code: 'assessments_action_plan', name: 'Avaliações e Plano de Ação', description: 'Avaliações de maturidade e plano de ação', tier_code: 'core', display_order: 2 },
  { code: 'documents_evidence', name: 'Documentos e Evidências', description: 'Gestão de documentos de segurança e evidências', tier_code: 'core', display_order: 3 },
  { code: 'knowledge_guidance', name: 'Conhecimento e Orientação', description: 'Biblioteca Legal e guia de referenciais', tier_code: 'core', display_order: 4 },
  { code: 'risk_management', name: 'Gestão de Risco', description: 'Registo e matriz de risco', tier_code: 'core', display_order: 5 },
  { code: 'reporting_audit_prep', name: 'Relatórios e Preparação de Auditoria', description: 'Relatórios, métricas e exportações', tier_code: 'core', display_order: 6 },
  { code: 'asset_management', name: 'Ativos e Ferramentas', description: 'Inventário de ativos (art. 32.º do Reg. 756/2026) e ferramentas NIS2', tier_code: 'core', display_order: 7 },
  { code: 'incident_management', name: 'Gestão de Incidentes', description: 'Incidentes e vulnerabilidades', tier_code: 'professional', display_order: 8 },
  { code: 'supplier_management', name: 'Gestão de Fornecedores', description: 'Fornecedores e cadeia de abastecimento', tier_code: 'professional', display_order: 9 },
  { code: 'cve_monitoring', name: 'Alertas CVE', description: 'Alertas de CVE críticos por fabricante do inventário', tier_code: 'professional', display_order: 10 },
  { code: 'privacy', name: 'Privacidade', description: 'RoPA e pedidos de titulares', tier_code: 'advanced', display_order: 11, is_active: false },
  { code: 'ai_assistant', name: 'Assistente de IA', description: 'Rascunhos de evidências documentais e análise de evidências com base na legislação', tier_code: 'advanced', display_order: 12 },
];

export const SEED_ENTITLEMENTS = [
  ['nis2_checklist', 'Checklist NIS2', 'nis2_journey'], ['nis2_progress_tracking', 'Progresso da jornada', 'nis2_journey'],
  ['maturity_assessments', 'Avaliações de maturidade', 'assessments_action_plan'], ['action_plan_management', 'Gestão do plano de ação', 'assessments_action_plan'],
  ['document_library', 'Biblioteca de documentos', 'documents_evidence'], ['evidence_management', 'Gestão de evidências', 'documents_evidence'],
  ['knowledge_base', 'Base de conhecimento', 'knowledge_guidance'], ['framework_guide', 'Guia de frameworks', 'knowledge_guidance'],
  ['risk_register', 'Registo de riscos', 'risk_management'], ['risk_matrix', 'Matriz de risco', 'risk_management'],
  ['reports_export', 'Exportação de relatórios', 'reporting_audit_prep'], ['compliance_metrics', 'Métricas de conformidade', 'reporting_audit_prep'],
  ['asset_inventory', 'Inventário de ativos', 'asset_management'], ['tool_coverage', 'Ferramentas e cobertura NIS2', 'asset_management'],
  ['incident_tracking', 'Registo de incidentes', 'incident_management'], ['vulnerability_management', 'Gestão de vulnerabilidades', 'incident_management'],
  ['supplier_assessment', 'Avaliação de fornecedores', 'supplier_management'], ['supply_chain_management', 'Cadeia de abastecimento', 'supplier_management'],
  ['cve_alerts', 'Alertas CVE por fabricante', 'cve_monitoring'],
  ['ropa_management', 'Gestão de RoPA', 'privacy'], ['dsr_management', 'Gestão de pedidos de titulares', 'privacy'],
  ['ai_document_drafts', 'Rascunhos de documentos por IA', 'ai_assistant'], ['ai_evidence_review', 'Análise de evidências por IA', 'ai_assistant'],
  // 4.º elemento: quota mensal que esta funcionalidade limita (feature de LicenseUsageRecord; «ai» = consumeQuota da função aiDraft).
  ['ai_requests', 'Pedidos de IA por mês', 'ai_assistant', 'ai'],
];

const CORE = ['nis2_journey', 'assessments_action_plan', 'documents_evidence', 'knowledge_guidance', 'risk_management', 'reporting_audit_prep', 'asset_management'];
const PRO = [...CORE, 'incident_management', 'supplier_management', 'cve_monitoring'];
export const SEED_TIERS = [
  { code: 'core', name: 'Core', display_order: 1, modules: CORE, description: 'Bundle de entrada.' },
  { code: 'professional', name: 'PRO', display_order: 2, modules: PRO, description: 'Core + Gestão de Incidentes, Gestão de Fornecedores e Alertas CVE.' },
  { code: 'advanced', name: 'Enterprise', display_order: 3, modules: [...PRO, 'privacy', 'ai_assistant'], description: 'PRO + Privacidade e Assistente de IA.' },
];

export const SEED_STANDARDS = [
  ['NIS2', 'NIS2 — Diretiva (UE) 2022/2555 / RJC (DL 125/2025)'], ['QNRC', 'QNRCS (Reg. 756/2026)'],
  ['EU_2024_2690', 'Regulamento de Execução (UE) 2024/2690'], ['DORA', 'DORA — Regulamento (UE) 2022/2554'],
  ['ISO27001', 'ISO/IEC 27001:2022'], ['NIST_CSF', 'NIST CSF'], ['CIS_V8', 'CIS Controls v8.1.2'],
  ['TISAX_ISA6', 'TISAX — VDA ISA 6.0.3'], ['TISAX_ISA2027', 'TISAX — VDA ISA 2027'], ['GDPR', 'RGPD — Regulamento (UE) 2016/679'],
];

