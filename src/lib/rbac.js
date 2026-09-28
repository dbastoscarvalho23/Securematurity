/**
 * Centralized RBAC — capability-based access control.
 *
 * Single source of truth for:
 * - Route access (canAccess)
 * - Sidebar navigation visibility (getNavGroups)
 * - Role capabilities (getCapabilities)
 *
 * This replaces the hardcoded lists previously scattered across
 * RouteGuard.jsx and Sidebar.jsx.
 */

// ─── Role definitions ──────────────────────────────────────────
export const ROLES = {
  ADMIN: 'admin',
  CUSTOMER_ADMIN: 'customer_admin',
  USER: 'user',
};

// ─── Capability definitions per role ────────────────────────────
// Each capability is a named permission that grants access to a set of routes.
const ROLE_CAPABILITIES = {
  [ROLES.ADMIN]: [
    'platform_admin',      // /admin, /audit-log, /workspaces
    'manage_customers',   // /customers
    'manage_users',        // user CRUD
    'manage_frameworks',   // /question-bank, framework config
    'manage_storage',      // storage settings
    'manage_reminders',    // reminder settings
    'view_reports',        // /email-report, generated reports
    'view_all_modules',    // all module-gated routes
    'view_development',     // /ropa, /dsr, /incidents, /vulnerabilities, /compliance-metrics, /training
    'view_organization',   // /organization
    'view_configuration',   // /configuration
    'view_system_status',   // /system-status
    'manage_assignments',  // user-customer delegation
  ],
  [ROLES.CUSTOMER_ADMIN]: [
    'manage_users',        // invite/edit users in own tenant
    'view_reports',        // /email-report
    'view_all_modules',    // all module-gated routes (license permitting)
    'view_settings',       // /settings
  ],
  [ROLES.USER]: [
    'view_principal',      // dashboard + core compliance routes
    'view_settings',       // /settings (own profile only)
  ],
};

// ─── Route → required capability mapping ───────────────────────
// null = no capability required (license module gates instead)
// string = the capability required to access this route
const ROUTE_CAPABILITY = {
  // Admin-only routes
  '/admin': 'platform_admin',
  '/audit-log': 'platform_admin',
  '/workspaces': 'platform_admin',
  '/customers': 'manage_customers',
  '/question-bank': 'manage_frameworks',
  '/organization': 'view_organization',
  '/configuration': 'view_configuration',
  '/system-status': 'view_system_status',
  '/user-assignments': 'manage_assignments',
  '/licensing': null, // accessible to all (shows denial info)

  // Shared routes
  '/settings': 'view_settings',
  '/email-report': 'view_reports',

  // Development/module routes (admin sees all; others gated by license)
  '/ropa': 'view_development',
  '/dsr': 'view_development',
  '/incidents': 'view_development',
  '/vulnerabilities': 'view_development',
  '/compliance-metrics': 'view_development',
  '/training': 'view_development',
  '/framework-guide': 'view_development',

  // Principal routes (accessible to all authenticated users with customer)
  '/': null,
  '/dashboard': null,
  '/compliance-journey': null,
  '/assessments': null,
  '/action-plan': null,
  '/task-analytics': null,
  '/recommendations': null,
  '/tasks': null,
  '/evidence': null,
  '/security-documents': null,
  '/document-audit-trail': null,
  '/risk-assessment': null,
  '/reports': null,
  '/supply-chain': null,
  '/suppliers': null,
};

// Routes accessible by 'user' role (with a customer assigned)
// These are the principal routes that don't require a special capability.
const USER_PRINCIPAL_ROUTES = [
  '/', '/compliance-journey', '/assessments', '/evidence',
  '/tasks', '/task-analytics', '/risk-assessment', '/security-documents',
  '/document-audit-trail', '/supply-chain', '/suppliers', '/reports', '/settings',
];

// Prefix-based fallback for dynamic routes
const ROUTE_PREFIX_CAPABILITY = [
  { prefix: '/assessments', capability: null },
];

// ─── Helper functions ──────────────────────────────────────────

/**
 * Get the list of capabilities for a role.
 */
export function getCapabilities(role) {
  return ROLE_CAPABILITIES[role] || [];
}

/**
 * Check if a role has a specific capability.
 */
export function hasCapability(role, capability) {
  return getCapabilities(role).includes(capability);
}

/**
 * Resolve the required capability for a route path.
 * Returns null if no capability is required (license module gates instead).
 */
export function capabilityForRoute(path) {
  if (ROUTE_CAPABILITY[path] !== undefined) return ROUTE_CAPABILITY[path];

  for (const { prefix, capability } of ROUTE_PREFIX_CAPABILITY) {
    if (path.startsWith(prefix)) return capability;
  }

  return null;
}

/**
 * Check if a user can access a route.
 * Combines RBAC capability check with role-based route lists.
 *
 * @param {string} role - User role
 * @param {string} path - Route path
 * @param {boolean} hasCustomer - Whether user has a customer assigned
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function canAccess(role, path, hasCustomer) {
  // Admin: full access
  if (role === ROLES.ADMIN) return { allowed: true, reason: null };

  // User without customer: only dashboard
  if (role === ROLES.USER && !hasCustomer) {
    if (path === '/') return { allowed: true, reason: null };
    return { allowed: false, reason: 'no_customer' };
  }

  // Check capability requirement
  const requiredCap = capabilityForRoute(path);

  // No capability required — check principal route access for 'user' role
  if (requiredCap === null) {
    if (role === ROLES.USER) {
      const allowed = USER_PRINCIPAL_ROUTES.some(p =>
        path === p || (p !== '/' && path.startsWith(p))
      );
      return allowed
        ? { allowed: true, reason: null }
        : { allowed: false, reason: 'not_principal_route' };
    }
    // customer_admin: principal routes are allowed
    return { allowed: true, reason: null };
  }

  // Check if role has the required capability
  if (hasCapability(role, requiredCap)) {
    return { allowed: true, reason: null };
  }

  return { allowed: false, reason: 'missing_capability' };
}

// ─── Sidebar navigation definition ──────────────────────────────
// Icons are referenced by name to avoid importing lucide here.
// The Sidebar component maps these to actual icon components.
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

/**
 * Get the visible nav groups for a user.
 * Filters items based on role capabilities and customer assignment.
 *
 * @param {string} role - User role
 * @param {boolean} hasCustomer - Whether user has a customer assigned
 * @returns {Array} - Filtered nav groups
 */
export function getNavGroups(role, hasCustomer) {
  const caps = getCapabilities(role);

  // User without customer: only dashboard
  if (role === ROLES.USER && !hasCustomer) {
    return NAV_GROUPS_CONFIG.map(group => ({
      ...group,
      items: group.items.filter(item => item.path === '/'),
    })).filter(group => group.items.length > 0);
  }

  return NAV_GROUPS_CONFIG.map(group => {
    // Skip admin-only groups for non-admins
    if (group.adminOnly && role !== ROLES.ADMIN) {
      return { ...group, items: [] };
    }

    // Filter items by capability
    const items = group.items.filter(item => {
      if (!item.capability) return true; // No capability required
      return caps.includes(item.capability);
    });

    return { ...group, items };
  }).filter(group => group.items.length > 0);
}
