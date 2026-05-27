import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Returns the list of users belonging to a given customer.
 * Falls back to an empty array while loading or when no customerId is provided.
 */
export function useCustomerUsers(customerId) {
  const { data: users = [] } = useQuery({
    queryKey: ['users-for-customer', customerId],
    queryFn: () => base44.entities.User.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });
  return users;
}