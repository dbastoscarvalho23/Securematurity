import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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

const statusStyles = {
  active: 'bg-accent/10 text-accent border-accent/20',
  inactive: 'bg-muted text-muted-foreground',
  onboarding: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
};

export default function Customers() {
  const { t } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
      base44.entities.AuditLog.create({ action: 'customer_created', user_email: 'current', entity_type: 'Customer' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
      setEditingCustomer(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Customer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setSelectedCustomer(null);
    },
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
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {t('customers_subtitle')} · <span className="text-foreground font-medium">{customers.length}</span> {t('common_total')}
        </p>
        <Button onClick={() => { setEditingCustomer(null); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> {t('customers_add')}
        </Button>
      </div>

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
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t('common_loading')}</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {search ? t('customers_no_results') : t('customers_empty')}
                    </TableCell>
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
                      <Badge variant="outline" className={cn("text-xs border", statusStyles[c.status])}>
                        {c.status}
                      </Badge>
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
            />
          </div>
        )}
      </div>
    </div>
  );
}