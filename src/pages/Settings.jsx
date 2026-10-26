import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
const UserManagementPanel = lazy(() => import('@/components/backoffice/UserManagementPanel'));
const FrameworksPanel = lazy(() => import('@/components/backoffice/FrameworksPanel'));
import { Settings as SettingsIcon, Trash2, User, Bell, FileBarChart, GraduationCap, HardDrive, Loader2, BadgeCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import MaintenanceWindowPanel from '@/components/settings/MaintenanceWindowPanel';
import StorageSettingsPanel from '@/components/settings/StorageSettingsPanel';
import CustomerStoragePanel from '@/components/settings/CustomerStoragePanel';
import StorageProvidersPanel from '@/components/settings/StorageProvidersPanel';
import CustomerStorageAssignmentsPanel from '@/components/settings/CustomerStorageAssignmentsPanel';
import ReminderSettingsPanel from '@/components/settings/ReminderSettingsPanel';
import LicenseSettingsPanel from '@/components/licensing/LicenseSettingsPanel';
import GeneratedReportsPanel from '@/components/genreports/GeneratedReportsPanel';
import TrainingReportsPanel from '@/components/genreports/TrainingReportsPanel';
import EmailSettingsPanel from '@/components/settings/EmailSettingsPanel';

export default function Settings() {
  const { user: currentUser, checkAppState, refreshUser } = useAuth();
  const { t } = useLanguage();
  const isAdmin = currentUser?.role === 'admin';
  const isCustomerAdmin = currentUser?.role === 'customer_admin';
  const isReadOnly = currentUser?.role === 'user';

  const [userToDelete, setUserToDelete] = useState(null);

  // Profile edit state (for current user's own profile)
  const [profileName, setProfileName] = useState('');
  const [profileCustomerId, setProfileCustomerId] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const queryClient = useQueryClient();

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

  // Pre-populate profile fields directly from the auth context user
  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.display_name || currentUser.full_name || '');
      setProfileCustomerId(currentUser.customer_id || '');
    }
  }, [currentUser?.email, currentUser?.display_name, currentUser?.full_name, currentUser?.customer_id]);

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

      <PageHeader description={t('settings_subtitle')} />

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">{t('settings_tab_users')}</TabsTrigger>
          <TabsTrigger value="frameworks">{t('settings_tab_frameworks')}</TabsTrigger>
          <TabsTrigger value="reminders" className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" />{t('settings_tab_reminders')}</TabsTrigger>
          {currentUser?.customer_id && <TabsTrigger value="license" className="flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5" />{t('settings_tab_license')}</TabsTrigger>}
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

          {(isAdmin || isCustomerAdmin) && (
            <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin mx-auto my-8" />}>
              <UserManagementPanel />
            </Suspense>
          )}
        </TabsContent>


        {/* Frameworks Tab */}
        <TabsContent value="frameworks" className="space-y-4 mt-4">
          <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin mx-auto my-8" />}>
            <FrameworksPanel />
          </Suspense>
        </TabsContent>

        {/* Reminders Tab */}
        {currentUser?.customer_id && (
          <TabsContent value="license" className="space-y-4 mt-4">
            <LicenseSettingsPanel />
          </TabsContent>
        )}

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
            <EmailSettingsPanel />
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