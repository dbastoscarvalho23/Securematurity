import { useQuery } from '@tanstack/react-query';
import { invokeFn } from '@/lib/invokeFn';

/**
 * Utilizadores de um cliente (para escolher responsáveis). Passa pela função «listUsers», porque as regras de acesso
 * não deixam ler a entidade User diretamente a quem não é administrador da plataforma.
 */
export function useCustomerUsers(customerId) {
  const { data: users = [] } = useQuery({
    queryKey: ['users-for-customer', customerId],
    queryFn: async () => {
      const r = await invokeFn('listUsers', { customer_id: customerId });
      return (r.users || []).filter((u) => (u.customer_id || u.data?.customer_id) === customerId);
    },
    enabled: !!customerId,
    staleTime: 60 * 1000,
  });
  return users;
}
