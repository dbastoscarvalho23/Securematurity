import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useLicenseCatalog() {
  const modules = useQuery({ queryKey: ['lic-modules'], queryFn: () => base44.entities.LicenseModule.list('display_order', 200) });
  const tiers = useQuery({ queryKey: ['lic-tiers'], queryFn: () => base44.entities.LicenseTier.list('display_order', 100) });
  const standards = useQuery({ queryKey: ['lic-standards'], queryFn: () => base44.entities.LicenseStandard.list('code', 200) });
  const entitlements = useQuery({ queryKey: ['lic-entitlements'], queryFn: () => base44.entities.LicenseEntitlement.list('module_code', 500) });
  const moduleNames = Object.fromEntries((modules.data || []).map((m) => [m.code, m.name]));
  return {
    modules: modules.data || [], tiers: tiers.data || [], standards: standards.data || [], entitlements: entitlements.data || [],
    moduleNames, loading: modules.isLoading || tiers.isLoading,
  };
}

export const LIC_KEYS = ['lic-modules', 'lic-tiers', 'lic-standards', 'lic-entitlements', 'lic-subs', 'lic-tenant-modules', 'lic-log', 'lic-certs', 'license-me'];
