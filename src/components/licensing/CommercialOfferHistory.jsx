import React, { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, History, Loader2, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import {
  COMMERCIAL_ACTION_META,
  commercialFieldLabel,
  commercialValueLabel,
  formatMoney,
} from '@/lib/commercialOffer';

/**
 * Histórico comercial (FM1/FM2).
 *
 * Uma alteração à oferta ou ao preço tem de deixar rasto de quem, quando, porquê
 * e de que valor para que valor — sem isso, o preço vigente a uma data passada
 * não é reconstruível e a faturação, quando vier a ser decidida, não teria base.
 * A leitura passa por `manageCommercialOffer` (`history`), com o âmbito e a
 * paginação no servidor; a entidade não é lida pelo browser.
 */
const PAGE_SIZE = 25;

const TIER_LABEL_KEYS = {
  core: 'license_tier_core',
  professional: 'license_tier_professional',
  advanced: 'license_tier_advanced',
};

function formatTimestamp(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** Valor de um campo alterado: escalares pela chave, tiers e preços pela linha. */
function stateValue(state, code, t, tierName) {
  if (!state) return null;

  if (code.startsWith('tier:')) {
    const row = (state.tiers || []).find((tier) => tier.tier_code === code.slice(5));
    if (!row) return null;
    const availability = row.commercially_available
      ? t('licensing_badge_available')
      : t('licensing_badge_prepared');
    const standards = (row.standards || []).join(' · ');
    return `${availability} · ${(row.modules || []).length} ${t('licensing_modules_count')}${standards ? ` · ${standards}` : ''}`;
  }

  if (code.startsWith('price:')) {
    const row = (state.entries || []).find((entry) => entry.tier_code === code.slice(6));
    if (!row) return null;
    const amount = formatMoney(row.amount_cents, state.currency || 'EUR');
    const seats = row.included_seats === null || row.included_seats === undefined
      ? ''
      : ` · ${row.included_seats} ${t('license_seats')}`;
    const extra = row.extra_seat_amount_cents === null || row.extra_seat_amount_cents === undefined
      ? ''
      : ` · +${formatMoney(row.extra_seat_amount_cents, state.currency || 'EUR')}`;
    const discount = row.annual_discount_pct === null || row.annual_discount_pct === undefined
      ? ''
      : ` · −${row.annual_discount_pct}%`;
    return `${amount}${seats}${extra}${discount}`;
  }

  return commercialValueLabel(state[code] ?? null, code, t);
}

function ChangeDetail({ entry, t, tierName }) {
  const fields = entry.changed_fields || [];

  return (
    <div className="space-y-2 py-1">
      {fields.includes('*') ? (
        <p className="text-xs text-muted-foreground">{t('commercial_history_created')}</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {t('commercial_history_detail_title').replace('{n}', String(fields.length))}
          </p>
          <div className="grid gap-1">
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 text-xs uppercase tracking-wide text-muted-foreground">
              <span>{t('commercial_history_detail_field')}</span>
              <span>{t('commercial_history_detail_before')}</span>
              <span>{t('commercial_history_detail_after')}</span>
            </div>
            {fields.map((code) => (
              <div key={code} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 text-sm">
                <span className="text-muted-foreground truncate">
                  {commercialFieldLabel(code, t, tierName)}
                </span>
                <span className="text-muted-foreground line-through truncate">
                  {stateValue(entry.before, code, t, tierName) || t('commercial_value_empty')}
                </span>
                <span className="font-medium truncate">
                  {stateValue(entry.after, code, t, tierName) || t('commercial_value_empty')}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {entry.actor_role && (
        <p className="text-xs text-muted-foreground">
          {t('commercial_history_detail_role')}: {entry.actor_role}
        </p>
      )}
    </div>
  );
}

export default function CommercialOfferHistory() {
  const { t } = useLanguage();
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [expanded, setExpanded] = useState([]);

  // O filtro por acção é `change_action`: `action` é o selector da função
  // multiplexada (`history`) e usá-lo aqui substituía o comando pelo filtro.
  const filters = useMemo(() => ({
    entity_type: filterEntity === 'all' ? '' : filterEntity,
    change_action: filterAction === 'all' ? '' : filterAction,
  }), [filterEntity, filterAction]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['commercial-changes', filters],
    queryFn: async ({ pageParam = 0 }) => {
      const result = await base44.functions.invoke('manageCommercialOffer', {
        action: 'history',
        ...filters,
        cursor: pageParam,
        limit: PAGE_SIZE,
      });
      return result?.data || result;
    },
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? undefined,
  });

  const pages = data?.pages || [];
  const entries = useMemo(() => pages.flatMap((page) => page?.entries || []), [pages]);
  const facets = pages[0]?.filters || { actions: [], entity_types: [] };
  const total = pages[0]?.total ?? entries.length;
  const tierName = (code) => t(TIER_LABEL_KEYS[code]) || code;
  const hasFilters = filterEntity !== 'all' || filterAction !== 'all';

  const toggle = (id) => setExpanded((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  const entityLabel = (type) => (type === 'PriceTable' ? t('commercial_entity_price') : t('commercial_entity_offer'));

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold leading-none tracking-tight flex items-center gap-2">
          <History className="w-4 h-4" />
          {t('commercial_history_title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('commercial_history_subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{t('commercial_history_filter_entity')}</span>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('commercial_history_all_entities')}</SelectItem>
                {facets.entity_types.map((type) => (
                  <SelectItem key={type} value={type}>{entityLabel(type)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{t('lch_col_action')}</span>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('commercial_history_all_actions')}</SelectItem>
                {facets.actions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {t(COMMERCIAL_ACTION_META[action]?.labelKey || action)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => { setFilterEntity('all'); setFilterAction('all'); }}
            >
              <X className="w-3.5 h-3.5" /> {t('lch_clear_filters')}
            </Button>
          )}
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('lch_col_date')}</TableHead>
                <TableHead>{t('commercial_history_col_entity')}</TableHead>
                <TableHead>{t('lch_col_action')}</TableHead>
                <TableHead>{t('lch_col_actor')}</TableHead>
                <TableHead>{t('lch_col_reason')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6}><LoadingState variant="skeleton" rows={4} label={t('common_loading')} /></TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6}><ErrorState variant="inline" onRetry={() => refetch()} /></TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      compact
                      icon={History}
                      title={hasFilters ? t('commercial_history_no_match') : t('commercial_history_empty')}
                    />
                  </TableCell>
                </TableRow>
              ) : entries.map((entry) => {
                const meta = COMMERCIAL_ACTION_META[entry.action] || { labelKey: entry.action, className: 'bg-muted text-muted-foreground' };
                const isOpen = expanded.includes(entry.id);
                return (
                  <React.Fragment key={entry.id}>
                    <TableRow>
                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(entry.created_date)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="font-medium">{entry.entity_label || '—'}</span>
                        <span className="block text-xs text-muted-foreground">{entityLabel(entry.entity_type)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${meta.className}`}>{t(meta.labelKey)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{entry.actor_email || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {entry.reason || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={isOpen ? t('commercial_history_collapse') : t('commercial_history_expand')}
                          title={isOpen ? t('commercial_history_collapse') : t('commercial_history_expand')}
                          onClick={() => toggle(entry.id)}
                        >
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="bg-muted/30">
                          <ChangeDetail entry={entry} t={t} tierName={tierName} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {entries.length > 0 && (
          <p className="text-xs text-muted-foreground">{entries.length} / {total}</p>
        )}

        {hasNextPage && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
              {t('lch_load_more')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
