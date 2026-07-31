import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SeatAdjustDialog from '@/components/customers/SeatAdjustDialog';
import {
  UserPlus, Trash2, Loader2, Users, AlertTriangle,
  Mail, ShieldCheck, User, ChevronRight, Plus, Minus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { notifySeatChange, MIN_SEAT_LIMIT } from '@/lib/seatManagement';

const ROLE_STYLES = {
  admin:          'bg-red-100 text-red-700 border-red-200',
  customer_admin: 'bg-purple-100 text-purple-700 border-purple-200',
  user:           'bg-blue-100 text-blue-700 border-blue-200',
};

const ROLE_LABELS = {
  admin:          'Admin',
  customer_admin: 'Customer Admin',
  user:           'User',
};

function SeatBar({ used, total }) {
  const { t } = useLanguage();
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const atLimit = used >= total;
  const nearLimit = pct >= 80;

  return (
    <div className="space-y-2">
      {/* Visual counter pills */}
      <div className="flex items-center gap-1 flex-wrap">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[9px] font-bold transition-colors ${
              i < used
                ? atLimit ? 'bg-destructive border-destructive text-destructive-foreground'
                  : nearLimit ? 'bg-orange-400 border-orange-400 text-white'
                  : 'bg-primary border-primary text-primary-foreground'
                : 'bg-muted border-muted-foreground/20 text-muted-foreground'
            }`}
          >
            {i < used ? <Users className="w-2.5 h-2.5" /> : ''}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{t('seat_used_of_total').replace('{used}', used).replace('{total}', total)}</span>
        {atLimit && (
          <span className="text-destructive font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {t('seat_at_limit')}
          </span>
        )}
        {!atLimit && nearLimit && (
          <span className="text-orange-500 font-medium">{t('seat_remaining').replace('{count}', total - used)}</span>
        )}
        {!atLimit && !nearLimit && (
          <span className="text-muted-foreground">{t('seat_available').replace('{count}', total - used)}</span>
        )}
      </div>
    </div>
  );
}

export default function CustomerSeatSection({ customer, onCustomerUpdated }) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [updatingRoleId, setUpdatingRoleId] = useState(null);
  const [savingSeats, setSavingSeats] = useState(false);
  const [showSeatDialog, setShowSeatDialog] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const isCustomerAdmin = currentUser?.role === 'customer_admin';
  const canManage = isAdmin || isCustomerAdmin;

  const baseLimit = customer.user_seat_limit ?? MIN_SEAT_LIMIT;
  const addonSeats = customer.user_seat_addon_count ?? 0;
  const totalSeats = baseLimit + addonSeats;

  const { data: customerUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['customerUsers', customer.id],
    queryFn: () => base44.entities.User.filter({ customer_id: customer.id }),
  });

  const { data: pendingInvites = [], isLoading: loadingInvites } = useQuery({
    queryKey: ['pendingInvites', customer.id],
    queryFn: () => base44.entities.InvitedUser.filter({ customer_id: customer.id, status: 'inactive' }),
  });

  const usedSeats = customerUsers.length + pendingInvites.length;
  const atLimit = usedSeats >= totalSeats;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['customerUsers', customer.id] });
    queryClient.invalidateQueries({ queryKey: ['pendingInvites', customer.id] });
    queryClient.invalidateQueries({ queryKey: ['allInvitedUsers'] });
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || atLimit) return;
    setInviting(true);
    try {
      // base44.users.inviteUser only accepts 'user' or 'admin'.
      // We invite as 'user' and track the desired role (e.g. customer_admin)
      // in InvitedUser so it can be upgraded after registration.
      await base44.users.inviteUser(inviteEmail.trim(), 'user');
      await base44.entities.InvitedUser.create({
        email: inviteEmail.trim(),
        role: inviteRole,
        invited_by: currentUser?.email || 'admin',
        customer_id: customer.id,
        customer_name: customer.name,
        status: 'inactive',
      });
      toast.success(t('seat_invite_sent').replace('{email}', inviteEmail.trim()));
      setInviteEmail('');
      setInviteRole('user');
      invalidate();
    } catch (err) {
      toast.error(err?.message || t('seat_invite_failed'));
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveUser = async (userId, userName) => {
    setRemovingId(userId);
    try {
      await base44.entities.User.update(userId, { customer_id: null });
      toast.success(t('seat_user_removed').replace('{name}', userName).replace('{customer}', customer.name));
      invalidate();
    } catch {
      toast.error(t('seat_remove_failed'));
    } finally {
      setRemovingId(null);
    }
  };

  const handleRemoveInvite = async (inviteId, email) => {
    setRemovingId(inviteId);
    try {
      await base44.entities.InvitedUser.delete(inviteId);
      toast.success(t('seat_invite_cancelled').replace('{email}', email));
      invalidate();
    } catch {
      toast.error(t('seat_invite_cancel_failed'));
    } finally {
      setRemovingId(null);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingRoleId(userId);
    try {
      await base44.entities.User.update(userId, { role: newRole });
      toast.success(t('seat_role_updated'));
      invalidate();
    } catch {
      toast.error(t('seat_role_update_failed'));
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleSeatLimitChange = async (newLimit) => {
    if (!canManage) return;
    const clamped = Math.max(MIN_SEAT_LIMIT, newLimit);
    if (clamped === baseLimit) {
      setShowSeatDialog(false);
      return;
    }
    setSavingSeats(true);
    try {
      await base44.entities.Customer.update(customer.id, { user_seat_limit: clamped });
      await notifySeatChange({
        customer,
        field: 'user_seat_limit',
        oldValue: baseLimit,
        newValue: clamped,
        changedBy: currentUser?.email,
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (onCustomerUpdated) onCustomerUpdated({ ...customer, user_seat_limit: clamped });
      toast.success(t('seat_limit_total_updated').replace('{count}', clamped + addonSeats));
      setShowSeatDialog(false);
    } catch {
      toast.error(t('seat_limit_update_failed'));
    } finally {
      setSavingSeats(false);
    }
  };

  if (loadingUsers || loadingInvites) {
    return <div className="py-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> {t('common_loading')}</div>;
  }

  return (
    <div className="space-y-4 py-2">

      {/* Seat usage + admin controls */}
      <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('seat_usage')}</p>
          {canManage && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {t('seat_base_limit')} <span className="font-mono font-bold text-foreground">{baseLimit}</span>
                {addonSeats > 0 && <span className="ml-1">{t('seat_addon_short').replace('{count}', addonSeats)}</span>}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setShowSeatDialog(true)}
                disabled={savingSeats}
              >
                {savingSeats ? <Loader2 className="w-3 h-3 animate-spin" /> : <Users className="w-3 h-3" />}
                {t('seat_adjust_seats')}
              </Button>
            </div>
          )}
        </div>
        <SeatBar used={usedSeats} total={totalSeats} />
      </div>

      {/* At-limit warning */}
      {atLimit && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 px-3 py-2">
          <p className="text-xs text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {t('seat_limit_reached')}
          </p>
        </div>
      )}

      {/* Invite form */}
      {canManage && !atLimit && (
        <form onSubmit={handleInvite} className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[180px] space-y-1">
            <p className="text-xs text-muted-foreground">{t('seat_email_address')}</p>
            <Input
              type="email"
              placeholder="user@company.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="h-8 text-xs"
              required
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('seat_role')}</p>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{t('role_user')}</SelectItem>
                <SelectItem value="customer_admin">{t('role_customer_admin')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="sm" className="h-8 gap-1.5 text-xs" disabled={inviting}>
            {inviting ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
            {t('seat_invite_user')}
          </Button>
        </form>
      )}

      {/* User table */}
      {customerUsers.length === 0 && pendingInvites.length === 0 ? (
        <div className="py-6 flex flex-col items-center gap-2 text-muted-foreground border-2 border-dashed rounded-lg">
          <Users className="w-8 h-8 opacity-30" />
          <p className="text-sm">{t('seat_no_users')}</p>
          {canManage && !atLimit && <p className="text-xs opacity-60">{t('seat_use_invite_form')}</p>}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          {/* Active users */}
          {customerUsers.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 border-b last:border-0 hover:bg-muted/30 transition-colors">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                {(u.full_name || u.email)?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight truncate">{u.display_name || u.full_name || u.email}</p>
                {(u.display_name || u.full_name) && (
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isAdmin ? (
                  <div className="relative">
                    {updatingRoleId === u.id
                      ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                      : (
                        <Select
                          value={u.role || 'user'}
                          onValueChange={val => handleRoleChange(u.id, val)}
                        >
                          <SelectTrigger className={`h-6 text-[10px] px-2 border font-semibold rounded-md ${ROLE_STYLES[u.role] || ROLE_STYLES.user}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">{t('role_user')}</SelectItem>
                            <SelectItem value="customer_admin">{t('role_customer_admin')}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                  </div>
                ) : (
                  <Badge variant="outline" className={`text-[10px] px-1.5 capitalize ${ROLE_STYLES[u.role] || ''}`}>
                    {ROLE_LABELS[u.role] || u.role}
                  </Badge>
                )}
                {canManage && (
                  <button
                    onClick={() => handleRemoveUser(u.id, u.display_name || u.full_name || u.email)}
                    disabled={removingId === u.id}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                    title={t('seat_remove_user')}
                  >
                    {removingId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Pending invites */}
          {pendingInvites.map(inv => (
            <div key={inv.id} className="flex items-center gap-3 px-3 py-2.5 border-b last:border-0 bg-muted/10">
              <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate text-muted-foreground">{inv.email}</p>
                <p className="text-[10px] text-muted-foreground">{t('seat_invited_by').replace('{name}', inv.invited_by || 'admin')}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className="text-[10px] px-1.5 border-dashed text-muted-foreground">
                  {t('seat_pending')}
                </Badge>
                {canManage && (
                  <button
                    onClick={() => handleRemoveInvite(inv.id, inv.email)}
                    disabled={removingId === inv.id}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                    title={t('seat_cancel_invite')}
                  >
                    {removingId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Seat adjust dialog */}
      <SeatAdjustDialog
        open={showSeatDialog}
        customer={customer}
        currentLimit={baseLimit}
        addonSeats={addonSeats}
        saving={savingSeats}
        onConfirm={handleSeatLimitChange}
        onCancel={() => setShowSeatDialog(false)}
      />
    </div>
  );
}