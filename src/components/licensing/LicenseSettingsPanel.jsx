import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FileBadge, FileJson, FileText, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useLicense, STATE_STYLE, downloadCertificateJson, downloadCertificatePdf } from '@/lib/licensing';

/** Definições → Licença: o que o cliente tem contratado (só leitura). */
export default function LicenseSettingsPanel() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: lic, isLoading } = useLicense();
  const { data: modules = [] } = useQuery({ queryKey: ['lic-modules'], queryFn: () => base44.entities.LicenseModule.list('display_order', 200) });
  const { data: tiers = [] } = useQuery({ queryKey: ['lic-tiers'], queryFn: () => base44.entities.LicenseTier.list('display_order', 100) });
  const { data: certs = [] } = useQuery({
    queryKey: ['lic-certs', user?.customer_id],
    queryFn: () => base44.entities.LicenseCertificate.filter({ customer_id: user.customer_id, status: 'active' }, '-issued_at', 1),
    enabled: user?.role === 'customer_admin' && Boolean(user?.customer_id),
  });
  if (isLoading || !lic) return <p className="text-sm text-muted-foreground">{t('common_loading')}</p>;
  const names = Object.fromEntries(modules.map((m) => [m.code, m.name]));
  const tier = tiers.find((x) => x.code === lic.tier_code);
  const end = lic.state === 'trial' ? lic.trial_ends_at : lic.expires_date;
  const cert = certs[0];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><FileBadge className="w-4 h-4" />{t('lic_my_title')}
          <Badge variant="outline" className={`text-[10px] ${STATE_STYLE[lic.state] || ''}`}>{t(`lic_state_${lic.state}`)}</Badge></CardTitle>
        <CardDescription>{lic.state === 'legacy' ? t('lic_my_legacy') : `${tier?.name || lic.tier_code || '—'}${end ? ` · ${t('lic_until', { date: end })}` : ''}${lic.grace_until ? ` · ${t('lic_grace')}: ${lic.grace_until}` : ''}`}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid sm:grid-cols-2 gap-1">
          {(lic.modules || []).map((c) => <span key={c} className="flex items-center gap-1 text-xs"><Check className="w-3.5 h-3.5 text-chart-2" />{names[c] || c}</span>)}
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div>{t('lic_seats')}: <span className="font-medium">{lic.seat_limit ?? '—'}</span></div>
          <div className="space-y-1">
            <span>{t('lic_ai_month')}: <span className="font-medium">{lic.ai_used_month}{lic.ai_quota_monthly != null ? ` / ${lic.ai_quota_monthly}` : ` (${t('lic_unlimited')})`}</span></span>
            {lic.ai_quota_monthly ? <Progress value={Math.min(100, (lic.ai_used_month / lic.ai_quota_monthly) * 100)} className="h-1.5" /> : null}
          </div>
        </div>
        {cert && (
          <div className="flex items-center gap-2 text-xs border-t pt-3">
            <span>{t('lic_cert_current')}: <span className="font-mono">{cert.serial}</span></span>
            <Button size="sm" variant="outline" className="h-7" onClick={() => downloadCertificatePdf(cert, names)}><FileText className="w-3.5 h-3.5 mr-1" />PDF</Button>
            <Button size="sm" variant="outline" className="h-7" onClick={() => downloadCertificateJson(cert)}><FileJson className="w-3.5 h-3.5 mr-1" />JSON</Button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">{t('lic_my_contact')}</p>
      </CardContent>
    </Card>
  );
}
