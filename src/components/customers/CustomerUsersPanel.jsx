import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Trash2, Loader2, Users, AlertTriangle, Send, Clock, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';

const DEFAULT_SEAT_LIMIT = 5;

export default function CustomerUsersPanel({ customer }) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [inviting, setInviting] = useState(false);
  const [requestingSeat, setRequestingSeat] = useState(false);
  const [resendingId, setResendingId] = useState(null);

  const isAdmin = currentUser?.role === 'admin';
  const seatLimit = (customer.user_seat_limit ?? DEFAULT_SEAT_LIMIT) + (customer.user_seat_addon_count ?? 0);

  // Fetch users belonging to this customer
  const { data: customerUsers = [], isLoading } = useQuery({
    queryKey: ['customerUsers', customer.id],
    queryFn: () => base44.entities.User.filter({ customer_id: customer.id }),
  });

  // Also count pending invites
  const { data: pendingInvites = [] } = useQuery({
    queryKey: ['pendingInvites', customer.id],
    queryFn: () => base44.entities.InvitedUser.filter({ customer_id: customer.id, status: 'inactive' }),
  });

  const usedSeats = customerUsers.length + pendingInvites.length;
  const seatsAvailable = seatLimit - usedSeats;
  const atLimit = seatsAvailable <= 0;

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    if (atLimit) {
      toast.error(t('cup_seat_limit_invite'));
      return;
    }

    setInviting(true);
    try {
      // base44.users.inviteUser only accepts 'user' or 'admin' as role.
      // We always invite as 'user' and track the desired role in InvitedUser
      // so it can be upgraded (e.g. to customer_admin) after registration via Settings.
      await base44.users.inviteUser(email.trim(), 'user');
      await base44.entities.InvitedUser.create({
        email: email.trim(),
        role,
        invited_by: currentUser?.email || 'admin',
        customer_id: customer.id,
        customer_name: customer.name,
        status: 'inactive',
      });
      toast.success(t('cup_invite_sent_password', { email: email.trim() }));
      setEmail('');
      setRole('user');
      queryClient.invalidateQueries({ queryKey: ['customerUsers', customer.id] });
      queryClient.invalidateQueries({ queryKey: ['pendingInvites', customer.id] });
    } catch (err) {
      toast.error(err?.message || t('seat_invite_failed'));
    } finally {
      setInviting(false);
    }
  };

  const handleResend = async (inv) => {
    setResendingId(inv.id);
    try {
      await base44.users.inviteUser(inv.email, 'user');
      toast.success(t('cup_invite_sent_password', { email: inv.email }));
    } catch (err) {
      toast.error(err?.message || t('cup_resend_failed'));
    } finally {
      setResendingId(null);
    }
  };

  const handleRemove = async (userId) => {    try {
      await base44.entities.User.update(userId, { customer_id: null });
      toast.success(t('cup_user_removed'));
      queryClient.invalidateQueries({ queryKey: ['customerUsers', customer.id] });
    } catch {
      toast.error(t('seat_remove_failed'));
    }
  };

  const handleRequestMoreSeats = async () => {
    setRequestingSeat(true);
    try {
      // Find platform admins to notify
      const admins = await base44.entities.User.filter({ role: 'admin' });
      const adminEmails = admins.map(a => a.email).filter(Boolean);

      // Send email to each admin
      await Promise.all(adminEmails.map(adminEmail =>
        base44.integrations.Core.SendEmail({
          to: adminEmail,
          subject: `[Seat Request] ${customer.name} needs more user seats`,
          body: `Hello,\n\nThe customer "${customer.name}" (ID: ${customer.id}) has reached their user seat limit.\n\nCurrent usage: ${usedSeats} / ${seatLimit} seats used.\n\nThey are requesting additional seats to onboard more users.\n\nPlease review and adjust the seat limit in the Admin panel > Seat Management section.\n\nThis request was triggered by: ${currentUser?.email || 'unknown'}\n\nBest regards,\nCyberGovern Platform`,
        })
      ));

      toast.success(t('cup_seat_request_sent'));
    } catch (err) {
      toast.error(t('cup_seat_request_failed', { error: err?.message || 'unknown error' }));
    } finally {
      setRequestingSeat(false);
    }
  };

  const seatPct = Math.min(100, Math.round((usedSeats / seatLimit) * 100));

  return (
    <div className="space-y-4">
      {/* Seat usage bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> {t('cup_user_seats')}
          </span>
          <span className={atLimit ? 'text-destructive font-bold' : 'text-muted-foreground'}>
            {t('cup_seats_used', { used: usedSeats, total: seatLimit })}
          </span>
        </div>
        <Progress value={seatPct} className={`h-2 ${atLimit ? '[&>div]:bg-destructive' : ''}`} />
        {pendingInvites.length > 0 && (
          <p className="text-[10px] text-muted-foreground">{t('cup_pending_invite', { count: pendingInvites.length })}</p>
        )}
      </div>

      {/* At-limit warning + request button */}
      {atLimit && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-400">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{t('cup_seat_limit_contact')}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-400 flex-shrink-0"
            onClick={handleRequestMoreSeats}
            disabled={requestingSeat}
          >
            {requestingSeat ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            {t('cup_request_more_seats')}
          </Button>
        </div>
      )}

      {/* Invite form */}
      {!atLimit && (
        <>
        <form onSubmit={handleInvite} className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <Input
              type="email"
              placeholder="user@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="h-8 text-xs"
              required
            />
          </div>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">{t('cup_role_user')}</SelectItem>
              <SelectItem value="customer_admin">{t('cup_role_customer_admin')}</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" className="h-8 gap-1.5 text-xs" disabled={inviting}>
            {inviting ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
            {t('cup_invite')}
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-0.5">
          <MailCheck className="w-3 h-3" />
          {t('cup_invite_help')}
        </p>
        </>
      )}

      {/* User list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground py-2">{t('cup_loading_users')}</p>
      ) : customerUsers.length === 0 && pendingInvites.length === 0 ? (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Users className="w-4 h-4 opacity-40" />
          {t('cup_no_users')}
        </div>
      ) : (
        <div className="space-y-1">
          {/* Active users */}
          {customerUsers.map(u => (
            <div key={u.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {(u.full_name || u.email)?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{u.display_name || u.full_name || u.email}</p>
                  {(u.display_name || u.full_name) && <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Badge variant="secondary" className="text-[10px] px-1.5 capitalize">{u.role}</Badge>
                {isAdmin && (
                  <button
                    onClick={() => handleRemove(u.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title={t('seat_remove_user')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {/* Pending invites */}
          {pendingInvites.map(inv => (
            <div key={inv.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {inv.email?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs truncate">{inv.email}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {t('cup_pending_password')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] gap-1 text-primary hover:text-primary"
                  onClick={() => handleResend(inv)}
                  disabled={resendingId === inv.id}
                >
                  {resendingId === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  {resendingId === inv.id ? t('cup_resending') : t('cup_resend_link')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}