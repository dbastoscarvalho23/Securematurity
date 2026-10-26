import { invokeFn } from '@/lib/invokeFn';

/** Prefixo dos ficheiros privados guardados pela função `files`. */
export const FILE_SCHEME = 'ankora-file://';
export const FILE_MAX_BYTES = 8 * 1024 * 1024;

export const isPrivateFile = (url) => typeof url === 'string' && url.startsWith(FILE_SCHEME);

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

/**
 * Carrega um ficheiro de forma privada no repositório do cliente (nativo, Google Drive, OneDrive ou NAS).
 * Nunca cria links públicos. Devolve { file_url: 'ankora-file://<id>', provider }.
 *
 * @param {File} file
 * @param {string} [customerId] cliente do ficheiro (só o administrador da plataforma pode indicar outro)
 * @param {string} [context] security_document | document_version | nomination | task | comment | assessment | training | report | framework | other
 * @param {string} [contextId] registo a que o ficheiro fica associado
 */
export async function uploadFile(file, customerId, context = 'other', contextId) {
  if (file.size > FILE_MAX_BYTES) throw new Error('O ficheiro excede 8 MB');
  const content_base64 = await fileToBase64(file);
  const data = await invokeFn('files', {
    action: 'upload',
    content_base64,
    file_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    customer_id: customerId || undefined,
    context,
    context_id: contextId,
  });
  return { file_url: data.file_url, provider: data.provider || 'base44' };
}

/**
 * Abre um ficheiro guardado. Os privados (ankora-file://) passam pela função `files`, que confirma o acesso e
 * devolve um URL temporário; os antigos (links públicos de antes desta alteração) abrem diretamente.
 */
export async function openFile(url, fileName) {
  if (!isPrivateFile(url)) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  // Abrir a janela já, para o bloqueio de pop-ups não a impedir depois do pedido.
  const win = window.open('', '_blank');
  try {
    const data = await invokeFn('files', { action: 'open', file_url: url });
    if (data.url) {
      if (win) { win.opener = null; win.location.href = data.url; } else window.open(data.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (win) win.close();
    const bin = atob(data.content_base64 || '');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blobUrl = URL.createObjectURL(new Blob([bytes], { type: data.mime_type || 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = data.file_name || fileName || 'ficheiro';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch (e) {
    if (win) win.close();
    throw e;
  }
}
