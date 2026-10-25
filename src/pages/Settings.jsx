import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Settings as SettingsIcon, Shield, Loader2, UserPlus, Mail, Trash2, Pencil, User, Plus, ToggleLeft, ToggleRight, Bell, Link, Upload, FileText, ExternalLink, FileBarChart, GraduationCap, Clock, HardDrive } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { writeAuditLog } from '@/lib/auditLog';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import EditUserDialog from '@/components/settings/EditUserDialog';
import MaintenanceWindowPanel from '@/components/settings/MaintenanceWindowPanel';
import StorageSettingsPanel from '@/components/settings/StorageSettingsPanel';
import CustomerStoragePanel from '@/components/settings/CustomerStoragePanel';
import StorageProvidersPanel from '@/components/settings/StorageProvidersPanel';
import CustomerStorageAssignmentsPanel from '@/components/settings/CustomerStorageAssignmentsPanel';
import ReminderSettingsPanel from '@/components/settings/ReminderSettingsPanel';
import GeneratedReportsPanel from '@/components/genreports/GeneratedReportsPanel';
import TrainingReportsPanel from '@/components/genreports/TrainingReportsPanel';
import LegalSyncCard from '@/components/legal/LegalSyncCard';

export default function Settings() {
  const { user: currentUser, checkAppState, refreshUser } = useAuth();
  const { t } = useLanguage();
  const isAdmin = currentUser?.role === 'admin';
  const isCustomerAdmin = currentUser?.role === 'customer_admin';
  const isReadOnly = currentUser?.role === 'user';

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [isInviting, setIsInviting] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [invitedToDelete, setInvitedToDelete] = useState(null);
  const [userToEdit, setUserToEdit] = useState(null);
  const [newFwDialog, setNewFwDialog] = useState(false);
  const [newFwForm, setNewFwForm] = useState({ code: '', name: '', version: '', description: '', reference_url: '' });
  const [isSavingFw, setIsSavingFw] = useState(false);
  const [fwRefEdit, setFwRefEdit] = useState({}); // { [fw.id]: { url: '', uploading: false } }
  const [fwStatusConfirm, setFwStatusConfirm] = useState(null);
  const [fwUrlConfirm, setFwUrlConfirm] = useState(null);
  const [fwDocConfirm, setFwDocConfirm] = useState(null);
  const [fwCreateConfirm, setFwCreateConfirm] = useState(false);
  const [selectedFwIds, setSelectedFwIds] = useState([]);
  const [fwBulkConfirm, setFwBulkConfirm] = useState(null);
  const [isBulkFwAction, setIsBulkFwAction] = useState(false);

  const handleFwRefUrlSave = async (fw, url) => {
    await base44.entities.Framework.update(fw.id, { reference_url: url });
    queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], editingUrl: false } }));
    toast.success(t('settings_ref_link'));
  };

  const handleFwDocUpload = async (fw, file) => {
    setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], uploading: true } }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Framework.update(fw.id, { document_url: file_url, document_name: file.name });
    queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], uploading: false } }));
    toast.success(t('settings_doc_uploaded'));
  };

  // Profile edit state (for current user's own profile)
  const [profileName, setProfileName] = useState('');
  const [profileCustomerId, setProfileCustomerId] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const queryClient = useQueryClient();

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      const res = await base44.functions.invoke('adminDeleteUser', { userId });
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
      const res = await base44.functions.invoke('adminUpdateUser', { userId, data });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (result?.roleError) {
        toast.warning(`Profile updated, but role could not be changed: ${result.roleError}`);
      } else {
        toast.success(t('settings_user_updated'));
      }
      setUserToEdit(null);
    },
    onError: (err) => {
      toast.error(err?.message || t('settings_user_update_error'));
    }
  });

  const handleCreateFramework = async () => {
    if (!newFwForm.code || !newFwForm.name) return;
    setIsSavingFw(true);
    const result = await base44.entities.Framework.create({ ...newFwForm, status: 'active' });
    await writeAuditLog({ action: 'framework_created', entity_type: 'Framework', entity_id: result?.id, details: `Created framework: ${newFwForm.name} (${newFwForm.code})` });
    queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    setIsSavingFw(false);
    setNewFwDialog(false);
    setNewFwForm({ code: '', name: '', version: '', description: '', reference_url: '', document_url: '', document_name: '' });
    toast.success(t('settings_fw_created'));
  };

  const handleToggleFrameworkStatus = async (fw) => {
    const newStatus = fw.status === 'active' ? 'deprecated' : 'active';
    await base44.entities.Framework.update(fw.id, { status: newStatus });
    await writeAuditLog({ action: 'framework_status_changed', entity_type: 'Framework', entity_id: fw.id, details: `Framework ${fw.code} (${fw.name}) set to ${newStatus}` });
    queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    toast.success(`${t('settings_fw_framework')} ${newStatus === 'active' ? t('settings_fw_activated') : t('settings_fw_deactivated')}`);
  };

  const handleBulkFwAction = async () => {
    if (!fwBulkConfirm) return;
    setIsBulkFwAction(true);
    try {
      const { action, ids } = fwBulkConfirm;
      if (action === 'delete') {
        for (const id of ids) {
          await base44.entities.Framework.delete(id);
        }
        await writeAuditLog({ action: 'framework_status_changed', entity_type: 'Framework', details: `Bulk deleted ${ids.length} frameworks` });
        toast.success(`${ids.length} ${t('settings_fw_bulk_deleted')}`);
      } else {
        const newStatus = action === 'activate' ? 'active' : 'deprecated';
        for (const id of ids) {
          await base44.entities.Framework.update(id, { status: newStatus });
        }
        await writeAuditLog({ action: 'framework_status_changed', entity_type: 'Framework', details: `Bulk set ${ids.length} frameworks to ${newStatus}` });
        toast.success(`${ids.length} ${newStatus === 'active' ? t('settings_fw_activated') : t('settings_fw_deactivated')}`);
      }
      setSelectedFwIds([]);
      queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    } catch {
      toast.error(t('settings_fw_bulk_error'));
    }
    setIsBulkFwAction(false);
    setFwBulkConfirm(null);
  };

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: frameworks = [] } = useQuery({
    queryKey: ['frameworks'],
    queryFn: () => base44.entities.Framework.list(),
  });

  const { data: questions = [] } = useQuery({
    queryKey: ['questions'],
    queryFn: () => base44.entities.Question.list('-created_date', 500),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await base44.functions.invoke('listUsers', {});
      return res.data?.users || [];
    },
    enabled: isAdmin || isCustomerAdmin,
  });

  // Pre-populate profile fields directly from the auth context user
  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.display_name || currentUser.full_name || '');
      setProfileCustomerId(currentUser.customer_id || '');
    }
  }, [currentUser?.email, currentUser?.display_name, currentUser?.full_name, currentUser?.customer_id]);

  const { data: invitedUsers = [], refetch: refetchInvited } = useQuery({
    queryKey: ['invited-users'],
    queryFn: () => base44.entities.InvitedUser.list(),
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['all-responses'],
    queryFn: () => base44.entities.AssessmentResponse.list('-created_date', 2000),
  });

  // Compute weighted risk score per framework (0–5 scale)
  // Score = sum(maturity_level * weight) / sum(weight) for all answered questions
  const frameworkScores = {};
  questions.forEach(q => {
    const answered = responses.filter(r => r.question_id === q.id && r.maturity_level != null);
    if (answered.length === 0) return;
    const fw = q.framework_code;
    if (!frameworkScores[fw]) frameworkScores[fw] = { weightedSum: 0, totalWeight: 0, answeredCount: 0 };
    const w = q.weight || 1;
    // Average maturity across all responses for this question
    const avgLevel = answered.reduce((s, r) => s + r.maturity_level, 0) / answered.length;
    frameworkScores[fw].weightedSum += avgLevel * w;
    frameworkScores[fw].totalWeight += w;
    frameworkScores[fw].answeredCount += answered.length;
  });

  const getRiskScore = (code) => {
    const s = frameworkScores[code];
    if (!s || s.totalWeight === 0) return null;
    return s.weightedSum / s.totalWeight;
  };

  const getRiskLabel = (score) => {
    if (score === null) return { label: t('settings_fw_no_data'), color: 'text-muted-foreground' };
    if (score >= 4) return { label: t('settings_fw_low_risk'), color: 'text-accent' };
    if (score >= 3) return { label: t('settings_fw_moderate'), color: 'text-chart-3' };
    if (score >= 2) return { label: t('settings_fw_elevated'), color: 'text-chart-4' };
    return { label: t('settings_fw_high_risk'), color: 'text-destructive' };
  };

  // Derive current user's record from the users list
  const myRecord = users.find(u => u.email === currentUser?.email);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await base44.auth.updateMe({
        display_name: profileName,
      });
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('settings_profile_saved'));
    } catch (err) {
      toast.error(err?.message || t('settings_profile_error'));
    } finally {
      setIsSavingProfile(false);
    }
  };

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
      if (!alreadyTracked) {
        await base44.entities.InvitedUser.create({
          email: inviteEmail,
          role: trackedRole,
          status: 'inactive',
          invited_by: me?.email || '',
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


  return (
    <div className="space-y-6">
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
      <PageHeader description={t('settings_subtitle')} />

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">{t('settings_tab_users')}</TabsTrigger>
          <TabsTrigger value="frameworks">{t('settings_tab_frameworks')}</TabsTrigger>
          <TabsTrigger value="reminders" className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" />{t('settings_tab_reminders')}</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="generated-reports" className="flex items-center gap-1.5"><FileBarChart className="w-3.5 h-3.5" />{t('nav_generated_reports')}</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="reports" className="flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" />{t('settings_tab_reports')}</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="app" className="flex items-center gap-1.5"><SettingsIcon className="w-3.5 h-3.5" />{t('settings_tab_app')}</TabsTrigger>
          )}
          {(isAdmin || isCustomerAdmin) && (
            <TabsTrigger value="storage" className="flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5" />{t('settings_tab_storage')}</TabsTrigger>
          )}
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4 mt-4">

          {/* My Profile — visible to all users */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                {t('settings_my_profile')}
              </CardTitle>
              <CardDescription>{t('settings_my_profile_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t('settings_full_name')}</Label>
                    <Input
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      placeholder={t('settings_full_name_placeholder')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings_email')}</Label>
                    <Input
                      value={currentUser?.email || '—'}
                      disabled
                      className="bg-muted/50 text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings_role')}</Label>
                    <div className="flex items-center gap-2 h-9">
                      <Badge variant={currentUser?.role === 'admin' ? 'default' : 'secondary'}>
                        {currentUser?.role === 'customer_admin' ? t('settings_role_customer_admin') : currentUser?.role === 'admin' ? t('settings_role_admin') : t('settings_role_user')}
                      </Badge>
                      <Badge className="bg-accent/10 text-accent border-accent/20">{t('settings_user_active')}</Badge>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings_associated_customer')}</Label>
                    <Input
                      value={currentUser?.customer_name || '—'}
                      disabled
                      className="bg-muted/50 text-muted-foreground"
                    />
                    {currentUser?.role !== 'admin' && (
                      <p className="text-xs text-muted-foreground">{t('settings_customer_contact_admin')}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings_col_joined')}</Label>
                    <Input
                      value={currentUser?.created_date ? new Date(currentUser.created_date).toLocaleDateString() : '—'}
                      disabled
                      className="bg-muted/50 text-muted-foreground"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t gap-4">
                  <Button type="submit" disabled={isSavingProfile} size="sm" className="gap-2">
                    {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {t('settings_save_profile')}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => myRecord && setUserToDelete(myRecord)}
                  >
                    <Trash2 className="w-4 h-4" /> {t('settings_delete_account')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Invite User — available to admin and customer_admin */}
          {(isAdmin || isCustomerAdmin) && (
            <>
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
                        placeholder="user@example.com"
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

            </>
          )}

          {/* All Users table — admin and customer_admin */}
          {(isAdmin || isCustomerAdmin) && (
            <>
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
            </>
          )}
        </TabsContent>


        {/* Frameworks Tab */}
        <TabsContent value="frameworks" className="space-y-4 mt-4">
          {isAdmin && <LegalSyncCard />}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {t('settings_frameworks')}
                  </CardTitle>
                  <CardDescription>{t('settings_frameworks_desc')}</CardDescription>
                </div>
                {!isReadOnly && (
                  <div className="flex gap-2">
                    <Button onClick={() => setNewFwDialog(true)} className="gap-2">
                      <Plus className="w-4 h-4" /> {t('settings_new_framework')}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {frameworks.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-sm text-muted-foreground">{t('settings_no_frameworks')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Bulk action bar — admin only */}
                  {isAdmin && (
                    <div className="flex items-center gap-3 pb-3 border-b flex-wrap">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={frameworks.length > 0 && selectedFwIds.length === frameworks.length}
                          onCheckedChange={(checked) => setSelectedFwIds(checked ? frameworks.map(f => f.id) : [])}
                        />
                        <span className="text-xs text-muted-foreground">{t('settings_fw_select_all')}</span>
                      </div>
                      {selectedFwIds.length > 0 && (
                        <>
                          <span className="text-xs font-medium">{selectedFwIds.length} {t('settings_fw_selected')}</span>
                          <div className="flex gap-2 ml-auto">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setFwBulkConfirm({ action: 'activate', ids: [...selectedFwIds] })}>
                              <ToggleRight className="w-3.5 h-3.5" /> {t('settings_fw_bulk_activate')}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setFwBulkConfirm({ action: 'deactivate', ids: [...selectedFwIds] })}>
                              <ToggleLeft className="w-3.5 h-3.5" /> {t('settings_fw_bulk_deactivate')}
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5" onClick={() => setFwBulkConfirm({ action: 'delete', ids: [...selectedFwIds] })}>
                              <Trash2 className="w-3.5 h-3.5" /> {t('settings_fw_bulk_delete')}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {frameworks.map(fw => {
                    const fwQuestions = questions.filter(q => q.framework_code === fw.code);
                    const domains = [...new Set(fwQuestions.map(q => q.domain))];
                    const score = getRiskScore(fw.code);
                    const { label: riskLabel, color: riskColor } = getRiskLabel(score);
                    const isActive = fw.status === 'active';
                    return (
                      <div key={fw.id} className={`p-4 rounded-lg border transition-opacity ${isActive ? '' : 'opacity-60'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <Checkbox
                                checked={selectedFwIds.includes(fw.id)}
                                onCheckedChange={(checked) => setSelectedFwIds(prev => checked ? [...prev, fw.id] : prev.filter(id => id !== fw.id))}
                              />
                            )}
                            <p className="font-medium">{fw.name}</p>
                            <Badge variant="outline" className="text-xs font-mono">{fw.code}</Badge>
                            {fw.version && <span className="text-xs text-muted-foreground">v{fw.version}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            {isReadOnly ? (
                              <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                                isActive
                                  ? 'bg-accent/10 text-accent border-accent/20'
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}>
                                {isActive
                                  ? <><ToggleRight className="w-3.5 h-3.5" /> {t('settings_fw_active')}</>
                                  : <><ToggleLeft className="w-3.5 h-3.5" /> {t('settings_fw_inactive')}</>
                                }
                              </span>
                            ) : (
                              <button
                                onClick={() => setFwStatusConfirm(fw)}
                                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                                  isActive
                                    ? 'bg-accent/10 text-accent border-accent/20 hover:bg-accent/20'
                                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                                }`}
                                title={isActive ? t('settings_fw_click_deactivate') : t('settings_fw_click_activate')}
                              >
                                {isActive
                                  ? <><ToggleRight className="w-3.5 h-3.5" /> {t('settings_fw_active')}</>
                                  : <><ToggleLeft className="w-3.5 h-3.5" /> {t('settings_fw_inactive')}</>
                                }
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{fw.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {fwQuestions.length} {t('settings_fw_questions')} · {domains.length} {t('settings_fw_domains')}
                        </p>
                        {fw.created_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('settings_fw_created_on')} {new Date(fw.created_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {fw.updated_date && fw.updated_date !== fw.created_date && (
                              <> · {t('settings_fw_modified_on')} {new Date(fw.updated_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                            )}
                          </p>
                        )}
                        {/* Risk Score */}
                        {isActive && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-muted-foreground">{t('settings_fw_overall_score')}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold ${riskColor}`}>{riskLabel}</span>
                                {score !== null && (
                                  <span className="text-xs font-mono font-bold">{score.toFixed(2)} / 5.00</span>
                                )}
                              </div>
                            </div>
                            {score !== null ? (
                              <Progress value={(score / 5) * 100} className="h-2" />
                            ) : (
                              <p className="text-xs text-muted-foreground italic">{t('settings_fw_no_responses')}</p>
                            )}
                          </div>
                        )}

                        {/* Reference Link & Document — visible to all, editable by admin */}
                        <div className="mt-3 pt-3 border-t space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('settings_fw_docs_section')}</p>
                          {/* Reference URL */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            {isAdmin && fwRefEdit[fw.id]?.editingUrl ? (
                              <form className="flex gap-2 flex-1" onSubmit={e => { e.preventDefault(); setFwUrlConfirm({ fw, url: fwRefEdit[fw.id]?.url ?? fw.reference_url ?? '' }); }}>
                                <Input
                                  autoFocus
                                  className="h-7 text-xs flex-1"
                                  placeholder="https://..."
                                  value={fwRefEdit[fw.id]?.url ?? fw.reference_url ?? ''}
                                  onChange={e => setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], url: e.target.value } }))}
                                />
                                <Button type="submit" size="sm" className="h-7 text-xs px-3">{t('common_save')}</Button>
                                 <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], editingUrl: false } }))}>{t('common_cancel')}</Button>
                              </form>
                            ) : fw.reference_url ? (
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <a href={fw.reference_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />{fw.reference_url}
                                </a>
                                {!isReadOnly && (
                                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs flex-shrink-0" onClick={() => setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], editingUrl: true, url: fw.reference_url } }))}>{t('common_edit')}</Button>
                                )}
                              </div>
                            ) : isAdmin ? (
                              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={() => setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], editingUrl: true, url: '' } }))}>
                                {t('docs_add_ref_link')}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">{t('settings_fw_no_link')}</span>
                            )}
                          </div>

                          {/* Document upload */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            {fw.document_url ? (
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <a href={fw.document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />{fw.document_name || t('settings_fw_ref_doc_fallback')}
                                </a>
                                {isAdmin && (
                                  <label className="cursor-pointer">
                                    <span className="text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-0.5">{t('docs_replace')}</span>
                                    <input type="file" className="hidden" onChange={e => { if (e.target.files[0]) setFwDocConfirm({ fw, file: e.target.files[0] }); e.target.value = ''; }} />
                                  </label>
                                )}
                              </div>
                            ) : isAdmin ? (
                              <label className="cursor-pointer flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                                {fwRefEdit[fw.id]?.uploading
                                  ? <><Loader2 className="w-3 h-3 animate-spin" /> {t('common_uploading')}</>
                                  : <><Upload className="w-3 h-3" /> {t('docs_upload_doc')}</>
                                }
                                <input type="file" className="hidden" disabled={fwRefEdit[fw.id]?.uploading} onChange={e => { if (e.target.files[0]) setFwDocConfirm({ fw, file: e.target.files[0] }); e.target.value = ''; }} />
                              </label>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">{t('settings_fw_no_doc')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Framework Status Toggle Confirmation */}
          <ConfirmDialog
            open={!!fwStatusConfirm}
            onOpenChange={() => setFwStatusConfirm(null)}
            title={t('settings_fw_confirm_status')}
            description={<>{t('settings_fw_confirm_status_desc')} <strong>{fwStatusConfirm?.status === 'active' ? t('settings_fw_deactivate') : t('settings_fw_activate')}</strong> {t('settings_fw_framework').toLowerCase()} <strong>{fwStatusConfirm?.name}</strong>?</>}
            confirmLabel={t('common_confirm')}
            cancelLabel={t('common_cancel')}
            onConfirm={() => { handleToggleFrameworkStatus(fwStatusConfirm); setFwStatusConfirm(null); }}
            destructive={false}
          />

          {/* Framework URL Save Confirmation */}
          <ConfirmDialog
            open={!!fwUrlConfirm}
            onOpenChange={() => setFwUrlConfirm(null)}
            title={t('settings_fw_confirm_url')}
            description={<>{t('settings_fw_confirm_url_desc')} <strong>{fwUrlConfirm?.fw?.name}</strong>?</>}
            confirmLabel={t('common_confirm')}
            cancelLabel={t('common_cancel')}
            onConfirm={() => { handleFwRefUrlSave(fwUrlConfirm.fw, fwUrlConfirm.url); setFwUrlConfirm(null); }}
            destructive={false}
          />

          {/* Framework Document Upload Confirmation */}
          <ConfirmDialog
            open={!!fwDocConfirm}
            onOpenChange={() => setFwDocConfirm(null)}
            title={t('settings_fw_confirm_doc')}
            description={<>{t('settings_fw_confirm_doc_desc')} <strong>{fwDocConfirm?.fw?.name}</strong>?{fwDocConfirm?.fw?.document_url && <><br />{t('settings_fw_confirm_doc_replace')}</>}</>}
            confirmLabel={t('common_confirm')}
            cancelLabel={t('common_cancel')}
            onConfirm={() => { handleFwDocUpload(fwDocConfirm.fw, fwDocConfirm.file); setFwDocConfirm(null); }}
            destructive={false}
          />

          {/* Framework Create Confirmation */}
          <ConfirmDialog
            open={fwCreateConfirm}
            onOpenChange={setFwCreateConfirm}
            title={t('settings_fw_confirm_create')}
            description={<>{t('settings_fw_confirm_create_desc')} <strong>{newFwForm.name}</strong> (<strong>{newFwForm.code}</strong>)?</>}
            confirmLabel={t('common_confirm')}
            cancelLabel={t('common_cancel')}
            onConfirm={() => { setFwCreateConfirm(false); handleCreateFramework(); }}
            destructive={false}
          />

          {/* Bulk Framework Action Confirmation */}
          <ConfirmDialog
            open={!!fwBulkConfirm}
            onOpenChange={(open) => !isBulkFwAction && !open && setFwBulkConfirm(null)}
            title={fwBulkConfirm?.action === 'delete' ? t('settings_fw_bulk_confirm_delete_title') : t('settings_fw_bulk_confirm_toggle_title')}
            description={fwBulkConfirm?.action === 'delete'
              ? `${t('settings_fw_bulk_confirm_delete_desc')} ${fwBulkConfirm?.ids.length}? ${t('settings_fw_bulk_cannot_undo')}`
              : `${t('settings_fw_bulk_confirm_toggle_desc')} ${fwBulkConfirm?.ids.length}?`}
            confirmLabel={t('common_confirm')}
            cancelLabel={t('common_cancel')}
            onConfirm={handleBulkFwAction}
            loading={isBulkFwAction}
            destructive={fwBulkConfirm?.action === 'delete'}
          />

          {/* New Framework Dialog */}
          <Dialog open={newFwDialog} onOpenChange={setNewFwDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('settings_fw_new_dialog_title')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t('settings_fw_code')}</Label>
                    <Input
                      value={newFwForm.code}
                      onChange={e => setNewFwForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                      placeholder="e.g. ISO27001"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings_fw_version')}</Label>
                    <Input
                      value={newFwForm.version}
                      onChange={e => setNewFwForm(p => ({ ...p, version: e.target.value }))}
                      placeholder="e.g. 2022"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings_fw_name')}</Label>
                  <Input
                    value={newFwForm.name}
                    onChange={e => setNewFwForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. ISO/IEC 27001:2022"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings_fw_description')}</Label>
                  <Textarea
                    value={newFwForm.description}
                    onChange={e => setNewFwForm(p => ({ ...p, description: e.target.value }))}
                    placeholder={t('settings_fw_desc_placeholder')}
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings_fw_ref_url')}</Label>
                  <Input
                    value={newFwForm.reference_url}
                    onChange={e => setNewFwForm(p => ({ ...p, reference_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings_fw_ref_doc')}</Label>
                  {newFwForm.document_name ? (
                    <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/40 text-sm">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1 text-xs">{newFwForm.document_name}</span>
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setNewFwForm(p => ({ ...p, document_url: '', document_name: '' }))}>{t('settings_fw_remove')}</Button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 cursor-pointer border border-dashed rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors">
                      {newFwForm.uploadingDoc
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('common_uploading')}</>
                        : <><Upload className="w-4 h-4" /> {t('docs_upload_doc')}</>
                      }
                      <input type="file" className="hidden" disabled={newFwForm.uploadingDoc} onChange={async e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        setNewFwForm(p => ({ ...p, uploadingDoc: true }));
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        setNewFwForm(p => ({ ...p, document_url: file_url, document_name: file.name, uploadingDoc: false }));
                      }} />
                    </label>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewFwDialog(false)}>{t('common_cancel')}</Button>
                <Button onClick={() => setFwCreateConfirm(true)} disabled={isSavingFw || !newFwForm.code || !newFwForm.name}>
                  {isSavingFw ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t('settings_fw_create')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="space-y-4 mt-4">
          <ReminderSettingsPanel customers={customers} isAdmin={isAdmin} isReadOnly={isReadOnly} />
        </TabsContent>

        {/* Generated Reports Tab — admin only */}
        {isAdmin && (
          <TabsContent value="generated-reports" className="space-y-4 mt-4">
            <GeneratedReportsPanel customers={customers} />
          </TabsContent>
        )}

        {/* Training Reports Tab — admin only */}
        {isAdmin && (
          <TabsContent value="reports" className="space-y-4 mt-4">
            <TrainingReportsPanel />
          </TabsContent>
        )}

        {/* App Tab — maintenance window configuration */}
        {isAdmin && (
          <TabsContent value="app" className="space-y-4 mt-4">
            <MaintenanceWindowPanel isAdmin={isAdmin} />
          </TabsContent>
        )}

        {/* Storage Tab — external storage configuration */}
        {(isAdmin || isCustomerAdmin) && (
          <TabsContent value="storage" className="space-y-4 mt-4">
            {isAdmin && <StorageProvidersPanel />}
            {isAdmin && <StorageSettingsPanel isAdmin={isAdmin} />}
            {isAdmin && <CustomerStorageAssignmentsPanel />}
            {isCustomerAdmin && <CustomerStoragePanel />}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}