/**
 * License module constants and route mapping.
 * Maps app routes to the module that gates them.
 */

export const MODULE_CODES = [
  "nis2_journey",
  "assessments_action_plan",
  "documents_evidence",
  "reporting_audit_prep",
  "risk_management",
  "incident_management",
  "supplier_management",
  "knowledge_guidance",
  "privacy",
];

/**
 * Map each route to the module that gates it.
 * null = admin-only route, gated by RBAC only (no module check).
 */
export const ROUTE_MODULE = {
  "/": null,
  "/dashboard": null,
  "/customers": null,
  "/admin": null,
  "/audit-log": null,
  "/settings": null,
  "/question-bank": null,
  "/email-report": null,
  "/organization": null,
  "/configuration": null,
  "/licensing": null,
  "/license-unavailable": null,
  "/workspaces": null,
  "/system-status": null,
  "/user-assignments": null,
  "/external-access": null,
  "/documentacao-tecnica": null,

  // nis2_journey
  "/compliance-journey": "nis2_journey",

  // assessments_action_plan
  "/assessments": "assessments_action_plan",
  "/action-plan": "assessments_action_plan",
  "/task-analytics": "assessments_action_plan",
  "/recommendations": "assessments_action_plan",

  // documents_evidence
  "/security-documents": "documents_evidence",
  "/document-audit-trail": "documents_evidence",
  "/evidence": "documents_evidence",

  // reporting_audit_prep
  "/reports": "reporting_audit_prep",
  "/strategic-report": "reporting_audit_prep",
  "/compliance-metrics": "reporting_audit_prep",
  "/audit-package": "reporting_audit_prep",

  // risk_management
  "/risk-assessment": "risk_management",

  // incident_management
  "/incidents": "incident_management",
  "/vulnerabilities": "incident_management",

  // supplier_management
  "/supply-chain": "supplier_management",
  "/suppliers": "supplier_management",

  // knowledge_guidance
  "/framework-guide": "knowledge_guidance",
  "/knowledge-base": "knowledge_guidance",

  // privacy
  "/ropa": "privacy",
  "/dsr": "privacy",

  // tasks — gated by assessments_action_plan (part of action plan workflow)
  "/tasks": "assessments_action_plan",

  // RBAC-only routes (no module gating) — available in all tiers
  "/training": null,
  "/policy-attestation": null,
};

/** Prefix-based fallback for dynamic routes (e.g. /assessments/:id). */
const ROUTE_PREFIX_MODULE = [
  { prefix: "/assessments", module: "assessments_action_plan" },
];

/**
 * Resolve the module for a given route path.
 * Returns null for admin-only routes (RBAC only).
 */
export function moduleForRoute(path) {
  // Exact match
  if (ROUTE_MODULE[path] !== undefined) return ROUTE_MODULE[path];

  // Prefix fallback for dynamic routes
  for (const { prefix, module } of ROUTE_PREFIX_MODULE) {
    if (path.startsWith(prefix)) return module;
  }

  // Default: no module gating
  return null;
}

/** Map each module to the RBAC resources it covers. */
export const MODULE_RESOURCES = {
  nis2_journey: ["compliance_journey"],
  assessments_action_plan: ["assessments", "action_plan", "task_analytics", "recommendations", "tasks"],
  documents_evidence: ["security_documents", "document_audit_trail", "evidence"],
  reporting_audit_prep: ["reports", "audit_package", "compliance_metrics"],
  risk_management: ["risk_assessment"],
  incident_management: ["incidents", "vulnerabilities"],
  supplier_management: ["supply_chain", "suppliers"],
  knowledge_guidance: ["framework_guide"],
  privacy: ["ropa", "dsr"],
};

/**
 * Cumulative tier → modules mapping.
 * Exactly three commercial client tiers (Core ⊂ Profissional ⊂ Avançado).
 * Each tier adds whole modules; a module has the same capabilities in every tier
 * that includes it. `privacy` is preserved in the codebase but is part of no tier
 * (outside the launch offering).
 */
