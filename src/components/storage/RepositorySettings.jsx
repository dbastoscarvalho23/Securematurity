import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Cloud, HardDrive, Server, AlertTriangle, Info, Loader2, CheckCircle2, XCircle, Folder, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';
import {
  PROVIDERS, REPOSITORY_FOLDERS, ROOT, safeName, normalizeStorageRoot, defaultStorageRoot, effectiveStorageRoot,
  storageProvidersStatus, nasConnection,
} from '@/lib/repository';

const ICONS = { base44: Lock, google_drive: Cloud, one_drive: Cloud, webdav: Server };

/** Estado inicial do formulário a partir do cliente (ou de um cliente novo). */
export function initialRepositoryValue(customer) {
  return {
    provider: customer?.storage_provider || 'base44',
    // null = localização por omissão (AnkoraOne/<cliente>); texto = localização escolhida.
    storage_root: customer?.storage_root || null,
    webdav: null, // só preenchido quando o administrador da plataforma altera a ligação ao NAS
  };
}

/** Dados a enviar ao servidor: { provider, storage_root, webdav? }. */
export function repositoryPayload(value) {
  return {
    provider: value.provider,
    storage_root: value.storage_root == null ? '' : value.storage_root,
    ...(value.provider === 'webdav' && value.webdav ? { webdav: value.webdav } : {}),
  };
}

/** O repositório ou a localização mudam em relação ao que o cliente tem hoje? (credenciais do NAS não contam) */
export function locationChanged(customer, value) {
  if (!customer) return false;
  let root = '';
  try { root = normalizeStorageRoot(value.storage_root); } catch { return true; }
  const sameRoot = (root || defaultStorageRoot(customer)) === effectiveStorageRoot(customer);
  return (customer.storage_provider || 'base44') !== value.provider || !sameRoot;
}

/** É preciso gravar alguma coisa? (cliente novo, repositório/localização diferentes ou nova ligação ao NAS) */
export function repositoryChanged(customer, value) {
  return !customer || locationChanged(customer, value) || Boolean(value.webdav);
}

/**
 * Escolha do repositório documental de um cliente e da localização dos ficheiros.
 * Usado na ficha do cliente (administrador da plataforma) e em Definições → Armazenamento (administrador do cliente),
 * para que os dois caminhos tenham o mesmo aspeto. Não grava nada sozinho, exceto «Testar ligação» ao NAS de um
 * cliente que já existe (o servidor só aceita testar a ligação guardada).
 *
 * props: customer (null ao criar), customerName (para a pré-visualização ao criar), value, onChange,
 *        canEditNas (só o administrador da plataforma configura o NAS).
 */
