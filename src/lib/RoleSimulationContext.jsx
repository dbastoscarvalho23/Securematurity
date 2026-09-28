/**
 * Role Simulation Context
 *
 * Allows a real master_admin to preview the platform from any of the
 * 8 roles' perspectives. View-only: does not change the real session,
 * does not call adminImpersonateUser, does not grant backend permissions.
 * Only re-renders Sidebar, Dashboard, and RouteGuard with the simulated
 * role, and blocks write actions in the UI.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { normalizeRole } from './rbac';

const SESSION_KEY = 'ankora_simulated_role';

const RoleSimulationContext = createContext();

export const RoleSimulationProvider = ({ children }) => {
  const { user } = useAuth();
  const [simulatedRole, setSimulatedRoleState] = useState(null);

  // Restore simulated role from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) setSimulatedRoleState(stored);
    } catch {}
  }, []);

  // Security guard: if the real role is no longer master_admin, clear stale simulation
  useEffect(() => {
    const realRole = normalizeRole(user?.role);
    if (simulatedRole && realRole !== 'master_admin') {
      setSimulatedRoleState(null);
      try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    }
  }, [user?.role, simulatedRole]);

  const setSimulatedRole = useCallback((role) => {
    setSimulatedRoleState(role);
    try {
      if (role) sessionStorage.setItem(SESSION_KEY, role);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {}
  }, []);

  const clearSimulation = useCallback(() => {
    setSimulatedRoleState(null);
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  }, []);

  const value = {
    simulatedRole,
    setSimulatedRole,
    clearSimulation,
    isSimulating: simulatedRole !== null,
    effectiveRole: simulatedRole ?? normalizeRole(user?.role),
  };

  return (
    <RoleSimulationContext.Provider value={value}>
      {children}
    </RoleSimulationContext.Provider>
  );
};

export const useRoleSimulation = () => {
  const ctx = useContext(RoleSimulationContext);
  if (!ctx) throw new Error('useRoleSimulation must be used within RoleSimulationProvider');
  return ctx;
};

/**
 * Returns the effective role: simulated role if active, otherwise the
 * normalized real role. Use everywhere that previously read
 * normalizeRole(user.role) for UI decisions.
 */
export const useEffectiveRole = () => {
  const { effectiveRole } = useRoleSimulation();
  return effectiveRole;
};

/**
 * Returns true if a role simulation is currently active.
 */
export const useIsSimulating = () => {
  const { isSimulating } = useRoleSimulation();
  return isSimulating;
};
