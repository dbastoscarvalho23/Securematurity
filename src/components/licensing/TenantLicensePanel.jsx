import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, GitCompareArrows, Loader2, Package, ShieldPlus, SlidersHorizontal, PauseCircle, PlayCircle, ListChecks } from 'lucide-react';
import { addonLabel, formatMoney } from '@/lib/commercialOffer';
import TierChangeSimulatorDialog from '@/components/licensing/TierChangeSimulatorDialog';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';

/**
 * Provisionamento de licenças por cliente (FB1).
 *
 * Antes deste painel não havia forma de atribuir uma licença pela plataforma:
 * com o gating fail-closed, um cliente novo ficava com todos os módulos fechados
 * e abrir a operação exigia funções internas. Aqui o master_admin (e o
 * administrador de parceiro, dentro da sua carteira) cria a subscrição, escolhe
 * o nível, os lugares, a validade e as notas, concede excepções por módulo com
 * motivo e validade, atribui standards e suspende com tolerância.
 *
 * Toda a escrita passa por `provisionTenantLicense` — nenhuma entidade de
 * licenciamento é escrita pelo frontend — e a leitura por `listTenantLicenses`,
 * que resolve o âmbito no servidor. Cada operação fica no histórico
 * (`listLicenseChanges`), que o cartão seguinte mostra.
 */
const TIER_LABEL_KEYS = {
  core: 'license_tier_core',
  professional: 'license_tier_professional',
  advanced: 'license_tier_advanced',
};

const STATUS_LABEL_KEYS = {
  active: 'license_status_active',
  trial: 'license_status_trial',
  suspended: 'license_status_suspended',
  expired: 'license_status_expired',
  cancelled: 'license_status_cancelled',
  none: 'licensing_status_none',
};

