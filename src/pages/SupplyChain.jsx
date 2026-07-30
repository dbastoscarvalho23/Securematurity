import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, ChevronRight, Building2, CalendarDays, Layers, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import QuestionnaireFormDialog from '@/components/supplychain/QuestionnaireFormDialog';
import QuestionnaireDetail from '@/components/supplychain/QuestionnaireDetail';
import { toast } from 'sonner';

const STATUS_STYLES = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-primary/10 text-primary border-primary/20',
  in_progress: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  completed: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  archived: 'bg-muted text-muted-foreground',
};

export default function SupplyChain() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);

  const customerId = user?.customer_id;

  const { data: questionnaires = [], isLoading: loadingQuestionnaires } = useQuery({
    queryKey: ['supplier-questionnaires', customerId],
    queryFn: () => isAdmin
      ? base44.entities.SupplierQuestionnaire.list('-created_date')
      : base44.entities.SupplierQuestionnaire.filter({ customer_id: customerId }, '-created_date'),
    enabled: isAdmin || !!customerId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('name'),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => isAdmin
      ? base44.entities.Supplier.list('name')
      : base44.entities.Supplier.filter({ customer_id: customerId }, 'name'),
    enabled: isAdmin || !!customerId,
  });

  const handleDelete = async (q) => {
    if (!confirm(`${t('sc_delete_confirm')} "${q.title}"?`)) return;
    await base44.entities.SupplierQuestionnaire.delete(q.id);
    queryClient.invalidateQueries({ queryKey: ['supplier-questionnaires'] });
    toast.success(t('sc_questionnaire_deleted'));
  };

  const filtered = questionnaires.filter(q => {
    const matchSearch = !search || q.title?.toLowerCase().includes(search.toLowerCase()) || q.supplier_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || q.status === statusFilter;
    const matchCustomer = customerFilter === 'all' || q.customer_id === customerFilter;
    return matchSearch && matchStatus && matchCustomer;
  });

  if (selected) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <QuestionnaireDetail
          questionnaire={selected}
          onBack={() => setSelected(null)}
        />
      </div>
    );
  }

  const customerScoped = customerFilter === 'all' ? questionnaires : questionnaires.filter(q => q.customer_id === customerFilter);
  const totalQ = customerScoped.length;
  const completedQ = customerScoped.filter(q => q.status === 'completed').length;
  const inProgressQ = customerScoped.filter(q => q.status === 'in_progress' || q.status === 'sent').length;
  const suppliersCount = new Set(customerScoped.map(q => q.supplier_name).filter(Boolean)).size;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('nav_supply_chain')}</h1>
          <p className="text-sm text-muted-foreground">{t('sc_page_subtitle')}</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" />{t('sc_new_questionnaire')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t('sc_stat_total'), value: totalQ },
          { label: t('sc_stat_completed'), value: completedQ },
          { label: t('sc_stat_in_progress'), value: inProgressQ },
          { label: t('sc_stat_suppliers'), value: suppliersCount },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('sc_search_placeholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('sc_all_statuses')}</SelectItem>
            {['draft','sent','in_progress','completed','archived'].map(s => (
              <SelectItem key={s} value={s}>{t(`sc_status_${s}`) || s.replace('_',' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('sc_all_customers')}</SelectItem>
              {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* List */}
      {loadingQuestionnaires ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p className="text-sm">{t('common_loading')}</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="text-sm">{t('sc_empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(q => (
            <Card key={q.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelected(q)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{q.title}</p>
                      <Badge variant="outline" className={STATUS_STYLES[q.status]}>
                        {t(`sc_status_${q.status}`) || q.status?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                      {q.supplier_name && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />{q.supplier_name}
                        </span>
                      )}
                      {q.customer_name && (
                        <span className="text-muted-foreground">{q.customer_name}</span>
                      )}
                      {q.areas?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />{q.areas.length} {t('sc_areas')}
                        </span>
                      )}
                      {q.due_date && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />{t('sc_due')} {format(parseISO(q.due_date), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                    {q.areas?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {q.areas.slice(0, 5).map(a => (
                          <span key={a} className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">{a}</span>
                        ))}
                        {q.areas.length > 5 && (
                          <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">+{q.areas.length - 5} {t('sc_more')}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(q); setDialogOpen(true); }}>
                          <Pencil className="w-4 h-4 mr-2" />{t('common_edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(q)} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />{t('common_delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <QuestionnaireFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        questionnaire={editing}
        customers={customers}
        suppliers={suppliers}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['supplier-questionnaires'] })}
      />
    </div>
  );
}