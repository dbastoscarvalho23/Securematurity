/**
 * Centralized RBAC — capability-based access control.
 *
 * Single source of truth for:
 * - Role normalization (normalizeRole)
 * - Capability tiers (CAPABILITY_TIERS)
 * - Capabilities matrix (CAPABILITIES)
 * - Route access (can, canView, canAccessRoute)
 *
 * Supports 9-role tier system with backward compatibility for the
 * legacy 3-role system (admin, customer_admin, user).
 *
 * Three layers of access control (cascading, most permissive → most restrictive):
 * 1. RBAC (canView) — which roles can SEE each resource (UX layer)
 * 2. Licensing (isModuleLicensed) — which commercial modules the tenant has
 * 3. RLS (backend) — the real security boundary, filters by customer_id/workspace
 */

// ─── Role definitions (9-role tier) ─────────────────────────────
export const ROLES = {
  MASTER_ADMIN: 'master_admin',
  WORKSPACE_ADMIN: 'workspace_admin',
  CUSTOMER_ADMIN: 'customer_admin',
  GRC_ANALYST: 'grc_analyst',
  CONTROL_OWNER: 'control_owner',
  EXECUTIVE: 'executive',
  AUDITOR: 'auditor',
  EMPLOYEE: 'employee',
  CONSULTANT: 'consultant',
  // Legacy aliases (backward compat)
  ADMIN: 'admin',
  USER: 'user',
  PARTNER_ADMIN: 'partner_admin',
};

export const ALL_ROLES = [
  'master_admin', 'workspace_admin', 'customer_admin',
  'grc_analyst', 'control_owner', 'executive', 'auditor',
  'employee', 'consultant',
];

/**
 * Normalize a backend role to the 9-role tier system.
 * Maps legacy roles to their new equivalents:
 *   admin        → master_admin      (legacy admin keeps full access)
 *   partner_admin → workspace_admin  (rename)
 *   user         → employee
 */
export function normalizeRole(role) {
  if (!role) return 'employee';
  const map = {
    admin: 'master_admin',
    customer_admin: 'customer_admin',
    user: 'employee',
    master_admin: 'master_admin',
    workspace_admin: 'workspace_admin',
    partner_admin: 'workspace_admin',
    grc_analyst: 'grc_analyst',
    control_owner: 'control_owner',
    executive: 'executive',
    auditor: 'auditor',
    employee: 'employee',
    consultant: 'consultant',
  };
  return map[role] || 'employee';
}

// ─── Capability tiers (reusable role arrays) ────────────────────
// Administration tiers — platform & partner admins manage the platform,
// customers, licensing and the shared content catalogue. They are
// administration-only and never appear in a compliance capability.
const PLATFORM   = ['master_admin'];                        // AnkoraOne team only
const PARTNER    = ['master_admin', 'workspace_admin'];
const TENANT_MGR = ['master_admin', 'workspace_admin', 'customer_admin'];
const ALL_VIEW = [
  'master_admin', 'workspace_admin', 'customer_admin', 'grc_analyst',
  'control_owner', 'auditor', 'executive', 'employee', 'consultant',
];

// Compliance/operational tiers — tenant-only. Platform & partner admins are
// administration-only and never appear in a compliance capability.
const T_MGR  = ['customer_admin'];
const T_EDIT = ['customer_admin', 'grc_analyst'];
const T_OPS  = ['customer_admin', 'grc_analyst', 'control_owner'];
const T_VIEW = ['customer_admin', 'grc_analyst', 'control_owner', 'auditor'];

// Content / catalogue tiers — the shared content catalogue (question database,
// knowledge base) is managed by the platform & partner admins AND by the tenant
// roles that curate the same content.
const CONTENT_MGR    = [...PLATFORM, 'workspace_admin', 'grc_analyst'];
const CONTENT_DELETE = [...CONTENT_MGR, ...T_MGR];

export const CAPABILITY_TIERS = {
  PLATFORM, PARTNER, TENANT_MGR, ALL_VIEW,
  T_MGR, T_EDIT, T_OPS, T_VIEW, CONTENT_MGR, CONTENT_DELETE,
};

