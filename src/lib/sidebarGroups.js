/**
 * Sidebar navigation groups — dynamic by role.
 *
 * 11 base groups organized by the 3-tier model, plus role-specific
 * overrides that pull items from base groups and reorganize them
 * under contextual labels.
 */
import { canView, isWorkspaceOrAbove } from './rbac';

/**
 * Helper to create a nav item.
 *
 * `sectionKey` é opcional: dentro de um grupo, os itens com a mesma chave
 * formam uma secção temática e a sidebar desenha o rótulo dessa secção antes do
 * primeiro item (ver «Gestão da plataforma», separada em comercial, operacional
 * e parceiros/utilizadores). Os itens de uma secção têm de ser contíguos.
 */
function mk(path, labelKey, icon, resource, sectionKey) {
  return { path, labelKey, icon, resource, sectionKey };
}

/**
 * 11 base groups (3-tier model).
 */
export const BASE_GROUPS = [
  {
    labelKey: 'nav_main',
    items: [
      mk('/', 'nav_dashboard', 'LayoutDashboard', 'dashboard'),
      mk('/customers', 'nav_customers', 'Building2', 'customers'),
    ],
  },
  {
    labelKey: 'nav_nis2_journey',
    items: [
      mk('/compliance-journey', 'nav_compliance_journey', 'MapPin', 'compliance_journey'),
      mk('/framework-guide', 'nav_framework_guide', 'Bot', 'framework_guide'),
    ],
  },
  {
    labelKey: 'nav_assessments_action',
    items: [
      mk('/assessments', 'nav_assessments', 'ClipboardCheck', 'assessments'),
      mk('/action-plan', 'nav_action_plan', 'Target', 'action_plan'),
      mk('/question-bank', 'nav_question_bank', 'BookOpen', 'question_bank'),
      mk('/compliance-metrics', 'nav_compliance_metrics', 'Gauge', 'compliance_metrics'),
      mk('/tasks', 'nav_tasks', 'ListTodo', 'tasks'),
      mk('/task-analytics', 'nav_task_analytics', 'TrendingUp', 'task_analytics'),
    ],
  },
  {
    labelKey: 'nav_documents_evidence',
    items: [
      mk('/security-documents', 'nav_documents', 'FolderLock', 'documents'),
      mk('/evidence', 'nav_evidence', 'Paperclip', 'evidence'),
      mk('/document-audit-trail', 'nav_doc_audit_trail', 'Activity', 'document_audit'),
    ],
  },
  {
    labelKey: 'nav_reporting_audit',
    items: [
      mk('/reports', 'nav_reports', 'BarChart3', 'reports'),
      mk('/audit-package', 'nav_audit_package', 'PackageCheck', 'audit_package'),
      mk('/strategic-report', 'nav_strategic_report', 'TrendingUp', 'strategic_report'),
      mk('/email-report', 'nav_email_report', 'MailCheck', 'email_report'),
    ],
  },
  {
    labelKey: 'nav_risk_incidents',
    items: [
      mk('/risk-assessment', 'nav_risk_assessment', 'TriangleAlert', 'risks'),
      mk('/vulnerabilities', 'nav_vulnerabilities', 'Bug', 'vulnerabilities'),
      mk('/incidents', 'nav_incidents', 'Siren', 'incidents'),
    ],
  },
  {
    labelKey: 'nav_supply_chain_group',
    items: [
      mk('/suppliers', 'nav_suppliers', 'Building2', 'suppliers'),
      mk('/supply-chain', 'nav_supply_chain', 'Truck', 'supply_chain'),
    ],
  },
  {
    labelKey: 'nav_knowledge',
    items: [
      mk('/knowledge-base', 'nav_knowledge_base', 'BookOpen', 'knowledge_base'),
    ],
  },
  {
    labelKey: 'nav_privacy',
    items: [
      mk('/ropa', 'nav_ropa', 'Database', 'ropa'),
      mk('/dsr', 'nav_dsr', 'Users', 'dsr'),
    ],
  },
  {
    labelKey: 'nav_common',
    items: [
      mk('/training', 'nav_training', 'GraduationCap', 'training'),
      mk('/policy-attestation', 'nav_policy_attestation', 'ShieldCheck', 'policy_attestation'),
      // O «Acesso Externo» foi fundido em «Delegações» (ver o grupo de gestão da
      // plataforma): /external-access redireciona para /user-assignments.
    ],
  },
  {
    // Um grupo, três temas: os itens são os mesmos, agrupados por assunto
    // (`sectionKey`) para que a administração se leia por tema em vez de por
    // ordem de chegada. A ordem dos itens tem de manter cada tema contíguo.
    labelKey: 'nav_platform_management',
    items: [
      // ─── Comercial ───────────────────────────────────────────
      mk('/licensing', 'nav_licensing', 'ShieldCheck', 'licensing', 'nav_platform_theme_commercial'),

      // ─── Operacional ─────────────────────────────────────────
      mk('/configuration', 'nav_configuration', 'Settings', 'settings', 'nav_platform_theme_operational'),
      mk('/system-status', 'nav_system_status', 'Activity', 'system_status', 'nav_platform_theme_operational'),
      // FB4 — visibilidade e configuração das automações e da conservação.
      mk('/platform-operations', 'nav_platform_operations', 'Timer', 'system_status', 'nav_platform_theme_operational'),
      mk('/audit-log', 'nav_audit_log', 'ScrollText', 'audit_log', 'nav_platform_theme_operational'),

      // ─── Parceiros e utilizadores ────────────────────────────
      mk('/organization', 'nav_organization', 'Building2', 'organization', 'nav_platform_theme_partners'),
      // FB2 — páginas de administração que existiam mas não estavam na navegação.
      mk('/workspaces', 'nav_workspaces', 'Network', 'organization', 'nav_platform_theme_partners'),
      // «Delegações» é a entrada única da fusão com o «Acesso Externo»: a mesma
      // página trata o ciclo de vida das delegações e as atribuições diretas.
      mk('/user-assignments', 'nav_user_assignments', 'UserCog', 'external_access', 'nav_platform_theme_partners'),
      mk('/admin', 'nav_admin', 'ShieldAlert', 'organization', 'nav_platform_theme_partners'),
    ],
  },
  {
    labelKey: 'nav_dev',
    items: [
      mk('/documentacao-tecnica', 'nav_technical_docs', 'FileCode', 'system_status'),
      // TEMPORÁRIO — relatório de validação (retirar com a página).
      mk('/validacao-seguranca', 'nav_validation_report', 'ShieldAlert', 'system_status'),
    ],
  },
];

