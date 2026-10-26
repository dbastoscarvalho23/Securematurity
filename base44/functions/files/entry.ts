import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isPlatformAdmin, userCustomerId } from '../../shared/http.ts';
import { logAudit } from '../../shared/audit.ts';
import { checkFile } from '../../shared/fileCheck.ts';
import { getFile, fromBase64, toBase64, MAX_EXTERNAL_BYTES } from '../../shared/storage.ts';
import { storePrivateFile, resolveFileTenant, TenantError, FILE_SCHEME, FILE_CONTEXTS } from '../../shared/storedFile.ts';

/**
 * Ficheiros privados (documentos, nomeações, anexos de tarefas e avaliações, formação, relatórios).
 * Substitui o carregamento público (Core.UploadFile) e a partilha aberta no Google Drive/OneDrive.
 *
 * Ações:
 *  - upload { content_base64, file_name, mime_type, customer_id? (só admin), context, context_id? }
 *      → { file_url: 'ankora-file://<id>', file: {...} }. O ficheiro vai para o repositório do cliente, sem link público,
 *      na pasta do contexto (CONTEXT_FOLDER). Com context_id, o cliente é o do registo (resolveFileTenant).
 *  - open   { file_url | id } → URL assinado (5 min) ou conteúdo em base64; cada acesso fica na auditoria.
 *
 * Acesso: administrador da plataforma; utilizadores do mesmo cliente; ficheiros «restritos» (formação, relatórios)
 * só para o administrador do cliente; ficheiros sem cliente (relatórios internos) só para administradores.
 */

const str = (v: unknown, n = 500) => (v == null ? '' : String(v)).slice(0, n);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const admin = isPlatformAdmin(user);
    const own = userCustomerId(user);
    const body = await readJson(req);
    const action = String(body.action || '');

    if (action === 'upload') {
      const context = FILE_CONTEXTS.includes(body.context) ? body.context : 'other';
      // O cliente do ficheiro é o do registo (context_id), não o de quem carrega.
      let customer = null;
      try {
        customer = await resolveFileTenant(base44, {
          admin, ownCustomerId: own, requestedCustomerId: str(body.customer_id, 64), context, contextId: str(body.context_id, 120),
        });
      } catch (e) {
        if (e instanceof TenantError) return json({ error: e.message }, e.status);
        throw e;
      }
      const customerId = customer?.id || '';
      const fileName = str(body.file_name, 200);
      const bytes = fromBase64(String(body.content_base64 || ''));
      const mime = checkFile(fileName, str(body.mime_type, 120), bytes, MAX_EXTERNAL_BYTES);
      const { record, url } = await storePrivateFile(base44, {
        customer, bytes, fileName, mimeType: mime, context, contextId: str(body.context_id, 120), uploadedBy: user.email,
      });
      await logAudit(base44, 'file_uploaded', {
        user_email: user.email, customer_id: customerId || undefined, entity_type: 'StoredFile', entity_id: record.id,
        details: `Ficheiro «${fileName}» (${context}, ${record.storage_provider}, pasta «${record.folder || ''}») guardado de forma privada`,
      });
      const { storage_ref: _hidden, ...safe } = record;
      return json({ file_url: url, file: safe, provider: record.storage_provider });
    }

    if (action === 'open') {
      const raw = str(body.file_url || body.id, 200);
      const id = raw.startsWith(FILE_SCHEME) ? raw.slice(FILE_SCHEME.length) : raw;
      if (!/^[a-zA-Z0-9_-]{6,64}$/.test(id)) return json({ error: 'Referência inválida' }, 400);
      const f = await base44.asServiceRole.entities.StoredFile.get(id).catch(() => null);
      if (!f) return json({ error: 'Ficheiro inexistente' }, 404);
      if (!admin) {
        if (!f.customer_id || f.customer_id !== own) return json({ error: 'Forbidden' }, 403);
        if (f.restricted && user.role !== 'customer_admin') return json({ error: 'Forbidden' }, 403);
      }
      const file = await getFile(base44, f.customer_id, f.storage_provider, f.storage_ref, f.mime_type);
      await logAudit(base44, 'file_accessed', {
        user_email: user.email, customer_id: f.customer_id || undefined, entity_type: 'StoredFile', entity_id: f.id,
        details: `Acesso ao ficheiro «${f.file_name}»`,
      });
      if (file.signedUrl) return json({ url: file.signedUrl, expires_in: 300, file_name: f.file_name });
      return json({ content_base64: toBase64(file.bytes), mime_type: file.mimeType, file_name: f.file_name });
    }

    return json({ error: 'Ação desconhecida' }, 400);
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
});

