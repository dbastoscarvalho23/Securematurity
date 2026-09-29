import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Users, Shield, Network, Plus, Pencil } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
import EditUserDialog from '@/components/settings/EditUserDialog';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isPlatformOwner, hasRole } from '@/lib/rbac';
import { useActiveCustomer } from '@/lib/tenantContext';

export default function Organization() {
  const { user } = useAuth();
  // Âmbito do tenant pelo contexto único (FA2) — a página não o resolve por si.
  const { customerId } = useActiveCustomer();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [userToEdit, setUserToEdit] = useState(null);

  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['org-users'],
    queryFn: () => base44.functions.invoke('listUsers', {}),
    enabled: hasRole(user?.role, 'master_admin', 'customer_admin'),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['org-customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: isPlatformOwner(user?.role),
  });

  const { data: frameworks = [] } = useQuery({
    queryKey: ['org-frameworks'],
    queryFn: () => base44.entities.Framework.list(),
  });

  const isAdmin = isPlatformOwner(user?.role);
  const isCustomerAdmin = user?.role === 'customer_admin';

  if (!isAdmin && !isCustomerAdmin) {
    return <EmptyState icon={Building2} title={t('common_no_permission')} className="h-64" />;
  }

  const userList = Array.isArray(users?.users) ? users.users : Array.isArray(users) ? users : [];
  const visibleUsers = isAdmin ? userList : userList.filter(u => u.customer_id === customerId);

  return (
    <div className="space-y-6">
      <PageHeader description={t('org_subtitle')} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-1/10"><Users className="w-5 h-5 text-chart-1" /></div>
              <div>
                <p className="text-2xl font-bold">{visibleUsers.length}</p>
                <p className="text-xs text-muted-foreground">{t('org_total_users')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {isAdmin && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-chart-2/10"><Building2 className="w-5 h-5 text-chart-2" /></div>
                <div>
                  <p className="text-2xl font-bold">{customers.length}</p>
                  <p className="text-xs text-muted-foreground">{t('org_total_customers')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-4/10"><Shield className="w-5 h-5 text-chart-4" /></div>
              <div>
                <p className="text-2xl font-bold">{frameworks.length}</p>
                <p className="text-xs text-muted-foreground">{t('org_total_frameworks')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-3/10"><Network className="w-5 h-5 text-chart-3" /></div>
              <div>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/workspaces')}>
                  {t('nav_workspaces')} →
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('settings_tab_users')}</CardTitle>
            <Button size="sm" onClick={() => navigate('/settings')}>
              <Plus className="w-4 h-4 mr-1" /> {t('settings_invite_user')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('settings_col_name')}</TableHead>
                <TableHead>{t('settings_col_email')}</TableHead>
                <TableHead>{t('settings_col_role')}</TableHead>
                <TableHead>{t('settings_col_customer')}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleUsers.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.display_name || u.full_name || '—'}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">{u.role?.replace(/_/g, ' ') || 'user'}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {customers.find(c => c.id === u.customer_id)?.name || u.customer_name || '—'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t('common_edit')} title={t('common_edit')} onClick={() => setUserToEdit(u)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {isError ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <ErrorState variant="inline" onRetry={() => refetch()} />
                  </TableCell>
                </TableRow>
              ) : isLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <LoadingState variant="skeleton" rows={4} label={t('common_loading')} />
                  </TableCell>
                </TableRow>
              ) : visibleUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState compact icon={Users} title={t('common_no_data')} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Frameworks list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings_tab_frameworks')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {frameworks.map(fw => (
              <Badge key={fw.id} variant="outline" className="text-sm py-1.5 px-3">
                {fw.name} {fw.version && <span className="text-muted-foreground ml-1">v{fw.version}</span>}
              </Badge>
            ))}
            {frameworks.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('common_no_data')}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {userToEdit && (
        <EditUserDialog
          user={userToEdit}
          open={!!userToEdit}
          onClose={() => setUserToEdit(null)}
        />
      )}
    </div>
  );
}
