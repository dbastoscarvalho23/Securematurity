import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import EmptyState from '@/components/shared/EmptyState';

/**
 * Backoffice shell — admin-only area with its own sub-navigation.
 * Sections: Overview, Customers, Users, Audit.
 */
const TABS = [
  { to: '/backoffice', labelKey: 'backoffice_tab_overview', end: true },
  { to: '/backoffice/customers', labelKey: 'backoffice_tab_customers' },
  { to: '/backoffice/users', labelKey: 'backoffice_tab_users' },
  { to: '/backoffice/audit', labelKey: 'backoffice_tab_audit' },
];

export default function BackofficeLayout() {
  const { user } = useAuth();
  const { t } = useLanguage();

  if (user?.role !== 'admin') {
    return <EmptyState icon={ShieldCheck} title={t('common_no_permission')} className="h-64" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('nav_backoffice')}</h1>
      </div>
      <nav className="flex gap-1 border-b border-border overflow-x-auto" aria-label={t('nav_backoffice')}>
        {TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => cn(
              'px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t(tab.labelKey)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
