/**
 * Contextual Help — route-to-article matching logic.
 *
 * getRouteContext(pathname) → { page, framework, domain }
 * getContextualArticles({ page, framework, domain, route }) → article[]
 */

import { KB_ARTICLES } from './knowledgeBaseMockData';

// Route → page label key mapping (subset of PAGE_TITLE_KEYS from TopBar)
const ROUTE_PAGE_MAP = {
  '/': 'page_dashboard',
  '/customers': 'page_customers',
  '/assessments': 'page_assessments',
  '/question-bank': 'page_question_bank',
  '/recommendations': 'page_recommendations',
  '/tasks': 'page_tasks',
  '/task-analytics': 'page_task_analytics',
  '/action-plan': 'page_action_plan',
  '/reports': 'page_reports',
  '/admin': 'page_admin',
  '/audit-log': 'page_audit_log',
  '/settings': 'page_settings',
  '/risk-assessment': 'page_risk_assessment',
  '/security-documents': 'page_security_documents',
  '/document-audit-trail': 'page_document_audit_trail',
  '/compliance-journey': 'page_compliance_journey',
  '/evidence': 'page_evidence',
  '/email-report': 'page_email_report',
  '/ropa': 'page_ropa',
  '/incidents': 'page_incidents',
  '/dsr': 'page_dsr',
  '/vulnerabilities': 'page_vulnerabilities',
  '/compliance-metrics': 'page_compliance_metrics',
  '/suppliers': 'suppliers_title',
  '/workspaces': 'page_workspaces',
  '/organization': 'page_organization',
  '/configuration': 'page_configuration',
  '/system-status': 'page_system_status',
  '/user-assignments': 'page_user_assignments',
  '/licensing': 'page_licensing',
  '/strategic-report': 'page_reports',
  '/training': 'nav_training',
  '/policy-attestation': 'nav_policy_attestation',
  '/external-access': 'nav_external_access',
  '/framework-guide': 'nav_framework_guide',
  '/supply-chain': 'nav_supply_chain',
};

// Route → framework code mapping
const ROUTE_FRAMEWORK_MAP = {
  '/compliance-journey': 'NIS2',
};

// Route → domain keywords for article matching
const ROUTE_DOMAIN_KEYWORDS = {
  '/risk-assessment': ['risk', 'risk management'],
  '/incidents': ['incident', 'incident response'],
  '/vulnerabilities': ['vulnerability', 'vulnerability management'],
  '/suppliers': ['supplier', 'supply chain', 'third-party'],
  '/supply-chain': ['supply chain', 'third-party', 'supplier'],
  '/ropa': ['ropa', 'record of processing', 'privacy', 'gdpr'],
  '/dsr': ['dsr', 'data subject', 'privacy', 'gdpr'],
  '/training': ['training', 'awareness'],
  '/policy-attestation': ['policy', 'attestation'],
  '/evidence': ['evidence', 'audit'],
  '/security-documents': ['document', 'policy', 'standard', 'procedure'],
  '/tasks': ['task', 'action', 'remediation'],
  '/assessments': ['assessment', 'maturity', 'framework'],
  '/compliance-metrics': ['metrics', 'compliance', 'dashboard'],
  '/email-report': ['report', 'email'],
  '/reports': ['report', 'reporting'],
  '/audit-log': ['audit', 'log'],
  '/licensing': ['license', 'subscription', 'tier'],
  '/organization': ['organization', 'settings'],
  '/settings': ['settings', 'configuration'],
};

export function getRouteContext(pathname) {
  let matchedRoute = null;
  for (const route of Object.keys(ROUTE_PAGE_MAP)) {
    if (route === '/') {
      if (pathname === '/') { matchedRoute = '/'; break; }
    } else if (pathname.startsWith(route)) {
      if (!matchedRoute || route.length > matchedRoute.length) {
        matchedRoute = route;
      }
    }
  }

  const pageLabelKey = matchedRoute ? ROUTE_PAGE_MAP[matchedRoute] : null;
  const framework = matchedRoute ? (ROUTE_FRAMEWORK_MAP[matchedRoute] || null) : null;
  const domainKeywords = matchedRoute ? (ROUTE_DOMAIN_KEYWORDS[matchedRoute] || []) : [];

  return {
    page: pageLabelKey,
    framework,
    domain: domainKeywords,
    route: matchedRoute,
  };
}

export function getContextualArticles({ page, framework, domain, route } = {}) {
  if (!KB_ARTICLES || KB_ARTICLES.length === 0) return [];

  // If no context, return general platform guide articles
  if (!page && !framework && (!domain || domain.length === 0)) {
    return KB_ARTICLES.filter(a => a.category === 'guide' || a.category === 'faq').slice(0, 8);
  }

  const scored = KB_ARTICLES.map(article => {
    let score = 0;
    const titleLower = (article.title || '').toLowerCase();
    const summaryLower = (article.summary || '').toLowerCase();
    const tags = (article.tags || []).map(t => t.toLowerCase());
    const artFramework = (article.framework || '').toLowerCase();
    const artCategory = article.category || '';

    // Framework match
    if (framework && artFramework === framework.toLowerCase()) {
      score += 3;
    }

    // Domain keyword match
    if (domain && domain.length > 0) {
      for (const kw of domain) {
        const kwLower = kw.toLowerCase();
        if (titleLower.includes(kwLower) || summaryLower.includes(kwLower) || tags.includes(kwLower)) {
          score += 2;
        }
      }
    }

    // Route-specific boosts
    if (route) {
      const routeKwMap = {
        '/risk-assessment': ['risk'],
        '/incidents': ['incident'],
        '/vulnerabilities': ['vulnerability'],
        '/suppliers': ['supplier', 'supply chain'],
        '/supply-chain': ['supply chain', 'supplier'],
        '/ropa': ['ropa', 'privacy', 'gdpr'],
        '/dsr': ['dsr', 'privacy', 'gdpr'],
        '/training': ['training', 'awareness'],
        '/policy-attestation': ['policy', 'attestation'],
        '/evidence': ['evidence', 'audit'],
        '/security-documents': ['document', 'policy'],
        '/tasks': ['task', 'action', 'remediation'],
        '/assessments': ['assessment', 'maturity'],
        '/compliance-metrics': ['metrics', 'compliance'],
        '/reports': ['report'],
        '/audit-log': ['audit', 'log'],
        '/licensing': ['license', 'subscription'],
      };
      const routeKws = routeKwMap[route] || [];
      for (const kw of routeKws) {
        if (titleLower.includes(kw) || summaryLower.includes(kw) || tags.includes(kw)) {
          score += 1;
        }
      }
    }

    // General guide articles get a small boost
    if (artCategory === 'guide') score += 0.5;
    if (artCategory === 'faq') score += 0.3;

    return { article, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.article)
    .slice(0, 10);
}