export const TIER_MODULES = {
  core: ["nis2_journey", "assessments_action_plan", "documents_evidence", "reporting_audit_prep"],
  professional: ["nis2_journey", "assessments_action_plan", "documents_evidence", "reporting_audit_prep", "risk_management", "incident_management"],
  advanced: ["nis2_journey", "assessments_action_plan", "documents_evidence", "reporting_audit_prep", "risk_management", "incident_management", "supplier_management", "knowledge_guidance"],
};

/**
 * Legacy tier codes kept only so pre-existing records still resolve to a module set.
 * NOT commercial tiers: "partner" is an organization type and service channel.
 */
export const LEGACY_TIER_ALIASES = { partner: "advanced" };

/** Tiers commercially available at launch: Core only. */
export const COMMERCIALLY_AVAILABLE_TIERS = ["core"];

/**
 * Packs/acréscimos (FM1) — espelho de `ADDON_PACKS` em
 * `base44/shared/licenseGuard.ts`, que é a fonte do gating. Um pack abre módulos
 * que nenhum tier inclui (`privacy` vende-se assim, fora da oferta de lançamento)
 * ou antecipa a um cliente Core os módulos de um tier superior. Contratar um pack
 * grava uma excepção por módulo (`provisionTenantLicense` `set_addon`), pelo que
 * revogá-lo nunca fecha o que o tier já abre.
 */
export const ADDON_PACKS = {
  privacy: {
    name: "Pack de Privacidade",
    description: "RoPA e pedidos de titulares — fora de todos os tiers, vende-se como acréscimo",
    modules: ["privacy"],
  },
  risk: {
    name: "Pack de Risco e Incidentes",
    description: "Os módulos do nível Profissional, contratáveis por um cliente Core",
    modules: ["risk_management", "incident_management"],
  },
  suppliers: {
    name: "Pack de Fornecedores e Conhecimento",
    description: "Os módulos do nível Avançado, contratáveis por um cliente Core",
    modules: ["supplier_management", "knowledge_guidance"],
  },
};

/** Códigos de pack do catálogo, pela ordem em que a oferta os apresenta. */
export const ADDON_CODES = Object.keys(ADDON_PACKS);

/** Módulos que um pack abre. */
export function modulesForAddon(code) {
  return ADDON_PACKS[code]?.modules || [];
}

/** Resolve a tier code (including legacy aliases) to its cumulative module list. */
export function modulesForTier(tierCode) {
  const resolved = LEGACY_TIER_ALIASES[tierCode] || tierCode;
  return TIER_MODULES[resolved] || TIER_MODULES.core;
}

export const ALL_MODULE_CODES = [...MODULE_CODES];

/** Module metadata (PT-PT names and descriptions). */
export const MODULE_META = {
  nis2_journey: {
    name: "Jornada NIS2",
    description: "Checklist de conformidade RJCS/NIS2 passo a passo",
  },
  assessments_action_plan: {
    name: "Avaliações e Plano de Ação",
    description: "Avaliações de maturidade, recomendações, tarefas e plano de ação",
  },
  documents_evidence: {
    name: "Documentos e Evidências",
    description: "Gestão de documentos de segurança e evidências",
  },
  reporting_audit_prep: {
    name: "Relatórios e Preparação de Auditoria",
    description: "Relatórios, métricas de conformidade e analytics",
  },
  risk_management: {
    name: "Gestão de Risco",
    description: "Avaliação e gestão de riscos de cibersegurança",
  },
  incident_management: {
    name: "Gestão de Incidentes",
    description: "Registo e gestão de incidentes e vulnerabilidades",
  },
  supplier_management: {
    name: "Gestão de Fornecedores",
    description: "Avaliação de fornecedores e cadeia de abastecimento",
  },
  knowledge_guidance: {
    name: "Conhecimento e Orientação",
    description: "Guia de frameworks e formação",
  },
  privacy: {
    name: "Privacidade",
    description: "Registo de atividades de tratamento e pedidos de titulares",
  },
};
