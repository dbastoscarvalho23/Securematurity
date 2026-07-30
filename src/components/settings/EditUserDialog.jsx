import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { validators, validateForm, hasErrors } from '@/lib/validation';
import { useLanguage } from '@/lib/LanguageContext';

export default function EditUserDialog({ open, onOpenChange, user, customers, onSave, isSaving, currentUserRole }) {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [role, setRole] = useState('user');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      setFullName(user.display_name || user.full_name || '');
      setCustomerId(user.customer_id || '');
      setRole(user.role || 'user');
    }
    setErrors({});
  }, [user]);

  const isPlatformAdmin = currentUserRole === 'admin';
  const needsCustomer = role === 'customer_admin' || role === 'user';

  const handleSave = () => {
    const values = { fullName, customerId, role };
    const schema = {
      fullName: [validators.required, (v) => validators.minLength(v, 2), (v) => validators.maxLength(v, 100)],
      role: (v) => validators.enum(v, ['user', 'customer_admin', 'admin']),
      ...(isPlatformAdmin && role === 'customer_admin' && { customerId: validators.required }),
    };
    const formErrors = validateForm(values, schema);
    setErrors(formErrors);
    if (hasErrors(formErrors)) return;

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
          <DialogTitle>{t('user_dlg_edit')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Name — editable by all */}
          <div className="space-y-1.5">
            <Label>{t('common_full_name')}</Label>
            <Input
              value={fullName}
              onChange={e => { setFullName(e.target.value); if (errors.fullName) setErrors(p => ({ ...p, fullName: null })); }}
              placeholder={t('user_dlg_full_name_ph')}
              className={errors.fullName ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
          </div>

          {/* Customer — shown whenever role is customer_admin or user */}
          {needsCustomer && (
            isPlatformAdmin ? (
              <div className="space-y-1.5">
                <Label>{t('user_dlg_associated_customer')} {role === 'customer_admin' && <span className="text-destructive">*</span>}</Label>
                <Select value={customerId} onValueChange={(v) => { setCustomerId(v); if (errors.customerId) setErrors(p => ({ ...p, customerId: null })); }}>
                  <SelectTrigger className={errors.customerId ? 'border-destructive' : ''}>
                    <SelectValue placeholder={t('common_select_customer_ph')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>{t('user_dlg_none')}</SelectItem>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.customerId && <p className="text-xs text-destructive">{errors.customerId}</p>}
                {role === 'customer_admin' && !errors.customerId && (
                  <p className="text-xs text-muted-foreground">{t('user_dlg_customer_admin_must')}</p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>{t('user_dlg_associated_customer')}</Label>
                <Input
                  value={user?.customer_name || '—'}
                  disabled
                  className="bg-muted/50 text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">{t('user_dlg_only_admin_customer')}</p>
              </div>
            )
          )}

          {/* Role — only platform admin can change */}
          {isPlatformAdmin ? (
            <div className="space-y-1.5">
              <Label>{t('common_role')}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{t('user_dlg_role_user')}</SelectItem>
                  <SelectItem value="customer_admin">{t('user_dlg_role_customer_admin')}</SelectItem>
                  <SelectItem value="admin">{t('user_dlg_role_admin')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>{t('common_role')}</Label>
              <Input
                value={user?.role === 'customer_admin' ? t('user_dlg_role_customer_admin') : user?.role || '—'}
                disabled
                className="bg-muted/50 text-muted-foreground capitalize"
              />
              <p className="text-xs text-muted-foreground">{t('user_dlg_only_admin_roles')}</p>
            </div>
          )}

          <div className="text-sm text-muted-foreground border rounded p-2 bg-muted/30">
            <span className="font-medium">{t('user_dlg_email')}</span> {user?.email}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common_cancel')}</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {t('common_save_changes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}