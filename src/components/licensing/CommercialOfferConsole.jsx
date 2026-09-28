import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertTriangle, ChevronDown, ChevronRight, Info, Layers, Package, Pencil, Plus, Tag, XCircle,
} from 'lucide-react';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import OfferVersionDialog from '@/components/licensing/OfferVersionDialog';
import PriceTableDialog from '@/components/licensing/PriceTableDialog';
import CommercialActionDialog from '@/components/licensing/CommercialActionDialog';
import CommercialOfferHistory from '@/components/licensing/CommercialOfferHistory';
import {
  COMMERCIAL_STATUS_META,
  OFFER_TIER_ORDER,
  addonLabel,
  formatMoney,
  formatValidity,
} from '@/lib/commercialOffer';

/**
 * Consola da oferta comercial (FM1/FM2).
 *
 * A oferta e o preço existiam só em código: o que um tier incluía lia-se da
 * branch em execução e nada registava o que estava à venda numa data, com que
 * normas, nem por que valor. Aqui o dono da plataforma cria uma versão da oferta
 * a partir do catálogo em execução, decide o que fica comercializável e com que
 * normas, marca o preço por tier e publica — sempre com motivo e com o
 * antes/depois no histórico. Publicar uma versão retira a anterior com data de
 * fim, pelo que a qualquer data existe uma só oferta e um só preço em vigor.
 *
 * A fronteira é explícita (FB7): os módulos de cada tier continuam a vir do
 * catálogo de código e é ele que decide acessos; uma versão publicada cuja
 * assinatura do catálogo já não coincide com o código em execução é assinalada
 * como divergente, para que a consola diga a verdade sobre o que está a vender.
 * Toda a escrita passa por `manageCommercialOffer` — nenhuma entidade é escrita
 * pelo frontend.
 */
const TIER_LABEL_KEYS = {
  core: 'license_tier_core',
  professional: 'license_tier_professional',
  advanced: 'license_tier_advanced',
};

const TOAST_BY_ACTION = {
  create_offer_version: 'commercial_toast_created',
  create_price_table: 'commercial_toast_created',
  update_offer_version: 'commercial_toast_updated',
  update_price_table: 'commercial_toast_updated',
  publish_offer_version: 'commercial_toast_published',
  publish_price_table: 'commercial_toast_published',
  retire_offer_version: 'commercial_toast_retired',
  retire_price_table: 'commercial_toast_retired',
};

