import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { moduleForRoute } from '@/lib/licenseModules';
import { isModuleLicensed, moduleDenialReason } from '@/lib/license';

/**
 * Access rules:
 * - admin: full access everywhere
 * - customer_admin: all customer-scoped routes, no /admin /audit-log
 * - user (with customer): principal routes + /settings only
 * - user (no customer): / only
 *
 * License check: for tenant users, routes mapped to a module are gated
 * by the effective license. If the module is not licensed, redirect to /licensing.
 */

// Routes accessible by 'user' role (with a customer assigned)
const USER_ALLOWED = [
  '/', '/compliance-journey', '/assessments', '/evidence',
  '/tasks', '/task-analytics', '/risk-assessment', '/security-documents',
  '/document-audit-trail', '/supply-chain', '/suppliers', '/reports', '/settings',
];

// Routes NOT accessible by customer_admin
const CUSTOMER_ADMIN_BLOCKED = ['/admin', '/audit-log', '/customers', '/question-bank', '/ropa', '/incidents', '/dsr', '/vulnerabilities', '/compliance-metrics', '/training', '/workspaces'];

export default function RouteGuard({ path, children }) {
  const { user } = useAuth();
  const role = user?.role;
  const hasCustomer = !!user?.customer_id;
  const moduleCode = moduleForRoute(path);

  // Always call useQuery (Rules of Hooks) — only fetches for tenant users on module-gated routes
  const { data: license } = useQuery({
    queryKey: ['effective-license', user?.customer_id],
    queryFn: () => base44.functions.invoke('getEffectiveLicense', { customer_id: user.customer_id }),
    enabled: !!user?.customer_id && role !== 'admin' && !!moduleCode,
    staleTime: 60000,
  });

  // --- Role-based access control ---
  if (role === 'admin') return children;

  if (role === 'customer_admin') {
    if (CUSTOMER_ADMIN_BLOCKED.includes(path)) return <Navigate to="/" replace />;
    // Fall through to license check
  } else {
    // role === 'user'
    if (!hasCustomer) {
      if (path !== '/') return <Navigate to="/" replace />;
      return children;
    }
    const allowed = USER_ALLOWED.some(p => path === p || (p !== '/' && path.startsWith(p)));
    if (!allowed) return <Navigate to="/" replace />;
    // Fall through to license check
  }

  // --- License module check (tenant users only) ---
  // Admin-only routes (moduleCode === null) skip license check
  if (!moduleCode) return children;

  // Permissive while loading (isModuleLicensed returns true for null/undefined license)
  if (!isModuleLicensed(license, moduleCode)) {
    const reason = moduleDenialReason(license, moduleCode);
    return <Navigate to="/licensing" replace state={{ reason, module: moduleCode }} />;
  }

  return children;
}