// ─── Capabilities matrix (single source of truth) ──────────────
// For each resource, defines which roles can perform each action.
// master_admin is NOT short-circuited — it only holds what the matrix grants.
export const CAPABILITIES = {
  // ─── Administration (platform & partner admins) ─────────────
  dashboard:          { view: ALL_VIEW },
  customers:          { view: PARTNER, create: PARTNER, edit: PARTNER, delete: PLATFORM },
  organization:       { view: [...PARTNER, 'customer_admin'], create: PARTNER, edit: PARTNER, delete: PLATFORM },
  licensing:          { view: [...PLATFORM, 'workspace_admin'] },
  system_status:      { view: PLATFORM },
  audit_log:          { view: [...PLATFORM, 'auditor'] },
  settings:           { view: TENANT_MGR, edit: TENANT_MGR },
  external_access:    { view: ['customer_admin', 'consultant', 'master_admin', 'workspace_admin'] },

  // Content catalogue — managed by platform & partner admins AND curating tenants.
  question_bank:      { view: CONTENT_MGR, create: CONTENT_MGR, edit: CONTENT_MGR, delete: CONTENT_DELETE },
  knowledge_base:     { view: ALL_VIEW, create: CONTENT_MGR, edit: CONTENT_MGR, delete: CONTENT_DELETE },

  // ─── Compliance management (tenant-only — no platform/partner admins) ───
  compliance_journey: { view: T_EDIT, create: T_EDIT, edit: T_EDIT, delete: T_MGR },
  framework_guide:    { view: T_EDIT },
  action_plan:        { view: T_EDIT, create: T_EDIT, edit: T_EDIT, delete: T_MGR },
  assessments:        { view: [...T_VIEW, 'executive'], create: T_EDIT, edit: T_EDIT, delete: T_MGR, export: [...T_EDIT, 'executive', 'auditor'] },
  recommendations:    { view: T_EDIT, create: T_EDIT, edit: T_EDIT, delete: T_MGR },
  compliance_metrics: { view: [...T_EDIT, 'executive'], export: [...T_EDIT, 'executive', 'auditor'] },
  tasks:              { view: [...T_OPS, 'employee'], create: T_OPS, edit: T_OPS, delete: T_MGR, approve: T_MGR },
  task_analytics:     { view: T_OPS },
  documents:          { view: T_OPS, create: T_OPS, edit: T_OPS, delete: T_MGR },
  evidence:           { view: T_VIEW, create: T_OPS, edit: T_OPS, delete: T_MGR },
  document_audit:     { view: [...T_EDIT, 'auditor'] },
  reports:            { view: [...T_EDIT, 'auditor', 'executive'], export: [...T_EDIT, 'auditor', 'executive'] },
  audit_package:      { view: [...T_EDIT, 'auditor'], create: T_EDIT, export: [...T_EDIT, 'auditor'] },
  strategic_report:   { view: ['executive'], export: ['executive'] },
  email_report:       { view: T_EDIT, create: T_EDIT },
  risks:              { view: [...T_VIEW, 'executive'], create: T_EDIT, edit: T_EDIT, delete: T_MGR },
  vulnerabilities:    { view: T_VIEW, create: T_OPS, edit: T_OPS, delete: T_MGR },
  incidents:          { view: [...T_OPS, 'employee'], create: [...T_OPS, 'employee'], edit: T_OPS, delete: T_MGR },
  suppliers:          { view: T_EDIT, create: T_EDIT, edit: T_EDIT, delete: T_MGR },
  supply_chain:       { view: T_EDIT, create: T_EDIT, edit: T_EDIT, delete: T_MGR },
  ropa:               { view: [...T_EDIT, 'auditor'], create: T_EDIT, edit: T_EDIT, delete: T_MGR },
  dsr:                { view: [...T_EDIT, 'auditor'], create: T_EDIT, edit: T_EDIT, delete: T_MGR },
  training:           { view: [...T_MGR, 'control_owner', 'employee'], create: T_MGR, edit: T_MGR, delete: T_MGR },
  policy_attestation: { view: [...T_MGR, 'control_owner', 'employee'], create: T_MGR, edit: T_MGR, delete: T_MGR, approve: T_MGR },
};

/**
 * Check if a role can perform an action on a resource.
 * master_admin is not short-circuited — it only holds what the matrix grants.
 *
 * @param {string} role - User role (raw or normalized)
 * @param {string} action - Action: 'view', 'create', 'edit', 'delete', 'export', 'approve'
 * @param {string} resource - Resource name from CAPABILITIES
 * @returns {boolean}
 */
