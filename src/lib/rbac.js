/**
 * Centralized RBAC — capability-based access control.
 *
 * Single source of truth for:
 * - Role normalization (normalizeRole)
 * - Route access (canAccess, canAccessRoute)
 * - Resource visibility (canView)
 * - Role capabilities (getCapabilities)
 *
 * Supports 8-role tier system with backward compatibility for the
 * legacy 3-role system (admin, customer_admin, user).
 */

// ─── Role definitions (8-role tier) ─────────────────────────────
export const ROLES = {
  MASTER_ADMIN: 'master_admin',
  WORKSPACE_ADMIN: 'workspace_admin',
  PARTNER_ADMIN: 'partner_admin',
  CUSTOMER_ADMIN: 'customer_admin',
  GRC_ANALYST: 'grc_analyst',
  CONTROL_OWNER: 'control_owner',
  EXECUTIVE: 'executive',
  AUDITOR: 'auditor',
  EMPLOYEE: 'employee',
  // Legacy aliases (backward compat)
  ADMIN: 'admin',
  USER: 'user',
};

export const ALL_ROLES = [
  'master_admin', 'workspace_admin', 'partner_admin', 'customer_admin',
  'grc_analyst', 'control_owner', 'executive', 'auditor', 'employee',
];

/**
 * Normalize a backend role to the 8-role tier system.
 * Maps legacy roles to their new equivalents.
 */
export function normalizeRole(role) {
  if (!role) return 'employee';
  const map = {
    admin: 'master_admin',
    customer_admin: 'customer_admin',
    user: 'employee',
    master_admin: 'master_admin',
    workspace_admin: 'workspace_admin',
    partner_admin: 'partner_admin',
    grc_analyst: 'grc_analyst',
    control_owner: 'control_owner',
    executive: 'executive',
    auditor: 'auditor',
    employee: 'employee',
  };
  return map[role] || 'employee';
}

// ─── Resource visibility per role ───────────────────────────────
// Defines which nav resources each role can see.
const RESOURCE_ACCESS = {
  master_admin: '*',
  workspace_admin: [
    'dashboard', 'customers', 'compliance_journey', 'framework_guide',
    'assessments', 'action_plan', 'question_bank', 'compliance_metrics',
    'tasks', 'task_analytics', 'documents', 'evidence', 'document_audit',
    'reports', 'strategic_report', 'recommendations', 'email_report',
    'risks', 'vulnerabilities', 'incidents',
    'suppliers', 'supply_chain', 'knowledge_base',
    'ropa', 'dsr', 'training', 'policy_attestation', 'external_access',
    'organization', 'licensing', 'settings', 'system_status', 'audit_log',
  ],
  partner_admin: [
    'dashboard', 'customers', 'compliance_journey', 'framework_guide',
    'assessments', 'action_plan', 'compliance_metrics',
    'tasks', 'task_analytics', 'documents', 'evidence', 'document_audit',
    'reports', 'strategic_report', 'recommendations', 'email_report',
    'risks', 'vulnerabilities', 'incidents',
    'suppliers', 'supply_chain', 'knowledge_base',
    'ropa', 'dsr', 'training', 'policy_attestation',
    'organization', 'licensing',
  ],
  customer_admin: [
    'dashboard', 'compliance_journey', 'framework_guide',
    'assessments', 'action_plan', 'question_bank', 'compliance_metrics',
    'tasks', 'task_analytics', 'documents', 'evidence', 'document_audit',
    'reports', 'recommendations', 'email_report',
    'risks', 'vulnerabilities', 'incidents',
    'suppliers', 'supply_chain', 'knowledge_base',
    'ropa', 'dsr', 'training', 'policy_attestation', 'external_access',
    'settings',
  ],
  grc_analyst: [
    'dashboard', 'compliance_journey', 'framework_guide',
    'assessments', 'action_plan', 'question_bank', 'compliance_metrics',
    'tasks', 'task_analytics', 'documents', 'evidence', 'document_audit',
    'reports', 'recommendations', 'risks', 'vulnerabilities', 'incidents',
    'suppliers', 'supply_chain', 'knowledge_base',
    'ropa', 'dsr',
  ],
  control_owner: [
    'dashboard', 'tasks', 'task_analytics', 'evidence',
    'documents', 'incidents', 'knowledge_base',
    'training', 'policy_attestation', 'external_access',
  ],
  executive: [
    'dashboard', 'reports', 'strategic_report', 'compliance_metrics',
    'risks',
  ],
  auditor: [
    'dashboard', 'audit_log', 'document_audit', 'evidence',
    'ropa', 'dsr', 'reports',
  ],
  employee: [
    'dashboard', 'tasks', 'incidents', 'training',
    'knowledge_base', 'policy_attestation', 'external_access',
  ],
};

