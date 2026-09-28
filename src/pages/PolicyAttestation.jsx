/**
 * PolicyAttestation — manage policy acknowledgments.
 * Users see pending attestations assigned to them and can accept/reject.
 * Admins/customer_admins see all attestations for their tenant and can create new.
 *
 * Uses PolicyAttestation entity (tenant-scoped RLS).
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { ShieldCheck, Plus, CheckCircle2, XCircle, Clock } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EmptyState from '@/components/shared/EmptyState';
import { writeAuditLog } from '@/lib/auditLog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { hasRole } from '@/lib/rbac';

// Cores dos tokens semânticos (FC2) e rótulo por chave de tradução (FC3).
const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-chart-3', bg: 'bg-chart-3/10', labelKey: 'pa_pending' },
  accepted: { icon: CheckCircle2, color: 'text-chart-2', bg: 'bg-chart-2/10', labelKey: 'pa_accepted' },
  rejected: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', labelKey: 'pa_rejected' },
  expired: { icon: XCircle, color: 'text-muted-foreground', bg: 'bg-muted', labelKey: 'pa_expired' },
};

export default function PolicyAttestation() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const isAdmin = hasRole(user?.role, 'master_admin', 'customer_admin');
  const customerId = user?.customer_id;
  const userEmail = user?.email;
  const [newDialog, setNewDialog] = useState(false);
  const [newForm, setNewForm] = useState({ policy_title: '', policy_version: '', user_email: '', due_date: '' });

  const { data: attestations = [], isLoading } = useQuery({
    queryKey: ['policy-attestations', customerId],
    queryFn: () => isAdmin
      ? base44.entities.PolicyAttestation.filter({ customer_id: customerId }, '-created_date', 200)
      : base44.entities.PolicyAttestation.filter({ user_email: userEmail }, '-created_date', 200),
    enabled: !!customerId || !!userEmail,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const result = await base44.entities.PolicyAttestation.update(id, {
        status,
        attested_date: new Date().toISOString(),
      });
      await writeAuditLog({
        action: `policy_attestation_${status}`,
        entity_type: 'PolicyAttestation',
        entity_id: id,
        details: `Policy attestation ${status}`,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy-attestations'] });
      toast.success(t('pa_attestation_updated'));
    },
    onError: () => toast.error(t('common_update_error')),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.PolicyAttestation.create({
        ...data,
        customer_id: customerId,
        assigned_by: userEmail,
        status: 'pending',
      });
      await writeAuditLog({
        action: 'policy_attestation_created',
        entity_type: 'PolicyAttestation',
        entity_id: result?.id,
        details: `Created attestation for ${data.policy_title}`,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy-attestations'] });
      setNewDialog(false);
      setNewForm({ policy_title: '', policy_version: '', user_email: '', due_date: '' });
      toast.success(t('pa_attestation_created'));
    },
    onError: () => toast.error(t('common_save_error')),
  });

  const pending = attestations.filter(a => a.status === 'pending');
  const completed = attestations.filter(a => a.status === 'accepted' || a.status === 'rejected');
  const localeStr = language === 'pt' ? 'pt-PT' : 'en-GB';

  return (
    <div className="space-y-6">
      <PageHeader
        description={t('pa_subtitle')}
        actions={isAdmin && (
          <Button onClick={() => setNewDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            {t('pa_new_attestation')}
          </Button>
        )}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-chart-3/10 text-chart-3">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pending.length}</p>
              <p className="text-xs text-muted-foreground">{t('pa_pending')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-chart-2/10 text-chart-2">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{attestations.filter(a => a.status === 'accepted').length}</p>
              <p className="text-xs text-muted-foreground">{t('pa_accepted')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{attestations.filter(a => a.status === 'rejected').length}</p>
              <p className="text-xs text-muted-foreground">{t('pa_rejected')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending attestations */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState variant="skeleton" rows={5} label={t('common_loading')} />
          ) : pending.length === 0 ? (
            <EmptyState icon={ShieldCheck} title={t('pa_no_pending')} />
          ) : (
            <div className="divide-y">
              {pending.map(a => {
                const cfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending;
                const overdue = a.due_date && new Date(a.due_date) < new Date();
                return (
                  <div key={a.id} className="flex items-center justify-between p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">{a.policy_title}</p>
                        {a.policy_version && (
                          <Badge variant="secondary" className="text-xs">v{a.policy_version}</Badge>
                        )}
                        {overdue && (
                          <Badge variant="destructive" className="text-xs">{t('pa_overdue')}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {a.user_name || a.user_email}
                        {a.due_date && ` · ${t('common_due_date')}: ${new Date(a.due_date).toLocaleDateString(localeStr)}`}
                      </p>
                    </div>
                    {a.user_email === userEmail && a.status === 'pending' && (
                      <div className="flex items-center gap-2 ml-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs"
                          onClick={() => updateMutation.mutate({ id: a.id, status: 'rejected' })}
                          disabled={updateMutation.isPending}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          {t('pa_reject')}
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => updateMutation.mutate({ id: a.id, status: 'accepted' })}
                          disabled={updateMutation.isPending}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t('pa_accept')}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {completed.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <h3 className="text-sm font-semibold">{t('pa_history')}</h3>
            </div>
            <div className="divide-y">
              {completed.slice(0, 20).map(a => {
                const cfg = STATUS_CONFIG[a.status];
                return (
                  <div key={a.id} className="flex items-center justify-between p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{a.policy_title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.user_name || a.user_email}
                        {a.attested_date && ` · ${new Date(a.attested_date).toLocaleDateString(localeStr)}`}
                      </p>
                    </div>
                    <Badge variant="secondary" className={cn('text-xs ml-2', cfg?.color)}>
                      {cfg?.labelKey ? t(cfg.labelKey) : a.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New attestation dialog */}
      <Dialog open={newDialog} onOpenChange={setNewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('pa_new_attestation')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('pa_policy_title')} *</Label>
              <Input
                value={newForm.policy_title}
                onChange={e => setNewForm(prev => ({ ...prev, policy_title: e.target.value }))}
                placeholder={t('pa_policy_title_ph')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('pa_policy_version')}</Label>
                <Input
                  value={newForm.policy_version}
                  onChange={e => setNewForm(prev => ({ ...prev, policy_version: e.target.value }))}
                  placeholder="1.0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('pa_due_date')}</Label>
                <Input
                  type="date"
                  value={newForm.due_date}
                  onChange={e => setNewForm(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('pa_assign_to')} *</Label>
              <Input
                value={newForm.user_email}
                onChange={e => setNewForm(prev => ({ ...prev, user_email: e.target.value }))}
                placeholder="user@company.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialog(false)}>{t('common_cancel')}</Button>
            <Button
              onClick={() => createMutation.mutate(newForm)}
              disabled={createMutation.isPending || !newForm.policy_title || !newForm.user_email}
            >
              {createMutation.isPending ? t('common_loading') : t('common_create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
