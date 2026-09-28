import React, { Suspense, lazy } from 'react';
import { useEffectiveRole } from '@/lib/RoleSimulationContext';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

// Lazy-load dashboard variants for code-splitting
const PlatformAdminDashboard = lazy(() => import('@/components/dashboard/PlatformAdminDashboard'));
const PartnerDashboard = lazy(() => import('@/components/dashboard/PartnerDashboard'));
const PlatformTenantDashboard = lazy(() => import('@/components/dashboard/PlatformTenantDashboard'));
const ExecutiveDashboard = lazy(() => import('@/components/dashboard/ExecutiveDashboard'));
const EmployeeDashboard = lazy(() => import('@/components/dashboard/EmployeeDashboard'));

function DashboardFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-pulse text-muted-foreground">Loading dashboard…</div>
    </div>
  );
}

export default function Dashboard() {
  const effectiveRole = useEffectiveRole();

  // Choose dashboard component based on effective role (not real role)
  // so that role simulation works correctly.
  let DashboardComponent;
  let readOnly = false;

  switch (effectiveRole) {
    case 'master_admin':
      DashboardComponent = PlatformAdminDashboard;
      break;
    case 'workspace_admin':
    case 'partner_admin':
      DashboardComponent = PartnerDashboard;
      break;
    case 'customer_admin':
    case 'grc_analyst':
    case 'control_owner':
      DashboardComponent = PlatformTenantDashboard;
      break;
    case 'executive':
      DashboardComponent = ExecutiveDashboard;
      readOnly = true;
      break;
    case 'auditor':
      DashboardComponent = PlatformTenantDashboard;
      readOnly = true;
      break;
    case 'employee':
      DashboardComponent = EmployeeDashboard;
      break;
    default:
      // Legacy admin/user roles → tenant dashboard
      DashboardComponent = PlatformTenantDashboard;
      break;
  }

  return (
    <ErrorBoundary fallback={<DashboardFallback />}>
      <Suspense fallback={<DashboardFallback />}>
        <DashboardComponent readOnly={readOnly} />
      </Suspense>
    </ErrorBoundary>
  );
}
