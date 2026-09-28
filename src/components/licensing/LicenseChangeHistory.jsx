import React, { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, History, Loader2, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { addonLabel } from '@/lib/commercialOffer';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';

/**
 * Histórico de licenciamento (FB1.12).
 *
 * Uma alteração de licença ficava apenas em `AuditLog`, que o produto não
 * mostrava: quem alterou o tier de um cliente não tinha onde o confirmar. Este
 * cartão lê o registo próprio (`listLicenseChanges`), com o âmbito resolvido no
 * servidor — o dono da plataforma vê todos os clientes, o administrador de
 * parceiro só a sua carteira — e os filtros (cliente, tipo de alteração e
 * intervalo de datas) aplicados antes da paginação. Cada linha abre o detalhe
 * com os campos alterados e o antes → novo de cada um.
 */
const ACTION_META = {
  create: { labelKey: 'lch_action_create', className: 'bg-chart-1/10 text-chart-1' },
  update: { labelKey: 'lch_action_update', className: 'bg-chart-3/10 text-chart-3' },
  suspend: { labelKey: 'lch_action_suspend', className: 'bg-destructive/10 text-destructive' },
  resume: { labelKey: 'lch_action_resume', className: 'bg-chart-2/10 text-chart-2' },
  set_module: { labelKey: 'lch_action_set_module', className: 'bg-chart-4/10 text-chart-4' },
  set_addon: { labelKey: 'lch_action_set_addon', className: 'bg-chart-2/10 text-chart-2' },
  set_standard: { labelKey: 'lch_action_set_standard', className: 'bg-chart-5/10 text-chart-5' },
  renew: { labelKey: 'lch_action_renew', className: 'bg-chart-2/10 text-chart-2' },
  change_tier: { labelKey: 'lch_action_change_tier', className: 'bg-chart-1/10 text-chart-1' },
  close: { labelKey: 'lch_action_close', className: 'bg-destructive/10 text-destructive' },
  set_quotas: { labelKey: 'lch_action_set_quotas', className: 'bg-chart-3/10 text-chart-3' },
};

const PAGE_SIZE = 25;

function formatTimestamp(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** Nome legível do módulo/standard, com o código como recurso. */
function nameOf(list, code) {
  return list.find((item) => item.code === code)?.name || code;
}

/** Rótulo do campo alterado: os fixos pela chave, os de módulo/standard pelo nome. */
function fieldLabel(code, t, moduleName, standardName) {
  if (code.startsWith('module:')) return `${t('lch_field_module')} · ${moduleName(code.slice(7))}`;
  if (code.startsWith('addon:')) return `${t('lch_field_addon')} · ${addonLabel(code.slice(6), t)}`;
  if (code.startsWith('standard:')) return `${t('lch_field_standard')} · ${standardName(code.slice(9))}`;
  return t(`lch_field_${code}`);
}

/** Valor em texto legível — nunca JSON cru. */
function formatValue(value, t) {
  if (value === null || value === undefined || value === '') return t('lch_value_empty');
  if (typeof value === 'boolean') return t(value ? 'lch_value_true' : 'lch_value_false');
  for (const key of [`lch_value_${value}`, `license_status_${value}`, `license_tier_${value}`]) {
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return String(value);
}

/** Valor de um campo alterado no estado antes/depois do registo. */
function stateValue(state, code, t) {
  if (!state) return null;
  if (code.startsWith('module:')) {
    const row = (state.modules || []).find((m) => m.module_code === code.slice(7));
    if (!row) return null;
    const status = formatValue(row.status, t);
    return row.expires_at ? `${status} · ${t('lch_value_until', { date: String(row.expires_at).slice(0, 10) })}` : status;
  }
  if (code.startsWith('addon:')) {
    const row = (state.addons || []).find((a) => a.addon_code === code.slice(6));
    if (!row) return null;
    const status = formatValue(row.status, t);
    return row.ended_date ? `${status} · ${t('lch_value_until', { date: String(row.ended_date).slice(0, 10) })}` : status;
  }
  if (code.startsWith('standard:')) {
    const row = (state.standards || []).find((s) => s.standard_code === code.slice(9));
    return row ? formatValue(row.status, t) : null;
  }
  return state.subscription ? state.subscription[code] ?? null : null;
}

function ChangeDetail({ entry, t, moduleName, standardName }) {
  const fields = entry.changed_fields || [];

  return (
    <div className="space-y-2 py-1">
      <p className="text-xs text-muted-foreground">
        {t('lch_detail_title').replace('{n}', String(fields.length))}
      </p>
      <div className="grid gap-1">
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 text-xs uppercase tracking-wide text-muted-foreground">
          <span>{t('lch_detail_field')}</span>
          <span>{t('lch_detail_before')}</span>
          <span>{t('lch_detail_after')}</span>
        </div>
        {fields.map((code) => (
          <div key={code} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 text-sm">
            <span className="text-muted-foreground truncate">{fieldLabel(code, t, moduleName, standardName)}</span>
            <span className="text-muted-foreground line-through truncate">
              {formatValue(stateValue(entry.before, code, t), t)}
            </span>
            <span className="font-medium truncate">{formatValue(stateValue(entry.after, code, t), t)}</span>
          </div>
        ))}
      </div>
      {entry.actor_role && (
        <p className="text-xs text-muted-foreground">{t('lch_detail_role')}: {entry.actor_role}</p>
      )}
    </div>
  );
}

export default function LicenseChangeHistory({ modules = [], standards = [] }) {
  const { t } = useLanguage();
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expanded, setExpanded] = useState([]);

  const moduleName = (code) => nameOf(modules, code);
  const standardName = (code) => nameOf(standards, code);

  const serverFilters = useMemo(() => ({
    customer_id: filterCustomer === 'all' ? '' : filterCustomer,
    action: filterAction === 'all' ? '' : filterAction,
    from: dateFrom,
    to: dateTo,
  }), [filterCustomer, filterAction, dateFrom, dateTo]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['license-changes', serverFilters],
    queryFn: async ({ pageParam = 0 }) => {
      const result = await base44.functions.invoke('listLicenseChanges', { ...serverFilters, cursor: pageParam, limit: PAGE_SIZE });
      return result?.data || result;
    },
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? undefined,
  });

  const pages = data?.pages || [];
  const entries = useMemo(() => pages.flatMap((page) => page?.entries || []), [pages]);
  const facets = pages[0]?.filters || { customers: [], actions: [] };
  const total = pages[0]?.total ?? entries.length;
  const truncated = pages[0]?.truncated;

  const hasFilters = filterCustomer !== 'all' || filterAction !== 'all' || !!dateFrom || !!dateTo;

  const clearFilters = () => {
    setFilterCustomer('all');
    setFilterAction('all');
    setDateFrom('');
    setDateTo('');
  };

  const toggle = (id) => {
    setExpanded((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold leading-none tracking-tight flex items-center gap-2">
          <History className="w-4 h-4" />
          {t('licensing_history_title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('licensing_history_subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros — aplicados no servidor, antes da paginação */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="lch-customer" className="text-xs text-muted-foreground">{t('lch_filter_customer')}</Label>
            <Select value={filterCustomer} onValueChange={setFilterCustomer}>
              <SelectTrigger id="lch-customer" className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('lch_all_customers')}</SelectItem>
                {facets.customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="lch-action" className="text-xs text-muted-foreground">{t('lch_filter_action')}</Label>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger id="lch-action" className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('lch_all_actions')}</SelectItem>
                {facets.actions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {t(ACTION_META[action]?.labelKey || action)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="lch-from" className="text-xs text-muted-foreground">{t('audit_date_from')}</Label>
            <Input id="lch-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lch-to" className="text-xs text-muted-foreground">{t('audit_date_to')}</Label>
            <Input id="lch-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
              <X className="w-3.5 h-3.5" /> {t('lch_clear_filters')}
            </Button>
          )}
        </div>

        {truncated && <p className="text-xs text-muted-foreground">{t('lch_truncated')}</p>}

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('lch_col_date')}</TableHead>
                <TableHead>{t('lch_col_customer')}</TableHead>
                <TableHead>{t('lch_col_action')}</TableHead>
                <TableHead>{t('lch_col_actor')}</TableHead>
                <TableHead>{t('lch_col_reason')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6}><LoadingState variant="skeleton" rows={5} label={t('common_loading')} /></TableCell>
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
                      title={hasFilters ? t('lch_no_match') : t('lch_empty')}
                    />
                  </TableCell>
                </TableRow>
              ) : entries.map((entry) => {
                const meta = ACTION_META[entry.action] || { labelKey: entry.action, className: 'bg-muted text-muted-foreground' };
                const isOpen = expanded.includes(entry.id);
                return (
                  <React.Fragment key={entry.id}>
                    <TableRow>
                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(entry.created_date)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {entry.customer_name || entry.customer_id}
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
                          aria-label={isOpen ? t('lch_collapse') : t('lch_expand')}
                          title={isOpen ? t('lch_collapse') : t('lch_expand')}
                          onClick={() => toggle(entry.id)}
                        >
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="bg-muted/30">
                          <ChangeDetail
                            entry={entry}
                            t={t}
                            moduleName={moduleName}
                            standardName={standardName}
                          />
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
          <p className="text-xs text-muted-foreground">
            {entries.length} / {total}
          </p>
        )}

        {hasNextPage && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="gap-2">
              {isFetchingNextPage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
              {t('lch_load_more')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
