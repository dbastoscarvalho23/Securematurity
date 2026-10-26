import { invokeFn } from '@/lib/invokeFn';

/** Limites e tipos aceites (iguais aos verificados na função `evidence`). */
export const EVIDENCE_MAX_BYTES = 8 * 1024 * 1024;
export const EVIDENCE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.json,.xml,.zip,.docx,.xlsx,.pptx,.doc,.xls,.odt,.ods,.eml';
export const EVIDENCE_TYPES = ['screenshot', 'tool_report', 'contract_licence', 'policy_procedure', 'log_record', 'test_audit_report', 'other'];
export const EVIDENCE_METHODS = ['examine', 'interview', 'test'];

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

const invoke = (payload) => invokeFn('evidence', payload);

/**
 * Carrega um ficheiro como evidência privada do cliente. O ficheiro segue para a função «evidence», que verifica o
 * conteúdo, calcula o SHA-256 e o guarda no repositório do cliente (nativo, Google Drive, OneDrive ou NAS).
 */
export async function uploadEvidence({ file, customerId, meta }) {
  if (file.size > EVIDENCE_MAX_BYTES) throw new Error('O ficheiro excede 8 MB');
  const content_base64 = await fileToBase64(file);
  const { valid_until, ...rest } = meta;
  return (await invoke({
    action: 'create', content_base64, ...rest, ...(valid_until ? { valid_until } : {}),
    customer_id: customerId, file_name: file.name, mime_type: file.type || 'application/octet-stream',
  })).evidence;
}

/** Abre ou descarrega o ficheiro de uma evidência (o acesso fica registado na auditoria). */
export async function openEvidence(evidence) {
  const data = await invoke({ action: 'download', evidence_id: evidence.id });
  if (data.url) {
    window.open(data.url, '_blank', 'noopener,noreferrer');
    return;
  }
  const bin = atob(data.content_base64 || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: data.mime_type || 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = data.file_name || evidence.file_name || 'evidencia';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Repositório efetivo do cliente: { provider, wanted, fallback }. */
export const evidenceProvider = (customerId) => invoke({ action: 'provider', customer_id: customerId });

export const reviewEvidence = (evidence, status, notes) => invoke({ action: 'review', evidence_id: evidence.id, status, notes });
export const deleteEvidence = (evidence) => invoke({ action: 'delete', evidence_id: evidence.id });

/** Estado efetivo: aceite e dentro da validade conta como «evidenciado». */
export function evidenceState(ev, today = new Date().toISOString().slice(0, 10)) {
  if (ev.superseded) return 'superseded';
  if (ev.status === 'rejected') return 'rejected';
  if (ev.valid_until && ev.valid_until < today) return 'expired';
  return ev.status === 'accepted' ? 'valid' : 'pending';
}

export const linkKey = (type, id) => `${type}:${id}`;
