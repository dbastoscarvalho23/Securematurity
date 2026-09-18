import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';

const ALL_PROVIDERS = ['base44', 'google_drive', 'one_drive'];

export default function CustomerStorageAssignmentsPanel() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [drafts, setDrafts] = useState({});
  const [dirty, setDirty] = useState({});
  const [savingId, setSavingId] = useState(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customer-storage-assignments'],
    queryFn: () => base44.entities.Customer.list('name'),
  });

  const { data: config } = useQuery({
    queryKey: ['storage-settings'],
    queryFn: async () => {
      const list = await base44.entities.StorageSettings.list();
      return list[0] || null;
    },
  });

  const enabledProviders = config?.enabled_providers?.length ? config.enabled_providers : ALL_PROVIDERS;

  // Seed the drafts once per customer; never overwrite an unsaved selection.
  useEffect(() => {
    if (!customers.length) return;
    setDrafts((prev) => {
      const next = { ...prev };
      customers.forEach((c) => {
        if (next[c.id] === undefined) next[c.id] = c.storage_provider || 'base44';
      });
      return next;
    });
  }, [customers]);

  const providerLabel = (id) => {
    if (id === 'google_drive') return t('storage_provider_google_drive');
    if (id === 'one_drive') return t('storage_provider_one_drive');
    return t('storage_provider_base44');
  };

  const handleChange = (customer, value) => {
    setDrafts((prev) => ({ ...prev, [customer.id]: value }));
    setDirty((prev) => ({ ...prev, [customer.id]: value !== (customer.storage_provider || 'base44') }));
  };

  const handleSave = async (customer) => {
    const provider = drafts[customer.id];
    setSavingId(customer.id);
    try {
      const res = await base44.functions.invoke('updateCustomerStorage', {
        customer_id: customer.id,
        provider,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setDirty((prev) => ({ ...prev, [customer.id]: false }));
      queryClient.invalidateQueries({ queryKey: ['customer-storage-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(t('storage_assignments_saved'));
    } catch (err) {
      toast.error(err?.message || t('storage_assignments_error'));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          {t('storage_assignments_title')}
        </CardTitle>
        <CardDescription>{t('storage_assignments_desc')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : customers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('storage_assignments_empty')}</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {customers.map((customer) => {
              const current = drafts[customer.id] ?? customer.storage_provider ?? 'base44';
              const options = Array.from(new Set([...enabledProviders, current]));
              const isDirty = Boolean(dirty[customer.id]);
              const isSaving = savingId === customer.id;
              return (
                <div key={customer.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{customer.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={current} onValueChange={(value) => handleChange(customer, value)}>
                      <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {options.map((id) => (
                          <SelectItem key={id} value={id}>{providerLabel(id)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="gap-2"
                      disabled={!isDirty || isSaving}
                      onClick={() => handleSave(customer)}
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {t('storage_settings_save')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}