import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HardDrive, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import RepositorySettings, {
  initialRepositoryValue, repositoryPayload, repositoryChanged, repositoryValueError,
} from '@/components/storage/RepositorySettings';
import { applyCustomerStorage } from '@/lib/repository';

/**
 * Definições → Armazenamento, para o administrador do cliente: o mesmo componente da ficha do cliente.
 * Grava pela função updateCustomerStorage (só o próprio cliente). A ligação ao NAS só é configurada pelo
 * administrador da plataforma; aqui aparece o estado dela.
 */
export default function CustomerStoragePanel() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ['my-customer-storage', user?.customer_id],
    queryFn: async () => (user?.customer_id ? await base44.entities.Customer.get(user.customer_id) : (await base44.entities.Customer.list())[0]) || null,
  });

  const [value, setValue] = useState(() => initialRepositoryValue(null));
  useEffect(() => {
    if (customer) setValue(initialRepositoryValue(customer));
  }, [customer?.id, customer?.storage_provider, customer?.storage_root]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    const err = repositoryValueError(value);
    if (err) { toast.error(t(err)); return; }
    setSaving(true);
    try {
      await applyCustomerStorage(customer.id, repositoryPayload(value), { withNas: false });
      queryClient.invalidateQueries({ queryKey: ['my-customer-storage'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['repository-provider'] });
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
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <RepositorySettings customer={customer} value={value} onChange={setValue} canEditNas={false} />
            <div className="flex justify-end pt-2 border-t">
              <Button onClick={handleSave} disabled={saving || !repositoryChanged(customer, value)} className="gap-2">
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
