/**
 * Knowledge Base mock data and helpers.
 * Used by ContextualHelpDrawer and KB page for article display.
 */

export const KB_FRAMEWORKS = {
  NIS2: { code: 'NIS2', name: 'NIS2 / DL 125/2025', color: '#3b82f6' },
  ISO27001: { code: 'ISO27001', name: 'ISO/IEC 27001', color: '#22c55e' },
  NIST_CSF: { code: 'NIST_CSF', name: 'NIST CSF', color: '#f97316' },
  CIS_V8: { code: 'CIS_V8', name: 'CIS Controls v8', color: '#a855f7' },
  GDPR: { code: 'GDPR', name: 'GDPR', color: '#ef4444' },
};

export const KB_ARTICLES = [
  // Platform Guide
  {
    id: 'pg-getting-started',
    title: 'Getting Started with AnkoraOne',
    summary: 'Learn the basics of navigating the platform, understanding your dashboard, and starting your compliance journey.',
    category: 'guide',
    framework: '',
    tags: ['platform', 'onboarding', 'dashboard', 'getting started'],
    section: 'platform',
  },
  {
    id: 'pg-assessments',
    title: 'Running Maturity Assessments',
    summary: 'How to create, configure, and complete maturity assessments across multiple frameworks.',
    category: 'guide',
    framework: '',
    tags: ['assessment', 'maturity', 'framework', 'evaluation'],
    section: 'platform',
  },
  {
    id: 'pg-tasks-action-plan',
    title: 'Managing Tasks and Action Plans',
    summary: 'Create remediation tasks, assign them to owners, and track completion through your action plan.',
    category: 'guide',
    framework: '',
    tags: ['task', 'action', 'remediation', 'plan'],
    section: 'platform',
  },
  {
    id: 'pg-reports',
    title: 'Generating Reports',
    summary: 'Create strategic reports, email summaries, and export compliance documentation.',
    category: 'guide',
    framework: '',
    tags: ['report', 'reporting', 'export', 'email'],
    section: 'platform',
  },
  {
    id: 'pg-evidence',
    title: 'Evidence Collection and Audit Trails',
    summary: 'Upload evidence, maintain document audit trails, and prepare for external audits.',
    category: 'guide',
    framework: '',
    tags: ['evidence', 'audit', 'document', 'trail'],
    section: 'platform',
  },
  {
    id: 'pg-user-management',
    title: 'User Roles and Permissions',
    summary: 'Understand the 8-role tier system, assign users, and manage workspace access.',
    category: 'guide',
    framework: '',
    tags: ['user', 'role', 'permission', 'workspace', 'organization', 'settings'],
    section: 'platform',
  },
  {
    id: 'pg-licensing',
    title: 'Licensing and Subscriptions',
    summary: 'Manage your subscription tier, activate modules, and understand license-gated features.',
    category: 'guide',
    framework: '',
    tags: ['license', 'subscription', 'tier', 'module'],
    section: 'platform',
  },
  {
    id: 'pg-faq-ai',
    title: 'AI Assistant FAQ',
    summary: 'Common questions about the AI-powered features, credit usage, and data privacy.',
    category: 'faq',
    framework: '',
    tags: ['ai', 'faq', 'credits', 'privacy'],
    section: 'platform',
  },

  // Compliance
  {
    id: 'cp-nis2-overview',
    title: 'NIS2 Directive Overview',
    summary: 'Understanding the NIS2 Directive (DL 125/2025 in Portugal), scope, and key obligations.',
    category: 'article',
    framework: 'NIS2',
    tags: ['nis2', 'compliance', 'directive', 'dl 125'],
    section: 'compliance',
  },
  {
    id: 'cp-nis2-risk',
    title: 'NIS2 Risk Management Requirements',
    summary: 'Risk assessment and management obligations under NIS2, including supply chain security.',
    category: 'article',
    framework: 'NIS2',
    tags: ['nis2', 'risk', 'risk management', 'supply chain', 'supplier'],
    section: 'compliance',
  },
  {
    id: 'cp-nis2-incident',
    title: 'NIS2 Incident Reporting Obligations',
    summary: 'Timeline and procedures for incident reporting under NIS2, including early warning and notification.',
    category: 'article',
    framework: 'NIS2',
    tags: ['nis2', 'incident', 'incident response', 'reporting'],
    section: 'compliance',
  },
  {
    id: 'cp-iso27001-overview',
    title: 'ISO 27001 Implementation Guide',
    summary: 'How to implement an Information Security Management System (ISMS) aligned with ISO/IEC 27001.',
    category: 'guide',
    framework: 'ISO27001',
    tags: ['iso27001', 'isms', 'compliance', 'security'],
    section: 'compliance',
  },
  {
    id: 'cp-iso27001-controls',
    title: 'ISO 27001 Annex A Controls',
    summary: 'Overview of Annex A control categories and how to map them to your security posture.',
    category: 'article',
    framework: 'ISO27001',
    tags: ['iso27001', 'controls', 'annex a', 'security'],
    section: 'compliance',
  },
  {
    id: 'cp-nist-csf',
    title: 'NIST Cybersecurity Framework',
    summary: 'Implementing the NIST CSF functions: Identify, Protect, Detect, Respond, Recover.',
    category: 'guide',
    framework: 'NIST_CSF',
    tags: ['nist', 'csf', 'framework', 'compliance'],
    section: 'compliance',
  },
  {
    id: 'cp-cis-v8',
    title: 'CIS Controls v8 Implementation',
    summary: 'How to implement the 18 CIS Controls v8 safeguards and track compliance.',
    category: 'guide',
    framework: 'CIS_V8',
    tags: ['cis', 'controls', 'v8', 'safeguards', 'compliance'],
    section: 'compliance',
  },
  {
    id: 'cp-gdpr-ropa',
    title: 'GDPR Records of Processing Activities',
    summary: 'How to maintain your RoPA and manage Data Subject Requests under GDPR.',
    category: 'article',
    framework: 'GDPR',
    tags: ['gdpr', 'ropa', 'record of processing', 'privacy', 'dsr', 'data subject'],
    section: 'compliance',
  },
  {
    id: 'cp-training-awareness',
    title: 'Security Awareness Training',
    summary: 'Setting up and tracking security awareness training programs for your organization.',
    category: 'guide',
    framework: '',
    tags: ['training', 'awareness', 'security', 'education'],
    section: 'compliance',
  },
  {
    id: 'cp-policy-attestation',
    title: 'Policy Attestation Best Practices',
    summary: 'How to manage policy attestations and ensure organization-wide compliance acknowledgment.',
    category: 'article',
    framework: '',
    tags: ['policy', 'attestation', 'compliance', 'acknowledgment'],
    section: 'compliance',
  },
  {
    id: 'cp-vulnerability-mgmt',
    title: 'Vulnerability Management Process',
    summary: 'Establishing a vulnerability management lifecycle aligned with compliance requirements.',
    category: 'article',
    framework: '',
    tags: ['vulnerability', 'vulnerability management', 'security', 'patch'],
    section: 'compliance',
  },
  {
    id: 'cp-supplier-risk',
    title: 'Third-Party and Supplier Risk Management',
    summary: 'Assessing and managing risks from suppliers and supply chain partners.',
    category: 'article',
    framework: '',
    tags: ['supplier', 'supply chain', 'third-party', 'risk', 'vendor'],
    section: 'compliance',
  },
];

/**
 * Localize an article field based on language.
 * Currently articles are single-language; this is a hook for future i18n.
 */
export function localizeArticle(article, field = 'title', language = 'en') {
  if (!article) return '';
  return article[field] || '';
}

/**
 * Get the framework color for an article.
 */
export function getArticleFrameworkColor(article) {
  const fw = KB_FRAMEWORKS[article?.framework];
  return fw?.color || '#6b7280';
}
