import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Server, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';

const call = async (payload) => {
  const res = await base44.functions.invoke('storageConnection', payload);
  const data = res?.data ?? res;
  if (data?.error) throw new Error(data.error);
  return data;
};

/** Configuração do NAS do cliente (WebDAV sobre HTTPS). A palavra-passe fica cifrada e nunca é devolvida. */
export default function NasConnectionPanel({ customerId }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['nas-connection', customerId],
    queryFn: () => call({ action: 'get', customer_id: customerId }),
    enabled: Boolean(customerId),
  });
  const conn = data?.connection;
  const [form, setForm] = useState({ base_url: '', base_path: '', username: '', password: '' });
  const [busy, setBusy] = useState('');
  useEffect(() => {
    setForm({ base_url: conn?.base_url || '', base_path: conn?.base_path || 'AnkoraOne', username: conn?.username || '', password: '' });
  }, [conn?.id, conn?.base_url, conn?.base_path, conn?.username]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const run = async (kind) => {
    setBusy(kind);
    try {
      if (kind === 'save') {
        if (!/^https:\/\//i.test(form.base_url)) throw new Error(t('nas_https_only'));
        await call({ action: 'save', customer_id: customerId, ...form, password: form.password || undefined });
        toast.success(t('nas_saved'));
      } else {
        const r = await call({ action: 'test', customer_id: customerId });
        r.ok ? toast.success(t('nas_test_ok')) : toast.error(`${t('nas_test_fail')}: ${r.message}`);
      }
      qc.invalidateQueries({ queryKey: ['nas-connection', customerId] });
      setForm((f) => ({ ...f, password: '' }));
    } catch (e) {
      toast.error(e?.message || t('nas_test_fail'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium"><Server className="w-4 h-4 text-primary" />{t('nas_title')}</div>
      <p className="text-xs text-muted-foreground">{t('nas_help')}</p>
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2"><Label className="text-xs">{t('nas_base_url')} *</Label><Input value={form.base_url} onChange={(e) => set('base_url', e.target.value)} placeholder="https://nas.cliente.pt/remote.php/dav/files/ankora/" /></div>
            <div className="space-y-1"><Label className="text-xs">{t('nas_base_path')}</Label><Input value={form.base_path} onChange={(e) => set('base_path', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">{t('nas_username')}</Label><Input value={form.username} autoComplete="off" onChange={(e) => set('username', e.target.value)} /></div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">{t('nas_password')}</Label>
              <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder={conn?.has_password ? t('nas_password_keep') : ''} />
            </div>
          </div>
          {conn?.last_test_at && (
            <p className={`text-xs flex items-center gap-1 ${conn.last_test_ok ? 'text-chart-2' : 'text-destructive'}`}>
              {conn.last_test_ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {t('nas_last_test')}: {conn.last_test_at.replace('T', ' ').slice(0, 16)} — {conn.last_test_message}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => run('save')} disabled={!!busy || !form.base_url}>{busy === 'save' && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}{t('nas_save')}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => run('test')} disabled={!!busy || !conn}>{busy === 'test' && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}{t('nas_test')}</Button>
          </div>
        </>
      )}
    </div>
  );
}
