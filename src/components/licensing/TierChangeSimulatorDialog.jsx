import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, GitCompareArrows, Info, Loader2 } from 'lucide-react';
import ErrorState from '@/components/shared/ErrorState';
import { addonLabel, formatMoney } from '@/lib/commercialOffer';
import { LIFECYCLE_TIER_LABEL_KEYS } from '@/lib/commercialLifecycle';

/**
 * Simulador «o que muda se…» (OP-M5).
 *
 * Compõe o que `change_tier` e `set_addon` fariam — nível alvo, packs, módulos
 * que entram e saem, retiradas exigidas pelo novo nível, quotas e valor mensal
 * resultantes — e mostra o antes/depois **sem escrever nada**. Nada aqui calcula
 * preços nem retiradas: quem compõe é a função (`simulate_change`), a mesma
 * matéria-prima das duas acções de escrita, para que a pré-visualização não
 * possa divergir do que a operação aplica.
 */
const NO_ADDON = '__none__';

/** Linha do antes/depois. */
function CompareRow({ label, before, after, emphasis = false }) {
  return (
    <TableRow>
      <TableCell className="text-xs text-muted-foreground">{label}</TableCell>
      <TableCell className="text-sm tabular-nums">{before}</TableCell>
      <TableCell className={`text-sm tabular-nums ${emphasis ? 'font-medium' : ''}`}>{after}</TableCell>
    </TableRow>
  );
}