export default function TenantLicensePanel() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({});
  const [simulator, setSimulator] = useState(null);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-licenses'],
    queryFn: async () => {
      const result = await base44.functions.invoke('listTenantLicenses', {});
      return result?.data || result;
    },
  });

  const tenants = data?.tenants || [];
  const tiers = data?.catalogue?.tiers || [];
  const modules = data?.catalogue?.modules || [];
  const standards = data?.catalogue?.standards || [];
  const packs = data?.catalogue?.addons || [];
  // Só se contrata o que a oferta em vigor põe à venda (`for_sale`): os restantes
  // packs existem no catálogo de código mas não estão comercializados.
  const sellablePacks = packs.filter((pack) => pack.for_sale);

  const mutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('provisionTenantLicense', payload),
    onSuccess: (result) => {
      const license = result?.data?.license || result?.license;
      queryClient.invalidateQueries({ queryKey: ['tenant-licenses'] });
      queryClient.invalidateQueries({ queryKey: ['license-changes'] });
      setDialog(null);
      setError('');
      toast.success(
        license?.licensed
          ? t('licensing_provision_saved_active').replace('{tier}', license.tier_code || '—')
          : t('licensing_provision_saved_closed'),
      );
    },
    onError: (err) => {
      const message = err?.response?.data?.error || err?.data?.error || err?.message;
      setError(message || t('licensing_provision_error'));
    },
  });

  const openDialog = (kind, tenant) => {
    setError('');
    setForm({
      tenant,
      tier_code: tenant.subscription?.tier_code || 'core',
      seat_limit: tenant.subscription?.seat_limit || 5,
      expires_date: tenant.subscription?.expires_date || '',
      notes: tenant.subscription?.notes || '',
      grace_days: 7,
      reason: '',
      module_code: modules[0]?.code || '',
      standard_code: standards[0]?.code || '',
      standard_active: true,
      expires_at: '',
      addon_code: sellablePacks[0]?.code || '',
      addon_active: true,
    });
    setDialog(kind);
  };

  const submit = () => {
    const customer_id = form.tenant.id;
    const payloads = {
      create: { action: 'create', customer_id, tier_code: form.tier_code, seat_limit: Number(form.seat_limit) },
      update: {
        action: 'update',
        customer_id,
        tier_code: form.tier_code,
        seat_limit: Number(form.seat_limit),
        expires_date: form.expires_date || null,
        notes: form.notes,
        reason: form.reason,
      },
      suspend: { action: 'suspend', customer_id, grace_days: Number(form.grace_days), reason: form.reason },
      resume: { action: 'resume', customer_id },
      override: {
        action: 'set_module',
        customer_id,
        module_code: form.module_code,
        active: true,
        reason: form.reason,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      },
      standard: {
        action: 'set_standard',
        customer_id,
        standard_code: form.standard_code,
        active: form.standard_active,
        reason: form.reason,
      },
      addon: {
        action: 'set_addon',
        customer_id,
        addon_code: form.addon_code,
        active: form.addon_active,
        reason: form.reason,
      },
    };
    mutation.mutate(payloads[dialog]);
  };

  // Packs do diálogo: os que a oferta em vigor vende, mais os que este cliente já
  // tem contratado — um pack que saiu da oferta continua a poder ser retirado.
  const contractedAddonCodes = new Set((form.tenant?.addons || []).map((addon) => addon.addon_code));
  const addonChoices = packs.filter((pack) => pack.for_sale || contractedAddonCodes.has(pack.code));

  if (isLoading) {
    return <Card><CardContent className="p-0"><LoadingState label={t('licensing_provision_loading')} className="py-12" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldPlus className="w-4 h-4" />
          {t('licensing_provision_title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('licensing_provision_subtitle')}</p>
      </CardHeader>
      <CardContent className="p-0">
        {tenants.length === 0 ? (
          <EmptyState icon={ShieldPlus} title={t('licensing_provision_no_tenants')} description={t('licensing_provision_no_tenants_desc')} className="py-12" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('licensing_col_customer')}</TableHead>
                <TableHead>{t('licensing_col_tier')}</TableHead>
                <TableHead>{t('licensing_col_status')}</TableHead>
                <TableHead>{t('licensing_col_seats')}</TableHead>
                <TableHead>{t('licensing_provision_col_modules')}</TableHead>
                <TableHead>{t('licensing_standards')}</TableHead>
                <TableHead className="text-right">{t('licensing_provision_col_actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => {
                const license = tenant.license || {};
                const suspended = tenant.subscription?.status === 'suspended';
                return (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>
                      {tenant.subscription ? (
                        <Badge variant="outline" className="text-xs">
                          {t(TIER_LABEL_KEYS[tenant.subscription.tier_code]) || tenant.subscription.tier_code}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t('licensing_provision_no_subscription')}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant={license.status === 'active' ? 'default' : license.status === 'none' ? 'outline' : 'secondary'}
                          className="text-xs w-fit"
                        >
                          {t(STATUS_LABEL_KEYS[license.status]) || license.status}
                        </Badge>
                        {license.warning === 'suspension_grace' && (
                          <span className="text-[11px] text-destructive flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t('licensing_provision_grace_warning').replace('{date}', String(license.grace_until || '').slice(0, 10))}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {tenant.subscription ? `${license.seats_used ?? 0}/${license.seat_limit ?? 0}` : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {(license.module_codes || []).map((code) => (
                          <Badge key={code} variant="secondary" className="text-[10px] font-normal">
                            {modules.find((m) => m.code === code)?.name || code}
                          </Badge>
                        ))}
                        {(license.module_codes || []).length === 0 && (
                          <span className="text-xs text-muted-foreground">{t('licensing_provision_no_modules')}</span>
                        )}
                        {(tenant.addons || []).map((addon) => (
                          <Badge
                            key={`ad-${addon.addon_code}`}
                            variant="outline"
                            className={`text-[10px] font-normal ${addon.status === 'active' ? 'border-primary/40 text-primary' : 'text-muted-foreground'}`}
                          >
                            {addonLabel(addon.addon_code, t)}
                            {addon.status === 'active' && addon.amount_cents ? ` · ${formatMoney(addon.amount_cents)}` : ''}
                          </Badge>
                        ))}
                        {(tenant.addons || []).length === 0 && tenant.subscription && (
                          <span className="text-[10px] text-muted-foreground">{t('licensing_provision_addon_none')}</span>
                        )}
                        {(tenant.overrides || [])
                          .filter((o) => o.reason)
                          .map((o) => (
                            <Badge key={`ov-${o.module_code}`} variant="outline" className="text-[10px] font-normal">
                              {o.module_code}: {o.reason}
                              {o.expires_at ? ` · ${String(o.expires_at).slice(0, 10)}` : ''}
                            </Badge>
                          ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(license.standards || []).map((code) => (
                          <Badge key={code} variant="outline" className="text-[10px] font-normal">
                            {standards.find((s) => s.code === code)?.name || code}
                          </Badge>
                        ))}
                        {(license.standards || []).length === 0 && (
                          <span className="text-xs text-muted-foreground">{t('licensing_provision_no_standards')}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {!tenant.subscription && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openDialog('create', tenant)}>
                            {t('licensing_provision_create')}
                          </Button>
                        )}
                        {tenant.subscription && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openDialog('update', tenant)}>
                            <SlidersHorizontal className="w-3 h-3" /> {t('licensing_provision_change')}
                          </Button>
                        )}
                        {tenant.subscription && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openDialog('standard', tenant)}>
                            <ListChecks className="w-3 h-3" /> {t('licensing_provision_standards')}
                          </Button>
                        )}
                        {tenant.subscription && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setSimulator(tenant)}>
                            <GitCompareArrows className="w-3 h-3" /> {t('licensing_simulate')}
                          </Button>
                        )}
                        {tenant.subscription && (sellablePacks.length > 0 || (tenant.addons || []).length > 0) && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openDialog('addon', tenant)}>
                            <Package className="w-3 h-3" /> {t('licensing_provision_addon')}
                          </Button>
                        )}
                        {tenant.subscription && !suspended && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openDialog('suspend', tenant)}>
                            <PauseCircle className="w-3 h-3" /> {t('licensing_provision_suspend')}
                          </Button>
                        )}
                        {tenant.subscription && suspended && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openDialog('resume', tenant)} disabled={mutation.isPending}>
                            <PlayCircle className="w-3 h-3" /> {t('licensing_provision_resume')}
                          </Button>
                        )}
                        {tenant.subscription && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openDialog('override', tenant)}>
                            {t('licensing_provision_override')}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {simulator && (
        <TierChangeSimulatorDialog
          tenant={simulator}
          tiers={tiers}
          // A simulação oferece o que a oferta vende, mais o que o cliente já tem
          // contratado: um pack fora da oferta continua a poder ser retirado.
          packs={packs.filter(
            (pack) => pack.for_sale || (simulator.addons || []).some((addon) => addon.addon_code === pack.code),
          )}
          modules={modules}
          onClose={() => setSimulator(null)}
        />
      )}

      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(`licensing_provision_dialog_${dialog || 'create'}_title`)}</DialogTitle>
            <DialogDescription>{form.tenant?.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {(dialog === 'create' || dialog === 'update') && (
              <>
                <div className="space-y-2">
                  <Label>{t('licensing_col_tier')}</Label>
                  <Select value={form.tier_code} onValueChange={(value) => setForm((f) => ({ ...f, tier_code: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tiers.map((tier) => (
                        <SelectItem key={tier.code} value={tier.code}>
                          {t(TIER_LABEL_KEYS[tier.code]) || tier.code} · {tier.modules.length} {t('licensing_modules_count')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('license_seats')}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.seat_limit}
                    onChange={(event) => setForm((f) => ({ ...f, seat_limit: event.target.value }))}
                  />
                </div>
              </>
            )}

            {dialog === 'update' && (
              <>
                <div className="space-y-2">
                  <Label>{t('licensing_col_expiry')}</Label>
                  <Input
                    type="date"
                    value={form.expires_date}
                    onChange={(event) => setForm((f) => ({ ...f, expires_date: event.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">{t('licensing_provision_expiry_help')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('licensing_provision_notes')}</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(event) => setForm((f) => ({ ...f, notes: event.target.value }))}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('licensing_provision_reason')}</Label>
                  <Textarea
                    value={form.reason}
                    onChange={(event) => setForm((f) => ({ ...f, reason: event.target.value }))}
                    rows={2}
                  />
                </div>
              </>
            )}

            {dialog === 'standard' && (
              <>
                <div className="space-y-2">
                  <Label>{t('licensing_provision_standard')}</Label>
                  <Select value={form.standard_code} onValueChange={(value) => setForm((f) => ({ ...f, standard_code: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {standards.map((standard) => (
                        <SelectItem key={standard.code} value={standard.code}>{standard.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('licensing_provision_standard_state')}</Label>
                  <Select
                    value={form.standard_active ? 'active' : 'inactive'}
                    onValueChange={(value) => setForm((f) => ({ ...f, standard_active: value === 'active' }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t('licensing_provision_standard_grant')}</SelectItem>
                      <SelectItem value="inactive">{t('licensing_provision_standard_revoke')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('licensing_provision_reason')}</Label>
                  <Textarea
                    value={form.reason}
                    onChange={(event) => setForm((f) => ({ ...f, reason: event.target.value }))}
                    rows={2}
                  />
                </div>
              </>
            )}

            {dialog === 'suspend' && (
              <>
                <div className="space-y-2">
                  <Label>{t('licensing_provision_grace_days')}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.grace_days}
                    onChange={(event) => setForm((f) => ({ ...f, grace_days: event.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">{t('licensing_provision_grace_help')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('licensing_provision_reason')}</Label>
                  <Textarea
                    value={form.reason}
                    onChange={(event) => setForm((f) => ({ ...f, reason: event.target.value }))}
                    rows={2}
                  />
                </div>
              </>
            )}

            {dialog === 'override' && (
              <>
                <div className="space-y-2">
                  <Label>{t('licensing_col_module')}</Label>
                  <Select value={form.module_code} onValueChange={(value) => setForm((f) => ({ ...f, module_code: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {modules.map((module) => (
                        <SelectItem key={module.code} value={module.code}>{module.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('licensing_provision_override_expires')}</Label>
                  <Input
                    type="date"
                    value={form.expires_at}
                    onChange={(event) => setForm((f) => ({ ...f, expires_at: event.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">{t('licensing_provision_override_help')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('licensing_provision_reason')}</Label>
                  <Textarea
                    value={form.reason}
                    onChange={(event) => setForm((f) => ({ ...f, reason: event.target.value }))}
                    rows={2}
                  />
                </div>
              </>
            )}

            {dialog === 'addon' && (
              <>
                <div className="space-y-2">
                  <Label>{t('licensing_provision_addon_pack')}</Label>
                  <Select value={form.addon_code} onValueChange={(value) => setForm((f) => ({ ...f, addon_code: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {addonChoices.map((pack) => (
                        <SelectItem key={pack.code} value={pack.code}>
                          {addonLabel(pack.code, t)} · {(pack.modules || []).map((module) => module.name).join(' · ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('licensing_provision_addon_help')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('licensing_provision_addon_state')}</Label>
                  <Select
                    value={form.addon_active ? 'active' : 'inactive'}
                    onValueChange={(value) => setForm((f) => ({ ...f, addon_active: value === 'active' }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t('licensing_provision_addon_grant')}</SelectItem>
                      <SelectItem value="inactive">{t('licensing_provision_addon_revoke')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(form.tenant?.addons || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(form.tenant.addons || []).map((addon) => (
                      <Badge key={addon.addon_code} variant="outline" className="text-[10px] font-normal">
                        {addonLabel(addon.addon_code, t)}
                        {addon.status === 'active' ? ` · ${t('license_status_active')}` : ''}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t('licensing_provision_reason')}</Label>
                  <Textarea
                    value={form.reason}
                    onChange={(event) => setForm((f) => ({ ...f, reason: event.target.value }))}
                    rows={2}
                  />
                </div>
              </>
            )}

            {dialog === 'resume' && (
              <p className="text-sm text-muted-foreground">{t('licensing_provision_resume_help')}</p>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={mutation.isPending}>
              {t('common_cancel')}
            </Button>
            <Button onClick={submit} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {t('common_confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
