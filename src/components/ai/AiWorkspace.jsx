import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useLicense, hasModule } from '@/lib/licensing';
import AiDraftsList from './AiDraftsList';
import AiDraftDialog from './AiDraftDialog';

/** Relatório anual com IA e lista de rascunhos (página Evidências). Só admin e administrador do cliente com o módulo. */
export default function AiWorkspace() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [selected, setSelected] = useState(null);
  const customerId = isAdmin ? selected : user?.customer_id;
  const { data: license } = useLicense(isAdmin ? customerId || undefined : undefined);
  const lastYear = new Date().getFullYear() - 1;
  const [year, setYear] = useState(String(lastYear));
  const [open, setOpen] = useState(false);
  const { data: customers = [] } = useQuery({ queryKey: ['ai-customers'], queryFn: () => base44.entities.Customer.list('name', 500), enabled: isAdmin });
  if (!(isAdmin || user?.role === 'customer_admin') || !hasModule(license, user, 'ai_assistant')) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        {isAdmin && (
          <Select value={selected || undefined} onValueChange={setSelected}>
            <SelectTrigger className="w-56 h-8 text-xs"><SelectValue placeholder={t('common_select_customer')} /></SelectTrigger>
            <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{[0, 1, 2].map((d) => String(lastYear + 1 - d)).map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={!customerId} onClick={() => setOpen(true)}><FileText className="w-3.5 h-3.5 mr-1" />{t('ai_annual_button')}</Button>
      </div>
      <AiDraftsList customerId={customerId} />
      <AiDraftDialog open={open} onOpenChange={setOpen} customerId={customerId} target={{ type: 'annual_report', year: Number(year) }} kinds={['annual']} title={`${t('ai_kind_annual')} — ${year}`} />
    </div>
  );
}
