import { resolveProvider, putFile, sha256Hex } from './storage.ts';

/** Prefixo guardado nos campos `file_url` para ficheiros privados (abertos pela função `files`). */
export const FILE_SCHEME = 'ankora-file://';

const SUBFOLDER: Record<string, string> = {
  security_document: 'documentos', document_version: 'documentos', nomination: 'nomeacoes', task: 'tarefas',
  comment: 'tarefas', assessment: 'avaliacoes', training: 'formacao', report: 'relatorios', framework: 'referenciais', other: 'outros',
};
export const FILE_CONTEXTS = Object.keys(SUBFOLDER);
// Dados pessoais e relatórios: só administradores do cliente.
const RESTRICTED_CONTEXTS = new Set(['training', 'report']);

/**
 * Guarda um ficheiro de forma privada no repositório do cliente (ou no armazenamento privado da plataforma,
 * quando não há cliente) e cria o registo StoredFile. Devolve { record, url } com url = ankora-file://<id>.
 */
export async function storePrivateFile(base44: any, { customer, bytes, fileName, mimeType, context = 'other', contextId = '', uploadedBy = '' }: {
  customer: any | null; bytes: Uint8Array; fileName: string; mimeType: string; context?: string; contextId?: string; uploadedBy?: string;
}) {
  const ctx = FILE_CONTEXTS.includes(context) ? context : 'other';
  const provider = customer ? await resolveProvider(base44, customer) : 'base44';
  const target = customer || { id: 'plataforma', name: 'Plataforma' };
  const { ref } = await putFile(base44, target, provider, { bytes, fileName, mimeType, subfolder: SUBFOLDER[ctx] });
  const record = await base44.asServiceRole.entities.StoredFile.create({
    customer_id: customer?.id || '',
    file_name: fileName,
    mime_type: mimeType,
    size_bytes: bytes.byteLength,
    sha256: await sha256Hex(bytes),
    storage_provider: provider,
    storage_ref: ref,
    context: ctx,
    context_id: String(contextId || '').slice(0, 120),
    restricted: RESTRICTED_CONTEXTS.has(ctx),
    uploaded_by: uploadedBy,
  });
  return { record, url: `${FILE_SCHEME}${record.id}` };
}
