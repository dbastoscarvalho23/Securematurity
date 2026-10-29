import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/shared/PageHeader';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import AssetsTab from '@/components/assets/AssetsTab';
import ToolsTab from '@/components/assets/ToolsTab';
import CveTab from '@/components/assets/CveTab';
import { useLicense, hasModule } from '@/lib/licensing';

export default function AssetsTools() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [params, setParams] = useSearchParams();
  const { data: license } = useLicense();
  const cveAllowed = hasModule(license, user, 'cve_monitoring');
  const tab = ['tools', ...(cveAllowed ? ['cve'] : [])].includes(params.get('tab')) ? params.get('tab') : 'assets';
  const [selected, setSelected] = useState(params.get('customer') || null);
  const customerId = isAdmin ? selected : user?.customer_id;

  const { data: customers = [] } = useQuery({
    queryKey: ['assets-customers'],
    queryFn: () => base44.entities.Customer.list('name', 500),
    enabled: isAdmin,
  });
  const { data: customer } = useQuery({
    queryKey: ['assets-customer', customerId],
    queryFn: () => base44.entities.Customer.get(customerId),
    enabled: Boolean(customerId),
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t('at_title')} description={t('at_subtitle')}
        actions={isAdmin && (
          <Select value={selected || undefined} onValueChange={setSelected}>
            <SelectTrigger className="w-64"><SelectValue placeholder={t('common_select_customer')} /></SelectTrigger>
            <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        )} />
      {!customerId ? (
        <p className="text-sm text-muted-foreground">{isAdmin ? t('at_pick_customer') : t('at_no_customer')}</p>
      ) : !customer ? (
        <p className="text-sm text-muted-foreground">{t('common_loading')}</p>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
          <TabsList>
            <TabsTrigger value="assets">{t('at_tab_assets')}</TabsTrigger>
            <TabsTrigger value="tools">{t('at_tab_tools')}</TabsTrigger>
            {cveAllowed && <TabsTrigger value="cve">{t('cve_tab')}</TabsTrigger>}
          </TabsList>
          <TabsContent value="assets" className="mt-4">{tab === 'assets' && <AssetsTab customer={customer} />}</TabsContent>
          <TabsContent value="tools" className="mt-4">{tab === 'tools' && <ToolsTab customer={customer} />}</TabsContent>
          <TabsContent value="cve" className="mt-4">{tab === 'cve' && <CveTab customer={customer} />}</TabsContent>
        </Tabs>
      )}
    </div>
  );
}
