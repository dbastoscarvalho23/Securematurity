import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Pencil, Trash2, AlertTriangle, ShieldAlert, FileText, TrendingUp, FileSpreadsheet, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import RiskFormDialog from '@/components/risks/RiskFormDialog';
import RiskExcelImportDialog from '@/components/risks/RiskExcelImportDialog';
import RiskHeatmap from '@/components/risks/RiskHeatmap';
import TaskHeatmap from '@/components/risks/TaskHeatmap';
import { writeAuditLog } from '@/lib/auditLog';
import { useLanguage } from '@/lib/LanguageContext';

const STATUS_STYLES = {
  open: 'bg-destructive/10 text-destructive border-destructive/20',
  in_treatment: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  accepted: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  closed: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
};
const STATUS_LABELS = { open: 'Open', in_treatment: 'In Treatment', accepted: 'Accepted', closed: 'Closed' };

const CATEGORY_LABELS = {
  access_control: 'Access Control', data_protection: 'Data Protection',
  network_security: 'Network Security', physical_security: 'Physical Security',
  third_party: 'Third Party', compliance: 'Compliance', operational: 'Operational', other: 'Other',
};

function riskScore(r) { return (r.impact || 0) * (r.likelihood || 0); }

function RiskLevelBadge({ risk }) {
  const score = riskScore(risk);
  if (score >= 16) return <Badge className="bg-destructive/10 text-destructive border-destructive/20 border text-xs">Critical</Badge>;
  if (score >= 9) return <Badge className="bg-chart-4/10 text-chart-4 border-chart-4/20 border text-xs">High</Badge>;
  if (score >= 4) return <Badge className="bg-chart-3/10 text-chart-3 border-chart-3/20 border text-xs">Medium</Badge>;
  return <Badge className="bg-chart-2/10 text-chart-2 border-chart-2/20 border text-xs">Low</Badge>;
}

