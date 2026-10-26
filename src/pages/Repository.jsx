import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Search, Folder, FolderOpen, FileText, Lock, HardDrive, ExternalLink, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { openFile, isPrivateFile, FILE_SCHEME } from '@/lib/cloudStorage';
import { openEvidence, evidenceProvider } from '@/lib/evidence';
import {
  REPOSITORY_FOLDERS, storedFileFolderKey, evidenceFileFolderKey, storageProvidersStatus,
} from '@/lib/repository';

const PERIODS = ['all', '30', '90', '365'];

const fmtSize = (n) => {
  if (!n && n !== 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};
const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—');

/** Leitura tolerante: sem permissão (RLS) ou sem entidade, a lista fica vazia em vez de partir a página. */
const safeList = async (fn) => { try { return (await fn()) || []; } catch { return []; } };

/**
 * Repositório documental: todos os ficheiros de um cliente, agrupados pelas 12 pastas da estrutura comum.
 * Abre sempre pelas funções seguras (files / evidence), com URL temporário e registo na auditoria.
 * Os itens restritos só chegam a quem os pode ler (RLS das entidades: admin e administrador do cliente).
 */
export default function Repository() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const isStaff = isAdmin || user?.role === 'customer_admin';

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('name'),
    enabled: isAdmin,
  });
  const [selected, setSelected] = useState('');
  useEffect(() => {
    if (!isAdmin || selected || !customers.length) return;
    setSelected(customers.find((c) => c.id === user?.customer_id)?.id || customers[0].id);
  }, [isAdmin, customers, selected, user?.customer_id]);
  const customerId = isAdmin ? selected : user?.customer_id;

  const enabled = Boolean(customerId);
  const q = (key, fn, extra = {}) => ({ queryKey: [key, customerId], queryFn: fn, enabled, ...extra });

  const { data: repo } = useQuery(q('repository-provider', () => evidenceProvider(customerId)));
  const { data: providerState } = useQuery({ queryKey: ['storage-provider-status'], queryFn: storageProvidersStatus, enabled: isStaff });
  const { data: storedFiles = [], isLoading: l1 } = useQuery(q('repo-stored-files', () => safeList(() => base44.entities.StoredFile.filter({ customer_id: customerId }, '-created_date', 2000))));
  const { data: evidence = [], isLoading: l2 } = useQuery(q('evidence', () => safeList(() => base44.entities.Evidence.filter({ customer_id: customerId }, '-created_date', 2000))));
  const { data: docs = [] } = useQuery(q('repo-docs', () => safeList(() => base44.entities.SecurityDocument.filter({ customer_id: customerId }, '-created_date', 1000))));
  const { data: nominations = [] } = useQuery(q('repo-nominations', () => safeList(() => base44.entities.NominationDocument.filter({ customer_id: customerId }, '-created_date', 500))));
  const { data: assessments = [] } = useQuery(q('repo-assessments', () => safeList(() => base44.entities.Assessment.filter({ customer_id: customerId }, '-created_date', 500))));
  const { data: tasks = [] } = useQuery(q('repo-tasks', () => safeList(() => base44.entities.Task.filter({ customer_id: customerId }, '-created_date', 2000))));
  const { data: drafts = [] } = useQuery({ ...q('repo-ai-drafts', () => safeList(() => base44.entities.AiDraft.filter({ customer_id: customerId, status: 'approved' }, '-approved_at', 500))), enabled: enabled && isStaff });

  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('all');
  const [type, setType] = useState('all');
  const [period, setPeriod] = useState('all');
  const [showSuperseded, setShowSuperseded] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [draftOpen, setDraftOpen] = useState(null);
  const [busy, setBusy] = useState('');

  // Nome legível do registo a que cada ficheiro pertence.
  const contextNames = useMemo(() => {
    const m = {};
    docs.forEach((d) => { m[`security_document:${d.id}`] = d.title; m[`document_version:${d.id}`] = d.title; });
    nominations.forEach((n) => { m[`nomination:${n.id}`] = n.title || n.nominated_person; });
    assessments.forEach((a) => { m[`assessment:${a.id}`] = a.name || a.title; });
    tasks.forEach((x) => { m[`task:${x.id}`] = x.title; m[`comment:${x.id}`] = x.title; });
    return m;
  }, [docs, nominations, assessments, tasks]);

  const items = useMemo(() => {
    const out = [];
    const privateIds = new Set();
    storedFiles.forEach((f) => {
      privateIds.add(f.id);
      out.push({
        id: `sf:${f.id}`, kind: 'stored', name: f.file_name, folderKey: storedFileFolderKey(f),
        type: `ctx_${f.context || 'other'}`, context: contextNames[`${f.context}:${f.context_id}`] || '',
        uploadedBy: f.uploaded_by, date: f.created_date, size: f.size_bytes, provider: f.storage_provider,
        location: f.storage_location || '', restricted: f.restricted, superseded: false,
        open: () => openFile(`${FILE_SCHEME}${f.id}`, f.file_name),
      });
    });
    evidence.forEach((ev) => {
      out.push({
        id: `ev:${ev.id}`, kind: 'evidence', name: ev.file_name || ev.title, folderKey: evidenceFileFolderKey(ev),
        type: 'evidence', context: `${ev.title}${ev.version > 1 ? ` · v${ev.version}` : ''}`,
        uploadedBy: ev.uploaded_by, date: ev.created_date, size: ev.size_bytes, provider: ev.storage_provider,
        location: ev.storage_location || '', restricted: ev.restricted, superseded: Boolean(ev.superseded),
        open: () => openEvidence(ev),
      });
    });
    // Anexos antigos de documentos e nomeações (links de antes dos ficheiros privados).
    const legacy = (rec, folderKey, ctxType) => {
      if (!rec.file_url || isPrivateFile(rec.file_url)) return;
      out.push({
        id: `lg:${rec.id}`, kind: 'legacy', name: rec.file_name || rec.title, folderKey, type: ctxType,
        context: rec.title || '', uploadedBy: rec.owner_email || '', date: rec.created_date, size: null,
        provider: 'legacy', location: '', restricted: false, superseded: false,
        open: () => openFile(rec.file_url, rec.file_name),
      });
    };
    docs.forEach((d) => legacy(d, 'security_docs', 'ctx_security_document'));
    nominations.forEach((n) => legacy(n, 'security_docs', 'ctx_nomination'));
    drafts.forEach((d) => {
      out.push({
        id: `ai:${d.id}`, kind: 'ai_draft', name: d.title, folderKey: 'ai_drafts', type: 'ctx_ai_draft',
        context: d.target_ref || '', uploadedBy: d.approved_by || d.created_by_email, date: d.approved_at || d.created_date,
        size: null, provider: 'record', location: '', restricted: false, superseded: false, open: () => setDraftOpen(d),
      });
    });
    return out;
  }, [storedFiles, evidence, docs, nominations, drafts, contextNames]);

  const types = useMemo(() => [...new Set(items.map((i) => i.type))].sort(), [items]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const since = period === 'all' ? '' : new Date(Date.now() - Number(period) * 86400000).toISOString();
    return items.filter((i) => {
      if (i.superseded && !showSuperseded) return false;
      if (folder !== 'all' && i.folderKey !== folder) return false;
      if (type !== 'all' && i.type !== type) return false;
      if (since && (!i.date || i.date < since)) return false;
      if (s && ![i.name, i.context, i.uploadedBy, i.location].some((v) => String(v || '').toLowerCase().includes(s))) return false;
      return true;
    });
  }, [items, search, folder, type, period, showSuperseded]);

  const grouped = useMemo(() => REPOSITORY_FOLDERS.map((f) => ({
    ...f, items: filtered.filter((i) => i.folderKey === f.key).sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
  })), [filtered]);

  // Ficheiros por repositório: mostra os que ficaram em repositórios anteriores depois de uma mudança.
  const perProvider = useMemo(() => {
    const m = {};
    items.filter((i) => i.kind === 'stored' || i.kind === 'evidence').forEach((i) => { m[i.provider || 'base44'] = (m[i.provider || 'base44'] || 0) + 1; });
    return m;
  }, [items]);

  const open = async (item) => {
    setBusy(item.id);
    try { await item.open(); } catch (e) { toast.error(e?.message || t('repo_open_error')); } finally { setBusy(''); }
  };

  const providerName = (p) => (p === 'legacy' ? t('repo_provider_legacy') : p === 'record' ? t('repo_provider_record') : t(`repo_provider_${p || 'base44'}`));
  const account = repo && (repo.provider === 'google_drive' || repo.provider === 'one_drive') ? providerState?.accounts?.[repo.provider] : '';
  const loading = enabled && (l1 || l2);

  return (
    <div className="space-y-6">
      <PageHeader
        description={t('repo_page_desc')}
        actions={isAdmin && (
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-64" aria-label={t('repo_select_customer')}><SelectValue placeholder={t('repo_select_customer')} /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      />

      {!customerId ? (
        <EmptyState icon={FolderOpen} title={t('repo_no_customer')} description={t('repo_no_customer_desc')} />
      ) : (
        <>
          <Card>
            <CardContent className="p-4 grid gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('repo_in_use')}</p>
                <p className="text-sm font-medium flex items-center gap-1.5"><HardDrive className="w-4 h-4 text-primary" />{repo ? providerName(repo.provider) : '…'}</p>
                {repo?.fallback && <p className="text-xs text-amber-700 dark:text-amber-400">{t('repo_fallback', { wanted: providerName(repo.wanted) })}</p>}
              </div>
              <div className="space-y-1 md:col-span-2 min-w-0">
                <p className="text-xs text-muted-foreground">{t('repo_location')}</p>
                <p className="text-sm font-mono break-all">{repo ? (repo.provider === 'base44' ? t('repo_preview_private') : repo.root) : '…'}</p>
                {account && <p className="text-xs text-muted-foreground">{t('repo_connected_account')}: {account}</p>}
                {repo?.configured_at && <p className="text-xs text-muted-foreground">{t('repo_configured_at')}: {fmtDate(repo.configured_at)}</p>}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('repo_files_per_provider')}</p>
                {Object.keys(perProvider).length === 0
                  ? <p className="text-sm">—</p>
                  : Object.entries(perProvider).map(([p, n]) => (
                    <p key={p} className="text-sm flex justify-between gap-2"><span>{providerName(p)}</span><span className="font-medium">{n}</span></p>
                  ))}
                {Object.keys(perProvider).some((p) => repo && p !== repo.provider) && (
                  <p className="text-xs text-muted-foreground">{t('repo_previous_note')}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex flex-wrap items-end gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9" placeholder={t('repo_search')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('repo_search')} />
              </div>
              <Select value={folder} onValueChange={setFolder}>
                <SelectTrigger className="w-56" aria-label={t('repo_filter_folder')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('repo_all_folders')}</SelectItem>
                  {REPOSITORY_FOLDERS.map((f) => <SelectItem key={f.key} value={f.key}>{t(`repo_folder_${f.key}`)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-52" aria-label={t('repo_filter_type')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('repo_all_types')}</SelectItem>
                  {types.map((x) => <SelectItem key={x} value={x}>{t(`repo_type_${x}`)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-44" aria-label={t('repo_filter_period')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => <SelectItem key={p} value={p}>{t(`repo_period_${p}`)}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch id="repo-superseded" checked={showSuperseded} onCheckedChange={setShowSuperseded} />
                <Label htmlFor="repo-superseded" className="text-sm">{t('repo_show_superseded')}</Label>
              </div>
            </CardContent>
          </Card>

          {loading ? <LoadingState /> : filtered.length === 0 ? (
            <EmptyState icon={FolderOpen} title={t('repo_empty')} description={t('repo_empty_desc')} />
          ) : (
            <div className="space-y-3">
              {grouped.filter((g) => g.items.length > 0 || folder === g.key).map((g) => {
                const isCollapsed = collapsed[g.key];
                return (
                  <Card key={g.key}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/40"
                      onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))}
                      aria-expanded={!isCollapsed}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <Folder className="w-4 h-4 text-primary" />{t(`repo_folder_${g.key}`)}
                        {g.key === 'assets' && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                      </span>
                      <Badge variant="secondary">{g.items.length}</Badge>
                    </button>
                    {!isCollapsed && g.items.length > 0 && (
                      <div className="overflow-x-auto border-t">
                        <table className="w-full text-sm">
                          <thead className="text-xs text-muted-foreground">
                            <tr className="text-left">
                              <th className="px-4 py-2 font-medium">{t('repo_col_file')}</th>
                              <th className="px-4 py-2 font-medium">{t('repo_col_context')}</th>
                              <th className="px-4 py-2 font-medium">{t('repo_col_uploaded_by')}</th>
                              <th className="px-4 py-2 font-medium">{t('repo_col_date')}</th>
                              <th className="px-4 py-2 font-medium text-right">{t('repo_col_size')}</th>
                              <th className="px-4 py-2 font-medium">{t('repo_col_provider')}</th>
                              <th className="px-4 py-2" />
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {g.items.map((i) => (
                              <tr key={i.id} className={i.superseded ? 'text-muted-foreground' : ''}>
                                <td className="px-4 py-2 min-w-[200px]">
                                  <span className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                                    <span className="truncate max-w-[280px]" title={i.name}>{i.name}</span>
                                    {i.restricted && <Badge variant="outline" className="text-[10px]">{t('repo_restricted')}</Badge>}
                                    {i.superseded && <Badge variant="outline" className="text-[10px]">{t('ev_state_superseded')}</Badge>}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{t(`repo_type_${i.type}`)}</span>
                                </td>
                                <td className="px-4 py-2 text-xs max-w-[220px] truncate" title={i.context}>{i.context || '—'}</td>
                                <td className="px-4 py-2 text-xs">{i.uploadedBy || '—'}</td>
                                <td className="px-4 py-2 text-xs whitespace-nowrap">{fmtDate(i.date)}</td>
                                <td className="px-4 py-2 text-xs text-right whitespace-nowrap">{fmtSize(i.size)}</td>
                                <td className="px-4 py-2 text-xs">
                                  <span className="block">{providerName(i.provider)}</span>
                                  {i.location && <span className="block font-mono text-[10px] text-muted-foreground break-all">{i.location}</span>}
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <Button size="sm" variant="ghost" onClick={() => open(i)} disabled={busy === i.id} aria-label={`${t('repo_open')} ${i.name}`}>
                                    {busy === i.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <Dialog open={Boolean(draftOpen)} onOpenChange={(o) => !o && setDraftOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draftOpen?.title}</DialogTitle>
            <DialogDescription>{t('repo_draft_approved_by', { who: draftOpen?.approved_by || '—', date: fmtDate(draftOpen?.approved_at) })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {(draftOpen?.sections || []).map((s, idx) => (
              <section key={idx}>
                <h3 className="font-semibold">{s.heading}</h3>
                <p className="whitespace-pre-wrap text-muted-foreground">{s.body}</p>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
