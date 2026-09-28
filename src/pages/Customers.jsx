import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import CustomerForm from '@/components/customers/CustomerForm';
import CustomerDetailPanel from '@/components/customers/CustomerDetailPanel';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { writeAuditLog } from '@/lib/auditLog';
import { toast } from 'sonner';

export default function Customers() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.Customer.create(data);
      await writeAuditLog({ action: 'customer_created', entity_type: 'Customer', entity_id: result?.id, details: `Created customer: ${data.name}` });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
    },
    onError: (err) => toast.error(err?.message || t('customers_create_failed')),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const result = await base44.entities.Customer.update(id, data);
      await writeAuditLog({ action: 'customer_updated', entity_type: 'Customer', entity_id: id, details: `Updated customer: ${data.name}` });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
      setEditingCustomer(null);
    },
    onError: (err) => toast.error(err?.message || t('customers_update_failed')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.Customer.delete(id);
      await writeAuditLog({ action: 'customer_deleted', entity_type: 'Customer', entity_id: id, details: `Deleted customer` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setSelectedCustomer(null);
    },
    onError: (err) => toast.error(err?.message || t('customers_delete_failed')),
  });

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.nif?.includes(search)
  );

  const handleSubmit = (data) => {
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (c) => {
    setEditingCustomer(c);
    setShowForm(true);
  };

  const handleRowClick = (c) => {
    setSelectedCustomer(prev => prev?.id === c.id ? null : c);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description={<>{t('customers_subtitle')} · <span className="text-foreground font-medium">{customers.length}</span> {t('common_total')}</>}
        actions={
          <Button onClick={() => { setEditingCustomer(null); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> {t('customers_add')}
          </Button>
        }
      />

      {showForm && (
        <CustomerForm
          customer={editingCustomer}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingCustomer(null); }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      <div className={cn("grid gap-6", selectedCustomer ? "grid-cols-1 lg:grid-cols-5" : "grid-cols-1")}>
        {/* Table */}
        <Card className={selectedCustomer ? "lg:col-span-3" : ""}>
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('customers_search_placeholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('customers_col_org')}</TableHead>
                  {!selectedCustomer && <TableHead>{t('customers_col_nif')}</TableHead>}
                  <TableHead>{t('customers_col_sector')}</TableHead>
                  {!selectedCustomer && <TableHead>{t('customers_col_contact')}</TableHead>}
                  {!selectedCustomer && <TableHead>{t('customers_col_csm')}</TableHead>}
                  {!selectedCustomer && <TableHead>{t('customers_col_employees')}</TableHead>}
                  <TableHead>{t('customers_col_status')}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isError ? (
                  <TableRow>
                    <TableCell colSpan={8}><ErrorState variant="inline" onRetry={() => refetch()} /></TableCell>
                  </TableRow>
                ) : isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8}><LoadingState variant="skeleton" rows={4} label={t('common_loading')} /></TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}><EmptyState compact title={search ? t('customers_no_results') : t('customers_empty')} /></TableCell>
                  </TableRow>
                ) : filtered.map(c => (
                  <TableRow
                    key={c.id}
                    tabIndex={0}
                    aria-label={t('aria_customer_open', { name: c.name })}
                    className={cn(
                      "group cursor-pointer transition-colors focus-visible:outline-none focus-visible:bg-muted/60",
                      selectedCustomer?.id === c.id
                        ? "bg-primary/5 border-l-2 border-l-primary"
                        : "hover:bg-muted/30"
                    )}
                    onClick={() => handleRowClick(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick(c);
                      }
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {c.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.contact_email || c.nif}</p>
                        </div>
                      </div>
                    </TableCell>
                    {!selectedCustomer && <TableCell className="text-sm font-mono">{c.nif}</TableCell>}
                    <TableCell className="text-sm capitalize">{c.sector?.replace(/_/g, ' ')}</TableCell>
                    {!selectedCustomer && (
                      <TableCell>
                        <div className="text-sm">
                          {c.contact_email && <p className="truncate max-w-[180px]">{c.contact_email}</p>}
                          {c.contact_phone && <p className="text-xs text-muted-foreground">{c.contact_phone}</p>}
                        </div>
                      </TableCell>
                    )}
                    {!selectedCustomer && (
                      <TableCell className="text-sm">{c.cybersecurity_manager || <span className="text-muted-foreground">—</span>}</TableCell>
                    )}
                    {!selectedCustomer && <TableCell className="text-sm">{c.num_employees}</TableCell>}
                    <TableCell>
                      <StatusBadge status={c.status} label={t(`customers_status_${c.status}`) || c.status} />
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
                            aria-label={t('aria_customer_actions')}
                            title={t('aria_customer_actions')}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(c)}>
                                            <Pencil className="w-4 h-4 mr-2" /> {t('customers_menu_edit')}
                                          </DropdownMenuItem>
                                          {c.website && (
                                            <DropdownMenuItem onClick={() => window.open(c.website, '_blank')}>
                                              <ExternalLink className="w-4 h-4 mr-2" /> {t('customers_menu_website')}
                                            </DropdownMenuItem>
                                          )}
                                          <DropdownMenuItem
                                            className="text-destructive"
                                            onClick={() => deleteMutation.mutate(c.id)}
                                          >
                                            <Trash2 className="w-4 h-4 mr-2" /> {t('customers_menu_delete')}
                                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Detail Panel */}
        {selectedCustomer && (
          <div className="lg:col-span-2 relative">
            <button
              onClick={() => setSelectedCustomer(null)}
              className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors"
              aria-label={t('aria_close')}
              title={t('aria_close')}
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <CustomerDetailPanel
              customer={selectedCustomer}
              onEdit={(c) => { handleEdit(c); }}
              onCustomerUpdated={(updated) => setSelectedCustomer(updated)}
            />
          </div>
        )}
      </div>
    </div>
  );
}