export default function RiskAssessment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const isCustomerAdmin = user?.role === 'customer_admin';
  const customerId = user?.customer_id;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'heatmap'

  const { data: risks = [] } = useQuery({
    queryKey: ['riskItems'],
    queryFn: () => base44.entities.RiskItem.list('-created_date', 5000),
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['securityDocuments'],
    queryFn: () => base44.entities.SecurityDocument.list('-created_date', 500),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: isAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const isEdit = !!data.id;
      const previousRisk = isEdit ? risks.find(r => r.id === data.id) : null;
      let result;
      if (isEdit) {
        result = await base44.entities.RiskItem.update(data.id, data);
        await writeAuditLog({ action: 'risk_updated', entity_type: 'RiskItem', entity_id: data.id, details: `Updated risk: ${data.title}` });
      } else {
        result = await base44.entities.RiskItem.create({ ...data, owner_email: data.owner_email || user?.email });
        await writeAuditLog({ action: 'risk_created', entity_type: 'RiskItem', entity_id: result?.id, details: `Created risk: ${data.title} (score: ${(data.impact || 0) * (data.likelihood || 0)})` });
      }
      const savedRisk = result || data;

      // Fire notifications in the background (don't block save)
      if (savedRisk.owner_email) {
        const ownerChanged = !isEdit || (previousRisk?.owner_email !== savedRisk.owner_email);
        const statusChanged = isEdit && previousRisk?.status !== savedRisk.status;

        if (ownerChanged) {
          base44.functions.invoke('riskNotifications', { type: 'assigned', risk: savedRisk, previousRisk }).catch(() => {});
        }
        if (statusChanged) {
          base44.functions.invoke('riskNotifications', { type: 'status_changed', risk: savedRisk, previousRisk }).catch(() => {});
        }
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['riskItems'] });
      queryClient.invalidateQueries({ queryKey: ['riskHistory'] });
      setDialogOpen(false);
      setEditingRisk(null);
      toast.success(variables?.id ? t('risk_updated') : t('risk_created'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (risk) => {
      await base44.entities.RiskItem.delete(risk.id);
      await writeAuditLog({ action: 'risk_deleted', entity_type: 'RiskItem', entity_id: risk.id, details: `Deleted risk: ${risk.title}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['riskItems'] });
      toast.success(t('risk_deleted'));
    },
  });

  // Scope by role
  const scoped = useMemo(() => {
    if (isAdmin) return risks;
    return risks.filter(r => !r.customer_id || r.customer_id === customerId);
  }, [risks, isAdmin, customerId]);

  // Scope by customer filter only (not search/status) for KPI cards
  const customerScoped = useMemo(() => {
    if (isAdmin && filterCustomer) return scoped.filter(r => r.customer_id === filterCustomer);
    return scoped;
  }, [scoped, isAdmin, filterCustomer]);

  const filtered = useMemo(() => {
    return customerScoped.filter(r => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) ||
          CATEGORY_LABELS[r.category]?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [customerScoped, filterStatus, search]);

  // KPIs — reflect customer filter so they match the list below
  const critical = customerScoped.filter(r => riskScore(r) >= 16).length;
  const high = customerScoped.filter(r => riskScore(r) >= 9 && riskScore(r) < 16).length;
  const openCount = customerScoped.filter(r => r.status === 'open').length;

  const [initialTab, setInitialTab] = useState('edit');
  const handleNew = () => { setEditingRisk(null); setInitialTab('edit'); setDialogOpen(true); };
  const handleEdit = (r, tab = 'edit') => { setEditingRisk(r); setInitialTab(tab); setDialogOpen(true); };

  const handleBulkDelete = async () => {
    for (const r of customerScoped) {
      await base44.entities.RiskItem.delete(r.id);
    }
    await writeAuditLog({ action: 'risk_deleted', entity_type: 'RiskItem', details: `Bulk deleted ${customerScoped.length} risks` });
    queryClient.invalidateQueries({ queryKey: ['riskItems'] });
    setBulkDeleteOpen(false);
    toast.success(`${customerScoped.length} risk${customerScoped.length !== 1 ? 's' : ''} deleted`);
  };

  const handleExcelImport = async (risks) => {
    let created = 0;
    for (const r of risks) {
      const data = { ...r };
      if (!isAdmin) {
        data.customer_id = customerId;
        data.customer_name = user?.customer_name || r.customer_name;
      } else if (r.customer_name && customers.length > 0) {
        const match = customers.find(c => c.name?.toLowerCase() === r.customer_name?.toLowerCase());
        if (match) { data.customer_id = match.id; data.customer_name = match.name; }
      }
      await base44.entities.RiskItem.create({ ...data, owner_email: data.owner_email || user?.email });
      created++;
    }
    await writeAuditLog({ action: 'risk_created', entity_type: 'RiskItem', details: `Bulk imported ${created} risks from Excel` });
    queryClient.invalidateQueries({ queryKey: ['riskItems'] });
    toast.success(`${created} risk${created !== 1 ? 's' : ''} imported successfully`);
  };

  const getLinkedDocs = (risk) =>
    documents.filter(d => risk.linked_document_ids?.includes(d.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t('risk_subtitle')} · <span className="text-foreground font-medium">{customerScoped.length}</span> {t('common_total')}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle — segmented style */}
          <div className="flex items-center rounded-lg border border-border bg-muted p-0.5 gap-0.5">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                view === 'list'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('risk_view_list')}
            </button>
            <button
              onClick={() => setView('heatmap')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                view === 'heatmap'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('risk_view_heatmap')}
            </button>
            <button
              onClick={() => setView('task_heatmap')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                view === 'task_heatmap'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('risk_view_task_heatmap')}
            </button>
          </div>

          {/* Action buttons */}
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" /> {t('risk_import_excel')}
          </Button>
          {customerScoped.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setBulkDeleteOpen(true)} className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
              <Trash2 className="w-4 h-4" /> {t('risk_delete_all')}
            </Button>
          )}
          <Button size="sm" onClick={handleNew} className="gap-2">
            <Plus className="w-4 h-4" /> {t('risk_new')}
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-destructive/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="w-4 h-4 text-destructive" /></div>
            <div><p className="text-2xl font-bold">{critical}</p><p className="text-xs text-muted-foreground">{t('risk_card_critical')}</p></div>
          </CardContent>
        </Card>
        <Card className="border-chart-4/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-chart-4/10"><ShieldAlert className="w-4 h-4 text-chart-4" /></div>
            <div><p className="text-2xl font-bold">{high}</p><p className="text-xs text-muted-foreground">{t('risk_card_high')}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><TrendingUp className="w-4 h-4 text-primary" /></div>
            <div><p className="text-2xl font-bold">{openCount}</p><p className="text-xs text-muted-foreground">{t('risk_card_open')}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-chart-2/10"><FileText className="w-4 h-4 text-chart-2" /></div>
            <div><p className="text-2xl font-bold">{customerScoped.length}</p><p className="text-xs text-muted-foreground">{t('risk_card_total')}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Task Heatmap view */}
      {view === 'task_heatmap' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('risk_task_heatmap_title')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('risk_task_heatmap_desc')}</p>
          </CardHeader>
          <CardContent>
            <TaskHeatmap risks={filtered} />
          </CardContent>
        </Card>
      )}

      {/* Heatmap view */}
      {view === 'heatmap' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('risk_heatmap_title')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('risk_heatmap_desc')}</p>
          </CardHeader>
          <CardContent>
            <RiskHeatmap risks={filtered} onEdit={handleEdit} />
          </CardContent>
        </Card>
      )}

      {/* List view */}
      {view === 'list' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('risk_search_placeholder')} className="pl-9 w-56" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue placeholder={t('risk_filter_all_statuses')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('risk_filter_all_statuses')}</SelectItem>
                <SelectItem value="open">{t('risk_status_open')}</SelectItem>
                <SelectItem value="in_treatment">{t('risk_status_in_treatment')}</SelectItem>
                <SelectItem value="accepted">{t('risk_status_accepted')}</SelectItem>
                <SelectItem value="closed">{t('risk_status_closed')}</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All Customers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All Customers</SelectItem>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Risk list */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t('risk_empty')}</p>
              </div>
            ) : filtered.map(risk => {
              const score = riskScore(risk);
              const linkedDocs = getLinkedDocs(risk);
              return (
                <Card key={risk.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Score badge */}
                      <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 font-bold text-sm
                        ${score >= 16 ? 'bg-destructive/15 text-destructive' :
                          score >= 9 ? 'bg-chart-4/15 text-chart-4' :
                          score >= 4 ? 'bg-chart-3/15 text-chart-3' : 'bg-chart-2/15 text-chart-2'}`}>
                        <span className="text-lg leading-none">{score}</span>
                        <span className="text-[10px] opacity-70">{t('risk_score')}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {risk.risk_id && <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{risk.risk_id}</span>}
                          <p className="text-sm font-semibold">{risk.title}</p>
                          <RiskLevelBadge risk={risk} />
                          <Badge variant="outline" className={`text-xs border ${STATUS_STYLES[risk.status]}`}>
                            {STATUS_LABELS[risk.status]}
                          </Badge>
                          {risk.category && (
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {CATEGORY_LABELS[risk.category]}
                            </span>
                          )}
                        </div>

                        {risk.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{risk.description}</p>
                        )}

                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span>{t('risk_impact')}: <strong>{risk.impact}</strong></span>
                          <span>{t('risk_likelihood')}: <strong>{risk.likelihood}</strong></span>
                          {risk.owner_email && <span>{t('risk_owner')}: {risk.owner_email}</span>}
                          {risk.due_date && <span>{t('risk_due')}: {risk.due_date}</span>}
                          {isAdmin && risk.customer_name && <span>· {risk.customer_name}</span>}
                        </div>

                        {linkedDocs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {linkedDocs.map(d => (
                              <Badge key={d.id} variant="secondary" className="text-xs gap-1">
                                <FileText className="w-2.5 h-2.5" />{d.title}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {risk.treatment_notes && (
                          <p className="text-xs text-muted-foreground mt-1.5 italic border-l-2 border-muted pl-2">{risk.treatment_notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary hover:text-primary"
                          title={t('risk_tasks_button_title')}
                          onClick={() => handleEdit(risk, 'create_task')}>
                          <ClipboardList className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t('risk_tasks_button')}</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(risk)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(risk)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('risk_bulk_delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('risk_bulk_delete_desc')} <strong>{customerScoped.length}</strong> {customerScoped.length !== 1 ? 'risks' : 'risk'}. {t('risk_bulk_delete_desc2')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common_cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('risk_delete_all')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RiskExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleExcelImport}
      />

      <RiskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        risk={editingRisk}
        documents={documents}
        customers={customers}
        isAdmin={isAdmin}
        customerId={customerId}
        customerName={user?.customer_name}
        currentUser={user}
        initialTab={initialTab}
        onSave={(data) => saveMutation.mutateAsync(data)}
      />
    </div>
  );
}