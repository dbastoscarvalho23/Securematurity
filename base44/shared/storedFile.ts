import { resolveProvider, putFile, sha256Hex, CONTEXT_FOLDER } from './storage.ts';
import { customerRole, roleCanWrite, delegatedCustomerIds } from './http.ts';

/** Prefixo guardado nos campos `file_url` para ficheiros privados (abertos pela função `files`). */
export const FILE_SCHEME = 'ankora-file://';

export const FILE_CONTEXTS = Object.keys(CONTEXT_FOLDER);
// Dados pessoais, relatórios e ativos: só administradores do cliente.
const RESTRICTED_CONTEXTS = new Set(['training', 'report', 'asset', 'intake']);

/**
 * Registo a que cada contexto se refere (context_id). É deste registo que sai o cliente do ficheiro, para que um
 * ficheiro carregado pelo administrador da plataforma para o cliente X vá sempre para o repositório de X.
 * Comentários são anexados à tarefa (context_id = id da tarefa).
 */
const CONTEXT_ENTITY: Record<string, string[]> = {
  security_document: ['SecurityDocument'],
  document_version: ['DocumentVersion', 'SecurityDocument'],
  nomination: ['NominationDocument'],
  task: ['Task'],
  comment: ['Task'],
  assessment: ['Assessment'],
  training: ['TrainingUser'],
  risk: ['RiskItem'],
  incident: ['Incident'],
  supplier: ['Supplier'],
  asset: ['Asset'],
  ai_draft: ['AiDraft'],
};

export class TenantError extends Error {
  status: number;
  constructor(message: string, status = 403) { super(message); this.status = status; }
}

/**
 * Decide o cliente (tenant) de um ficheiro novo.
 *  - Com context_id de um registo conhecido: o cliente é o do registo. Um utilizador de outro cliente é recusado;
 *    o administrador da plataforma que indique outro cliente recebe erro (evita gravar no repositório errado).
 *  - Sem registo: administrador → customer_id indicado (vazio = armazenamento da plataforma); restantes → o seu.
 * Devolve o registo Customer (ou null para ficheiros da plataforma).
 */
export async function resolveFileTenant(base44: any, { admin, ownCustomerId, requestedCustomerId, context, contextId, user }: {
  admin: boolean; ownCustomerId: string; requestedCustomerId?: string; context: string; contextId?: string; user?: any;
}) {
  const requested = String(requestedCustomerId || '');
  // Pode escrever neste cliente? O próprio, ou um cliente delegado com nível contributor ou admin (com `user`).
  const writable = (id: string) => (user ? roleCanWrite(customerRole(user, id)) : id === ownCustomerId);
  if (!admin && requested && !writable(requested)) throw new TenantError('Forbidden', 403);
  let customerId = admin ? requested : (requested || ownCustomerId);
  if (!admin && !customerId && user) {
    const delegated = delegatedCustomerIds(user, 'contributor');
    if (delegated.length === 1) customerId = delegated[0];
  }

  const id = String(contextId || '');
  if (id && CONTEXT_ENTITY[context]) {
    let rec = null;
    for (const ent of CONTEXT_ENTITY[context]) {
      rec = await base44.asServiceRole.entities[ent].get(id).catch(() => null);
      if (rec) break;
    }
    if (rec?.customer_id) {
      if (!admin && !writable(rec.customer_id)) throw new TenantError('Forbidden', 403);
      if (admin && requested && requested !== rec.customer_id) {
        throw new TenantError('O cliente indicado não corresponde ao registo do ficheiro', 409);
      }
      customerId = rec.customer_id;
    }
  }

  if (!customerId && !admin) throw new TenantError('Sem cliente associado', 403);
  if (!customerId) return null;
  const customer = await base44.asServiceRole.entities.Customer.get(customerId).catch(() => null);
  if (!customer) throw new TenantError('Cliente inexistente', 404);
  return customer;
}

/**
 * Guarda um ficheiro de forma privada no repositório do cliente (ou no armazenamento privado da plataforma,
 * quando não há cliente) e cria o registo StoredFile. Devolve { record, url } com url = ankora-file://<id>.
 * `customer` tem de ser o cliente do registo (ver resolveFileTenant), nunca o de quem carrega.
 */
export async function storePrivateFile(base44: any, { customer, bytes, fileName, mimeType, context = 'other', contextId = '', uploadedBy = '' }: {
  customer: any | null; bytes: Uint8Array; fileName: string; mimeType: string; context?: string; contextId?: string; uploadedBy?: string;
}) {
  const ctx = FILE_CONTEXTS.includes(context) ? context : 'other';
  const provider = customer ? await resolveProvider(base44, customer) : 'base44';
  const target = customer || { id: 'plataforma', name: 'Plataforma' };
  const { ref, folder, location } = await putFile(base44, target, provider, { bytes, fileName, mimeType, folder: CONTEXT_FOLDER[ctx] });
  const record = await base44.asServiceRole.entities.StoredFile.create({
    customer_id: customer?.id || '',
    file_name: fileName,
    mime_type: mimeType,
    size_bytes: bytes.byteLength,
    sha256: await sha256Hex(bytes),
    storage_provider: provider,
    storage_ref: ref,
    folder,
    storage_location: location,
    context: ctx,
    context_id: String(contextId || '').slice(0, 120),
    restricted: RESTRICTED_CONTEXTS.has(ctx),
    uploaded_by: uploadedBy,
  });
  return { record, url: `${FILE_SCHEME}${record.id}` };
}
