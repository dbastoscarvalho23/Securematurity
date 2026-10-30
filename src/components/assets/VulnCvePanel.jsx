import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BellRing, ChevronDown, ChevronUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import CveTab from './CveTab';

/** Secção «Alertas CVE» na página de Vulnerabilidades: escolher o cliente e ver/tratar os alertas. */
export default function VulnCvePanel() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(true);
  const customerId = isAdmin ? selected : user?.customer_id;
  const { data: customers = [] } = useQuery({ queryKey: ['cve-customers'], queryFn: () => base44.entities.Customer.list('name', 500), enabled: isAdmin });
  const { data: customer } = useQuery({ queryKey: ['assets-customer', customerId], queryFn: () => base44.entities.Customer.get(customerId), enabled: Boolean(customerId) });
  // Contagem de alertas em aberto em todos os clientes visíveis (admin) ou no próprio.
  const { data: openAlerts = [] } = useQuery({
    queryKey: ['cve-open-alerts', isAdmin ? 'all' : customerId],
    queryFn: () => base44.entities.CveAlert.filter(isAdmin ? { status: 'new' } : { customer_id: customerId, status: 'new' }, '-published', 2000),
    enabled: isAdmin || Boolean(customerId),
  });
  const perCustomer = openAlerts.reduce((acc, a) => { acc[a.customer_id] = (acc[a.customer_id] || 0) + 1; return acc; }, {});

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BellRing className="w-4 h-4 text-primary" />{t('cve_section_title')}
            {openAlerts.length > 0 && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">{t('cve_new_count', { n: openAlerts.length })}</Badge>}
          </CardTitle>
          <div className="flex gap-2">
            {isAdmin && (
              <Select value={selected || undefined} onValueChange={setSelected}>
                <SelectTrigger className="w-64 h-8 text-xs"><SelectValue placeholder={t('common_select_customer')} /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{perCustomer[c.id] ? ` (${perCustomer[c.id]})` : ''}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen((v) => !v)}>{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t('cve_section_help')}</p>
      </CardHeader>
      {open && (
        <CardContent>
          {!customerId ? <p className="text-sm text-muted-foreground">{t('at_pick_customer')}</p> : !customer ? <p className="text-sm text-muted-foreground">{t('common_loading')}</p> : <CveTab customer={customer} />}
        </CardContent>
      )}
    </Card>
  );
}