/**
 * Check if a role can view a specific resource.
 */
export function canView(role, resource) {
  const normalized = normalizeRole(role);
  const access = RESOURCE_ACCESS[normalized];
  if (!access) return false;
  if (access === '*') return true;
  return access.includes(resource);
}

// ─── Route → required capability mapping (legacy compat) ────────
const ROUTE_CAPABILITY = {
  '/admin': 'platform_admin',
  '/audit-log': 'platform_admin',
  '/workspaces': 'platform_admin',
  '/customers': 'manage_customers',
  '/question-bank': 'manage_frameworks',
  '/organization': 'view_organization',
  '/configuration': 'view_configuration',
  '/system-status': 'view_system_status',
  '/user-assignments': 'manage_assignments',
  '/licensing': null,
  '/settings': 'view_settings',
  '/email-report': 'view_reports',
  '/ropa': 'view_development',
  '/dsr': 'view_development',
  '/incidents': 'view_development',
  '/vulnerabilities': 'view_development',
  '/compliance-metrics': 'view_development',
  '/training': 'view_development',
  '/framework-guide': 'view_development',
  '/': null,
  '/dashboard': null,
  '/compliance-journey': null,
  '/assessments': null,
  '/action-plan': null,
  '/task-analytics': null,
  '/recommendations': null,
  '/tasks': null,
  '/strategic-report': null,
  '/knowledge-base': null,
  '/policy-attestation': null,
  '/external-access': null,
  '/evidence': null,
  '/security-documents': null,
  '/document-audit-trail': null,
  '/risk-assessment': null,
  '/reports': null,
  '/supply-chain': null,
  '/suppliers': null,
};

const ROLE_CAPABILITIES = {
  admin: [
    'platform_admin', 'manage_customers', 'manage_users', 'manage_frameworks',
    'manage_storage', 'manage_reminders', 'view_reports', 'view_all_modules',
    'view_development', 'view_organization', 'view_configuration',
    'view_system_status', 'manage_assignments',
  ],
  customer_admin: [
    'manage_users', 'view_reports', 'view_all_modules', 'view_settings',
  ],
  user: ['view_principal', 'view_settings'],
};

// ─── Route → resource mapping (for canView) ─────────────────────
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
 */
export function resourceForRoute(path) {
  return ROUTE_RESOURCE[path] || null;
}

/**
 * Check if a role can access a specific route.
 * Uses the new canView system with fallback to legacy capability check.
 *
 * @param {string} role - User role (raw or normalized)
 * @param {string} path - Route path
 * @param {boolean} hasCustomer - Whether user has a customer assigned
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function canAccess(role, path, hasCustomer) {
  const normalized = normalizeRole(role);

  // Master admin: full access
  if (normalized === 'master_admin' || role === 'admin') {
    return { allowed: true, reason: null };
  }

  // Check resource visibility
  const resource = resourceForRoute(path);
  if (resource && canView(normalized, resource)) {
    return { allowed: true, reason: null };
  }

  // Fallback to legacy capability check for backward compat
  const requiredCap = capabilityForRoute(path);
  if (requiredCap === null) {
    // Principal routes — check if it's a basic route
    const principalRoutes = ['/', '/dashboard', '/compliance-journey', '/assessments',
      '/evidence', '/tasks', '/task-analytics', '/risk-assessment',
      '/security-documents', '/document-audit-trail', '/supply-chain',
      '/suppliers', '/reports', '/settings'];
    if (principalRoutes.some(p => path === p || (p !== '/' && path.startsWith(p)))) {
      return { allowed: true, reason: null };
    }
  }
  if (requiredCap && hasCapability(role, requiredCap)) {
    return { allowed: true, reason: null };
  }

  return { allowed: false, reason: 'missing_capability' };
}

/**
 * Check if a role can access a route (simple boolean, for RouteGuard).
 */
export function canAccessRoute(role, path) {
  const normalized = normalizeRole(role);
  if (normalized === 'master_admin') return true;
  const resource = resourceForRoute(path);
  if (resource && canView(normalized, resource)) return true;
  // Fallback to legacy
  const result = canAccess(role, path, true);
  return result.allowed;
}

// ─── Legacy helper functions (backward compat) ──────────────────

export function getCapabilities(role) {
  return ROLE_CAPABILITIES[role] || [];
}

export function hasCapability(role, capability) {
  return getCapabilities(role).includes(capability);
}

export function capabilityForRoute(path) {
  if (ROUTE_CAPABILITY[path] !== undefined) return ROUTE_CAPABILITY[path];
  return null;
}