export default function RepositorySettings({ customer, customerName, value, onChange, canEditNas = false }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const set = (patch) => onChange({ ...value, ...patch });

  const { data: settings } = useQuery({
    queryKey: ['storage-settings'],
    queryFn: async () => (await base44.entities.StorageSettings.list())[0] || null,
  });
  const { data: providerState } = useQuery({
    queryKey: ['storage-provider-status'],
    queryFn: storageProvidersStatus,
  });
  const nasQuery = useQuery({
    queryKey: ['nas-connection', customer?.id],
    queryFn: () => nasConnection({ action: 'get', customer_id: customer.id }),
    enabled: Boolean(customer?.id) && value.provider === 'webdav',
  });
  const conn = nasQuery.data?.connection || null;

  const enabled = settings?.enabled_providers?.length ? settings.enabled_providers : PROVIDERS;
  const original = customer?.storage_provider || 'base44';
  const status = providerState?.status || {};
  const accounts = providerState?.accounts || {};

  // Localização: valor mostrado e validação local (o servidor volta a validar).
  // Num cliente ainda por criar, o fim do identificador (sufixo da pasta) só existe depois de gravar.
  const defaultRoot = customer ? defaultStorageRoot(customer) : `${ROOT}/${safeName(customerName || 'cliente')}-······`;
  const rootInput = value.storage_root == null ? (customer ? defaultRoot : '') : value.storage_root;
  let rootError = '';
  let normalizedRoot = '';
  try { normalizedRoot = normalizeStorageRoot(value.storage_root); } catch (e) { rootError = e.message; }
  const effectiveRoot = normalizedRoot || defaultRoot;

  const changed = locationChanged(customer, value);

  // Ligação ao NAS (formulário local; segue no payload e é gravada depois de o cliente existir).
  const [nasForm, setNasForm] = useState({ base_url: '', base_path: ROOT, username: '', password: '' });
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    if (!conn) return;
    setNasForm({ base_url: conn.base_url || '', base_path: conn.base_path ?? ROOT, username: conn.username || '', password: '' });
  }, [conn?.id, conn?.base_url, conn?.base_path, conn?.username]); // eslint-disable-line react-hooks/exhaustive-deps
  const setNas = (k, v) => {
    const next = { ...nasForm, [k]: v };
    setNasForm(next);
    set({ webdav: next });
  };

  const testNas = async () => {
    if (!customer?.id) return;
    setTesting(true);
    try {
      if (!/^https:\/\//i.test(nasForm.base_url)) throw new Error(t('nas_https_only'));
      await nasConnection({ action: 'save', customer_id: customer.id, ...nasForm, password: nasForm.password || undefined });
      const r = await nasConnection({ action: 'test', customer_id: customer.id });
      r.ok ? toast.success(t('nas_test_ok')) : toast.error(`${t('nas_test_fail')}: ${r.message}`);
      setNasForm((f) => ({ ...f, password: '' }));
      set({ webdav: null }); // já gravada
      qc.invalidateQueries({ queryKey: ['nas-connection', customer.id] });
    } catch (e) {
      toast.error(e?.message || t('nas_test_fail'));
    } finally {
      setTesting(false);
    }
  };

  const badgeFor = (id) => {
    if (id === 'base44') return <Badge variant="secondary">{t('repo_always_available')}</Badge>;
    if (id === 'webdav') return <Badge variant="outline">{t('repo_per_customer')}</Badge>;
    return status[id]
      ? <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{t('storage_providers_status_connected')}</Badge>
      : <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">{t('storage_providers_status_disconnected')}</Badge>;
  };

  // No NAS, a localização fica dentro da pasta base da ligação.
  const treeBase = value.provider === 'webdav' ? String(nasForm.base_path || '').replace(/^\/+|\/+$/g, '') : '';
  const treeRoot = [treeBase, effectiveRoot].filter(Boolean).join('/');

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <p className="text-sm font-semibold flex items-center gap-2"><HardDrive className="w-4 h-4" />{t('repo_section_title')}</p>
        <p className="text-xs text-muted-foreground mt-1">{t('repo_section_help')}</p>
      </div>

      <div role="radiogroup" aria-label={t('repo_section_title')} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PROVIDERS.map((id) => {
          const Icon = ICONS[id];
          const selected = value.provider === id;
          const disabled = !enabled.includes(id) && id !== original;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => set({ provider: id })}
              className={cn(
                'text-left rounded-lg border p-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium"><Icon className="w-4 h-4 text-primary" />{t(`repo_provider_${id}`)}</span>
                {badgeFor(id)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t(`repo_provider_${id}_desc`)}</p>
              {(id === 'google_drive' || id === 'one_drive') && status[id] && (
                <p className="text-xs mt-1">{t('repo_connected_account')}: <span className="font-medium">{accounts[id] || t('repo_account_unknown')}</span></p>
              )}
              {disabled && <p className="text-xs text-muted-foreground mt-1">{t('repo_provider_disabled')}</p>}
            </button>
          );
        })}
      </div>

      {(value.provider === 'google_drive' || value.provider === 'one_drive') && !status[value.provider] && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{t('repo_not_connected_warning')}</span>
        </div>
      )}

      {value.provider !== 'base44' && (
        <div className="space-y-1.5">
          <Label htmlFor="repo-root">{t('repo_location')}</Label>
          <div className="flex gap-2">
            <Input
              id="repo-root"
              value={rootInput}
              placeholder={defaultRoot}
              onChange={(e) => set({ storage_root: e.target.value })}
              aria-invalid={Boolean(rootError)}
            />
            {value.storage_root != null && (
              <Button type="button" variant="outline" size="icon" title={t('repo_location_reset')} aria-label={t('repo_location_reset')} onClick={() => set({ storage_root: null })}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
          </div>
          {rootError
            ? <p className="text-xs text-destructive">{t(rootError)}</p>
            : <p className="text-xs text-muted-foreground">{customer ? t('repo_location_help') : t('repo_location_help_new')}</p>}
        </div>
      )}

      {value.provider === 'webdav' && (
        <div className="rounded-md border p-3 space-y-3">
          <p className="text-sm font-medium flex items-center gap-2"><Server className="w-4 h-4 text-primary" />{t('nas_title')}</p>
          {canEditNas ? (
            <>
              <p className="text-xs text-muted-foreground">{t('nas_help')}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs" htmlFor="nas-url">{t('repo_nas_url')} *</Label>
                  <Input id="nas-url" value={nasForm.base_url} onChange={(e) => setNas('base_url', e.target.value)} placeholder="https://nas.cliente.pt/remote.php/dav/files/ankora/" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="nas-user">{t('repo_nas_user')}</Label>
                  <Input id="nas-user" value={nasForm.username} autoComplete="off" onChange={(e) => setNas('username', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="nas-pass">{t('repo_nas_password')}</Label>
                  <Input id="nas-pass" type="password" autoComplete="new-password" value={nasForm.password} onChange={(e) => setNas('password', e.target.value)} placeholder={conn?.has_password ? t('nas_password_keep') : ''} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs" htmlFor="nas-base">{t('repo_nas_base_path')}</Label>
                  <Input id="nas-base" value={nasForm.base_path} onChange={(e) => setNas('base_path', e.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" size="sm" variant="outline" onClick={testNas} disabled={!customer?.id || testing || !nasForm.base_url}>
                  {testing && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}{t('nas_test')}
                </Button>
                {!customer?.id && <span className="text-xs text-muted-foreground">{t('repo_nas_after_create')}</span>}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{t('repo_nas_admin_only')}</p>
          )}
          {nasQuery.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {conn?.last_test_at && (
            <p className={cn('text-xs flex items-center gap-1', conn.last_test_ok ? 'text-chart-2' : 'text-destructive')}>
              {conn.last_test_ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {t('nas_last_test')}: {conn.last_test_at.replace('T', ' ').slice(0, 16)} — {conn.last_test_message}
            </p>
          )}
          {customer?.id && !conn && !nasQuery.isLoading && !canEditNas && <p className="text-xs text-destructive">{t('repo_nas_missing')}</p>}
        </div>
      )}

      {changed && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{t('repo_change_warning')}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-medium">{t('repo_preview')}</p>
        <div className="rounded-md bg-muted/40 border p-3 font-mono text-[11px] leading-5 overflow-x-auto">
          <p className="flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 flex-shrink-0" />
            {value.provider === 'base44' ? t('repo_preview_private') : treeRoot}
          </p>
          <ul className="pl-5">
            {REPOSITORY_FOLDERS.map((f) => (
              <li key={f.key} className="flex items-center gap-1.5"><Folder className="w-3 h-3 flex-shrink-0 text-muted-foreground" />{f.label}</li>
            ))}
          </ul>
        </div>
        {value.provider === 'base44' && (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5"><Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{t('repo_preview_private_note')}</p>
        )}
      </div>
    </div>
  );
}

/** Erro local da localização (chave de tradução) ou ''. */
export function repositoryValueError(value) {
  if (value.provider === 'base44') return '';
  try { normalizeStorageRoot(value.storage_root); return ''; } catch (e) { return e.message; }
}
