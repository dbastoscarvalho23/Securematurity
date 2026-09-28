/**
 * ExternalAccess — manage delegated user-to-customer access.
 *
 * Role-specific views:
 * - master_admin:    All assignments, pending approvals, onboarding button
 * - workspace_admin: Onboarding button, authorized tenants
 * - customer_admin:  Pending requests (approve/reject), active onboarding (accept/revoke), active delegations (revoke)
 * - consultant:      Authorized tenants or empty state, request delegation button
 *
 * Break-glass/support access is out of the Core MVP scope.
 *
 * Toda a interface visível passa por chaves de tradução (FC3) — nada de texto
 * de interface escrito directamente no componente.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { normalizeRole } from '@/lib/rbac';
import {
  Network, Plus, ShieldOff, ShieldCheck, UserCog,
  UserPlus, Clock, Check, X,
} from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
import { MODULE_META } from '@/lib/licenseModules';
import { toast } from 'sonner';
import {
  listAssignments,
  requestDelegation, approveDelegation, rejectDelegation, revokeDelegation,
  createOnboarding, acceptOnboarding, revokeOnboarding,
  DELEGATION_ROLES, STATUS_BADGES,
} from '@/lib/delegation';

// ─── Status badge ──────────────────────────────────────────────
function StatusBadge({ status, assignmentType }) {
  const { t } = useLanguage();
  const variant = STATUS_BADGES[status]?.variant || 'secondary';
  const isOnboarding = assignmentType === 'onboarding' && status === 'pending';
  const label = isOnboarding
    ? t('ea_status_onboarding')
    : STATUS_BADGES[status]?.labelKey ? t(STATUS_BADGES[status].labelKey) : status;
  return <Badge variant={variant} className="text-xs">{label}</Badge>;
}

// ─── Org badge ─────────────────────────────────────────────────
function OrgBadge({ isLegacy }) {
  const { t } = useLanguage();
  if (isLegacy) return <Badge variant="outline" className="text-xs">{t('ea_legacy')}</Badge>;
  return null;
}

// ─── Delegation Request Dialog ──────────────────────────────────
function DelegationRequestDialog({ open, onOpenChange, customers }) {
  const { t } = useLanguage();
  const defaultExpiry = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 16);
  };
  const emptyForm = { customer_id: '', access_level: 'viewer', expires_at: defaultExpiry(), authorized_modules: [], reason: '' };
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();

  const canSubmit = form.customer_id && form.expires_at && form.reason.trim() && form.authorized_modules.length > 0;

  const mutation = useMutation({
    mutationFn: () => requestDelegation({
      customerId: form.customer_id,
      customerName: customers.find(c => c.id === form.customer_id)?.name || '',
      accessLevel: form.access_level,
      authorizedModules: form.authorized_modules,
      expiresAt: new Date(form.expires_at).toISOString(),
      reason: form.reason,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-access'] });
      onOpenChange(false);
      setForm(emptyForm);
      toast.success(t('ea_delegation_request_sent'));
    },
    onError: (err) => toast.error(err?.message || t('ea_request_failed')),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('ea_dialog_request_title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('common_customer')}</Label>
            <Select value={form.customer_id} onValueChange={v => setForm(prev => ({ ...prev, customer_id: v }))}>
              <SelectTrigger><SelectValue placeholder={t('ea_select_customer_ph')} /></SelectTrigger>
              <SelectContent>
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('ea_access_level')}</Label>
            <Select value={form.access_level} onValueChange={v => setForm(prev => ({ ...prev, access_level: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DELEGATION_ROLES).map(([key, { labelKey, descriptionKey }]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex flex-col"><span>{t(labelKey)}</span><span className="text-xs text-muted-foreground">{t(descriptionKey)}</span></div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('ea_authorized_modules')}</Label>
            <div className="grid gap-2 rounded-lg border p-3">
              {Object.entries(MODULE_META).map(([code, meta]) => (
                <label key={code} className="flex items-start gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={form.authorized_modules.includes(code)}
                    onCheckedChange={(checked) => setForm(prev => ({
                      ...prev,
                      authorized_modules: checked
                        ? [...prev.authorized_modules, code]
                        : prev.authorized_modules.filter(c => c !== code),
                    }))}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col">
                    <span>{meta.name}</span>
                    <span className="text-xs text-muted-foreground">{meta.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('ea_authorized_modules_note')}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t('ea_access_until')}</Label>
            <Input type="datetime-local" value={form.expires_at} onChange={e => setForm(prev => ({ ...prev, expires_at: e.target.value }))} />
            <p className="text-xs text-muted-foreground">{t('ea_access_until_note')}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t('ea_reason')}</Label>
            <Textarea value={form.reason} onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))} placeholder={t('ea_reason_ph')} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common_cancel')}</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !canSubmit}>
            {mutation.isPending ? t('ea_sending') : t('ea_send_request')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Onboarding Dialog ──────────────────────────────────────────
function OnboardingDialog({ open, onOpenChange, users, customers }) {
  const { t } = useLanguage();
  const emptyForm = { user_id: '', customer_id: '', reason: '' };
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => createOnboarding({
      userId: form.user_id,
      userEmail: users.find(u => u.id === form.user_id)?.email || '',
      customerId: form.customer_id,
      customerName: customers.find(c => c.id === form.customer_id)?.name || '',
      reason: form.reason,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-access'] });
      onOpenChange(false);
      setForm(emptyForm);
      toast.success(t('ea_onboarding_created'));
    },
    onError: (err) => toast.error(err?.message || t('ea_onboarding_failed')),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('ea_dialog_onboard_title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('ea_select_user')}</Label>
            <Select value={form.user_id} onValueChange={v => setForm(prev => ({ ...prev, user_id: v }))}>
              <SelectTrigger><SelectValue placeholder={t('ea_select_user_ph')} /></SelectTrigger>
              <SelectContent>
                {users.map(u => <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('common_customer')}</Label>
            <Select value={form.customer_id} onValueChange={v => setForm(prev => ({ ...prev, customer_id: v }))}>
              <SelectTrigger><SelectValue placeholder={t('ea_select_customer_ph')} /></SelectTrigger>
              <SelectContent>
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground">
            {t('ea_onboarding_note')}
          </div>
          <div className="space-y-1.5">
            <Label>{t('ea_reason')}</Label>
            <Textarea value={form.reason} onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))} placeholder={t('ea_onboarding_reason_ph')} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common_cancel')}</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.user_id || !form.customer_id}>
            {mutation.isPending ? t('ea_creating') : t('ea_create_onboarding')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assignment Row ─────────────────────────────────────────────
function AssignmentRow({ assignment, actions }) {
  const { t } = useLanguage();
  const accessLevel = assignment.access_level || assignment.role_in_customer || 'viewer';
  const roleMeta = DELEGATION_ROLES[accessLevel];
  return (
    <div className="flex items-center justify-between p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-medium truncate">{assignment.user_email}</p>
          <Badge variant="secondary" className="text-xs">{roleMeta ? t(roleMeta.labelKey) : accessLevel}</Badge>
          <StatusBadge status={assignment.status} assignmentType={assignment.assignment_type} />
          <OrgBadge isLegacy={assignment.is_legacy} />
        </div>
        <p className="text-xs text-muted-foreground">
          {assignment.customer_name || assignment.customer_id}
          {assignment.assigned_by && ` · ${t('ea_assigned_by_inline')} ${assignment.assigned_by}`}
          {assignment.expires_at && ` · ${t('ea_expires_inline')} ${new Date(assignment.expires_at).toLocaleString()}`}
          {assignment.reason && ` · ${assignment.reason}`}
        </p>
      </div>
      {actions && <div className="flex items-center gap-2 ml-2">{actions}</div>}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export default function ExternalAccess() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const role = normalizeRole(user?.role);

  const [delegationDialog, setDelegationDialog] = useState(false);
  const [onboardingDialog, setOnboardingDialog] = useState(false);

  // Fetch assignments
  const { data: assignments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['external-access', user?.id],
    queryFn: () => listAssignments({ userId: role === 'consultant' ? user?.id : undefined }),
  });

  // Fetch customers (for dialogs)
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: role === 'master_admin' || role === 'workspace_admin' || role === 'consultant',
  });

  // Fetch users (for onboarding dialog)
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: role === 'master_admin' || role === 'workspace_admin',
  });

  // ─── Mutations ───────────────────────────────────────────────
  const approveMut = useMutation({
    mutationFn: approveDelegation,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['external-access'] }); toast.success(t('ea_delegation_approved')); },
    onError: (err) => toast.error(err?.message || t('ea_approve_failed')),
  });

  const rejectMut = useMutation({
    mutationFn: rejectDelegation,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['external-access'] }); toast.success(t('ea_delegation_rejected')); },
    onError: (err) => toast.error(err?.message || t('ea_reject_failed')),
  });

  const revokeMut = useMutation({
    mutationFn: revokeDelegation,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['external-access'] }); toast.success(t('ea_delegation_revoked')); },
    onError: (err) => toast.error(err?.message || t('ea_revoke_failed')),
  });

  const acceptOnboardingMut = useMutation({
    mutationFn: acceptOnboarding,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['external-access'] }); toast.success(t('ea_onboarding_accepted')); },
    onError: (err) => toast.error(err?.message || t('ea_accept_failed')),
  });

  const revokeOnboardingMut = useMutation({
    mutationFn: revokeOnboarding,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['external-access'] }); toast.success(t('ea_onboarding_revoked')); },
    onError: (err) => toast.error(err?.message || t('ea_revoke_failed')),
  });

  // ─── Categorize assignments ─────────────────────────────────
  const pendingDelegations = assignments.filter(a => a.assignment_type === 'delegation' && a.status === 'pending');
  const activeDelegations = assignments.filter(a => a.assignment_type === 'delegation' && a.status === 'active');
  const pendingOnboarding = assignments.filter(a => a.assignment_type === 'onboarding' && a.onboarding_state === 'pending');
  const activeOnboarding = assignments.filter(a => a.assignment_type === 'onboarding' && a.status === 'active');
  const revokedAssignments = assignments.filter(a => a.status === 'revoked' || a.status === 'expired');

  // ─── Action buttons per role ─────────────────────────────────
  const headerActions = (() => {
    const buttons = [];
    if (role === 'master_admin' || role === 'workspace_admin') {
      buttons.push(
        <Button key="ob" variant="outline" className="gap-2" onClick={() => setOnboardingDialog(true)}>
          <UserPlus className="w-4 h-4" /> {t('ea_onboard')}
        </Button>,
      );
    }
    if (role === 'consultant') {
      buttons.push(
        <Button key="del" className="gap-2" onClick={() => setDelegationDialog(true)}>
          <Plus className="w-4 h-4" /> {t('ea_request_access')}
        </Button>,
      );
    }
    return buttons.length > 0 ? <div className="flex gap-2">{buttons}</div> : null;
  })();

  return (
    <div className="space-y-6">
      <PageHeader description={t('ea_subtitle')} actions={headerActions} />

      {/* ─── Summary Stats ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-chart-2/10 text-chart-2"><ShieldCheck className="w-5 h-5" /></div>
            <div><p className="text-2xl font-bold">{activeDelegations.length}</p><p className="text-xs text-muted-foreground">{t('ea_active_delegations')}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-chart-3/10 text-chart-3"><Clock className="w-5 h-5" /></div>
            <div><p className="text-2xl font-bold">{pendingDelegations.length}</p><p className="text-xs text-muted-foreground">{t('ea_pending_requests')}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-chart-1/10 text-chart-1"><UserPlus className="w-5 h-5" /></div>
            <div><p className="text-2xl font-bold">{activeOnboarding.length + pendingOnboarding.length}</p><p className="text-xs text-muted-foreground">{t('ea_onboarding_summary')}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-muted text-muted-foreground"><UserCog className="w-5 h-5" /></div>
            <div><p className="text-2xl font-bold">{new Set(activeDelegations.map(a => a.user_email)).size}</p><p className="text-xs text-muted-foreground">{t('ea_unique_users')}</p></div>
          </CardContent>
        </Card>
      </div>

      {isError ? (
        <ErrorState variant="inline" onRetry={() => refetch()} />
      ) : isLoading ? (
        <LoadingState variant="skeleton" rows={4} label={t('common_loading')} />
      ) : (
        <>
          {/* ─── Pending Delegation Requests (customer_admin) ──── */}
          {(role === 'customer_admin' || role === 'master_admin') && pendingDelegations.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="p-4 border-b"><h3 className="text-sm font-semibold flex items-center gap-2"><Clock className="w-4 h-4 text-chart-3" /> {t('ea_section_pending_requests')}</h3></div>
                <div className="divide-y">
                  {pendingDelegations.map(a => (
                    <AssignmentRow key={a.id} assignment={a} actions={
                      <>
                        <Button size="sm" variant="default" className="gap-1.5 text-xs" onClick={() => approveMut.mutate(a.id)} disabled={approveMut.isPending}>
                          <Check className="w-3.5 h-3.5" /> {t('ea_approve')}
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive" onClick={() => rejectMut.mutate(a.id)} disabled={rejectMut.isPending}>
                          <X className="w-3.5 h-3.5" /> {t('ea_reject')}
                        </Button>
                      </>
                    } />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Pending Onboarding (user accept) ──────────────── */}
          {pendingOnboarding.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="p-4 border-b"><h3 className="text-sm font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4 text-chart-1" /> {t('ea_section_pending_onboarding')}</h3></div>
                <div className="divide-y">
                  {pendingOnboarding.map(a => (
                    <AssignmentRow key={a.id} assignment={a} actions={
                      (role === 'master_admin' || role === 'workspace_admin') ? (
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive" onClick={() => revokeOnboardingMut.mutate(a.id)} disabled={revokeOnboardingMut.isPending}>
                          <ShieldOff className="w-3.5 h-3.5" /> {t('ea_revoke')}
                        </Button>
                      ) : a.user_id === user?.id ? (
                        <Button size="sm" variant="default" className="gap-1.5 text-xs" onClick={() => acceptOnboardingMut.mutate(a.id)} disabled={acceptOnboardingMut.isPending}>
                          <Check className="w-3.5 h-3.5" /> {t('ea_accept')}
                        </Button>
                      ) : null
                    } />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Active Delegations ────────────────────────────── */}
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b"><h3 className="text-sm font-semibold flex items-center gap-2"><Network className="w-4 h-4 text-chart-2" /> {t('ea_active_delegations')}</h3></div>
              {activeDelegations.length === 0 ? (
                <EmptyState icon={Network} title={t('ea_no_delegations')} description={t('ea_no_delegations_desc')} />
              ) : (
                <div className="divide-y">
                  {activeDelegations.map(a => (
                    <AssignmentRow key={a.id} assignment={a} actions={
                      (role === 'customer_admin' || role === 'master_admin' || role === 'workspace_admin' || a.user_id === user?.id) ? (
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs text-chart-3" onClick={() => revokeMut.mutate(a.id)} disabled={revokeMut.isPending}>
                          <ShieldOff className="w-3.5 h-3.5" /> {t('ea_revoke')}
                        </Button>
                      ) : null
                    } />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Active Onboarding ──────────────────────────────── */}
          {activeOnboarding.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="p-4 border-b"><h3 className="text-sm font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4 text-chart-1" /> {t('ea_section_active_onboarding')}</h3></div>
                <div className="divide-y">
                  {activeOnboarding.map(a => (
                    <AssignmentRow key={a.id} assignment={a} actions={
                      (role === 'master_admin' || role === 'workspace_admin') ? (
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive" onClick={() => revokeOnboardingMut.mutate(a.id)} disabled={revokeOnboardingMut.isPending}>
                          <ShieldOff className="w-3.5 h-3.5" /> {t('ea_revoke')}
                        </Button>
                      ) : null
                    } />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Revoked/Expired History ───────────────────────── */}
          {revokedAssignments.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="p-4 border-b"><h3 className="text-sm font-semibold text-muted-foreground">{t('ea_section_revoked_expired')}</h3></div>
                <div className="divide-y">
                  {revokedAssignments.slice(0, 20).map(a => (
                    <AssignmentRow key={a.id} assignment={a} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Empty state for consultant ────────────────────── */}
          {role === 'consultant' && assignments.length === 0 && (
            <EmptyState icon={Network} title={t('ea_no_authorized_tenants')} description={t('ea_no_authorized_tenants_desc')} />
          )}
        </>
      )}

      {/* ─── Dialogs ─────────────────────────────────────────────── */}
      <DelegationRequestDialog open={delegationDialog} onOpenChange={setDelegationDialog} customers={customers} />
      <OnboardingDialog open={onboardingDialog} onOpenChange={setOnboardingDialog} users={users} customers={customers} />
    </div>
  );
}
