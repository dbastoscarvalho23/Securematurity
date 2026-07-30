import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Truck, Globe, Mail, Phone, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { writeAuditLog } from '@/lib/auditLog';
import SupplierExcelImportDialog from '@/components/suppliers/SupplierExcelImportDialog';
import SupplierStatusTracker from '@/components/suppliers/SupplierStatusTracker';
import BulkActionBar from '@/components/shared/BulkActionBar';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

const emptyForm = { name: '', nif: '', contact_email: '', contact_phone: '', website: '', tier: 'tier_2', notes: '', status: 'active' };

export default function Suppliers() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const canBulkAction = user?.role === 'admin' || user?.role === 'customer_admin';
  const customerId = user?.customer_id;
  const queryClient = useQueryClient();

  const supplierStatusOptions = [
    { value: 'active', labelKey: 'suppliers_status_active' },
    { value: 'inactive', labelKey: 'suppliers_status_inactive' },
  ];

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatusConfirm, setBulkStatusConfirm] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [isBulkAction, setIsBulkAction] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);

  const queryKey = ['suppliers', customerId];
  const { data: suppliers = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => isAdmin
      ? base44.entities.Supplier.list('-created_date', 500)
      : base44.entities.Supplier.filter({ customer_id: customerId }, '-created_date', 500),
    enabled: isAdmin || !!customerId,
  });

  const { data: questionnaires = [] } = useQuery({
    queryKey: ['supplier-questionnaires', customerId],
    queryFn: () => isAdmin
      ? base44.entities.SupplierQuestionnaire.list('-created_date', 500)
      : base44.entities.SupplierQuestionnaire.filter({ customer_id: customerId }, '-created_date', 500),
    enabled: isAdmin || !!customerId,
  });

  const questionnaireByName = useMemo(() => {
    const map = new Map();
    for (const q of questionnaires) {
      const key = (q.supplier_name || '').trim().toLowerCase();
      if (key && !map.has(key)) map.set(key, q);
    }
    return map;
  }, [questionnaires]);

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase();
    return !q || s.name?.toLowerCase().includes(q) || s.nif?.toLowerCase().includes(q) || s.contact_email?.toLowerCase().includes(q);
  });

  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const allFilteredSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const toggleSelectAll = () => setSelectedIds(allFilteredSelected ? [] : filtered.map(s => s.id));

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...emptyForm, ...s }); setDialogOpen(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.nif || !form.contact_email || !form.contact_phone) {
      toast.error(t('suppliers_required_missing'));
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.Supplier.update(editing.id, form);
        toast.success(t('suppliers_updated'));
      } else {
        const payload = isAdmin && !customerId ? form : { ...form, customer_id: customerId };
        await base44.entities.Supplier.create(payload);
        toast.success(t('suppliers_created'));
      }
      queryClient.invalidateQueries({ queryKey });
      setDialogOpen(false);
    } catch (err) {
      toast.error(err?.message || t('suppliers_save_error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (s) => setSupplierToDelete(s);

  const executeDelete = async () => {
    if (!supplierToDelete) return;
    try {
      await base44.entities.Supplier.delete(supplierToDelete.id);
      queryClient.invalidateQueries({ queryKey });
      toast.success(t('suppliers_deleted'));
    } catch (err) {
      toast.error(err?.message || t('suppliers_save_error'));
    }
    setSupplierToDelete(null);
  };

  const handleBulkStatus = (status) => { setPendingStatus(status); setBulkStatusConfirm(true); };

  const executeBulkStatus = async () => {
    setIsBulkAction(true);
    try {
      await base44.entities.Supplier.bulkUpdate(selectedIds.map(id => ({ id, status: pendingStatus })));
      await writeAuditLog({ action: 'customer_updated', entity_type: 'Supplier', details: `Bulk updated ${selectedIds.length} suppliers → status: ${pendingStatus}` });
      toast.success(`${selectedIds.length} ${t('bulk_updated')}`);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey });
    } catch {
      toast.error(t('bulk_error'));
    }
    setIsBulkAction(false);
    setBulkStatusConfirm(false);
    setPendingStatus(null);
  };

  const handleBulkDelete = async () => {
    setIsBulkAction(true);
    try {
      for (const id of selectedIds) await base44.entities.Supplier.delete(id);
      await writeAuditLog({ action: 'customer_updated', entity_type: 'Supplier', details: `Bulk deleted ${selectedIds.length} suppliers` });
      toast.success(`${selectedIds.length} ${t('bulk_deleted')}`);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey });
    } catch {
      toast.error(t('bulk_error'));
    }
    setIsBulkAction(false);
    setBulkDeleteConfirm(false);
  };

  const handleExcelImport = async (rows) => {
    const valid = rows.filter(r => r.name && r.nif && r.contact_email && r.contact_phone);
    const payload = valid.map(r => isAdmin && !customerId ? r : { ...r, customer_id: customerId });
    if (!payload.length) {
      toast.error(t('suppliers_required_missing'));
      return;
    }
    const created = await base44.entities.Supplier.bulkCreate(payload);
    await writeAuditLog({ action: 'customer_updated', entity_type: 'Supplier', details: `Bulk imported ${created.length} suppliers from Excel` });
    queryClient.invalidateQueries({ queryKey });
    toast.success(`${created.length} ${created.length !== 1 ? t('suppliers_supplier_plural') : t('suppliers_supplier_singular')} ${t('suppliers_imported')}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description={t('suppliers_subtitle')}
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
              <FileSpreadsheet className="w-4 h-4" /> {t('suppliers_bulk_import')}
            </Button>
            <Button onClick={openNew} className="gap-2">
              <Plus className="w-4 h-4" /> {t('suppliers_new')}
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-2">
        {canBulkAction && filtered.length > 0 && (
          <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} aria-label={t('bulk_select_all')} />
        )}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('suppliers_search')} className="pl-9" />
        </div>
        <Badge variant="outline" className="ml-auto">{filtered.length} {t('suppliers_total')}</Badge>
      </div>

      {canBulkAction && (
        <BulkActionBar
          selectedCount={selectedIds.length}
          statusOptions={supplierStatusOptions}
          statusLabelKey="bulk_set_status"
          onBulkStatus={handleBulkStatus}
          onBulkDelete={isAdmin ? () => setBulkDeleteConfirm(true) : undefined}
          onClear={() => setSelectedIds([])}
          isProcessing={isBulkAction}
        />
      )}

      {isLoading ? (
        <LoadingState label={t('common_loading')} className="py-20" />
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-0">
          <EmptyState icon={Truck} title={t('suppliers_empty')} />
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => (
            <Card key={s.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {canBulkAction && (
                      <Checkbox
                        checked={selectedIds.includes(s.id)}
                        onCheckedChange={() => toggleSelect(s.id)}
                        onClick={e => e.stopPropagation()}
                        aria-label={t('bulk_select_all')}
                        className="flex-shrink-0"
                      />
                    )}
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Truck className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.nif}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(s)}><Pencil className="w-4 h-4 mr-2" /> {t('suppliers_edit')}</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(s)}><Trash2 className="w-4 h-4 mr-2" /> {t('suppliers_delete')}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  {s.contact_email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-3.5 h-3.5" /><span className="truncate">{s.contact_email}</span></div>}
                  {s.contact_phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-3.5 h-3.5" /><span>{s.contact_phone}</span></div>}
                  {s.website && <div className="flex items-center gap-2 text-muted-foreground"><Globe className="w-3.5 h-3.5" /><a href={s.website} target="_blank" rel="noreferrer" className="truncate hover:text-primary">{s.website}</a></div>}
                </div>
                {s.notes && <p className="mt-3 text-xs text-muted-foreground line-clamp-2">{s.notes}</p>}
                <div className="mt-3 flex items-center gap-2">
                  <StatusBadge status={s.status} label={s.status === 'active' ? t('suppliers_status_active') : t('suppliers_status_inactive')} />
                </div>
                <SupplierStatusTracker supplier={s} questionnaire={questionnaireByName.get((s.name || '').trim().toLowerCase())} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t('suppliers_edit') : t('suppliers_new')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('suppliers_name')} <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t('suppliers_nif')} <span className="text-destructive">*</span></Label>
                <Input value={form.nif} onChange={e => setForm({ ...form, nif: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t('suppliers_email')} <span className="text-destructive">*</span></Label>
                <Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t('suppliers_phone')} <span className="text-destructive">*</span></Label>
                <Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t('suppliers_website')}</Label>
                <Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('suppliers_form_tier')}</Label>
                <Select value={form.tier} onValueChange={v => setForm({ ...form, tier: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tier_1">{t('suppliers_tier_1')}</SelectItem>
                    <SelectItem value="tier_2">{t('suppliers_tier_2')}</SelectItem>
                    <SelectItem value="tier_3">{t('suppliers_tier_3')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t('suppliers_tier_help')}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t('suppliers_status')}</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('suppliers_status_active')}</SelectItem>
                    <SelectItem value="inactive">{t('suppliers_status_inactive')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('suppliers_notes')}</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">{t('suppliers_cancel')}</Button></DialogClose>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing ? t('suppliers_save') : t('suppliers_create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={bulkDeleteConfirm}
        onOpenChange={open => !isBulkAction && setBulkDeleteConfirm(open)}
        title={t('bulk_confirm_delete_title')}
        description={`${t('bulk_confirm_delete_desc')} ${selectedIds.length}? ${t('bulk_cannot_undo')}`}
        confirmLabel={t('suppliers_delete')}
        cancelLabel={t('suppliers_cancel')}
        onConfirm={handleBulkDelete}
        loading={isBulkAction}
      />

      <ConfirmDialog
        open={bulkStatusConfirm}
        onOpenChange={open => !isBulkAction && setBulkStatusConfirm(open)}
        title={t('bulk_confirm_status_title')}
        description={`${t('bulk_confirm_status_desc')} ${selectedIds.length} ${t('bulk_selected')} → ${pendingStatus ? t('suppliers_status_' + pendingStatus) : ''}`}
        confirmLabel={t('suppliers_save')}
        cancelLabel={t('suppliers_cancel')}
        onConfirm={executeBulkStatus}
        loading={isBulkAction}
        destructive={false}
      />

      <ConfirmDialog
        open={!!supplierToDelete}
        onOpenChange={(open) => !open && setSupplierToDelete(null)}
        title={t('suppliers_delete')}
        description={`${t('suppliers_delete_confirm')} "${supplierToDelete?.name}"?`}
        confirmLabel={t('suppliers_delete')}
        cancelLabel={t('suppliers_cancel')}
        onConfirm={executeDelete}
        destructive
      />

      <SupplierExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleExcelImport}
      />
    </div>
  );
}