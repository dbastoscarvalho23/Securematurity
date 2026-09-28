/**
 * React Query hook for fetching and caching the effective license
 * for the current tenant.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchEffectiveLicense } from '@/lib/license';
import { useAuth } from '@/lib/AuthContext';

export function useLicense() {
  const { user } = useAuth();
  const customerId = user?.data?.customer_id || user?.customer_id;

  return useQuery({
    queryKey: ['effectiveLicense', customerId],
    queryFn: () => fetchEffectiveLicense(customerId),
    enabled: !!customerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}
