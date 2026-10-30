import { invokeFn } from '@/lib/invokeFn';

/**
 * Repositório documental do cliente (lado do browser).
 * REPOSITORY_FOLDERS, CONTEXT_FOLDER, evidenceFolderKey, safeName, folderFor e normalizeStorageRoot são cópias de
 * base44/shared/storage.ts, que é quem decide no servidor. O teste src/lib/__tests__/repository.test.js compara-as.
 */

export const ROOT = 'AnkoraOne';
export const PROVIDERS = ['base44', 'google_drive', 'one_drive', 'webdav'];

export const REPOSITORY_FOLDERS = [
  { key: 'inbox', label: '00 Por classificar' },
  { key: 'framing', label: '01 Enquadramento' },
  { key: 'security_docs', label: '02 Documentos de segurança' },
  { key: 'evidence', label: '03 Evidências' },
  { key: 'assessments', label: '04 Avaliações' },
  { key: 'risks', label: '05 Riscos' },
  { key: 'incidents', label: '06 Incidentes' },
  { key: 'suppliers', label: '07 Fornecedores' },
  { key: 'assets', label: '08 Ativos (restrito)' },
  { key: 'training', label: '09 Formação' },
  { key: 'reports', label: '10 Relatórios' },
  { key: 'ai_drafts', label: '11 Rascunhos de IA aprovados' },
  { key: 'other', label: '99 Outros' },
];

export const CONTEXT_FOLDER = {
  qualification: 'framing',
  security_document: 'security_docs',
  document_version: 'security_docs',
  nomination: 'security_docs',
  assessment: 'assessments',
  risk: 'risks',
  incident: 'incidents',
  supplier: 'suppliers',
  asset: 'assets',
  training: 'training',
  report: 'reports',
  ai_draft: 'ai_drafts',
  intake: 'inbox',
  task: 'other',
  comment: 'other',
  framework: 'other',
  other: 'other',
};

const LABEL_TO_KEY = Object.fromEntries(REPOSITORY_FOLDERS.map((f) => [f.label, f.key]));
const KEY_TO_LABEL = Object.fromEntries(REPOSITORY_FOLDERS.map((f) => [f.key, f.label]));

export const folderLabel = (key) => KEY_TO_LABEL[key] || KEY_TO_LABEL.other;
/** Chave de uma pasta a partir do nome guardado no registo (campo `folder`). */
export const folderKeyFromLabel = (label) => LABEL_TO_KEY[label] || null;

export function evidenceFolderKey(links, restricted, hint = '') {
  const types = new Set((links || []).map((l) => l?.type));
  if (restricted || types.has('asset') || types.has('component')) return 'assets';
  if (hint === 'framing') return 'framing';
  if (types.has('incident')) return 'incidents';
  if (types.has('supplier')) return 'suppliers';
  return 'evidence';
}

/** Pasta de um StoredFile: o campo `folder` (ficheiros novos) ou, nos antigos, a do contexto. */
export const storedFileFolderKey = (f) => folderKeyFromLabel(f?.folder) || CONTEXT_FOLDER[f?.context] || 'other';
/** Pasta de uma evidência: o campo `folder` (novas) ou, nas antigas, a calculada pelas ligações. */
export const evidenceFileFolderKey = (ev) => folderKeyFromLabel(ev?.folder) || evidenceFolderKey(ev?.links, ev?.restricted);

export function safeName(name) {
  const cleaned = String(name || 'ficheiro').normalize('NFKD').replace(/[^\w.\- ]+/g, '_').trim();
  return (cleaned || 'ficheiro').slice(0, 150);
}

export function safePathSegment(name) {
  return safeName(String(name || '').normalize('NFKD').replace(/[̀-ͯ]/g, ''));
}

export function folderFor(customer) {
  return safeName(`${customer?.name || 'cliente'}-${String(customer?.id || '').slice(-6)}`);
}

export const STORAGE_ROOT_MAX_SEGMENTS = 6;
export const STORAGE_ROOT_MAX_LENGTH = 200;

/** Igual ao servidor; as mensagens de erro são chaves de tradução (repo_err_*). */
export function normalizeStorageRoot(input) {
  const raw = String(input ?? '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!raw) return '';
  if (raw.length > STORAGE_ROOT_MAX_LENGTH) throw new Error('repo_err_length');
  const parts = raw.split('/').map((p) => p.trim());
  if (parts.some((p) => !p)) throw new Error('repo_err_empty_segment');
  if (parts.some((p) => /^\.+$/.test(p))) throw new Error('repo_err_dots');
  if (parts.length > STORAGE_ROOT_MAX_SEGMENTS) throw new Error('repo_err_segments');
  const clean = parts.map(safePathSegment);
  if (clean.some((p) => /^\.+$/.test(p))) throw new Error('repo_err_dots');
  const out = clean.join('/');
  if (out.length > STORAGE_ROOT_MAX_LENGTH) throw new Error('repo_err_length');
  return out;
}

/** Localização por omissão. Num cliente ainda por criar, o fim do identificador ainda não existe. */
export const defaultStorageRoot = (customer) => `${ROOT}/${folderFor(customer)}`;

/** Localização efetiva (a escolhida, se válida; senão a por omissão). */
export function effectiveStorageRoot(customer) {
  let root = '';
  try { root = normalizeStorageRoot(customer?.storage_root); } catch { root = ''; }
  return root || defaultStorageRoot(customer);
}

// ── Chamadas às funções ─────────────────────────────────────────────────────

export const storageProvidersStatus = () => invokeFn('getStorageProviders', {});
export const nasConnection = (payload) => invokeFn('storageConnection', payload);
export const updateCustomerStorage = (payload) => invokeFn('updateCustomerStorage', payload);

/**
 * Aplica a escolha do repositório a um cliente que já existe (depois de o criar, ou ao editar).
 * storage = { provider, storage_root, webdav?: { base_url, base_path, username, password } }
 * Com WebDAV: guarda a ligação (palavra-passe cifrada no servidor) e testa-a; se o teste falhar, o cliente fica no
 * repositório anterior e devolve-se o aviso. Devolve { ok, warning? }.
 * withNas = false para o administrador do cliente (a ligação ao NAS só é configurada pelo administrador da plataforma).
 */
export async function applyCustomerStorage(customerId, storage, { withNas = true } = {}) {
  if (!customerId || !storage) return { ok: true };
  const { provider, storage_root: root, webdav } = storage;
  if (provider === 'webdav' && withNas && webdav?.base_url) {
    await nasConnection({ action: 'save', customer_id: customerId, ...webdav, password: webdav.password || undefined });
    const test = await nasConnection({ action: 'test', customer_id: customerId });
    if (!test?.ok) return { ok: false, warning: test?.message || 'nas_test_fail' };
  }
  await updateCustomerStorage({ customer_id: customerId, provider, storage_root: root ?? '' });
  return { ok: true };
}
