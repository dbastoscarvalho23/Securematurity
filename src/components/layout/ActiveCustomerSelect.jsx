import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { delegatedLevels } from '@/lib/activeCustomer';

/**
 * Cliente ativo de um consultor (acesso delegado). Só aparece para o papel `consultant`. A lista vem das regras de
 * acesso: Customer.list só devolve os clientes que concederam acesso. Mudar de cliente limpa os dados em cache.
 */
export default function ActiveCustomerSelect() {
  const { user, rawUser, setActiveCustomer } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isConsultant = user?.platform_role === 'consultant';
  const { data: customers = [] } = useQuery({
    queryKey: ['consultant-customers', (user?.accessible_customer_ids || []).join(',')],
    queryFn: () => base44.entities.Customer.list('name', 500),
    enabled: isConsultant,
  });
  if (!isConsultant) return null;
  const levels = delegatedLevels(rawUser);
  const options = customers.filter((c) => levels[c.id]);

  const change = (id) => {
    setActiveCustomer(id);
    queryClient.removeQueries({ predicate: (q) => q.queryKey?.[0] !== 'consultant-customers' });
    navigate('/');
  };

  return (
    <div className="flex items-center gap-2">
      <Building2 className="w-4 h-4 text-muted-foreground hidden sm:block" />
      <Select value={user.customer_id || undefined} onValueChange={change}>
        <SelectTrigger className="h-8 w-48 text-xs" aria-label={t('acc_active_customer')}>
          <SelectValue placeholder={t('acc_choose_customer')} />
        </SelectTrigger>
        <SelectContent>
          {options.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name} · {t(`acc_level_${levels[c.id]}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {user.read_only && <Badge variant="outline" className="text-[10px] hidden md:inline-flex">{t('acc_read_only')}</Badge>}
    </div>
  );
}
