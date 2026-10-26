import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Mail, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { mailConfig, sendTestEmail } from '@/lib/mail';

const PROVIDER_LABEL = { base44: 'Base44', resend: 'Resend', smtp: 'SMTP' };

// Administração: remetente em uso e email de teste. A configuração vive nos segredos da app
// (MAIL_PROVIDER, MAIL_FROM, MAIL_REPLY_TO, RESEND_API_KEY ou SMTP_*), nunca no browser.
export default function EmailSettingsPanel() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [to, setTo] = useState('');
  const [sending, setSending] = useState(false);
  const { data: cfg, isLoading, error } = useQuery({ queryKey: ['mail-config'], queryFn: mailConfig });

  const test = async () => {
    setSending(true);
    try {
      const r = await sendTestEmail(to.trim() || user?.email);
      if (!r?.sent) throw new Error(r?.errors?.[0] || t('x_mail_test_failed'));
      toast.success(r.fallback ? t('x_mail_test_fallback') : t('x_mail_test_ok'));
    } catch (e) {
      toast.error(e.message || t('x_mail_test_failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4" />{t('x_mail_title')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('x_mail_desc')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : error ? (
          <p className="text-sm text-destructive">{error.message}</p>
        ) : (
          <dl className="grid gap-2 text-sm sm:grid-cols-[160px_1fr]">
            <dt className="text-muted-foreground">{t('x_mail_provider')}</dt>
            <dd><Badge variant="outline">{PROVIDER_LABEL[cfg?.provider] || cfg?.provider}</Badge></dd>
            <dt className="text-muted-foreground">{t('x_mail_from')}</dt>
            <dd className="break-all">{cfg?.provider === 'base44' ? `${cfg?.from_name} <no-reply@base44-apps.com>` : cfg?.from}</dd>
            <dt className="text-muted-foreground">{t('x_mail_reply_to')}</dt>
            <dd className="break-all">{cfg?.provider === 'base44' ? '—' : cfg?.reply_to}</dd>
          </dl>
        )}
        {cfg?.provider === 'base44' && <p className="text-xs text-muted-foreground">{t('x_mail_base44_note')}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder={user?.email} className="sm:max-w-xs" />
          <Button onClick={test} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{t('x_mail_test')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
