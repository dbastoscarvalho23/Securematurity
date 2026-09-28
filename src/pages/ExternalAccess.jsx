/**
 * ExternalAccess — manage delegated user-to-customer access (Fase 5).
 * Admins see all UserCustomerAssignment records, can create/revoke delegations.
 * Non-admin users see their own delegated access.
 *
 * Uses manageAssignment backend function (CRUD + resolve).
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Network, Plus, Trash2, ShieldOff, ShieldCheck, Loader2, UserCog } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { listAssignments, createAssignment, updateAssignment, deleteAssignment, DELEGATION_ROLES } from '@/lib/delegation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ROLE_BADGE = {
  viewer: 'secondary',
  contributor: 'default',
  admin: 'default',
};

export default function ExternalAccess() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [newDialog, setNewDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [newForm, setNewForm] = useState({ user_id: '', user_email: '', customer_id: '', customer_name: '', role_in_customer: 'viewer' });

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['external-access-assignments', user?.id],
    queryFn: () => listAssignments({ userId: isAdmin ? undefined : user?.id }),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: isAdmin,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (data) => createAssignment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-access-assignments'] });
      setNewDialog(false);
      setNewForm({ user_id: '', user_email: '', customer_id: '', customer_name: '', role_in_customer: 'viewer' });
      toast.success(t('ea_delegation_created'));
    },
    onError: (err) => toast.error(err?.message || t('common_save_error')),
  });

  const revokeMutation = useMutation({
    mutationFn: (id) => updateAssignment(id, { status: 'revoked' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-access-assignments'] });
      toast.success(t('ea_delegation_revoked'));
    },
    onError: () => toast.error(t('common_update_error')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-access-assignments'] });
      toast.success(t('ea_delegation_deleted'));
    },
    onError: () => toast.error(t('common_delete_error')),
  });

  const activeAssignments = assignments.filter(a => a.status === 'active');
  const revokedAssignments = assignments.filter(a => a.status === 'revoked');

  const handleUserSelect = (userId) => {
    const u = users.find(u => u.id === userId);
    setNewForm(prev => ({
      ...prev,
      user_id: userId,
      user_email: u?.email || '',
    }));
  };

  const handleCustomerSelect = (customerId) => {
    const c = customers.find(c => c.id === customerId);
    setNewForm(prev => ({
      ...prev,
      customer_id: customerId,
      customer_name: c?.name || '',
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav_external_access')}
        description={t('ea_subtitle')}
        actions={isAdmin && (
          <Button onClick={() => setNewDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            {t('ea_new_delegation')}
          </Button>
        )}
      />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeAssignments.length}</p>
              <p className="text-xs text-muted-foreground">{t('ea_active_delegations')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-muted text-muted-foreground">
              <ShieldOff className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{revokedAssignments.length}</p>
              <p className="text-xs text-muted-foreground">{t('ea_revoked_delegations')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{new Set(activeAssignments.map(a => a.user_email)).size}</p>
              <p className="text-xs text-muted-foreground">{t('ea_unique_users')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active delegations */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeAssignments.length === 0 ? (
            <EmptyState icon={Network} title={t('ea_no_delegations')} description={t('ea_no_delegations_desc')} />
          ) : (
            <div className="divide-y">
              {activeAssignments.map(a => (
                <div key={a.id} className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{a.user_email}</p>
                      <Badge variant={ROLE_BADGE[a.role_in_customer] || 'secondary'} className="text-xs">
                        {DELEGATION_ROLES[a.role_in_customer]?.label || a.role_in_customer}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {a.customer_name || a.customer_id}
                      {a.assigned_by && ` · ${t('ea_assigned_by')} ${a.assigned_by}`}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2 ml-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs text-amber-600"
                        onClick={() => revokeMutation.mutate(a.id)}
                        disabled={revokeMutation.isPending}
                      >
                        <ShieldOff className="w-3.5 h-3.5" />
                        {t('ea_revoke')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs text-destructive"
                        onClick={() => setDeleteConfirm(a)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoked delegations */}
      {revokedAssignments.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <h3 className="text-sm font-semibold text-muted-foreground">{t('ea_revoked_history')}</h3>
            </div>
            <div className="divide-y">
              {revokedAssignments.slice(0, 20).map(a => (
                <div key={a.id} className="flex items-center justify-between p-4 opacity-60">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{a.user_email}</p>
                    <p className="text-xs text-muted-foreground">{a.customer_name || a.customer_id}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{t('ea_revoked')}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New delegation dialog */}
      <Dialog open={newDialog} onOpenChange={setNewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('ea_new_delegation')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('ea_select_user')}</Label>
              <Select value={newForm.user_id} onValueChange={handleUserSelect}>
                <SelectTrigger><SelectValue placeholder={t('ea_select_user_ph')} /></SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('ea_select_customer')}</Label>
              <Select value={newForm.customer_id} onValueChange={handleCustomerSelect}>
                <SelectTrigger><SelectValue placeholder={t('common_select_customer_ph')} /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('ea_access_level')}</Label>
              <Select value={newForm.role_in_customer} onValueChange={v => setNewForm(prev => ({ ...prev, role_in_customer: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DELEGATION_ROLES).map(([key, { label, description }]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex flex-col">
                        <span>{label}</span>
                        <span className="text-xs text-muted-foreground">{description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialog(false)}>{t('common_cancel')}</Button>
            <Button
              onClick={() => createMutation.mutate(newForm)}
              disabled={createMutation.isPending || !newForm.user_id || !newForm.customer_id}
            >
              {createMutation.isPending ? t('common_loading') : t('common_create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !deleteMutation.isPending && setDeleteConfirm(open ? deleteConfirm : null)}
        title={t('ea_delete_title')}
        description={t('ea_delete_desc')}
        confirmLabel={t('common_delete')}
        cancelLabel={t('common_cancel')}
        onConfirm={() => {
          deleteMutation.mutate(deleteConfirm.id);
          setDeleteConfirm(null);
        }}
        loading={deleteMutation.isPending}
        destructive
      />
    </div>
  );
}
