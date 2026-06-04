import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Trash2, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerUsersPanel({ customer }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [inviting, setInviting] = useState(false);

  // Fetch users belonging to this customer
  const { data: customerUsers = [], isLoading } = useQuery({
    queryKey: ['customerUsers', customer.id],
    queryFn: () => base44.entities.User.filter({ customer_id: customer.id }),
  });

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      await base44.users.inviteUser(email.trim(), role);
      // Also update the invited user record with customer reference
      await base44.entities.InvitedUser.create({
        email: email.trim(),
        role,
        invited_by: 'admin',
        status: 'inactive',
      });
      toast.success(`Invitation sent to ${email.trim()}`);
      setEmail('');
      setRole('user');
      queryClient.invalidateQueries({ queryKey: ['customerUsers', customer.id] });
      queryClient.invalidateQueries({ queryKey: ['invitedUsers'] });
    } catch (err) {
      toast.error(err?.message || 'Failed to invite user');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId) => {
    try {
      await base44.entities.User.update(userId, { customer_id: null });
      toast.success('User removed from customer');
      queryClient.invalidateQueries({ queryKey: ['customerUsers', customer.id] });
    } catch {
      toast.error('Failed to remove user');
    }
  };

  return (
    <div className="space-y-3">
      {/* Invite form */}
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
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="customer_admin">Customer Admin</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" className="h-8 gap-1.5 text-xs" disabled={inviting}>
          {inviting ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
          Invite
        </Button>
      </form>

      {/* User list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground py-2">Loading users…</p>
      ) : customerUsers.length === 0 ? (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Users className="w-4 h-4 opacity-40" />
          No users assigned to this customer yet.
        </div>
      ) : (
        <div className="space-y-1">
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
                <button
                  onClick={() => handleRemove(u.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Remove from customer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}