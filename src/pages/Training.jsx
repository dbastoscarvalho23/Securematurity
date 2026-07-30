import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/shared/PageHeader';
import TrainingUserRoster from '@/components/training/TrainingUserRoster';
import TrainingList from '@/components/training/TrainingList';
import TrainingCalendar from '@/components/training/TrainingCalendar';

export default function Training() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('name', 500),
    enabled: isAdmin,
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  useEffect(() => {
    if (isAdmin && customers.length && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, isAdmin, selectedCustomerId]);

  const { data: myCustomer } = useQuery({
    queryKey: ['customer', user?.customer_id],
    queryFn: () => base44.entities.Customer.get(user.customer_id),
    enabled: !isAdmin && !!user?.customer_id,
  });

  const customer = isAdmin
    ? customers.find(c => c.id === selectedCustomerId) || null
    : myCustomer || null;

  return (
    <div className="space-y-6">
      <PageHeader title={t('training_page_title')} />

      {isAdmin && (
        <div className="flex items-end gap-3">
          <div className="w-72">
            <Label className="text-xs">{t('common_customer')}</Label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder={t('training_select_customer')} /></SelectTrigger>
              <SelectContent>
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {customer ? (
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">{t('training_tab_users')}</TabsTrigger>
            <TabsTrigger value="trainings">{t('training_tab_trainings')}</TabsTrigger>
            <TabsTrigger value="calendar">{t('training_tab_calendar')}</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-6">
            <TrainingUserRoster customer={customer} />
          </TabsContent>
          <TabsContent value="trainings" className="mt-6">
            <TrainingList customer={customer} />
          </TabsContent>
          <TabsContent value="calendar" className="mt-6">
            <TrainingCalendar customer={customer} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          {isAdmin ? t('training_no_customer_admin') : t('common_loading')}
        </div>
      )}
    </div>
  );
}