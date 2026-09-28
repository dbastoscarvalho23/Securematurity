import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Layers, Package, Check, Minus, Info } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import EmptyState from '@/components/shared/EmptyState';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { canView } from '@/lib/rbac';
import {
  MODULE_CODES,
  MODULE_META,
  TIER_MODULES,
  COMMERCIALLY_AVAILABLE_TIERS,
  LEGACY_TIER_ALIASES,
} from '@/lib/licenseModules';

/** Ordem de apresentação dos três tiers comerciais (cumulativos). */
const TIER_ORDER = ['core', 'professional', 'advanced'];

const TIER_LABEL_KEYS = {
  core: 'license_tier_core',
  professional: 'license_tier_professional',
  advanced: 'license_tier_advanced',
};

const STATUS_VARIANTS = {
  active: 'default',
  trial: 'secondary',
  suspended: 'destructive',
  expired: 'outline',
  cancelled: 'outline',
};

/** Primeiro tier (na ordem comercial) que inclui o módulo; null se está fora da oferta. */
function minimumTierForModule(moduleCode) {
  return TIER_ORDER.find((tier) => (TIER_MODULES[tier] || []).includes(moduleCode)) || null;
}

export default function Licensing() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const allowed = canView(user?.role, 'licensing');

  const { data: tiers = [] } = useQuery({
    queryKey: ['license-tiers'],
    queryFn: () => base44.entities.LicenseTier.list('display_order', 50),
    enabled: allowed,
  });

  const { data: modules = [] } = useQuery({
    queryKey: ['license-modules'],
    queryFn: () => base44.entities.LicenseModule.list('display_order', 100),
    enabled: allowed,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['tenant-subscriptions'],
    queryFn: () => base44.entities.TenantSubscription.list('-created_date', 500),
    enabled: allowed,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['licensing-customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: allowed,
  });

  const { data: standards = [] } = useQuery({
    queryKey: ['license-standards'],
    queryFn: () => base44.entities.LicenseStandard.list('code', 50),
    enabled: allowed,
  });

  if (!allowed) {
    return <EmptyState icon={ShieldCheck} title={t('common_no_permission')} className="h-64" />;
  }

  const moduleMap = new Map(modules.map((m) => [m.code, m]));
  const moduleName = (code) => moduleMap.get(code)?.name || MODULE_META[code]?.name || code;

  const tierCatalogue = TIER_ORDER.map((code) => {
    const row = tiers.find((tier) => tier.code === code);
    return {
      code,
      name: row?.name || t(TIER_LABEL_KEYS[code]),
      description: row?.description || '',
      commerciallyAvailable: row?.commercially_available
        ?? COMMERCIALLY_AVAILABLE_TIERS.includes(code),
      modules: TIER_MODULES[code] || [],
    };
  });

  const modulesInOffering = MODULE_CODES.filter((code) => minimumTierForModule(code));
  const modulesOutsideOffering = MODULE_CODES.filter((code) => !minimumTierForModule(code));
  const activeSubscriptions = subscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trial',
  );

  const customerName = (id) =>
    customers.find((c) => c.id === id)?.name || id || '—';

  /** Legacy tier codes (e.g. "partner") resolve to their commercial tier label. */
  const tierLabel = (code) => {
    const resolved = LEGACY_TIER_ALIASES[code] || code;
    return t(TIER_LABEL_KEYS[resolved]) || code;
  };

  return (
    <div className="space-y-6">
      <PageHeader description={t('licensing_subtitle')} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('licensing_stat_tiers')}
          value={tierCatalogue.filter((tier) => tier.commerciallyAvailable).length}
          subtitle={`${tierCatalogue.length} ${t('licensing_stat_tiers_total')}`}
          icon={Layers}
        />
        <StatCard
          title={t('licensing_stat_modules')}
          value={modulesInOffering.length}
          icon={Package}
        />
        <StatCard
          title={t('licensing_stat_outside')}
          value={modulesOutsideOffering.length}
          icon={Minus}
        />
        <StatCard
          title={t('licensing_stat_subscriptions')}
          value={activeSubscriptions.length}
          subtitle={`${subscriptions.length} ${t('licensing_stat_subscriptions_total')}`}
          icon={ShieldCheck}
        />
      </div>

      {/* Catálogo comercial */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('licensing_catalogue')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{t('licensing_launch_note')}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tierCatalogue.map((tier) => (
              <div key={tier.code} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{tier.name}</p>
                    {tier.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{tier.description}</p>
                    )}
                  </div>
                  <Badge
                    variant={tier.commerciallyAvailable ? 'default' : 'outline'}
                    className="text-xs flex-shrink-0"
                  >
                    {tier.commerciallyAvailable
                      ? t('licensing_badge_available')
                      : t('licensing_badge_prepared')}
                  </Badge>
                </div>
                <ul className="space-y-1.5">
                  {tier.modules.map((code) => (
                    <li key={code} className="flex items-center gap-2 text-sm">
                      <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <span>{moduleName(code)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  {tier.modules.length} {t('licensing_modules_count')}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Subscrições por cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('licensing_subscriptions')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('licensing_col_customer')}</TableHead>
                <TableHead>{t('licensing_col_tier')}</TableHead>
                <TableHead>{t('licensing_col_status')}</TableHead>
                <TableHead>{t('licensing_col_seats')}</TableHead>
                <TableHead>{t('licensing_col_expiry')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">
                    {sub.customer_name || customerName(sub.customer_id)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {tierLabel(sub.tier_code)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[sub.status] || 'outline'} className="text-xs">
                      {t(`license_status_${sub.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {sub.seats_used ?? 0} / {sub.seat_limit ?? 0}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {sub.expires_date || sub.trial_ends_at?.slice(0, 10) || '—'}
                  </TableCell>
                </TableRow>
              ))}
              {subscriptions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {t('licensing_no_subscriptions')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Catálogo de módulos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('licensing_modules_catalogue')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('licensing_col_module')}</TableHead>
                <TableHead>{t('licensing_col_min_tier')}</TableHead>
                <TableHead className="w-24 text-right">{t('licensing_col_state')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULE_CODES.map((code) => {
                const minTier = minimumTierForModule(code);
                const active = moduleMap.get(code)?.is_active !== false;
                return (
                  <TableRow key={code}>
                    <TableCell className="font-medium">
                      {moduleName(code)}
                      {MODULE_META[code]?.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {MODULE_META[code].description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {minTier ? (
                        <Badge variant="outline" className="text-xs">
                          {t(TIER_LABEL_KEYS[minTier])}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t('licensing_outside_offering')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {minTier && active ? (
                        <span className="text-xs text-primary">{t('common_active')}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t('common_inactive')}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Normas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('licensing_standards')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {standards.map((standard) => (
              <Badge key={standard.id || standard.code} variant="outline" className="text-sm py-1.5 px-3">
                {standard.name || standard.code}
              </Badge>
            ))}
            {standards.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('common_no_data')}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
