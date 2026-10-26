import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useLicense, hasModule, moduleForPath } from '@/lib/licensing';
import EmptyState from '@/components/shared/EmptyState';
import { Lock } from 'lucide-react';

/**
 * Access rules:
 * - admin: full access everywhere
 * - customer_admin: all customer-scoped routes, no /admin /audit-log
 * - user (with customer): principal routes + /settings only
 * - user (no customer): / only
 */

// Routes accessible by 'user' role (with a customer assigned)
const USER_ALLOWED = [
  '/', '/compliance-journey', '/legal-library', '/assessments', '/evidence',
  '/tasks', '/task-analytics', '/risk-assessment', '/security-documents',
  '/document-audit-trail', '/supply-chain', '/suppliers', '/reports', '/settings',
];

// Routes NOT accessible by customer_admin
const CUSTOMER_ADMIN_BLOCKED = ['/admin', '/backoffice', '/backoffice/customers', '/backoffice/users', '/backoffice/audit', '/audit-log', '/customers', '/question-bank', '/ropa', '/incidents', '/dsr', '/vulnerabilities', '/compliance-metrics', '/training'];

/** Bloqueia rotas de módulos que não estão na licença efetiva do cliente (o servidor também recusa). */
function LicensedRoute({ path, children }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { data: license } = useLicense();
  const code = moduleForPath(path);
  if (hasModule(license, user, code)) return children;
  return (
    <EmptyState icon={Lock} title={t('lic_blocked_title')}
      description={license && !license.effective ? t('lic_blocked_inactive', { state: t(`lic_state_${license.state}`) }) : t('lic_blocked_module')}
      className="h-64" />
  );
}

export default function RouteGuard({ path, children }) {
  const { user } = useAuth();
  const role = user?.role;
  const hasCustomer = !!user?.customer_id;

  if (role === 'admin') return children;
  if (moduleForPath(path)) return <RoleGuard path={path} role={role} hasCustomer={hasCustomer}><LicensedRoute path={path}>{children}</LicensedRoute></RoleGuard>;
  return <RoleGuard path={path} role={role} hasCustomer={hasCustomer}>{children}</RoleGuard>;
}

function RoleGuard({ path, role, hasCustomer, children }) {

  if (role === 'customer_admin') {
    if (CUSTOMER_ADMIN_BLOCKED.includes(path)) return <Navigate to="/" replace />;
    return children;
  }

  // role === 'user'
  if (!hasCustomer) {
    if (path !== '/') return <Navigate to="/" replace />;
    return children;
  }

  // user with customer: allow principal + settings
  const allowed = USER_ALLOWED.some(p => path === p || (p !== '/' && path.startsWith(p)));
  if (!allowed) return <Navigate to="/" replace />;
  return children;
}