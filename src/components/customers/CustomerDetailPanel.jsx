import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Mail, Phone, Globe, Users, Briefcase, Hash, Pencil, ExternalLink, ShieldCheck, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import CustomerSeatSection from './CustomerSeatSection';

const statusStyles = {
  active: 'bg-accent/10 text-accent border-accent/20',
  inactive: 'bg-muted text-muted-foreground',
  onboarding: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
};

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3 h-3 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 py-1">{children}</div>}
    </div>
  );
}

export default function CustomerDetailPanel({ customer, onEdit }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const canManageUsers = user?.role === 'admin' || user?.role === 'customer_admin';

  if (!customer) return null;

  return (
    <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b bg-muted/20">
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-lg font-bold flex-shrink-0">
          {customer.name?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base leading-tight truncate">{customer.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className={cn("text-xs border", statusStyles[customer.status])}>
              {t(`customers_status_${customer.status}`) || customer.status}
            </Badge>
            {customer.sector && (
              <span className="text-xs text-muted-foreground capitalize">{customer.sector.replace(/_/g, ' ')}</span>
            )}
            {customer.num_employees && (
              <span className="text-xs text-muted-foreground">{customer.num_employees} {t('customers_col_employees').toLowerCase()}</span>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 flex-shrink-0" onClick={() => onEdit(customer)}>
          <Pencil className="w-3.5 h-3.5" /> {t('customers_menu_edit')}
        </Button>
      </div>

      {/* Collapsible Sections */}
      <div className="p-4 space-y-2">

        <Section title={t('customers_detail_general')} defaultOpen={true}>
          <InfoRow icon={Hash} label="NIF" value={customer.nif} />
          <InfoRow icon={Building2} label={t('customers_col_sector')} value={customer.sector?.replace(/_/g, ' ')} />
          <InfoRow icon={Briefcase} label={t('customers_col_employees')} value={customer.num_employees} />
          {customer.website && (
            <div className="flex items-start gap-3 py-2 border-b last:border-0">
              <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                <Globe className="w-3 h-3 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('customers_detail_website')}</p>
                <a href={customer.website} target="_blank" rel="noreferrer"
                  className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                  {customer.website} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </Section>

        <Section title={t('customers_detail_contact')} defaultOpen={true}>
          <InfoRow icon={Users} label={t('customers_detail_contact_name')} value={customer.contact_name} />
          <InfoRow icon={Mail} label={t('customers_detail_contact_email')} value={customer.contact_email} />
          <InfoRow icon={Phone} label={t('customers_detail_contact_phone')} value={customer.contact_phone} />
        </Section>

        <Section title={t('customers_col_csm')} defaultOpen={true}>
          <InfoRow icon={ShieldCheck} label={t('customers_detail_csm_name')} value={customer.cybersecurity_manager} />
          <InfoRow icon={Mail} label={t('customers_detail_csm_email')} value={customer.cybersecurity_manager_email} />
          <InfoRow icon={Phone} label={t('customers_detail_csm_phone')} value={customer.cybersecurity_manager_phone} />
        </Section>

        {customer.allowed_frameworks?.length > 0 && (
          <Section title={t('customers_detail_frameworks')} defaultOpen={false}>
            <div className="flex flex-wrap gap-1.5 py-2">
              {customer.allowed_frameworks.map(f => (
                <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
              ))}
            </div>
          </Section>
        )}

        {customer.notes && (
          <Section title={t('common_notes')} defaultOpen={false}>
            <p className="text-sm text-foreground py-2">{customer.notes}</p>
          </Section>
        )}

        {canManageUsers && (
          <Section title="User Seats & Access" defaultOpen={true}>
            <CustomerSeatSection customer={customer} onCustomerUpdated={() => {}} />
          </Section>
        )}
      </div>
    </div>
  );
}