export function can(role, action, resource) {
  const normalized = normalizeRole(role);

  // NOTE: master_admin is NOT short-circuited here.
  // The CAPABILITIES matrix uses tenant-only T_* tiers for compliance resources,
  // which intentionally exclude master_admin. This enforces the delegation model:
  // master_admin must use explicit UserCustomerAssignment to access tenant data.
  // Route ACCESS for master_admin is still short-circuited in canAccessRoute().

  const caps = CAPABILITIES[resource];
  if (!caps) return false;

  const allowedRoles = caps[action];
  if (!allowedRoles) return false;

  return allowedRoles.includes(normalized);
}

/**
 * Check if a role can view a specific resource.
 * Convenience wrapper around can(role, 'view', resource).
 */
export function canView(role, resource) {
  return can(role, 'view', resource);
}

/**
 * Platform & partner admins — administration-only for compliance.
 * They keep management of the shared content catalogue, but never appear in a
 * compliance capability, and are not commercially gated for that catalogue.
 */
export function isWorkspaceOrAbove(role) {
  const normalized = normalizeRole(role);
  return normalized === 'master_admin' || normalized === 'workspace_admin';
}

// ─── Route → resource mapping ───────────────────────────────────
const ROUTE_RESOURCE = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/customers': 'customers',
  '/compliance-journey': 'compliance_journey',
  '/framework-guide': 'framework_guide',
  '/assessments': 'assessments',
  '/action-plan': 'action_plan',
  '/question-bank': 'question_bank',
  '/compliance-metrics': 'compliance_metrics',
  '/tasks': 'tasks',
  '/task-analytics': 'task_analytics',
  '/security-documents': 'documents',
  '/evidence': 'evidence',
  '/document-audit-trail': 'document_audit',
  '/reports': 'reports',
  '/audit-package': 'audit_package',
  '/strategic-report': 'strategic_report',
  '/recommendations': 'recommendations',
  '/email-report': 'email_report',
  '/risk-assessment': 'risks',
  '/vulnerabilities': 'vulnerabilities',
  '/incidents': 'incidents',
  '/suppliers': 'suppliers',
  '/supply-chain': 'supply_chain',
  '/knowledge-base': 'knowledge_base',
  '/ropa': 'ropa',
  '/dsr': 'dsr',
  '/audit-log': 'audit_log',
  '/training': 'training',
  '/policy-attestation': 'policy_attestation',
  '/external-access': 'external_access',
  '/organization': 'organization',
  '/licensing': 'licensing',
  // Informational notice reached from the license redirect — any signed-in role.
  '/license-unavailable': 'dashboard',
  '/configuration': 'settings',
  '/settings': 'settings',
  '/system-status': 'system_status',
  '/workspaces': 'organization',
  '/user-assignments': 'organization',
  '/admin': 'organization',
};

/**
 * Get the resource name for a route path.
 * Tries exact match first, then longest-prefix match for dynamic routes
 * (e.g. /assessments/123 → /assessments → 'assessments').
 */
export function resourceForRoute(path) {
  // Exact match
  if (ROUTE_RESOURCE[path]) return ROUTE_RESOURCE[path];

  // Longest-prefix match for dynamic routes
  const match = Object.keys(ROUTE_RESOURCE)
    .filter(p => p !== '/' && path.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];

  return match ? ROUTE_RESOURCE[match] : null;
}

/**
 * Check if a role can access a specific route.
 * Uses canView with prefix matching for dynamic routes.
 * No role is short-circuited: platform & partner admins are administration-only,
 * so a compliance URL opened directly redirects them to the dashboard.
 *
 * @param {string} role - User role (raw or normalized)
 * @param {string} path - Route path
 * @returns {boolean}
 */
export function canAccessRoute(role, path) {
  const normalized = normalizeRole(role);

  const resource = resourceForRoute(path);
  if (resource && canView(normalized, resource)) return true;

  return false;
}

/**
 * Check if a role can access a specific route (detailed result).
 * Returns an object with allowed flag and denial reason.
 *
 * @param {string} role - User role (raw or normalized)
 * @param {string} path - Route path
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function canAccess(role, path) {
  const normalized = normalizeRole(role);

  const resource = resourceForRoute(path);
  if (resource && canView(normalized, resource)) {
    return { allowed: true, reason: null };
  }

  return { allowed: false, reason: 'missing_capability' };
}
