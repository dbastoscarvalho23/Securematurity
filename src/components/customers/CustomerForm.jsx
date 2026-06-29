import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/lib/LanguageContext';

const FRAMEWORKS = [
  { code: 'NIS2', name: 'NIS2 / DL 125/2025' },
  { code: 'ISO27001', name: 'ISO/IEC 27001' },
  { code: 'NIST_CSF', name: 'NIST Cybersecurity Framework' },
  { code: 'CIS_V8', name: 'CIS Controls v8' },
  { code: 'QNRC', name: 'QNRC' },
  { code: 'GDPR', name: 'GDPR' },
];

const SECTORS = [
  { value: 'financial_services', label: 'Financial Services' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'energy', label: 'Energy' },
  { value: 'telecommunications', label: 'Telecommunications' },
  { value: 'public_administration', label: 'Public Administration' },
  { value: 'technology', label: 'Technology' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'education', label: 'Education' },
  { value: 'defense', label: 'Defense' },
  { value: 'other', label: 'Other' },
];

const EMPLOYEE_RANGES = ['1-50', '51-250', '251-1000', '1001-5000', '5000+'];

export default function CustomerForm({ customer, onSubmit, onCancel, isLoading }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    nif: customer?.nif || '',
    name: customer?.name || '',
    website: customer?.website || '',
    sector: customer?.sector || '',
    contact_name: customer?.contact_name || '',
    contact_email: customer?.contact_email || '',
    contact_phone: customer?.contact_phone || '',
    cybersecurity_manager: customer?.cybersecurity_manager || '',
    cybersecurity_manager_email: customer?.cybersecurity_manager_email || '',
    cybersecurity_manager_phone: customer?.cybersecurity_manager_phone || '',
    num_employees: customer?.num_employees || '',
    status: customer?.status || 'onboarding',
    allowed_frameworks: customer?.allowed_frameworks || ['NIS2', 'ISO27001', 'NIST_CSF', 'CIS_V8', 'QNRC', 'GDPR'],
    notes: customer?.notes || '',
    user_seat_limit: customer?.user_seat_limit ?? 5,
    user_seat_addon_count: customer?.user_seat_addon_count ?? 0,
  });

  const toggleFramework = (code) => {
    setForm(prev => ({
      ...prev,
      allowed_frameworks: prev.allowed_frameworks.includes(code)
        ? prev.allowed_frameworks.filter(f => f !== code)
        : [...prev.allowed_frameworks, code],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{customer ? t('customers_form_edit') : t('customers_form_new')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>NIF *</Label>
              <Input value={form.nif} onChange={e => set('nif', e.target.value)} required placeholder="Tax ID" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>{t('customers_form_org_name')} *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} required placeholder={t('customers_form_org_name_placeholder')} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{t('customers_col_sector')} *</Label>
              <Select value={form.sector} onValueChange={v => set('sector', v)}>
                <SelectTrigger><SelectValue placeholder={t('customers_form_select_sector')} /></SelectTrigger>
                <SelectContent>
                  {SECTORS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('customers_col_employees')}</Label>
              <Select value={form.num_employees} onValueChange={v => set('num_employees', v)}>
                <SelectTrigger><SelectValue placeholder={t('customers_form_select_range')} /></SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_RANGES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('customers_detail_website')}</Label>
              <Input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{t('customers_detail_contact_name')}</Label>
              <Input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('customers_detail_contact_email')}</Label>
              <Input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('customers_detail_contact_phone')}</Label>
              <Input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{t('customers_col_csm')}</Label>
              <Input value={form.cybersecurity_manager} onChange={e => set('cybersecurity_manager', e.target.value)} placeholder={t('customers_form_csm_placeholder')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('customers_detail_csm_email')}</Label>
              <Input type="email" value={form.cybersecurity_manager_email} onChange={e => set('cybersecurity_manager_email', e.target.value)} placeholder="manager@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('customers_detail_csm_phone')}</Label>
              <Input value={form.cybersecurity_manager_phone} onChange={e => set('cybersecurity_manager_phone', e.target.value)} placeholder="+351 900 000 000" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('customers_detail_frameworks')}</Label>
            <div className="flex flex-wrap gap-4">
              {FRAMEWORKS.map(fw => (
                <div key={fw.code} className="flex items-center gap-2">
                  <Checkbox
                    checked={form.allowed_frameworks.includes(fw.code)}
                    onCheckedChange={() => toggleFramework(fw.code)}
                  />
                  <span className="text-sm">{fw.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{t('common_status')}</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="onboarding">{t('customers_status_onboarding')}</SelectItem>
                  <SelectItem value="active">{t('customers_status_active')}</SelectItem>
                  <SelectItem value="inactive">{t('customers_status_inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>User Seat Limit</Label>
              <Input
                type="number"
                min={1}
                value={form.user_seat_limit}
                onChange={e => set('user_seat_limit', parseInt(e.target.value) || 5)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('common_notes')}</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>{t('common_cancel')}</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('common_loading') : customer ? t('customers_form_update') : t('customers_form_create')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}