import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Loader2, Search } from 'lucide-react';
import SeatAdjustDialog from '@/components/customers/SeatAdjustDialog';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { notifySeatChange, MIN_SEAT_LIMIT } from '@/lib/seatManagement';

export default function SeatManagementPanel() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [addonEdits, setAddonEdits] = useState({});
  const [seatDialog, setSeatDialog] = useState(null);

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
      toast.error(t('seat_invalid_value'));
      return;
    }
    const oldAddon = customer.user_seat_addon_count ?? 0;
    if (newAddon === oldAddon) {
      setAddonEdits(prev => { const n = { ...prev }; delete n[customer.id]; return n; });
      return;
    }
    setSavingId(customer.id);
    try {
      await base44.entities.Customer.update(customer.id, { user_seat_addon_count: newAddon });
      await notifySeatChange({
        customer,
        field: 'user_seat_addon_count',
        oldValue: oldAddon,
        newValue: newAddon,
        changedBy: currentUser?.email,
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(t('seat_addon_updated').replace('{name}', customer.name));
      setAddonEdits(prev => { const n = { ...prev }; delete n[customer.id]; return n; });
    } catch {
      toast.error(t('seat_update_failed'));
    } finally {
      setSavingId(null);
    }
  };

  const handleSeatLimitChange = async (customer, newLimit) => {
    const current = customer.user_seat_limit ?? MIN_SEAT_LIMIT;
    const clamped = Math.max(MIN_SEAT_LIMIT, newLimit);
    if (clamped === current) {
      setSeatDialog(null);
      return;
    }
    setSavingId(customer.id + '_limit');
    try {
      await base44.entities.Customer.update(customer.id, { user_seat_limit: clamped });
      await notifySeatChange({
        customer,
        field: 'user_seat_limit',
        oldValue: current,
        newValue: clamped,
        changedBy: currentUser?.email,
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(t('seat_base_updated').replace('{name}', customer.name));
      setSeatDialog(null);
    } catch {
      toast.error(t('seat_limit_update_failed'));
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
            {t('seat_management')}
          </CardTitle>
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="pl-9 h-8 text-xs"
              placeholder={t('seat_search_customer')}
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
              <TableHead>{t('seat_col_customer')}</TableHead>
              <TableHead>{t('seat_col_usage')}</TableHead>
              <TableHead className="text-center">{t('seat_col_base')}</TableHead>
              <TableHead className="text-center">{t('seat_col_addon')}</TableHead>
              <TableHead className="text-center">{t('seat_col_total')}</TableHead>
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
                        {atLimit && <Badge variant="destructive" className="text-[10px] px-1">{t('seat_at_limit')}</Badge>}
                      </div>
                      <Progress value={pct} className={`h-1.5 ${atLimit ? '[&>div]:bg-destructive' : ''}`} />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm font-mono w-6 text-center">{base}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setSeatDialog(c)}
                        disabled={savingId === c.id + '_limit'}
                      >
                        {savingId === c.id + '_limit' ? <Loader2 className="w-3 h-3 animate-spin" /> : t('seat_adjust')}
                      </Button>
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
                          {savingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : t('seat_save')}
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
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">{t('seat_no_customers')}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Seat adjust dialog */}
      <SeatAdjustDialog
        open={seatDialog !== null}
        customer={seatDialog}
        currentLimit={seatDialog?.user_seat_limit ?? MIN_SEAT_LIMIT}
        addonSeats={seatDialog?.user_seat_addon_count ?? 0}
        saving={savingId !== null}
        onConfirm={(newLimit) => seatDialog && handleSeatLimitChange(seatDialog, newLimit)}
        onCancel={() => setSeatDialog(null)}
      />
    </Card>
  );
}