export default function CommercialOfferConsole() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState([]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['commercial-offer'],
    queryFn: async () => {
      const result = await base44.functions.invoke('manageCommercialOffer', { action: 'overview' });
      return result?.data || result;
    },
  });

  const versions = data?.offer_versions || [];
  const tables = data?.price_tables || [];
  const catalogue = data?.catalogue || { tiers: [], standards: [] };

  const moduleNames = useMemo(() => {
    const map = new Map();
    for (const tier of catalogue.tiers || []) {
      for (const module of tier.modules || []) map.set(module.code, module.name);
    }
    return map;
  }, [catalogue]);

  const mutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('manageCommercialOffer', payload),
    onSuccess: (_result, payload) => {
      queryClient.invalidateQueries({ queryKey: ['commercial-offer'] });
      queryClient.invalidateQueries({ queryKey: ['commercial-changes'] });
      setDialog(null);
      setError('');
      toast.success(t(TOAST_BY_ACTION[payload.action] || 'commercial_toast_updated'));
    },
    onError: (err) => {
      const message = err?.response?.data?.error || err?.data?.error || err?.message;
      setError(message || t('commercial_error'));
    },
  });

  const open = (next) => {
    setError('');
    setDialog(next);
  };

  const submit = (payload) => mutation.mutate(payload);
  const tierName = (code) => t(TIER_LABEL_KEYS[code]) || code;
  const toggle = (id) => setExpanded((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  const publishedOffer = versions.find((version) => version.status === 'published') || null;

  return (
    <div className="space-y-6">
      {/* Oferta comercial — versões com vigência (FM1) */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <h2 className="text-base font-semibold leading-none tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4" />
              {t('commercial_offer_title')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{t('commercial_offer_subtitle')}</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => open({ kind: 'offer', mode: 'create' })}>
            <Plus className="w-4 h-4" /> {t('commercial_offer_new')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{t('commercial_offer_notice')}</span>
          </div>

          {isError ? (
            <ErrorState variant="inline" onRetry={() => refetch()} />
          ) : isLoading ? (
            <LoadingState variant="skeleton" rows={3} label={t('common_loading')} />
          ) : versions.length === 0 ? (
            <EmptyState compact icon={Layers} title={t('commercial_offer_empty')} />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('commercial_offer_col_version')}</TableHead>
                    <TableHead>{t('licensing_col_status')}</TableHead>
                    <TableHead>{t('commercial_offer_col_validity')}</TableHead>
                    <TableHead>{t('commercial_offer_col_composition')}</TableHead>
                    <TableHead className="text-right">{t('licensing_provision_col_actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((version) => {
                    const statusMeta = COMMERCIAL_STATUS_META[version.status] || COMMERCIAL_STATUS_META.draft;
                    const isOpen = expanded.includes(version.id);
                    return (
                      <React.Fragment key={version.id}>
                        <TableRow>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                aria-label={isOpen ? t('commercial_offer_hide_composition') : t('commercial_offer_show_composition')}
                                title={isOpen ? t('commercial_offer_hide_composition') : t('commercial_offer_show_composition')}
                                disabled={(version.tiers || []).length === 0}
                                onClick={() => toggle(version.id)}
                              >
                                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </Button>
                              <div>
                                <p className="text-sm font-medium font-mono">{version.code}</p>
                                <p className="text-xs text-muted-foreground">{version.label}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${statusMeta.className}`}>{t(statusMeta.labelKey)}</Badge>
                            {version.diverges_from_catalogue && (
                              <p className="mt-1 flex items-center gap-1 text-xs text-status-warning">
                                <AlertTriangle className="w-3 h-3" />
                                {t('commercial_offer_divergence')}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatValidity(version)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {(version.tiers || []).map((tier) => (
                                <Badge
                                  key={tier.tier_code}
                                  variant="outline"
                                  className={`text-xs ${tier.commercially_available ? 'border-primary/40 text-primary' : 'text-muted-foreground'}`}
                                >
                                  {tierName(tier.tier_code)} · {(tier.modules || []).length}{' '}
                                  {t('licensing_modules_count')}
                                </Badge>
                              ))}
                              {(version.addons || [])
                                .filter((row) => row.commercially_available === true)
                                .map((row) => (
                                  <Badge
                                    key={row.addon_code}
                                    variant="outline"
                                    className="text-xs border-chart-2/40 text-chart-2"
                                  >
                                    {addonLabel(row.addon_code, t)}
                                  </Badge>
                                ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {version.status === 'draft' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    aria-label={t('common_edit')}
                                    title={t('common_edit')}
                                    onClick={() => open({ kind: 'offer', mode: 'edit', record: version })}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7"
                                    onClick={() => open({ kind: 'action', entity: 'offer', action: 'publish', record: version })}
                                  >
                                    {t('commercial_publish')}
                                  </Button>
                                </>
                              )}
                              {version.status === 'published' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-destructive hover:text-destructive"
                                  onClick={() => open({ kind: 'action', entity: 'offer', action: 'retire', record: version })}
                                >
                                  <XCircle className="w-4 h-4 mr-1" /> {t('commercial_retire')}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={5} className="bg-muted/30">
                              <div className="grid gap-3 md:grid-cols-3">
                                {(version.tiers || []).map((tier) => (
                                  <div key={tier.tier_code} className="space-y-1">
                                    <p className="text-sm font-medium">
                                      {tierName(tier.tier_code)}
                                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                                        {tier.commercially_available
                                          ? t('licensing_badge_available')
                                          : t('licensing_badge_prepared')}
                                      </span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {(tier.modules || []).map((code) => moduleNames.get(code) || code).join(' · ') || '—'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {t('licensing_standards')}:{' '}
                                      {(tier.standards || []).length > 0 ? (tier.standards || []).join(' · ') : '—'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                              {/* Packs/acréscimos — o que se vende além do tier */}
                              {(version.addons || []).length > 0 && (
                                <div className="mt-3 space-y-2 border-t pt-3">
                                  <p className="text-sm font-medium">{t('commercial_offer_addons_title')}</p>
                                  <div className="grid gap-3 md:grid-cols-3">
                                    {(version.addons || []).map((row) => (
                                      <div key={row.addon_code} className="space-y-1">
                                        <p className="text-sm font-medium">
                                          {addonLabel(row.addon_code, t)}
                                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                                            {row.commercially_available
                                              ? t('licensing_badge_available')
                                              : t('licensing_badge_prepared')}
                                          </span>
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {(row.modules || []).map((code) => moduleNames.get(code) || code).join(' · ') || '—'}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de preços — valor por tier com vigência (FM2) */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <h2 className="text-base font-semibold leading-none tracking-tight flex items-center gap-2">
              <Tag className="w-4 h-4" />
              {t('commercial_price_title')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{t('commercial_price_subtitle')}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={versions.filter((version) => version.status !== 'retired').length === 0}
            onClick={() => open({ kind: 'price', mode: 'create' })}
          >
            <Plus className="w-4 h-4" /> {t('commercial_price_new')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              {t('commercial_price_notice')}
              {publishedOffer ? ` ${t('commercial_price_current_offer')}: ${publishedOffer.code}.` : ''}
            </span>
          </div>

          {isError ? (
            <ErrorState variant="inline" onRetry={() => refetch()} />
          ) : isLoading ? (
            <LoadingState variant="skeleton" rows={3} label={t('common_loading')} />
          ) : tables.length === 0 ? (
            <EmptyState compact icon={Package} title={t('commercial_price_empty')} />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('commercial_price_col_table')}</TableHead>
                    <TableHead>{t('commercial_price_field_offer')}</TableHead>
                    <TableHead>{t('commercial_price_field_period')}</TableHead>
                    <TableHead>{t('commercial_price_col_prices')}</TableHead>
                    <TableHead>{t('commercial_offer_col_validity')}</TableHead>
                    <TableHead>{t('licensing_col_status')}</TableHead>
                    <TableHead className="text-right">{t('licensing_provision_col_actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tables.map((table) => {
                    const statusMeta = COMMERCIAL_STATUS_META[table.status] || COMMERCIAL_STATUS_META.draft;
                    return (
                      <TableRow key={table.id}>
                        <TableCell className="text-sm font-medium">{table.label}</TableCell>
                        <TableCell className="text-sm font-mono text-muted-foreground">
                          {table.offer_version_code || '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {t(`commercial_period_${table.billing_period}`)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            {OFFER_TIER_ORDER.filter((code) =>
                              (table.entries || []).some((entry) => entry.tier_code === code)
                            ).map((code) => {
                              const entry = (table.entries || []).find((row) => row.tier_code === code);
                              return (
                                <p key={code} className="text-xs text-muted-foreground whitespace-nowrap">
                                  <span className="font-medium text-foreground">{tierName(code)}</span>
                                  {' · '}
                                  {formatMoney(entry.amount_cents, table.currency)}
                                  {entry.included_seats !== null && entry.included_seats !== undefined && (
                                    <> · {entry.included_seats} {t('license_seats')}</>
                                  )}
                                  {entry.extra_seat_amount_cents !== null && entry.extra_seat_amount_cents !== undefined && (
                                    <> · +{formatMoney(entry.extra_seat_amount_cents, table.currency)}</>
                                  )}
                                </p>
                              );
                            })}
                            {(table.addon_entries || [])
                              .filter((entry) => entry.amount_cents !== null && entry.amount_cents !== undefined)
                              .map((entry) => (
                                <p key={entry.addon_code} className="text-xs text-muted-foreground whitespace-nowrap">
                                  <span className="font-medium text-foreground">{addonLabel(entry.addon_code, t)}</span>
                                  {' · '}
                                  {formatMoney(entry.amount_cents, table.currency)}
                                </p>
                              ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatValidity(table)}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${statusMeta.className}`}>{t(statusMeta.labelKey)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {table.status === 'draft' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  aria-label={t('common_edit')}
                                  title={t('common_edit')}
                                  onClick={() => open({ kind: 'price', mode: 'edit', record: table })}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7"
                                  onClick={() => open({ kind: 'action', entity: 'price', action: 'publish', record: table })}
                                >
                                  {t('commercial_publish')}
                                </Button>
                              </>
                            )}
                            {table.status === 'published' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-destructive hover:text-destructive"
                                onClick={() => open({ kind: 'action', entity: 'price', action: 'retire', record: table })}
                              >
                                <XCircle className="w-4 h-4 mr-1" /> {t('commercial_retire')}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico comercial — quem alterou o quê, de que valor para que valor */}
      <CommercialOfferHistory />

      {dialog?.kind === 'offer' && (
        <OfferVersionDialog
          mode={dialog.mode}
          record={dialog.record}
          catalogue={catalogue}
          pending={mutation.isPending}
          error={error}
          onSubmit={submit}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.kind === 'price' && (
        <PriceTableDialog
          mode={dialog.mode}
          record={dialog.record}
          offerVersions={versions}
          pending={mutation.isPending}
          error={error}
          onSubmit={submit}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.kind === 'action' && (
        <CommercialActionDialog
          kind={dialog.action}
          entity={dialog.entity}
          record={dialog.record}
          pending={mutation.isPending}
          error={error}
          onSubmit={submit}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