export default function TierChangeSimulatorDialog({ tenant, tiers, packs, modules, onClose }) {
  const { t } = useLanguage();
  const currentTier = tenant?.subscription?.tier_code || 'core';
  const [tierCode, setTierCode] = useState(currentTier);
  const [addonCode, setAddonCode] = useState(NO_ADDON);
  const [addonActive, setAddonActive] = useState(true);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['license-simulation', tenant?.id, tierCode, addonCode, addonActive],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const result = await base44.functions.invoke('provisionTenantLicense', {
        action: 'simulate_change',
        customer_id: tenant.id,
        tier_code: tierCode,
        ...(addonCode === NO_ADDON ? {} : { addon_code: addonCode, addon_active: addonActive }),
      });
      return result?.data || result;
    },
  });

  const moduleName = (code) => modules.find((module) => module.code === code)?.name || code;
  const tierLabel = (code) => t(LIFECYCLE_TIER_LABEL_KEYS[code]) || code;
  const addonText = (rows) => (rows.length === 0
    ? t('licensing_simulate_no_addons')
    : rows.map((row) => addonLabel(row.addon_code, t)).join(' · '));

  const money = (cents) => (cents === null || cents === undefined
    ? t('licensing_simulate_no_price')
    : formatMoney(cents, data?.currency || 'EUR'));

  const delta = data?.changes?.monthly_delta_cents;
  const deltaText = delta === null || delta === undefined
    ? '—'
    : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatMoney(Math.abs(delta), data?.currency || 'EUR')}`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompareArrows className="w-4 h-4" />
            {t('licensing_simulate_title')}
          </DialogTitle>
          <DialogDescription>{tenant?.name}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{t('licensing_simulate_tier')}</Label>
            <Select value={tierCode} onValueChange={setTierCode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {tiers.map((tier) => (
                  <SelectItem key={tier.code} value={tier.code}>{tierLabel(tier.code)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('licensing_simulate_addon')}</Label>
            <Select value={addonCode} onValueChange={setAddonCode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ADDON}>{t('licensing_simulate_addon_none')}</SelectItem>
                {packs.map((pack) => (
                  <SelectItem key={pack.code} value={pack.code}>{addonLabel(pack.code, t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('licensing_simulate_addon_state')}</Label>
            <Select
              value={addonActive ? 'active' : 'inactive'}
              onValueChange={(value) => setAddonActive(value === 'active')}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t('licensing_simulate_addon_grant')}</SelectItem>
                <SelectItem value="inactive">{t('licensing_simulate_addon_revoke')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isError ? (
          <ErrorState variant="inline" onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> {t('licensing_simulate_loading')}
          </div>
        ) : !data ? null : (
          <div className="space-y-4">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[38%]">{t('licensing_simulate_col_field')}</TableHead>
                    <TableHead>{t('licensing_simulate_col_now')}</TableHead>
                    <TableHead>{t('licensing_simulate_col_after')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <CompareRow
                    label={t('licensing_simulate_row_tier')}
                    before={tierLabel(data.current.tier_code)}
                    after={tierLabel(data.target.tier_code)}
                    emphasis
                  />
                  <CompareRow
                    label={t('licensing_simulate_row_seats_included')}
                    before={data.current.included_seats ?? '—'}
                    after={data.target.included_seats ?? '—'}
                  />
                  <CompareRow
                    label={t('licensing_simulate_row_ai_quota')}
                    before={data.current.ai_quota_monthly ?? '—'}
                    after={data.target.ai_quota_default ?? '—'}
                  />
                  <CompareRow
                    label={t('licensing_simulate_row_addons')}
                    before={addonText(data.current.addons)}
                    after={addonText(data.target.addons)}
                  />
                  <CompareRow
                    label={t('licensing_simulate_row_modules')}
                    before={data.current.module_count}
                    after={data.target.module_count}
                  />
                  <CompareRow
                    label={t('licensing_simulate_row_price')}
                    before={money(data.current.monthly_cents)}
                    after={`${money(data.target.monthly_cents)} · ${deltaText}`}
                    emphasis
                  />
                </TableBody>
              </Table>
            </div>

            {/* O valor por omissão da quota sobe ao valor em uso quando o incluído
                do novo nível fica aquém — o acesso não depende disto (OP-M1). */}
            {data.target.quota_elevated_from !== null && (
              <div className="flex items-start gap-2 rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-xs text-status-warning">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  {t('licensing_simulate_seat_elevation')
                    .replace('{from}', String(data.target.quota_elevated_from))
                    .replace('{to}', String(data.target.seats_used))}
                </span>
              </div>
            )}

            {data.blockers.length > 0 && (
              <div className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <p className="font-medium">{t('licensing_simulate_blockers')}</p>
                {data.blockers.map((blocker) => (
                  <p key={blocker.code}>
                    {blocker.code === 'removals_required'
                      ? t('licensing_simulate_blocker_removals')
                      : t('licensing_simulate_blocker_addon_not_for_sale')
                          .replace('{pack}', addonLabel(blocker.addon_code, t))}
                  </p>
                ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('licensing_simulate_gained')}</p>
                <div className="flex flex-wrap gap-1">
                  {data.changes.modules_gained.map((code) => (
                    <Badge key={code} className="text-[10px] font-normal bg-status-success/10 text-status-success">
                      {moduleName(code)}
                    </Badge>
                  ))}
                  {data.changes.modules_gained.length === 0 && (
                    <span className="text-xs text-muted-foreground">{t('licensing_simulate_none')}</span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('licensing_simulate_lost')}</p>
                <div className="flex flex-wrap gap-1">
                  {data.changes.modules_lost.map((code) => (
                    <Badge key={code} variant="outline" className="text-[10px] font-normal text-destructive border-destructive/30">
                      {moduleName(code)}
                    </Badge>
                  ))}
                  {data.changes.modules_lost.length === 0 && (
                    <span className="text-xs text-muted-foreground">{t('licensing_simulate_none')}</span>
                  )}
                </div>
                {data.removals.standards.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t('licensing_simulate_standards_lost').replace('{n}', String(data.removals.standards.length))}
                  </p>
                )}
                {(data.removals.modules.length > 0 || data.removals.standards.length > 0) && (
                  <p className="text-xs text-muted-foreground">
                    {t('licensing_simulate_removals_note')}
                  </p>
                )}
              </div>
            </div>

            {!data.changed && (
              <p className="text-xs text-muted-foreground">{t('licensing_simulate_no_change')}</p>
            )}

            <div className="flex items-start gap-2 rounded-lg border p-3 text-xs text-muted-foreground">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{t('licensing_simulate_nothing_written')}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common_close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
