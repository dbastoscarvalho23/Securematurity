import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Cloud, HardDrive, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { writeAuditLog } from '@/lib/auditLog';

const ALL_PROVIDERS = ['base44', 'google_drive', 'one_drive'];
const THIRD_PARTY_PROVIDERS = ['google_drive', 'one_drive'];

export default function StorageProvidersPanel() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [enabled, setEnabled] = useState(ALL_PROVIDERS);
  const [saving, setSaving] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['storage-settings'],
    queryFn: async () => {
      const list = await base44.entities.StorageSettings.list();
      return list[0] || null;
    },
  });

  const { data: connections, isLoading: isLoadingConnections } = useQuery({
    queryKey: ['storage-provider-connections'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getStorageProviders', {});
      if (res.data?.error) throw new Error(res.data.error);
      return res.data?.status || {};
    },
    retry: false,
  });

  useEffect(() => {
    setEnabled(config?.enabled_providers?.length ? config.enabled_providers : ALL_PROVIDERS);
  }, [config?.id, config?.enabled_providers]);

  const toggleProvider = (id, isOn) => {
    if (id === 'base44') return;
    setEnabled((prev) => (isOn ? Array.from(new Set([...prev, id])) : prev.filter((p) => p !== id)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { enabled_providers: enabled, updated_by_email: user?.email || '' };
      // Never leave the application default pointing at a provider that was just disabled.
      if (!enabled.includes(config?.provider || 'base44')) payload.provider = 'base44';

      if (config?.id) {
        await base44.entities.StorageSettings.update(config.id, payload);
      } else {
        await base44.entities.StorageSettings.create({ provider: 'base44', ...payload });
      }
      await writeAuditLog({
        action: 'settings_changed',
        entity_type: 'StorageSettings',
        entity_id: config?.id,
        details: `Storage providers enabled: ${enabled.join(', ')}`,
      });
      queryClient.invalidateQueries({ queryKey: ['storage-settings'] });
      toast.success(t('storage_providers_saved'));
    } catch (err) {
      toast.error(err?.message || t('storage_providers_error'));
    } finally {
      setSaving(false);
    }
  };

  const providerLabel = (id) => {
    if (id === 'google_drive') return t('storage_provider_google_drive');
    if (id === 'one_drive') return t('storage_provider_one_drive');
    return t('storage_provider_base44');
  };

  const providerDescription = (id) => {
    if (id === 'google_drive') return t('storage_providers_google_desc');
    if (id === 'one_drive') return t('storage_providers_one_drive_desc');
    return t('storage_providers_base44_desc');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Cloud className="w-4 h-4" />
          {t('storage_providers_title')}
        </CardTitle>
        <CardDescription>{t('storage_providers_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {ALL_PROVIDERS.map((id) => {
                const isThirdParty = THIRD_PARTY_PROVIDERS.includes(id);
                const isConnected = isThirdParty ? Boolean(connections?.[id]) : true;
                return (
                  <div key={id} className="flex items-start justify-between gap-4 rounded-lg border p-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <HardDrive className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{providerLabel(id)}</span>
                          {isThirdParty && !isLoadingConnections && (
                            <Badge variant={isConnected ? 'secondary' : 'outline'} className="text-[10px]">
                              {isConnected
                                ? t('storage_providers_status_connected')
                                : t('storage_providers_status_disconnected')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{providerDescription(id)}</p>
                        {isThirdParty && !isLoadingConnections && !isConnected && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('storage_providers_not_connected_hint')}
                          </p>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={enabled.includes(id)}
                      disabled={id === 'base44'}
                      onCheckedChange={(value) => toggleProvider(id, value)}
                    />
                  </div>
                );
              })}
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