// ─── Legacy sidebar nav (backward compat — replaced by sidebarGroups.js) ──
export const NAV_GROUPS_CONFIG = [
  {
    labelKey: 'nav_main',
    items: [
      { path: '/', labelKey: 'nav_dashboard', icon: 'LayoutDashboard' },
      { path: '/customers', labelKey: 'nav_customers', icon: 'Building2', capability: 'manage_customers' },
      { path: '/compliance-journey', labelKey: 'nav_compliance_journey', icon: 'MapPin' },
      { path: '/assessments', labelKey: 'nav_assessments', icon: 'ClipboardCheck' },
      { path: '/evidence', labelKey: 'nav_evidence', icon: 'Paperclip' },
      { path: '/tasks', labelKey: 'nav_tasks', icon: 'ListTodo' },
      { path: '/task-analytics', labelKey: 'nav_task_analytics', icon: 'TrendingUp' },
      { path: '/risk-assessment', labelKey: 'nav_risk_assessment', icon: 'TriangleAlert' },
      { path: '/security-documents', labelKey: 'nav_documents', icon: 'FolderLock' },
      { path: '/document-audit-trail', labelKey: 'nav_doc_audit_trail', icon: 'Activity' },
      { path: '/reports', labelKey: 'nav_reports', icon: 'BarChart3' },
    ],
  },
  {
    labelKey: 'nav_supply_chain_group',
    items: [
      { path: '/suppliers', labelKey: 'nav_suppliers', icon: 'Building2' },
      { path: '/supply-chain', labelKey: 'nav_supply_chain', icon: 'Truck' },
    ],
  },
  {
    labelKey: 'nav_tools',
    items: [
      { path: '/action-plan', labelKey: 'nav_action_plan', icon: 'Target' },
      { path: '/question-bank', labelKey: 'nav_question_bank', icon: 'BookOpen', capability: 'manage_frameworks' },
    ],
    adminOnly: true,
  },
  {
    labelKey: 'nav_system',
    items: [
      { path: '/admin', labelKey: 'nav_admin', icon: 'ShieldCheck', capability: 'platform_admin' },
      { path: '/workspaces', labelKey: 'nav_workspaces', icon: 'Network', capability: 'platform_admin' },
      { path: '/user-assignments', labelKey: 'nav_user_assignments', icon: 'UserCog', capability: 'manage_assignments' },
      { path: '/organization', labelKey: 'nav_organization', icon: 'Building2', capability: 'view_organization' },
      { path: '/configuration', labelKey: 'nav_configuration', icon: 'Settings', capability: 'view_configuration' },
      { path: '/system-status', labelKey: 'nav_system_status', icon: 'Activity', capability: 'view_system_status' },
      { path: '/audit-log', labelKey: 'nav_audit_log', icon: 'ScrollText', capability: 'platform_admin' },
      { path: '/email-report', labelKey: 'nav_email_report', icon: 'MailCheck', capability: 'view_reports' },
      { path: '/settings', labelKey: 'nav_settings', icon: 'Settings', capability: 'view_settings' },
    ],
  },
  {
    labelKey: 'nav_development',
    items: [
      { path: '/ropa', labelKey: 'nav_ropa', icon: 'Database', capability: 'view_development' },
      { path: '/dsr', labelKey: 'nav_dsr', icon: 'Users', capability: 'view_development' },
      { path: '/vulnerabilities', labelKey: 'nav_vulnerabilities', icon: 'Bug', capability: 'view_development' },
      { path: '/incidents', labelKey: 'nav_incidents', icon: 'Siren', capability: 'view_development' },
      { path: '/compliance-metrics', labelKey: 'nav_compliance_metrics', icon: 'Gauge', capability: 'view_development' },
      { path: '/training', labelKey: 'nav_training', icon: 'GraduationCap', capability: 'view_development' },
      { path: '/framework-guide', labelKey: 'nav_framework_guide', icon: 'Bot', capability: 'view_development' },
    ],
    adminOnly: true,
  },
];

export function getNavGroups(role, hasCustomer) {
  const normalized = normalizeRole(role);
  const caps = getCapabilities(role);

  if (normalized === 'employee' && !hasCustomer) {
    return NAV_GROUPS_CONFIG.map(group => ({
      ...group,
      items: group.items.filter(item => item.path === '/'),
    })).filter(group => group.items.length > 0);
  }

  return NAV_GROUPS_CONFIG.map(group => {
    if (group.adminOnly && normalized !== 'master_admin' && role !== 'admin') {
      return { ...group, items: [] };
    }
    const items = group.items.filter(item => {
      if (!item.capability) return true;
      return caps.includes(item.capability);
    });
    return { ...group, items };
  }).filter(group => group.items.length > 0);
}
