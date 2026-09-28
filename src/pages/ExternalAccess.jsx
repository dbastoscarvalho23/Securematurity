/**
 * ExternalAccess — manage delegated user-to-customer access.
 *
 * Role-specific views:
 * - master_admin:    Break-glass banner, all assignments, break-glass/onboarding/delegation buttons
 * - workspace_admin: Onboarding/delegation buttons, authorized tenants
 * - customer_admin:  Pending requests (approve/reject), active onboarding (accept/revoke), active delegations (revoke)
 * - consultant:      Authorized tenants or empty state, request delegation button
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { normalizeRole } from '@/lib/rbac';
import {
  Network, Plus, ShieldOff, ShieldCheck, Loader2, UserCog,
  ShieldAlert, UserPlus, Clock, Check, X, KeyRound, AlertTriangle,
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
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';
import {
  listAssignments, listBreakGlass,
  requestDelegation, approveDelegation, rejectDelegation, revokeDelegation,
  createOnboarding, acceptOnboarding, revokeOnboarding,
  startBreakGlass, endBreakGlass,
  DELEGATION_ROLES, STATUS_BADGES,
} from '@/lib/delegation';

// ─── Status badge ──────────────────────────────────────────────
function StatusBadge({ status, assignmentType }) {
  let variant = STATUS_BADGES[status]?.variant || 'secondary';
  let label = STATUS_BADGES[status]?.label || status;
  if (assignmentType === 'breakglass' && status === 'active') {
    variant = 'destructive';
    label = 'Break-Glass';
  }
  if (assignmentType === 'onboarding' && status === 'pending') {
    label = 'Onboarding';
  }
  return <Badge variant={variant} className="text-xs">{label}</Badge>;
}

// ─── Org badge ─────────────────────────────────────────────────
function OrgBadge({ isLegacy }) {
  if (isLegacy) return <Badge variant="outline" className="text-xs">Legacy</Badge>;
  return null;
}

// ─── Delegation Request Dialog ──────────────────────────────────
function DelegationRequestDialog({ open, onOpenChange, customers }) {
  const [form, setForm] = useState({ customer_id: '', access_level: 'viewer', reason: '' });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => requestDelegation({
      customerId: form.customer_id,
      customerName: customers.find(c => c.id === form.customer_id)?.name || '',
      accessLevel: form.access_level,
      reason: form.reason,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-access'] });
      onOpenChange(false);
      setForm({ customer_id: '', access_level: 'viewer', reason: '' });
      toast.success('Delegation request sent');
    },
    onError: (err) => toast.error(err?.message || 'Failed to request delegation'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Delegation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Select value={form.customer_id} onValueChange={v => setForm(prev => ({ ...prev, customer_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Access Level</Label>
            <Select value={form.access_level} onValueChange={v => setForm(prev => ({ ...prev, access_level: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DELEGATION_ROLES).map(([key, { label, description }]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex flex-col"><span>{label}</span><span className="text-xs text-muted-foreground">{description}</span></div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea value={form.reason} onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))} placeholder="Justification for access request" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.customer_id}>
            {mutation.isPending ? 'Sending...' : 'Send Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Onboarding Dialog ──────────────────────────────────────────
function OnboardingDialog({ open, onOpenChange, users, customers }) {
  const [form, setForm] = useState({ user_id: '', customer_id: '', access_level: 'contributor', expires_at: '', reason: '' });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => createOnboarding({
      userId: form.user_id,
      userEmail: users.find(u => u.id === form.user_id)?.email || '',
      customerId: form.customer_id,
      customerName: customers.find(c => c.id === form.customer_id)?.name || '',
      accessLevel: form.access_level,
      expiresAt: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      reason: form.reason,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-access'] });
      onOpenChange(false);
      setForm({ user_id: '', customer_id: '', access_level: 'contributor', expires_at: '', reason: '' });
      toast.success('Onboarding created');
    },
    onError: (err) => toast.error(err?.message || 'Failed to create onboarding'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Onboard User to Customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>User</Label>
            <Select value={form.user_id} onValueChange={v => setForm(prev => ({ ...prev, user_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {users.map(u => <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Select value={form.customer_id} onValueChange={v => setForm(prev => ({ ...prev, customer_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Access Level</Label>
            <Select value={form.access_level} onValueChange={v => setForm(prev => ({ ...prev, access_level: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DELEGATION_ROLES).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Expires At (optional)</Label>
            <Input type="datetime-local" value={form.expires_at} onChange={e => setForm(prev => ({ ...prev, expires_at: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea value={form.reason} onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))} placeholder="Reason for onboarding" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.user_id || !form.customer_id}>
            {mutation.isPending ? 'Creating...' : 'Create Onboarding'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Break-Glass Dialog ─────────────────────────────────────────
function BreakGlassDialog({ open, onOpenChange, customers }) {
  const [form, setForm] = useState({ customer_id: '', duration_hours: 1, reason: '' });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => startBreakGlass({
      customerId: form.customer_id,
      customerName: customers.find(c => c.id === form.customer_id)?.name || '',
      durationHours: parseInt(form.duration_hours),
      reason: form.reason,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-access'] });
      queryClient.invalidateQueries({ queryKey: ['breakglass'] });
      onOpenChange(false);
      setForm({ customer_id: '', duration_hours: 1, reason: '' });
      toast.success('Break-glass access activated');
    },
    onError: (err) => toast.error(err?.message || 'Failed to start break-glass'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            Break-Glass Access
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
            <p className="font-medium">Emergency access only</p>
            <p className="text-xs mt-1">This will grant temporary admin access to the customer's compliance data. Customer admins will be notified. All actions are audit-logged.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Select value={form.customer_id} onValueChange={v => setForm(prev => ({ ...prev, customer_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Duration (1-8 hours)</Label>
            <Input type="number" min={1} max={8} value={form.duration_hours} onChange={e => setForm(prev => ({ ...prev, duration_hours: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Reason (required)</Label>
            <Textarea value={form.reason} onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))} placeholder="Emergency justification" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.customer_id || !form.reason}>
            {mutation.isPending ? 'Activating...' : 'Activate Break-Glass'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assignment Row ─────────────────────────────────────────────
function AssignmentRow({ assignment, actions }) {
  const accessLevel = assignment.access_level || assignment.role_in_customer || 'viewer';
  return (
    <div className="flex items-center justify-between p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-medium truncate">{assignment.user_email}</p>
          <Badge variant="secondary" className="text-xs">{DELEGATION_ROLES[accessLevel]?.label || accessLevel}</Badge>
          <StatusBadge status={assignment.status} assignmentType={assignment.assignment_type} />
          <OrgBadge isLegacy={assignment.is_legacy} />
        </div>
        <p className="text-xs text-muted-foreground">
          {assignment.customer_name || assignment.customer_id}
          {assignment.assigned_by && ` · by ${assignment.assigned_by}`}
          {assignment.expires_at && ` · expires ${new Date(assignment.expires_at).toLocaleString()}`}
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
  const [breakGlassDialog, setBreakGlassDialog] = useState(false);

  // Fetch assignments
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['external-access', user?.id],
    queryFn: () => listAssignments({ userId: role === 'consultant' ? user?.id : undefined }),
  });

  // Fetch break-glass assignments (master_admin only)
  const { data: breakGlassAssignments = [] } = useQuery({
    queryKey: ['breakglass'],
    queryFn: listBreakGlass,
    enabled: role === 'master_admin',
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['external-access'] }); toast.success('Delegation approved'); },
    onError: (err) => toast.error(err?.message || 'Failed to approve'),
  });

  const rejectMut = useMutation({
    mutationFn: rejectDelegation,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['external-access'] }); toast.success('Delegation rejected'); },
    onError: (err) => toast.error(err?.message || 'Failed to reject'),
  });

  const revokeMut = useMutation({
    mutationFn: revokeDelegation,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['external-access'] }); toast.success('Delegation revoked'); },
    onError: (err) => toast.error(err?.message || 'Failed to revoke'),
  });

  const acceptOnboardingMut = useMutation({
    mutationFn: acceptOnboarding,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['external-access'] }); toast.success('Onboarding accepted'); },
    onError: (err) => toast.error(err?.message || 'Failed to accept'),
  });

  const revokeOnboardingMut = useMutation({
    mutationFn: revokeOnboarding,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['external-access'] }); toast.success('Onboarding revoked'); },
    onError: (err) => toast.error(err?.message || 'Failed to revoke'),
  });

  const endBreakGlassMut = useMutation({
    mutationFn: endBreakGlass,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['breakglass'] }); queryClient.invalidateQueries({ queryKey: ['external-access'] }); toast.success('Break-glass ended'); },
    onError: (err) => toast.error(err?.message || 'Failed to end break-glass'),
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
    if (role === 'master_admin') {
      buttons.push(
        <Button key="bg" variant="destructive" className="gap-2" onClick={() => setBreakGlassDialog(true)}>
          <ShieldAlert className="w-4 h-4" /> Break-Glass
        </Button>,
        <Button key="ob" variant="outline" className="gap-2" onClick={() => setOnboardingDialog(true)}>
          <UserPlus className="w-4 h-4" /> Onboard
        </Button>,
      );
    }
    if (role === 'workspace_admin') {
      buttons.push(
        <Button key="ob" variant="outline" className="gap-2" onClick={() => setOnboardingDialog(true)}>
          <UserPlus className="w-4 h-4" /> Onboard
        </Button>,
      );
    }
    if (role === 'consultant') {
      buttons.push(
        <Button key="del" className="gap-2" onClick={() => setDelegationDialog(true)}>
          <Plus className="w-4 h-4" /> Request Access
        </Button>,
      );
    }
    return buttons.length > 0 ? <div className="flex gap-2">{buttons}</div> : null;
  })();

  return (
    <div className="space-y-6">
      <PageHeader title={t('nav_external_access')} description={t('ea_subtitle')} actions={headerActions} />

      {/* ─── Break-Glass Banner (master_admin only) ─────────────── */}
      {role === 'master_admin' && breakGlassAssignments.length > 0 && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4">
          <div className="flex items-center gap-3 mb-2">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            <h3 className="font-semibold text-destructive">Active Break-Glass Sessions ({breakGlassAssignments.length})</h3>
          </div>
          <div className="space-y-2">
            {breakGlassAssignments.map(bg => (
              <div key={bg.id} className="flex items-center justify-between bg-card rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">{bg.customer_name || bg.customer_id}</p>
                  <p className="text-xs text-muted-foreground">
                    Reason: {bg.reason} · Expires: {bg.expires_at ? new Date(bg.expires_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => endBreakGlassMut.mutate(bg.id)} disabled={endBreakGlassMut.isPending}>
                  <ShieldOff className="w-3.5 h-3.5" /> End
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Summary Stats ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600"><ShieldCheck className="w-5 h-5" /></div>
            <div><p className="text-2xl font-bold">{activeDelegations.length}</p><p className="text-xs text-muted-foreground">Active Delegations</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600"><Clock className="w-5 h-5" /></div>
            <div><p className="text-2xl font-bold">{pendingDelegations.length}</p><p className="text-xs text-muted-foreground">Pending Requests</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600"><UserPlus className="w-5 h-5" /></div>
            <div><p className="text-2xl font-bold">{activeOnboarding.length + pendingOnboarding.length}</p><p className="text-xs text-muted-foreground">Onboarding</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-muted text-muted-foreground"><UserCog className="w-5 h-5" /></div>
            <div><p className="text-2xl font-bold">{new Set(activeDelegations.map(a => a.user_email)).size}</p><p className="text-xs text-muted-foreground">Unique Users</p></div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* ─── Pending Delegation Requests (customer_admin) ──── */}
          {role === 'customer_admin' && pendingDelegations.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="p-4 border-b"><h3 className="text-sm font-semibold flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> Pending Delegation Requests</h3></div>
                <div className="divide-y">
                  {pendingDelegations.map(a => (
                    <AssignmentRow key={a.id} assignment={a} actions={
                      <>
                        <Button size="sm" variant="default" className="gap-1.5 text-xs" onClick={() => approveMut.mutate(a.id)} disabled={approveMut.isPending}>
                          <Check className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive" onClick={() => rejectMut.mutate(a.id)} disabled={rejectMut.isPending}>
                          <X className="w-3.5 h-3.5" /> Reject
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
                <div className="p-4 border-b"><h3 className="text-sm font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4 text-blue-500" /> Pending Onboarding</h3></div>
                <div className="divide-y">
                  {pendingOnboarding.map(a => (
                    <AssignmentRow key={a.id} assignment={a} actions={
                      (role === 'master_admin' || role === 'workspace_admin') ? (
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive" onClick={() => revokeOnboardingMut.mutate(a.id)} disabled={revokeOnboardingMut.isPending}>
                          <ShieldOff className="w-3.5 h-3.5" /> Revoke
                        </Button>
                      ) : a.user_id === user?.id ? (
                        <Button size="sm" variant="default" className="gap-1.5 text-xs" onClick={() => acceptOnboardingMut.mutate(a.id)} disabled={acceptOnboardingMut.isPending}>
                          <Check className="w-3.5 h-3.5" /> Accept
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
              <div className="p-4 border-b"><h3 className="text-sm font-semibold flex items-center gap-2"><Network className="w-4 h-4 text-emerald-500" /> Active Delegations</h3></div>
              {activeDelegations.length === 0 ? (
                <EmptyState icon={Network} title="No active delegations" description="No delegation access is currently active." />
              ) : (
                <div className="divide-y">
                  {activeDelegations.map(a => (
                    <AssignmentRow key={a.id} assignment={a} actions={
                      (role === 'customer_admin' || role === 'master_admin' || role === 'workspace_admin' || a.user_id === user?.id) ? (
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs text-amber-600" onClick={() => revokeMut.mutate(a.id)} disabled={revokeMut.isPending}>
                          <ShieldOff className="w-3.5 h-3.5" /> Revoke
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
                <div className="p-4 border-b"><h3 className="text-sm font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4 text-blue-500" /> Active Onboarding</h3></div>
                <div className="divide-y">
                  {activeOnboarding.map(a => (
                    <AssignmentRow key={a.id} assignment={a} actions={
                      (role === 'master_admin' || role === 'workspace_admin') ? (
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive" onClick={() => revokeOnboardingMut.mutate(a.id)} disabled={revokeOnboardingMut.isPending}>
                          <ShieldOff className="w-3.5 h-3.5" /> Revoke
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
                <div className="p-4 border-b"><h3 className="text-sm font-semibold text-muted-foreground">Revoked / Expired History</h3></div>
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
            <EmptyState icon={Network} title="No authorized tenants" description="Request delegation access to a customer to get started." />
          )}
        </>
      )}

      {/* ─── Dialogs ─────────────────────────────────────────────── */}
      <DelegationRequestDialog open={delegationDialog} onOpenChange={setDelegationDialog} customers={customers} />
      <OnboardingDialog open={onboardingDialog} onOpenChange={setOnboardingDialog} users={users} customers={customers} />
      <BreakGlassDialog open={breakGlassDialog} onOpenChange={setBreakGlassDialog} customers={customers} />
    </div>
  );
}
