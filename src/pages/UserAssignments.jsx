import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserCog, Plus, Trash2, Pencil, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
import { listAssignments, createAssignment, updateAssignment, deleteAssignment, DELEGATION_ROLES, STATUS_BADGES } from '@/lib/delegation';
import { isPlatformOwner } from '@/lib/rbac';
import { useActiveCustomer } from '@/lib/tenantContext';

function AssignmentFormDialog({ open, onClose, editing, users, customers, t }) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [roleInCustomer, setRoleInCustomer] = useState('viewer');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) {
      setUserId(editing?.user_id || '');
      setCustomerId(editing?.customer_id || '');
      setRoleInCustomer(editing?.role_in_customer || 'viewer');
    }
  }, [open, editing]);

  const handleSave = async () => {
    if (!userId || !customerId) {
      toast.error(t('common_required_field'));
      return;
    }
    setSaving(true);
    try {
      const user = users.find(u => u.id === userId);
      const customer = customers.find(c => c.id === customerId);
      if (editing) {
        await updateAssignment(editing.id, { role_in_customer: roleInCustomer });
        toast.success(t('assignment_updated'));
      } else {
        await createAssignment({
          userId,
          userEmail: user?.email,
          customerId,
          customerName: customer?.name,
          roleInCustomer,
        });
        toast.success(t('assignment_created'));
      }
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      onClose();
    } catch (error) {
      toast.error(error.message || t('common_error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await deleteAssignment(editing.id);
      toast.success(t('assignment_deleted'));
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      onClose();
    } catch (error) {
      toast.error(error.message || t('common_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t('assignment_edit') : t('assignment_new')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!editing && (
            <>
              <div className="space-y-2">
                <Label>{t('assignment_user')}</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger><SelectValue placeholder={t('assignment_select_user')} /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.display_name || u.email} {u.email && `(${u.email})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('assignment_customer')}</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder={t('assignment_select_customer')} /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>{t('assignment_role')}</Label>
            <Select value={roleInCustomer} onValueChange={setRoleInCustomer}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DELEGATION_ROLES).map(([code, meta]) => (
                  <SelectItem key={code} value={code}>{t(meta.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {editing && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              {t('assignment_user')}: <span className="font-medium">{editing.user_email}</span><br />
              {t('assignment_customer')}: <span className="font-medium">{editing.customer_name}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          {editing && (
            <Button variant="destructive" onClick={handleDelete} disabled={saving} className="mr-auto">
              <Trash2 className="w-4 h-4 mr-1" /> {t('common_delete')}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>{t('common_cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : null}
            {t('common_save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * `embedded` — usado pela página «Delegações», que já traz o seu próprio
 * cabeçalho de secção: sem ele a página não repete o cabeçalho da página.
 */
export default function UserAssignments({ embedded = false }) {
  const { user } = useAuth();
  // Âmbito do tenant pelo contexto único (FA2) — a página não o resolve por si.
  const { customerId } = useActiveCustomer();
  const { t } = useLanguage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const isAdmin = isPlatformOwner(user?.role);
  const isCustomerAdmin = user?.role === 'customer_admin';

  const { data: assignments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['assignments'],
    queryFn: () => listAssignments(),
    enabled: isAdmin || isCustomerAdmin,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['assign-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: isAdmin,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['assign-customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: isAdmin,
  });

  if (!isAdmin && !isCustomerAdmin) {
    return <EmptyState icon={UserCog} title={t('common_no_permission')} className="h-64" />;
  }

  const visibleAssignments = isAdmin ? assignments : assignments.filter(a => a.customer_id === customerId);

  const handleAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (assignment) => {
    setEditing(assignment);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {!embedded && <PageHeader description={t('assignment_subtitle')} />}

      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">
          {visibleAssignments.length} {t('assignment_total')}
        </Badge>
        {isAdmin && (
          <Button size="sm" onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-1" /> {t('assignment_new')}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isError ? (
            <ErrorState variant="inline" onRetry={() => refetch()} />
          ) : isLoading ? (
            <LoadingState variant="skeleton" rows={5} label={t('common_loading')} />
          ) : visibleAssignments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('assignment_col_user')}</TableHead>
                  <TableHead>{t('assignment_col_customer')}</TableHead>
                  <TableHead>{t('assignment_col_role')}</TableHead>
                  <TableHead>{t('assignment_col_assigned_by')}</TableHead>
                  <TableHead>{t('common_status')}</TableHead>
                  {isAdmin && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleAssignments.map(a => {
                  const roleMeta = DELEGATION_ROLES[a.role_in_customer] || DELEGATION_ROLES.viewer;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-sm">{a.user_email || '—'}</TableCell>
                      <TableCell className="text-sm">{a.customer_name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{t(roleMeta.labelKey)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.assigned_by || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${a.status === 'active' ? 'bg-chart-2/10 text-chart-2 border-chart-2/20' : 'bg-muted text-muted-foreground'}`}>
                          {STATUS_BADGES[a.status] ? t(STATUS_BADGES[a.status].labelKey) : a.status}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(a)}
                            aria-label={t('assignment_edit')}
                            title={t('assignment_edit')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={UserCog}
              title={t('assignment_empty')}
              description={t('assignment_empty_desc')}
              className="h-48"
            />
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <AssignmentFormDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          editing={editing}
          users={users}
          customers={customers}
          t={t}
        />
      )}
    </div>
  );
}
