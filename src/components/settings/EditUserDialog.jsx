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

  useEffect(() => {
    if (user) {
      setFullName(user.display_name || user.full_name || '');
      setCustomerId(user.customer_id || '');
    }
  }, [user]);

  const handleSave = () => {
    const selectedCustomer = customers.find(c => c.id === customerId);
    onSave(user.id, {
      full_name: fullName,
      customer_id: customerId || null,
      customer_name: selectedCustomer?.name || null,
    });
  };


  const isAdmin = currentUserRole === 'admin';
  const targetIsAdmin = user?.role === 'admin';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          {isAdmin && !targetIsAdmin && (
            <div className="space-y-1.5">
              <Label>Associated Customer</Label>
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
              <p className="text-xs text-muted-foreground">Non-admin users must be linked to a customer.</p>
            </div>
          )}
          {!isAdmin && !targetIsAdmin && (
            <div className="space-y-1.5">
              <Label>Associated Customer</Label>
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
              <p className="text-xs text-muted-foreground">Link your account to a customer organization.</p>
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