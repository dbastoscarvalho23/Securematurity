import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import EditUserDialog from '@/components/settings/EditUserDialog';
import { Loader2, UserPlus, Mail, Trash2, Pencil, Clock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';

/**
 * User management panel (invite, list, edit, delete) — admin and customer_admin only.
 * Extracted from the Settings "Users" tab so it can also be rendered in the Backoffice area.
 */
export default function UserManagementPanel() {
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const isAdmin = currentUser?.role === 'admin';
  const isCustomerAdmin = currentUser?.role === 'customer_admin';
  const queryClient = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [isInviting, setIsInviting] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [invitedToDelete, setInvitedToDelete] = useState(null);
  const [userToEdit, setUserToEdit] = useState(null);

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      const res = await base44.functions.invoke('manageUser', { action: 'delete', userId });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['customerUsers'] });
      queryClient.invalidateQueries({ queryKey: ['pendingInvites'] });
      queryClient.invalidateQueries({ queryKey: ['users-for-customer'] });
      toast.success(t('settings_user_deleted'));
      setUserToDelete(null);
    },
    onError: (err) => {
      toast.error(err?.message || t('settings_user_delete_error'));
    }
  });

  const deleteInvitedUserMutation = useMutation({
    mutationFn: async (invitedUserId) => {
      await base44.entities.InvitedUser.delete(invitedUserId);
    },
    onSuccess: () => {
      refetchInvited();
      toast.success(t('settings_invitation_deleted'));
      setInvitedToDelete(null);
    },
    onError: (err) => {
      toast.error(err?.message || t('settings_invitation_delete_error'));
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }) => {
      const res = await base44.functions.invoke('manageUser', { action: 'update', userId, data });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (result?.roleError) {
        toast.warning(t('x_user_role_not_changed', { error: result.roleError }));
      } else {
        toast.success(t('settings_user_updated'));
      }
      setUserToEdit(null);
    },
    onError: (err) => {
      toast.error(err?.message || t('settings_user_update_error'));
    }
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await base44.functions.invoke('listUsers', {});
      return res.data?.users || [];
    },
    enabled: isAdmin || isCustomerAdmin,
  });

  const { data: invitedUsers = [], refetch: refetchInvited } = useQuery({
    queryKey: ['invited-users'],
    queryFn: () => base44.entities.InvitedUser.list(),
  });

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setIsInviting(true);
    try {
      const me = await base44.auth.me();
      // base44.users.inviteUser only accepts 'user' or 'admin'.
      // We map customer_admin -> 'user' (upgraded later via EditUserDialog)
      // and keep the desired role tracked in InvitedUser.
      const platformRole = inviteRole === 'admin' ? 'admin' : 'user';
      const trackedRole = isCustomerAdmin ? 'user' : inviteRole;
      await base44.users.inviteUser(inviteEmail, platformRole);
      const alreadyTracked = invitedUsers.find(u => u.email === inviteEmail);
      // Platform admins are not tenant members: no InvitedUser tracking row for them.
      // A customer_admin's invite always belongs to their own customer (RLS requires it).
      if (!alreadyTracked && trackedRole !== 'admin') {
        await base44.entities.InvitedUser.create({
          email: inviteEmail,
          role: trackedRole,
          status: 'inactive',
          invited_by: me?.email || '',
          ...(isCustomerAdmin && me?.customer_id ? { customer_id: me.customer_id, customer_name: me.customer_name || '' } : {}),
        });
      }
      toast.success(`${t('settings_invitation_sent')} ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('user');
      refetchInvited();
    } catch (err) {
      toast.error(err?.message || `${t('settings_invitation_error')} ${inviteEmail}`);
    } finally {
      setIsInviting(false);
    }
  };

  if (!isAdmin && !isCustomerAdmin) return null;

  return (
    <div className="space-y-4">
      {/* Delete User Confirmation */}
      <ConfirmDialog
        open={!!userToDelete}
        onOpenChange={() => setUserToDelete(null)}
        title={t('settings_delete_user_title')}
        description={<>{t('settings_delete_user_desc')} <strong>{userToDelete?.email}</strong>? {t('settings_delete_user_undone')}</>}
        confirmLabel={deleteUserMutation.isPending ? t('common_deleting') : t('common_delete')}
        cancelLabel={t('common_cancel')}
        onConfirm={() => deleteUserMutation.mutate(userToDelete?.id)}
        loading={deleteUserMutation.isPending}
      />

      {/* Delete Invitation Confirmation */}
      <ConfirmDialog
        open={!!invitedToDelete}
        onOpenChange={() => setInvitedToDelete(null)}
        title={t('settings_delete_invite_title')}
        description={<>{t('settings_delete_invite_desc')} <strong>{invitedToDelete?.email}</strong>? {t('settings_delete_user_undone')}</>}
        confirmLabel={deleteInvitedUserMutation.isPending ? t('common_deleting') : t('common_delete')}
        cancelLabel={t('common_cancel')}
        onConfirm={() => deleteInvitedUserMutation.mutate(invitedToDelete?.id)}
        loading={deleteInvitedUserMutation.isPending}
      />

      {/* Edit User Dialog */}
      <EditUserDialog
        open={!!userToEdit}
        onOpenChange={(open) => !open && setUserToEdit(null)}
        user={userToEdit}
        customers={customers}
        currentUserRole={currentUser?.role}
        isSaving={updateUserMutation.isPending}
        onSave={(userId, data) => updateUserMutation.mutate({ userId, data })}
      />

      {/* Invite User */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            {t('settings_invite_user')}
          </CardTitle>
          <CardDescription>
            {isCustomerAdmin ? t('settings_invite_user_desc_customer') : t('settings_invite_user_desc_admin')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-48 space-y-1.5">
              <label className="text-sm font-medium">{t('settings_email')}</label>
              <Input
                type="email"
                placeholder={t('x_user_email_placeholder')}
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                required
              />
            </div>
            {isAdmin && (
              <div className="w-36 space-y-1.5">
                <label className="text-sm font-medium">{t('settings_role')}</label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">{t('settings_role_user')}</SelectItem>
                    <SelectItem value="customer_admin">{t('settings_role_customer_admin')}</SelectItem>
                    <SelectItem value="admin">{t('settings_role_admin')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" disabled={isInviting} className="gap-2">
              {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {isInviting ? t('common_sending') : t('settings_send_invite')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* All Users table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings_all_users')}</CardTitle>
          <CardDescription>
            {users.length} {t('settings_registered')} · {invitedUsers.filter(i => !users.find(u => u.email === i.email)).length} {t('settings_pending_invitation')}
            {(() => {
              const pending = users.filter(u => u.role !== 'admin' && !u.customer_id);
              return pending.length > 0
                ? ` · ${pending.length} ${t('settings_pending_activation_count')}`
                : '';
            })()}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('settings_col_name')}</TableHead>
                <TableHead>{t('settings_col_email')}</TableHead>
                <TableHead>{t('settings_col_customer')}</TableHead>
                <TableHead>{t('settings_col_role')}</TableHead>
                <TableHead>{t('settings_col_status')}</TableHead>
                <TableHead>{t('settings_col_joined')}</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.display_name || u.full_name || '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                  <TableCell className="text-sm">
                    {u.role === 'admin'
                      ? <span className="text-muted-foreground italic text-xs">{t('settings_na_admin')}</span>
                      : u.customer_name
                        ? <Badge variant="outline" className="text-xs">{u.customer_name}</Badge>
                        : <span className="text-destructive text-xs font-medium">{t('common_not_assigned')}</span>
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                      {u.role === 'customer_admin' ? t('settings_role_customer_admin') : u.role === 'admin' ? t('settings_role_admin') : t('settings_role_user')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.role !== 'admin' && !u.customer_id ? (
                      <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                        <Clock className="w-3 h-3 mr-1" />
                        {t('settings_pending_activation')}
                      </Badge>
                    ) : (
                      <Badge className="bg-accent/10 text-accent border-accent/20">{t('settings_user_active')}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {u.created_date ? new Date(u.created_date).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUserToEdit(u)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setUserToDelete(u)}
                        disabled={deleteUserMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {invitedUsers
                .filter(i => !users.find(u => u.email === i.email))
                .map(i => (
                  <TableRow key={i.id} className="opacity-60">
                    <TableCell className="font-medium text-muted-foreground">—</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{i.email}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">—</TableCell>
                    <TableCell>
                      <Badge variant={i.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                        {i.role === 'customer_admin' ? t('settings_role_customer_admin') : i.role === 'admin' ? t('settings_role_admin') : t('settings_role_user')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-muted-foreground">{t('settings_user_inactive')}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {t('settings_invited')} {i.created_date ? new Date(i.created_date).toLocaleDateString() : ''}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setInvitedToDelete(i)}
                        disabled={deleteInvitedUserMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
