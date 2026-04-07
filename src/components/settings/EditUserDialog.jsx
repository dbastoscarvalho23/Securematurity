import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export default function EditUserDialog({ open, onOpenChange, user, customers, onSave, isSaving, currentUserRole }) {
  const [fullName, setFullName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [role, setRole] = useState('user');

  useEffect(() => {
    if (user) {
      setFullName(user.display_name || user.full_name || '');
      setCustomerId(user.customer_id || '');
      setRole(user.role || 'user');
    }
  }, [user]);

  const isPlatformAdmin = currentUserRole === 'admin';
  const targetIsAdmin = user?.role === 'admin';
  const needsCustomer = role === 'customer_admin' || role === 'user';

  const handleSave = () => {
    const selectedCustomer = customers.find(c => c.id === customerId);
    onSave(user.id, {
      full_name: fullName,
      ...(isPlatformAdmin && { role }),
      ...(isPlatformAdmin && needsCustomer && {
        customer_id: customerId || null,
        customer_name: selectedCustomer?.name || null,
      }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Name — editable by all */}
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Full name"
            />
          </div>

          {/* Customer — shown whenever role is customer_admin or user */}
          {needsCustomer && (
            isPlatformAdmin ? (
              <div className="space-y-1.5">
                <Label>Associated Customer {role === 'customer_admin' && <span className="text-destructive">*</span>}</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>— None —</SelectItem>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {role === 'customer_admin' && (
                  <p className="text-xs text-muted-foreground">Customer Admin must be linked to a customer.</p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Associated Customer</Label>
                <Input
                  value={user?.customer_name || '—'}
                  disabled
                  className="bg-muted/50 text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">Only a platform admin can change customer assignment.</p>
              </div>
            )
          )}

          {/* Role — only platform admin can change */}
          {isPlatformAdmin ? (
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="customer_admin">Customer Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Input
                value={user?.role === 'customer_admin' ? 'Customer Admin' : user?.role || '—'}
                disabled
                className="bg-muted/50 text-muted-foreground capitalize"
              />
              <p className="text-xs text-muted-foreground">Only a platform admin can change roles.</p>
            </div>
          )}

          <div className="text-sm text-muted-foreground border rounded p-2 bg-muted/30">
            <span className="font-medium">Email:</span> {user?.email}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}