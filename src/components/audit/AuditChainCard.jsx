import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/LanguageContext';
import { format } from '@/lib/dateFormat';
import { auditChainStatus, verifyAuditChain, sealAuditChain } from '@/lib/auditLog';

const when = (iso) => (iso ? format(new Date(iso), 'd MMM yyyy HH:mm') : '');

/** Estado da cadeia de integridade da trilha: selo de partida, última verificação e ações do administrador. */
export default function AuditChainCard() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(null);
  const { data: status, isLoading } = useQuery({ queryKey: ['audit-chain-status'], queryFn: auditChainStatus });

  const run = async (kind) => {
    setBusy(kind);
    try {
      const result = kind === 'seal' ? await sealAuditChain() : await verifyAuditChain();
      if (kind === 'seal') {
        toast[result?.sealed || result?.already ? 'success' : 'error'](result?.sealed ? t('audit_chain_sealed_toast', { count: result.covered }) : result?.already ? t('audit_chain_already_sealed') : (result?.note || t('audit_chain_error')));
      } else {
        toast[result?.integrity_ok ? 'success' : 'error'](result?.note || t('audit_chain_error'));
      }
      queryClient.invalidateQueries({ queryKey: ['audit-chain-status'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    } catch (e) {
      toast.error(e?.message || t('audit_chain_error'));
    } finally {
      setBusy(null);
    }
  };

  const last = status?.last_verification;
  const broken = last?.action === 'audit_chain_broken';
  const Icon = broken ? ShieldAlert : ShieldCheck;

  return (
    <Card>
      <CardContent className="p-4 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${broken ? 'text-destructive' : 'text-primary'}`} />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium">{t('audit_chain_title')}</p>
            {isLoading ? <p className="text-xs text-muted-foreground">{t('common_loading')}</p> : (
              <>
                <p className="text-xs text-muted-foreground">
                  {status?.seal ? t('audit_chain_seal_info', { date: when(status.seal.at), count: status.seal.covered }) : t('audit_chain_not_sealed')}
                </p>
                {last && <p className={`text-xs ${broken ? 'text-destructive' : 'text-muted-foreground'}`}>{t('audit_chain_last_check', { date: when(last.at) })} {last.details}</p>}
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!status?.seal && (
            <Button size="sm" variant="outline" disabled={!!busy || isLoading} onClick={() => run('seal')}>
              {busy === 'seal' && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}{t('audit_chain_seal')}
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={!!busy || isLoading || !status?.seal} onClick={() => run('verify')}>
            {busy === 'verify' && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}{t('audit_chain_verify')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
