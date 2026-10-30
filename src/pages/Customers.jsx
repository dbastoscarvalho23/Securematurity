import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, ExternalLink, X, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import CustomerForm from '@/components/customers/CustomerForm';
import CustomerDetailPanel from '@/components/customers/CustomerDetailPanel';
import QualificationWizard from '@/components/customers/QualificationWizard';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { writeAuditLog } from '@/lib/auditLog';
import { applyCustomerStorage } from '@/lib/repository';
import { toast } from 'sonner';

export default function Customers() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState('');
  // Enquadramento (RJC) proposto logo após criar o cliente; também disponível no menu de cada cliente.
  const [offerCustomer, setOfferCustomer] = useState(null);
  const [wizardCustomer, setWizardCustomer] = useState(null);
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date'),
  });

  // Repositório documental: aplicado depois de o cliente existir (a ligação ao NAS precisa do id do cliente).
  // Uma falha aqui não desfaz a gravação do cliente: fica no repositório anterior e o aviso é mostrado.
  const applyStorage = async (customerId, storage) => {
    if (!storage) return;
    try {
      const res = await applyCustomerStorage(customerId, storage);
      if (!res.ok) toast.warning(`${t('repo_apply_nas_failed')} ${t(res.warning) || res.warning}`);
    } catch (e) {
      toast.warning(`${t('repo_apply_failed')} ${e?.message || ''}`);
    }
    queryClient.invalidateQueries({ queryKey: ['nas-connection', customerId] });
  };

  const createMutation = useMutation({
    mutationFn: async ({ data, storage }) => {
      const result = await base44.entities.Customer.create(data);
      await writeAuditLog({ action: 'customer_created', entity_type: 'Customer', entity_id: result?.id, details: `Created customer: ${data.name}` });
      if (result?.id) await applyStorage(result.id, storage);
      return result;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
      if (created?.id) setOfferCustomer(created);
    },
    onError: (err) => toast.error(err?.message || t('x_customer_create_failed')),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, storage }) => {
      const result = await base44.entities.Customer.update(id, data);
      await writeAuditLog({ action: 'customer_updated', entity_type: 'Customer', entity_id: id, details: `Updated customer: ${data.name}` });
      await applyStorage(id, storage);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
      setEditingCustomer(null);
    },
    onError: (err) => toast.error(err?.message || t('x_customer_update_failed')),
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
    onError: (err) => toast.error(err?.message || t('x_customer_delete_failed')),
  });

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.nif?.includes(search)
  );

  const handleSubmit = (data, storage) => {
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data, storage });
    } else {
      createMutation.mutate({ data, storage });
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
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8}><LoadingState label={t('common_loading')} /></TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}><EmptyState compact title={search ? t('customers_no_results') : t('customers_empty')} /></TableCell>
                  </TableRow>
                ) : filtered.map(c => (
                  <TableRow
                    key={c.id}
                    className={cn(
                      "group cursor-pointer transition-colors",
                      selectedCustomer?.id === c.id
                        ? "bg-primary/5 border-l-2 border-l-primary"
                        : "hover:bg-muted/30"
                    )}
                    onClick={() => handleRowClick(c)}
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
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(c)}>
                                            <Pencil className="w-4 h-4 mr-2" /> {t('customers_menu_edit')}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => { if (editingCustomer?.id === c.id) { setShowForm(false); setEditingCustomer(null); } setWizardCustomer(c); }}>
                                            <Scale className="w-4 h-4 mr-2" /> {c.rjc_qualification && c.rjc_qualification !== 'por_determinar' ? t('qw_review') : t('qw_start')}
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

      <Dialog open={Boolean(offerCustomer)} onOpenChange={(v) => { if (!v) setOfferCustomer(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Scale className="w-5 h-5 text-primary" /> {t('qw_offer_title')}</DialogTitle>
            <DialogDescription><strong className="text-foreground">{offerCustomer?.name}</strong> — {t('qw_offer_desc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOfferCustomer(null)}>{t('qw_offer_later')}</Button>
            <Button className="gap-2" onClick={() => { setWizardCustomer(offerCustomer); setOfferCustomer(null); }}><Scale className="w-4 h-4" /> {t('qw_offer_now')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {wizardCustomer && (
        <QualificationWizard
          open={Boolean(wizardCustomer)}
          onOpenChange={(v) => { if (!v) setWizardCustomer(null); }}
          customer={wizardCustomer}
          onDone={async () => {
            if (selectedCustomer?.id === wizardCustomer.id) {
              const fresh = await base44.entities.Customer.get(wizardCustomer.id).catch(() => null);
              if (fresh) setSelectedCustomer(fresh);
            }
          }}
        />
      )}
    </div>
  );
}