/**
 * Content catalogue group — Question DB + Knowledge Base.
 * Platform & partner admins are administration-only, so this is the only
 * non-administration group they get; the two items are pulled out of their
 * base groups, which then disappear for them.
 */
const ADMIN_CONTENT_GROUP = {
  labelKey: 'nav_content_management',
  pullPaths: ['/question-bank', '/knowledge-base'],
  // O catálogo de conteúdo é governado pela administração da plataforma: o grupo
  // fica imediatamente abaixo da «Gestão da plataforma», não no topo do menu.
  position: 'after:nav_platform_management',
};

/**
 * Role-specific group overrides.
 * Each override "steals" items from base groups (via pullPaths)
 * and regroups them under a contextual label.
 */
export const ROLE_GROUP_OVERRIDES = {
  master_admin: [ADMIN_CONTENT_GROUP],
  workspace_admin: [ADMIN_CONTENT_GROUP],
  executive: [
    {
      labelKey: 'nav_strategy',
      pullPaths: ['/reports', '/strategic-report', '/compliance-metrics', '/risk-assessment'],
      position: 'after:nav_main',
    },
  ],
  auditor: [
    {
      labelKey: 'nav_audit',
      pullPaths: ['/audit-log', '/document-audit-trail', '/evidence', '/audit-package', '/ropa', '/dsr'],
      position: 'after:nav_main',
    },
  ],
  employee: [
    {
      labelKey: 'nav_my_portal',
      pullPaths: ['/policy-attestation', '/tasks', '/incidents', '/training', '/knowledge-base'],
      position: 'top',
    },
  ],
  grc_analyst: [
    {
      labelKey: 'nav_grc_tools',
      pullPaths: ['/question-bank', '/action-plan', '/framework-guide'],
      position: 'after:nav_main',
    },
  ],
};

/**
 * Build the sidebar groups for a role.
 * 1. Collect all pullPaths from the role's overrides.
 * 2. Filter each base group removing pulled items.
 * 3. Insert override groups at their specified positions.
 *
 * @param {string} role - Normalized role
 * @returns {Array} - Array of { labelKey, items: [{path, labelKey, icon, resource}] }
 */
export function buildSidebarGroups(role) {
  const overrides = ROLE_GROUP_OVERRIDES[role] || [];

  // Collect all pulled paths
  const pulledPaths = new Set();
  overrides.forEach(o => o.pullPaths.forEach(p => pulledPaths.add(p)));

  // Filter base groups: remove pulled items
  let groups = BASE_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => !pulledPaths.has(item.path)),
  })).filter(group => group.items.length > 0);

  // Insert override groups at their positions
  overrides.forEach(override => {
    const pulledItems = [];
    override.pullPaths.forEach(path => {
      for (const group of BASE_GROUPS) {
        const item = group.items.find(i => i.path === path);
        if (item) {
          pulledItems.push(item);
          break;
        }
      }
    });

    const newGroup = { labelKey: override.labelKey, items: pulledItems };
    if (!newGroup.items.length) return;

    if (override.position === 'top') {
      groups.unshift(newGroup);
    } else if (override.position.startsWith('after:')) {
      const afterKey = override.position.slice(6);
      const idx = groups.findIndex(g => g.labelKey === afterKey);
      if (idx >= 0) {
        groups.splice(idx + 1, 0, newGroup);
      } else {
        groups.push(newGroup);
      }
    } else {
      groups.push(newGroup);
    }
  });

  return groups;
}

/**
 * Get visible sidebar groups for a role, filtered by resource visibility
 * and module licensing.
 *
 * @param {string} role - Normalized role
 * @param {object} license - Effective license (optional)
 * @param {function} isModuleLicensedFn - License check function
 * @param {function} moduleForRouteFn - Route→module mapping function
 * @returns {Array} - Filtered groups
 */
export function getVisibleSidebarGroups(role, license, isModuleLicensedFn, moduleForRouteFn) {
  const allGroups = buildSidebarGroups(role);

  // Platform & partner admins are administration-only: compliance items are
  // already filtered out by canView, and the content catalogue they manage
  // (Question DB, Knowledge Base) is not commercially gated for them.
  const isAdmin = isWorkspaceOrAbove(role);

  return allGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // Check resource visibility
      if (item.resource && !canView(role, item.resource)) return false;
      // Check module license
      if (!isAdmin && moduleForRouteFn && isModuleLicensedFn) {
        const mod = moduleForRouteFn(item.path);
        if (mod && !isModuleLicensedFn(license, mod)) return false;
      }
      return true;
    }),
  })).filter(group => group.items.length > 0);
}
