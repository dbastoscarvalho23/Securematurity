import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

/**
 * Access rules:
 * - admin: full access everywhere
 * - customer_admin: all customer-scoped routes, no /admin /audit-log
 * - user (with customer): principal routes + /settings only
 * - user (no customer): / only
 */

// Routes accessible by 'user' role (with a customer assigned)
const USER_ALLOWED = [
  '/', '/compliance-journey', '/assessments', '/evidence',
  '/tasks', '/task-analytics', '/risk-assessment', '/security-documents',
  '/document-audit-trail', '/supply-chain', '/suppliers', '/reports', '/settings',
];

// Routes NOT accessible by customer_admin
const CUSTOMER_ADMIN_BLOCKED = ['/admin', '/audit-log', '/customers', '/question-bank', '/ropa', '/incidents', '/dsr', '/vulnerabilities', '/compliance-metrics', '/training'];

export default function RouteGuard({ path, children }) {
  const { user } = useAuth();
  const role = user?.role;
  const hasCustomer = !!user?.customer_id;

  if (role === 'admin') return children;

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