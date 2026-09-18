import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HardDrive, FolderOpen, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { writeAuditLog } from '@/lib/auditLog';

export default function StorageSettingsPanel({ isAdmin }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [provider, setProvider] = useState('base44');
  const [saving, setSaving] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['storage-settings'],
    queryFn: async () => {
      const list = await base44.entities.StorageSettings.list();
      return list[0] || null;
    },
  });

  useEffect(() => {
    if (config?.provider) setProvider(config.provider);
  }, [config?.id, config?.provider]);

  const handleSave = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const payload = { provider, updated_by_email: user?.email || '' };
      if (config?.id) {
        await base44.entities.StorageSettings.update(config.id, payload);
      } else {
        await base44.entities.StorageSettings.create(payload);
      }
      await writeAuditLog({
        action: 'settings_changed',
        entity_type: 'StorageSettings',
        entity_id: config?.id,
        details: `Application storage provider set to ${provider}`,
      });
      queryClient.invalidateQueries({ queryKey: ['storage-settings'] });
      toast.success(t('storage_settings_saved'));
    } catch (err) {
      toast.error(err?.message || t('storage_settings_error'));
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t('storage_settings_admin_only')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HardDrive className="w-4 h-4" />
          {t('storage_settings_title')}
        </CardTitle>
        <CardDescription>{t('storage_settings_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-1.5 max-w-md">
              <Label>{t('storage_settings_provider')}</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="base44">{t('storage_provider_base44')}</SelectItem>
                  <SelectItem value="google_drive">{t('storage_provider_google_drive')}</SelectItem>
                  <SelectItem value="one_drive">{t('storage_provider_one_drive')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('storage_settings_provider_help')}</p>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/40 text-xs text-muted-foreground max-w-2xl">
              <FolderOpen className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>{t('storage_settings_folder_note')}</p>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('storage_settings_save')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}