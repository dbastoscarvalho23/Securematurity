import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Plus, Minus, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function SeatManagementPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [addonEdits, setAddonEdits] = useState({});

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: allInvites = [] } = useQuery({
    queryKey: ['allInvitedUsers'],
    queryFn: () => base44.entities.InvitedUser.filter({ status: 'inactive' }),
  });

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const getUsed = (customerId) => {
    const users = allUsers.filter(u => u.customer_id === customerId).length;
    const invites = allInvites.filter(i => i.customer_id === customerId).length;
    return users + invites;
  };

  const getAddonValue = (customer) => {
    return addonEdits[customer.id] !== undefined
      ? addonEdits[customer.id]
      : (customer.user_seat_addon_count ?? 0);
  };

  const handleSaveAddon = async (customer) => {
    const newAddon = parseInt(getAddonValue(customer), 10);
    if (isNaN(newAddon) || newAddon < 0) {
      toast.error('Invalid value');
      return;
    }
    setSavingId(customer.id);
    try {
      await base44.entities.Customer.update(customer.id, { user_seat_addon_count: newAddon });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(`Add-on seats updated for ${customer.name}`);
      setAddonEdits(prev => { const n = { ...prev }; delete n[customer.id]; return n; });
    } catch {
      toast.error('Failed to update seats');
    } finally {
      setSavingId(null);
    }
  };

  const handleSeatLimitChange = async (customer, delta) => {
    const current = customer.user_seat_limit ?? 5;
    const next = Math.max(1, current + delta);
    setSavingId(customer.id + '_limit');
    try {
      await base44.entities.Customer.update(customer.id, { user_seat_limit: next });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(`Base seat limit updated for ${customer.name}`);
    } catch {
      toast.error('Failed to update seat limit');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Seat Management
          </CardTitle>
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="pl-9 h-8 text-xs"
              placeholder="Search customer…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead className="text-center">Base Seats</TableHead>
              <TableHead className="text-center">Add-on Seats</TableHead>
              <TableHead className="text-center">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(c => {
              const base = c.user_seat_limit ?? 5;
              const addon = c.user_seat_addon_count ?? 0;
              const total = base + addon;
              const used = getUsed(c.id);
              const pct = Math.min(100, Math.round((used / total) * 100));
              const atLimit = used >= total;

              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <Badge variant="outline" className="text-[10px] capitalize mt-0.5">{c.status}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[140px]">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className={atLimit ? 'text-destructive font-bold' : 'text-muted-foreground'}>
                          {used} / {total}
                        </span>
                        {atLimit && <Badge variant="destructive" className="text-[10px] px-1">At limit</Badge>}
                      </div>
                      <Progress value={pct} className={`h-1.5 ${atLimit ? '[&>div]:bg-destructive' : ''}`} />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleSeatLimitChange(c, -1)}
                        disabled={savingId === c.id + '_limit' || base <= 1}
                        className="w-5 h-5 rounded border flex items-center justify-center hover:bg-muted disabled:opacity-40"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-mono w-6 text-center">{base}</span>
                      <button
                        onClick={() => handleSeatLimitChange(c, +1)}
                        disabled={savingId === c.id + '_limit'}
                        className="w-5 h-5 rounded border flex items-center justify-center hover:bg-muted disabled:opacity-40"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      {savingId === c.id + '_limit' && <Loader2 className="w-3 h-3 animate-spin ml-1 text-muted-foreground" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        className="w-16 h-7 text-xs text-center"
                        value={getAddonValue(c)}
                        onChange={e => setAddonEdits(prev => ({ ...prev, [c.id]: e.target.value }))}
                      />
                      {addonEdits[c.id] !== undefined && (
                        <Button
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => handleSaveAddon(c)}
                          disabled={savingId === c.id}
                        >
                          {savingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-bold text-sm">{total}</TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">No customers found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}