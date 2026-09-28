/**
 * Contexto único de tenant — hook React.
 *
 * A regra vive em `tenantResolver.js` (puro); aqui só se reúne o que ela precisa
 * — a sessão, a árvore de workspaces e as delegações do utilizador — e expõe-se
 * o resultado às páginas. Nenhuma página volta a resolver o tenant por si.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  accessibleCustomerIds,
  activeDelegatedCustomerIds,
  resolveActiveCustomerId,
  selectedWorkspaceIdOf,
  userEmailOf,
  userIdOf,
  userWorkspaceIdOf,
} from '@/lib/tenantResolver';

export * from '@/lib/tenantResolver';

/**
 * O contexto de tenant da sessão actual. Único ponto de leitura para as páginas.
 */
export function useActiveCustomer() {
  const { user } = useAuth();
  const userId = userIdOf(user);
  const email = userEmailOf(user);

  const { data: workspaces = [] } = useQuery({
    queryKey: ['tenant-context-workspaces'],
    queryFn: async () => {
      try {
        return (await base44.entities.Workspace.list()) || [];
      } catch (error) {
        console.error('Failed to load workspaces for the tenant context:', error);
        return [];
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: assignments = [], isSuccess: assignmentsLoaded } = useQuery({
    queryKey: ['tenant-context-assignments', email],
    queryFn: async () => {
      try {
        return (await base44.entities.UserCustomerAssignment.filter({ user_email: email })) || [];
      } catch (error) {
        console.error('Failed to load delegations for the tenant context:', error);
        return [];
      }
    },
    enabled: !!email,
    staleTime: 60 * 1000,
  });

  const delegatedCustomerIds = useMemo(() => {
    const fromRecord = [
      ...(user?.delegated_view_customer_ids || []),
      ...(user?.delegated_edit_customer_ids || []),
    ];
    const fromAssignments = activeDelegatedCustomerIds(assignments, { userId, email });
    return Array.from(new Set([...fromRecord, ...fromAssignments]));
  }, [
    assignments,
    userId,
    email,
    user?.delegated_view_customer_ids,
    user?.delegated_edit_customer_ids,
  ]);

  const customerId = useMemo(
    () =>
      resolveActiveCustomerId({
        user,
        workspaces,
        delegatedCustomerIds,
        selectedWorkspaceId: selectedWorkspaceIdOf(user),
      }),
    [user, workspaces, delegatedCustomerIds],
  );

  const customerIds = useMemo(
    () => accessibleCustomerIds({ user, workspaces, delegatedCustomerIds }),
    [user, workspaces, delegatedCustomerIds],
  );

  return {
    customerId,
    customerIds,
    delegatedCustomerIds,
    workspaceId: selectedWorkspaceIdOf(user) || userWorkspaceIdOf(user),
    // Só é possível afirmar que ainda não há contexto enquanto as delegações não
    // chegaram: um utilizador sem cliente próprio pode ganhar contexto por
    // delegação, e as páginas não devem concluir "sem dados" antes disso.
    isResolving: !!email && !assignmentsLoaded,
  };
}
