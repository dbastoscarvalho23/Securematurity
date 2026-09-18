import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HardDrive, Loader2, Save, Info, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';

const ALL_PROVIDERS = ['base44', 'google_drive', 'one_drive'];

export default function CustomerStoragePanel() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [provider, setProvider] = useState('base44');
  const [saving, setSaving] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ['my-customer-storage'],
    queryFn: async () => {
      const list = await base44.entities.Customer.list();
      return list[0] || null;
    },
  });

  // Only providers the platform administrator enabled can be selected; the
  // customer's current provider always stays visible so it can be changed.
  const { data: config } = useQuery({
    queryKey: ['storage-settings'],
    queryFn: async () => {
      const list = await base44.entities.StorageSettings.list();
      return list[0] || null;
    },
  });

  // Which third-party accounts the platform is actually connected to.
  const { data: connections } = useQuery({
    queryKey: ['storage-provider-status'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getStorageProviders', {});
      return res.data?.status || {};
    },
  });

  const enabledProviders = config?.enabled_providers?.length ? config.enabled_providers : ALL_PROVIDERS;
  const providerOptions = Array.from(new Set([...enabledProviders, provider]));

  const isConnected = (id) => id === 'base44' || Boolean(connections?.[id]);

  useEffect(() => {
    setProvider(customer?.storage_provider || 'base44');
  }, [customer?.id, customer?.storage_provider]);

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

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('updateCustomerStorage', { provider });
      if (res.data?.error) throw new Error(res.data.error);
      queryClient.invalidateQueries({ queryKey: ['my-customer-storage'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(t('storage_customer_saved'));
    } catch (err) {
      toast.error(err?.message || t('storage_customer_error'));
    } finally {
      setSaving(false);
    }
  };

  if (!isLoading && !customer) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t('storage_customer_no_customer')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HardDrive className="w-4 h-4" />
          {t('storage_customer_title')}
        </CardTitle>
        <CardDescription>{t('storage_customer_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>{t('storage_customer_status_title')}</Label>
              <div className="divide-y rounded-lg border">
                {providerOptions.map((id) => (
                  <div key={id} className="flex items-start justify-between gap-3 p-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{providerLabel(id)}</p>
                      <p className="text-xs text-muted-foreground">{providerDescription(id)}</p>
                    </div>
                    {id === 'base44' ? (
                      <Badge variant="secondary" className="flex-shrink-0">
                        {t('storage_customer_always_available')}
                      </Badge>
                    ) : isConnected(id) ? (
                      <Badge
                        variant="outline"
                        className="flex-shrink-0 border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                      >
                        {t('storage_providers_status_connected')}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="flex-shrink-0 border-amber-500/20 bg-amber-500/10 text-amber-600"
                      >
                        {t('storage_providers_status_disconnected')}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 max-w-md">
              <Label>{t('storage_settings_provider')}</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {providerOptions.map((id) => (
                    <SelectItem key={id} value={id}>{providerLabel(id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('storage_customer_help')}</p>
            </div>

            {!isConnected(provider) && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{t('storage_customer_not_connected_warning')}</span>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{t('storage_customer_connection_note')}</span>
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