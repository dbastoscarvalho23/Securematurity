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
// Tiers that include platform/partner roles
const PLATFORM     = ['master_admin'];
const PARTNER      = ['master_admin', 'workspace_admin'];
const TENANT_MGR   = ['master_admin', 'workspace_admin', 'customer_admin'];
const TENANT_EDIT  = [...TENANT_MGR, 'grc_analyst'];
const TENANT_OPS   = [...TENANT_EDIT, 'control_owner'];
const TENANT_VIEW  = [...TENANT_OPS, 'auditor'];
const EXEC_VIEW    = [...TENANT_MGR, 'executive'];
const ALL_VIEW     = [...TENANT_VIEW, 'executive', 'employee', 'consultant'];

// Tenant-only tiers (no platform/partner — pure tenant management)
const T_MGR  = ['customer_admin'];
const T_EDIT = ['customer_admin', 'grc_analyst'];
const T_OPS  = ['customer_admin', 'grc_analyst', 'control_owner'];
const T_VIEW = ['customer_admin', 'grc_analyst', 'control_owner', 'auditor'];

export const CAPABILITY_TIERS = {
  PLATFORM, PARTNER, TENANT_MGR, TENANT_EDIT, TENANT_OPS, TENANT_VIEW,
  EXEC_VIEW, ALL_VIEW, T_MGR, T_EDIT, T_OPS, T_VIEW,
};

// ─── Capabilities matrix (single source of truth) ──────────────
// For each resource, defines which roles can perform each action.
// master_admin is always allowed (short-circuited in can()).
export const CAPABILITIES = {
  // ─── Spec explicit ──────────────────────────────────────────
  dashboard:          { view: ALL_VIEW },
  customers:          { view: PARTNER, create: PARTNER, edit: PARTNER, delete: PLATFORM },
  assessments:        { view: [...T_VIEW, 'executive'], create: T_EDIT, edit: T_EDIT, delete: T_MGR, export: [...T_EDIT, 'executive', 'auditor'] },
  question_bank:      { view: ['grc_analyst'], create: ['grc_analyst'], edit: ['grc_analyst'], delete: T_MGR },
  organization:       { view: [...PARTNER, 'customer_admin'], create: PARTNER, edit: PARTNER, delete: PLATFORM },
  licensing:          { view: [...PLATFORM, 'workspace_admin'] },
  system_status:      { view: PLATFORM },
  external_access:    { view: ['customer_admin', 'consultant', 'master_admin', 'workspace_admin'] },

  // ─── Derived from existing access patterns + tier system ────
  compliance_journey: { view: TENANT_EDIT, create: T_EDIT, edit: T_EDIT, delete: T_MGR },
  framework_guide:    { view: TENANT_EDIT },
  action_plan:        { view: TENANT_EDIT, create: T_EDIT, edit: T_EDIT, delete: T_MGR },
  compliance_metrics: { view: [...TENANT_EDIT, 'executive'], export: [...TENANT_EDIT, 'executive', 'auditor'] },
  tasks:              { view: [...TENANT_OPS, 'employee'], create: T_OPS, edit: T_OPS, delete: T_MGR, approve: T_MGR },
  task_analytics:     { view: TENANT_OPS },
  documents:          { view: TENANT_OPS, create: T_OPS, edit: T_OPS, delete: T_MGR },
  evidence:           { view: TENANT_VIEW, create: T_OPS, edit: T_OPS, delete: T_MGR },
  document_audit:     { view: [...TENANT_EDIT, 'auditor'] },
  reports:            { view: [...TENANT_EDIT, 'auditor', 'executive'], export: [...TENANT_EDIT, 'auditor', 'executive'] },
  strategic_report:   { view: [...PLATFORM, 'workspace_admin', 'executive'], export: [...PLATFORM, 'workspace_admin', 'executive'] },
  recommendations:    { view: TENANT_EDIT, create: T_EDIT, edit: T_EDIT, delete: T_MGR },
  email_report:       { view: TENANT_EDIT, create: T_EDIT },
  risks:              { view: [...T_VIEW, 'executive'], create: T_EDIT, edit: T_EDIT, delete: T_MGR },
  vulnerabilities:    { view: T_VIEW, create: T_OPS, edit: T_OPS, delete: T_MGR },
  incidents:          { view: [...TENANT_OPS, 'employee'], create: [...TENANT_OPS, 'employee'], edit: T_OPS, delete: T_MGR },
  suppliers:          { view: TENANT_EDIT, create: T_EDIT, edit: T_EDIT, delete: T_MGR },
  supply_chain:       { view: TENANT_EDIT, create: T_EDIT, edit: T_EDIT, delete: T_MGR },
  knowledge_base:     { view: [...TENANT_OPS, 'employee'], create: T_EDIT, edit: T_EDIT, delete: T_MGR },
  ropa:               { view: [...TENANT_EDIT, 'auditor'], create: T_EDIT, edit: T_EDIT, delete: T_MGR },
  dsr:                { view: [...TENANT_EDIT, 'auditor'], create: T_EDIT, edit: T_EDIT, delete: T_MGR },
  audit_log:          { view: [...PLATFORM, 'workspace_admin', 'auditor'] },
  training:           { view: [...TENANT_MGR, 'control_owner', 'employee'], create: T_MGR, edit: T_MGR, delete: T_MGR },
  policy_attestation: { view: [...TENANT_MGR, 'control_owner', 'employee'], create: T_MGR, edit: T_MGR, delete: T_MGR, approve: T_MGR },
  settings:           { view: [...PARTNER, 'customer_admin'] },
};

/**
 * Check if a role can perform an action on a resource.
 * master_admin short-circuits to always true.
 *
 * @param {string} role - User role (raw or normalized)
 * @param {string} action - Action: 'view', 'create', 'edit', 'delete', 'export', 'approve'
 * @param {string} resource - Resource name from CAPABILITIES
 * @returns {boolean}
 */
export function can(role, action, resource) {
  const normalized = normalizeRole(role);
  if (normalized === 'master_admin') return true;

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
 * master_admin short-circuits to always true.
 *
 * @param {string} role - User role (raw or normalized)
 * @param {string} path - Route path
 * @returns {boolean}
 */
export function canAccessRoute(role, path) {
  const normalized = normalizeRole(role);
  if (normalized === 'master_admin') return true;

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

  if (normalized === 'master_admin') {
    return { allowed: true, reason: null };
  }

  const resource = resourceForRoute(path);
  if (resource && canView(normalized, resource)) {
    return { allowed: true, reason: null };
  }

  return { allowed: false, reason: 'missing_capability' };
}
