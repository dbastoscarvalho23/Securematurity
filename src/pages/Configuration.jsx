import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, HardDrive, Settings as SettingsIcon, Mail } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import ReminderSettingsPanel from '@/components/settings/ReminderSettingsPanel';
import StorageSettingsPanel from '@/components/settings/StorageSettingsPanel';
import StorageProvidersPanel from '@/components/settings/StorageProvidersPanel';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Configuration() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';
  const isCustomerAdmin = user?.role === 'customer_admin';

  if (!isAdmin && !isCustomerAdmin) {
    return <EmptyState icon={SettingsIcon} title={t('common_no_permission')} className="h-64" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader description={t('config_subtitle')} />

      {/* Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" /> {t('settings_tab_reminders')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ReminderSettingsPanel />
        </CardContent>
      </Card>

      {/* Storage — admin only */}
      {isAdmin && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="w-4 h-4" /> {t('settings_tab_storage')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <StorageProvidersPanel />
              <StorageSettingsPanel />
            </CardContent>
          </Card>
        </>
      )}

      {/* Email report link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4" /> {t('nav_email_report')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => navigate('/email-report')}>
            {t('config_view_email_reports')} →
          </Button>
        </CardContent>
      </Card>

      {/* Settings link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" /> {t('nav_settings')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
            {t('config_view_full_settings')} →
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
