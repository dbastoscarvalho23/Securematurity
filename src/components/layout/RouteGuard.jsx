import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { moduleForRoute } from '@/lib/licenseModules';
import { isModuleLicensed, moduleDenialReason } from '@/lib/license';
import { canAccessRoute, isWorkspaceOrAbove, normalizeRole } from '@/lib/rbac';
import { useEffectiveRole } from '@/lib/RoleSimulationContext';

/**
 * Centralized route guard — uses RBAC capability system from src/lib/rbac.js
 * plus license module gating from src/lib/licenseModules.js.
 *
 * Access flow:
 * 1. RBAC check (canAccessRoute) — role + capability based (uses effective role)
 * 2. License check — module-gated routes for tenant users
 */
export default function RouteGuard({ path, children }) {
  const { user } = useAuth();
  const effectiveRole = useEffectiveRole();
  const realRole = normalizeRole(user?.role);
  const hasCustomer = !!user?.customer_id;
  const moduleCode = moduleForRoute(path);

  // Always call useQuery (Rules of Hooks) — only fetches for tenant users on module-gated routes
  const { data: license } = useQuery({
    queryKey: ['effective-license', user?.customer_id],
    queryFn: () => base44.functions.invoke('getEffectiveLicense', { customer_id: user.customer_id }),
    enabled: !!user?.customer_id && !isWorkspaceOrAbove(realRole) && !!moduleCode,
    staleTime: 60000,
  });

  // --- RBAC capability check (using effective role for simulation support) ---
  if (!canAccessRoute(effectiveRole, path)) {
    return <Navigate to="/" replace />;
  }

  // --- License module check (tenant users only, skip during simulation) ---
  if (!moduleCode) return children;

  // Skip license check when simulating (view-only preview)
  if (effectiveRole !== realRole) return children;

  // Platform & partner admins are administration-only: no compliance route
  // reaches them (see canAccessRoute), and the shared content catalogue they
  // manage (Question DB, Knowledge Base) is not commercially gated for them.
  if (isWorkspaceOrAbove(effectiveRole)) return children;

  if (!isModuleLicensed(license, moduleCode)) {
    const reason = moduleDenialReason(license, moduleCode);
    return <Navigate to="/licensing" replace state={{ reason, module: moduleCode }} />;
  }

  return children;
}
