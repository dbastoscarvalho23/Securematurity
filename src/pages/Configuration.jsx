/**
 * Configuration — single platform configuration screen.
 *
 * Frameworks and Notifications are available to whoever can reach the page;
 * Reports, System and Storage keep the historical admin gate.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Bell, FileBarChart, Settings as SettingsIcon, HardDrive, Mail } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import FrameworksPanel from '@/components/settings/FrameworksPanel';
import ReminderSettingsPanel from '@/components/settings/ReminderSettingsPanel';
import GeneratedReportsPanel from '@/components/genreports/GeneratedReportsPanel';
import TrainingReportsPanel from '@/components/genreports/TrainingReportsPanel';
import MaintenanceWindowPanel from '@/components/settings/MaintenanceWindowPanel';
import StorageSettingsPanel from '@/components/settings/StorageSettingsPanel';
import StorageProvidersPanel from '@/components/settings/StorageProvidersPanel';
import CustomerStoragePanel from '@/components/settings/CustomerStoragePanel';
import CustomerStorageAssignmentsPanel from '@/components/settings/CustomerStorageAssignmentsPanel';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { isPlatformOwner, hasRole } from '@/lib/rbac';

export default function Configuration() {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const isAdmin = isPlatformOwner(currentUser?.role);
  const isCustomerAdmin = currentUser?.role === 'customer_admin';
  const isReadOnly = hasRole(currentUser?.role, 'employee');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t('config_title')} description={t('config_subtitle')} />

      <Tabs defaultValue="frameworks">
        <TabsList>
          <TabsTrigger value="frameworks" className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            {t('config_tab_frameworks')}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            {t('config_tab_notifications')}
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="reports" className="flex items-center gap-1.5">
              <FileBarChart className="w-3.5 h-3.5" />
              {t('config_tab_reports')}
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="system" className="flex items-center gap-1.5">
              <SettingsIcon className="w-3.5 h-3.5" />
              {t('config_tab_system')}
            </TabsTrigger>
          )}
          {(isAdmin || isCustomerAdmin) && (
            <TabsTrigger value="storage" className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5" />
              {t('config_tab_storage')}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="frameworks" className="space-y-4 mt-4">
          <FrameworksPanel isAdmin={isAdmin} isReadOnly={isReadOnly} />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 mt-4">
          <ReminderSettingsPanel customers={customers} isAdmin={isAdmin} isReadOnly={isReadOnly} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {t('nav_email_report')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" onClick={() => navigate('/email-report')}>
                {t('config_view_email_reports')} →
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="reports" className="space-y-4 mt-4">
            <GeneratedReportsPanel customers={customers} />
            <TrainingReportsPanel />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="system" className="space-y-4 mt-4">
            <MaintenanceWindowPanel isAdmin={isAdmin} />
          </TabsContent>
        )}

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
