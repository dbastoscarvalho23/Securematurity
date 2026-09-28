import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { moduleForRoute } from '@/lib/licenseModules';
import { isModuleLicensed, moduleDenialReason } from '@/lib/license';
import { canAccess } from '@/lib/rbac';

/**
 * Centralized route guard — uses RBAC capability system from src/lib/rbac.js
 * plus license module gating from src/lib/licenseModules.js.
 *
 * Access flow:
 * 1. RBAC check (canAccess) — role + capability based
 * 2. License check — module-gated routes for tenant users
 */

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

  // --- RBAC capability check ---
  const access = canAccess(role, path, hasCustomer);
  if (!access.allowed) {
    return <Navigate to="/" replace />;
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
