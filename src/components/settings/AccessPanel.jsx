import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { invokeFn } from '@/lib/invokeFn';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { format } from '@/lib/dateFormat';

const STATUS_STYLE = {
  requested: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
  active: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
  rejected: 'bg-muted text-muted-foreground',
  revoked: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
};
const day = (iso) => (iso ? format(new Date(iso), 'd MMM yyyy') : '—');
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/**
 * Acesso delegado (docs/acesso-delegado.md).
 * - Administração do cliente (própria ou delegada): vê os acessos ao cliente, aprova, rejeita, revoga e concede.
 * - Administração da plataforma: vê todos, pede acesso para um consultor e revoga. Não aprova: decide o cliente.
 * - Consultor: vê os seus acessos e pode renunciar.
 * O servidor (função `access`) volta a confirmar cada uma destas regras.
 */
export default function AccessPanel() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const isConsultant = user?.platform_role === 'consultant';
  const isDecider = !isAdmin && user?.role === 'customer_admin' && !!user?.customer_id;
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [busy, setBusy] = useState(null);
  const [form, setForm] = useState({ customer_id: '', user_email: '', access_level: 'viewer', assignment_type: 'delegation', expires_at: inDays(90), reason: '' });

  const scopeCustomer = isAdmin ? (filterCustomer === 'all' ? '' : filterCustomer) : (isDecider ? user.customer_id : '');
  const { data, isLoading } = useQuery({
    queryKey: ['access-assignments', scopeCustomer, user?.email],
    queryFn: () => invokeFn('access', { op: 'list', ...(scopeCustomer ? { customer_id: scopeCustomer } : {}) }),
  });
  const { data: customers = [] } = useQuery({
    queryKey: ['access-customers'],
    queryFn: () => base44.entities.Customer.list('name', 500),
    enabled: isAdmin,
  });
  const rows = data?.assignments || [];
  const nameOf = (id) => customers.find((c) => c.id === id)?.name;
  const mine = (a) => String(a.user_email || '').toLowerCase() === String(user?.email || '').toLowerCase();

  const act = async (op, a) => {
    setBusy(`${op}:${a?.id || 'new'}`);
    try {
      if (op === 'request' || op === 'grant') {
        await invokeFn('access', {
          op,
          ...form,
          customer_id: isAdmin ? form.customer_id : user.customer_id,
          expires_at: new Date(`${form.expires_at}T23:59:59`).toISOString(),
        });
        toast.success(op === 'grant' ? t('acc_granted_ok') : t('acc_requested_ok'));
        setForm((f) => ({ ...f, user_email: '', reason: '' }));
      } else {
        await invokeFn('access', { op, id: a.id });
        toast.success(t('acc_done'));
      }
      queryClient.invalidateQueries({ queryKey: ['access-assignments'] });
    } catch (e) {
      toast.error(e?.message || t('acc_error'));
    } finally {
      setBusy(null);
    }
  };

  const canAddNew = isAdmin || isDecider;
  const help = isAdmin ? t('acc_help_admin') : isDecider ? t('acc_help_customer') : t('acc_help_consultant');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><KeyRound className="w-4 h-4" />{t('acc_title')}</CardTitle>
          <CardDescription>{help}</CardDescription>
          {isAdmin && (
            <div className="pt-2">
              <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                <SelectTrigger className="w-64 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('at_filter_all')}</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">{t('common_loading')}</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">{t('acc_none')}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs bg-muted/50">
                  <tr>
                    <th className="text-left p-2">{t('acc_col_person')}</th>
                    <th className="text-left p-2">{t('acc_col_customer')}</th>
                    <th className="text-left p-2">{t('acc_col_level')}</th>
                    <th className="text-left p-2">{t('acc_col_status')}</th>
                    <th className="text-left p-2">{t('acc_col_until')}</th>
                    <th className="text-left p-2">{t('acc_col_reason')}</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const open = a.status === 'requested' || a.status === 'active';
                    const canDecide = isDecider && a.status === 'requested' && !mine(a);
                    const canRevoke = open && (isAdmin || isDecider || mine(a));
                    return (
                      <tr key={a.id} className="border-t align-top">
                        <td className="p-2">{a.user_email}<div className="text-[10px] text-muted-foreground">{t(`acc_type_${a.assignment_type || 'delegation'}`)}</div></td>
                        <td className="p-2 text-xs">{a.customer_name || nameOf(a.customer_id) || a.customer_id}</td>
                        <td className="p-2 text-xs">{t(`acc_level_${a.access_level}`)}</td>
                        <td className="p-2"><Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[a.status] || ''}`}>{t(`acc_status_${a.status}`)}</Badge></td>
                        <td className="p-2 text-xs">{day(a.expires_at)}</td>
                        <td className="p-2 text-xs max-w-xs">{a.reason}</td>
                        <td className="p-2 text-right whitespace-nowrap space-x-1">
                          {canDecide && <Button size="sm" className="h-7" disabled={!!busy} onClick={() => act('approve', a)}>{busy === `approve:${a.id}` && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}{t('acc_approve')}</Button>}
                          {canDecide && <Button size="sm" variant="outline" className="h-7" disabled={!!busy} onClick={() => act('reject', a)}>{t('acc_reject')}</Button>}
                          {canRevoke && <Button size="sm" variant="ghost" className="h-7 text-destructive" disabled={!!busy} onClick={() => act('revoke', a)}>{mine(a) ? t('acc_give_up') : t('acc_revoke')}</Button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {canAddNew && !isConsultant && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{isAdmin ? t('acc_request') : t('acc_grant')}</CardTitle>
            <CardDescription>{t('acc_max_days')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isAdmin && (
                <div className="space-y-1.5">
                  <Label>{t('acc_col_customer')}</Label>
                  <Select value={form.customer_id || undefined} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder={t('common_select_customer')} /></SelectTrigger>
                    <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>{t('acc_field_email')}</Label>
                <Input type="email" value={form.user_email} onChange={(e) => setForm({ ...form, user_email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('acc_field_type')}</Label>
                <Select value={form.assignment_type} onValueChange={(v) => setForm({ ...form, assignment_type: v, access_level: v === 'external' ? 'viewer' : form.access_level, expires_at: v === 'external' ? inDays(30) : form.expires_at })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delegation">{t('acc_type_delegation')}</SelectItem>
                    <SelectItem value="external">{t('acc_type_external')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('acc_field_level')}</Label>
                <Select value={form.access_level} onValueChange={(v) => setForm({ ...form, access_level: v })} disabled={form.assignment_type === 'external'}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['viewer', 'contributor', 'admin'].map((l) => <SelectItem key={l} value={l}>{t(`acc_level_${l}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('acc_field_until')}</Label>
                <Input type="date" value={form.expires_at} min={inDays(1)} max={inDays(form.assignment_type === 'external' ? 30 : 365)} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t('acc_field_reason')}</Label>
                <Textarea rows={2} value={form.reason} placeholder={t('acc_reason_placeholder')} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </div>
            </div>
            <div className="pt-3">
              <Button disabled={!!busy || !form.user_email || form.reason.trim().length < 10 || (isAdmin && !form.customer_id)} onClick={() => act(isAdmin ? 'request' : 'grant')}>
                {busy?.startsWith(isAdmin ? 'request' : 'grant') && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}{isAdmin ? t('acc_request') : t('acc_grant')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
