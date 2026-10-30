import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isPlatformAdmin, userCustomerId, resolveCustomer, customerRole, roleCanManage, delegatedCustomerIds } from '../../shared/http.ts';
import { logAudit } from '../../shared/audit.ts';
import { requireModule, LicenseError } from '../../shared/license.ts';
import { checkFile } from '../../shared/fileCheck.ts';
import { buildMeta, customerFromLinks, str } from '../../shared/evidenceMeta.ts';
import {
  resolveProvider, putFile, getFile, sha256Hex, fromBase64, toBase64, MAX_EXTERNAL_BYTES, evidenceFolderKey,
  normalizeStorageRoot, defaultStorageRoot,
} from '../../shared/storage.ts';

/**
 * Evidências com ficheiro anexo (privado).
 *
 * Ações:
 *  - provider        { customer_id? } → repositório efetivo do cliente e localização dos ficheiros novos.
 *  - create          { content_base64, file_name, mime_type, folder?, ...meta } → o ficheiro chega aqui e é a função
 *                     que o guarda no repositório do cliente (nativo privado, Google Drive, OneDrive ou NAS WebDAV),
 *                     na pasta dada por evidenceFolderKey (folder: 'framing' só para o relatório de enquadramento).
 *                     Nunca se aceitam referências de ficheiros vindas do browser.
 *  - download        { evidence_id }  → URL assinado (5 min) ou conteúdo em base64; cada acesso fica na auditoria.
 *  - review          { evidence_id, status: accepted|rejected, notes } → só administrador da plataforma (consultor).
 *  - delete          { evidence_id }  → só administrador da plataforma.
 *
 * meta: title, description, evidence_type, method, collected_at, valid_until, links[{type,id,ref,label}], supersedes_id, customer_id (só admin)
 * O cliente da evidência é sempre o do utilizador; só um administrador da plataforma pode indicar outro (ou, sem
 * indicar, é o dos registos ligados). O cliente do próprio administrador nunca é usado por omissão.
 */

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const admin = isPlatformAdmin(user);
    const body = await readJson(req);
    const action = body.action;

    if (action === 'provider') {
      // Repositório efetivo do cliente (respeita os fornecedores ativos na plataforma).
      const scope = admin ? null : resolveCustomer(user, body.customer_id);
      if (!admin && body.customer_id && !scope) return json({ error: 'Forbidden' }, 403);
      const customerId = admin ? (body.customer_id || userCustomerId(user)) : scope?.customerId;
      if (!customerId) return json({ error: 'Sem cliente associado' }, 403);
      const customer = await base44.asServiceRole.entities.Customer.get(customerId).catch(() => null);
      if (!customer) return json({ error: 'Cliente inexistente' }, 404);
      const effective = await resolveProvider(base44, customer);
      const wanted = customer.storage_provider || 'base44';
      let root = '';
      try { root = normalizeStorageRoot(customer.storage_root); } catch { root = ''; }
      return json({
        provider: effective, wanted, fallback: effective !== wanted,
        // Localização dos ficheiros novos (no armazenamento da plataforma não há pastas reais).
        root: root || defaultStorageRoot(customer), custom_root: Boolean(root),
        configured_at: customer.storage_configured_at || null,
      });
    }

    if (action === 'create' || action === 'create_external') {
      // Cliente da evidência: o do utilizador; o administrador da plataforma indica o cliente ou este sai dos
      // registos ligados. Nunca se usa o cliente do próprio administrador por omissão (o ficheiro iria para o
      // repositório errado).
      // Consultores: só num cliente delegado com escrita (contributor ou admin).
      const scope = admin ? null : resolveCustomer(user, body.customer_id, { write: true });
      if (!admin && body.customer_id && !scope) return json({ error: 'Forbidden' }, 403);
      const customerId = admin ? (str(body.customer_id, 64) || await customerFromLinks(base44, body.links)) : scope?.customerId;
      if (!customerId) return json({ error: admin ? 'Indique o cliente da evidência' : 'Sem cliente associado' }, admin ? 400 : 403);
      const customer = await base44.asServiceRole.entities.Customer.get(customerId).catch(() => null);
      if (!customer) return json({ error: 'Cliente inexistente' }, 404);
      await requireModule(base44, user, customerId, 'documents_evidence');
      const provider = await resolveProvider(base44, customer);
      const meta = await buildMeta(base44, body, customerId);
      const folderKey = evidenceFolderKey(meta.links, meta.restricted, body.folder === 'framing' ? 'framing' : '');
      if (meta.restricted && !admin && user.role !== 'customer_admin') return json({ error: 'Só os administradores do cliente podem anexar evidências a ativos e ferramentas' }, 403);
      const fileName = str(body.file_name, 200);
      const bytes = fromBase64(body.content_base64);
      const mime = checkFile(fileName, str(body.mime_type, 120), bytes, MAX_EXTERNAL_BYTES);
      // Nova versão: a anterior é marcada como substituída antes de gravar, para que dois envios em
      // simultâneo não criem duas versões «atuais». Se a gravação falhar, a marca é desfeita.
      if (meta.supersedes_id) {
        const prevNow = await base44.asServiceRole.entities.Evidence.get(meta.supersedes_id).catch(() => null);
        if (!prevNow || prevNow.superseded) return json({ error: 'Essa evidência já tem uma versão mais recente' }, 409);
        await base44.asServiceRole.entities.Evidence.update(meta.supersedes_id, { superseded: true });
      }
      let stored;
      try {
        stored = await putFile(base44, customer, provider, { bytes, fileName, mimeType: mime, folder: folderKey });
      } catch (e) {
        if (meta.supersedes_id) await base44.asServiceRole.entities.Evidence.update(meta.supersedes_id, { superseded: false }).catch(() => null);
        throw e;
      }

      const sha256 = await sha256Hex(bytes);
      const ev = await base44.asServiceRole.entities.Evidence.create({
        ...meta,
        file_name: fileName,
        mime_type: mime,
        size_bytes: bytes.byteLength,
        sha256,
        storage_provider: provider,
        storage_ref: stored.ref,
        folder: stored.folder,
        storage_location: stored.location,
        uploaded_by: user.email,
      });
      await logAudit(base44, 'evidence_created', {
        user_email: user.email, customer_id: customerId, entity_type: 'Evidence', entity_id: ev.id,
        details: `Evidência «${meta.title}» (${provider}, pasta «${stored.folder}», SHA-256 ${sha256.slice(0, 12)}…) ligada a ${meta.link_keys.length} registo(s)`,
      });
      const { storage_ref: _hidden, ...safe } = ev;
      return json({ evidence: safe });
    }

    const ev = body.evidence_id ? await base44.asServiceRole.entities.Evidence.get(String(body.evidence_id)).catch(() => null) : null;
    if (!ev) return json({ error: 'Evidência inexistente' }, 404);
    // Cliente próprio ou delegado; evidências restritas só para quem administra esse cliente.
    const role = customerRole(user, ev.customer_id);
    if (!admin && !role) return json({ error: 'Forbidden' }, 403);
    if (!admin && ev.restricted && !roleCanManage(role)) return json({ error: 'Forbidden' }, 403);

    if (action === 'download') {
      const file = await getFile(base44, ev.customer_id, ev.storage_provider, ev.storage_ref, ev.mime_type);
      await logAudit(base44, 'evidence_accessed', {
        user_email: user.email, customer_id: ev.customer_id, entity_type: 'Evidence', entity_id: ev.id,
        details: `Acesso ao ficheiro «${ev.file_name}»`,
      });
      if (file.signedUrl) return json({ url: file.signedUrl, expires_in: 300, sha256: ev.sha256 });
      return json({ content_base64: toBase64(file.bytes), mime_type: file.mimeType, file_name: ev.file_name, sha256: ev.sha256 });
    }

    // Revisão: a plataforma ou um consultor com delegação de nível admin neste cliente (o papel de revisor externo).
    const delegatedReviewer = delegatedCustomerIds(user, 'admin').includes(String(ev.customer_id));
    if (action === 'review' && !admin && !delegatedReviewer) return json({ error: 'Forbidden' }, 403);
    if (action !== 'review' && !admin) return json({ error: 'Forbidden' }, 403);

    if (action === 'review') {
      if (!['accepted', 'rejected'].includes(body.status)) return json({ error: 'Estado inválido' }, 400);
      // Separação de funções: quem carregou a evidência não a revê.
      if (String(ev.uploaded_by || '').toLowerCase() === String(user.email || '').toLowerCase()) return json({ error: 'Quem carregou a evidência não a pode rever.' }, 403);
      const updated = await base44.asServiceRole.entities.Evidence.update(ev.id, {
        status: body.status, review_notes: str(body.notes, 2000), reviewer_email: user.email, reviewed_at: new Date().toISOString(),
      });
      await logAudit(base44, 'evidence_reviewed', {
        user_email: user.email, customer_id: ev.customer_id, entity_type: 'Evidence', entity_id: ev.id,
        details: `Evidência «${ev.title}»: ${body.status}`,
      });
      const { storage_ref: _h, ...safe } = updated;
      return json({ evidence: safe });
    }

    if (action === 'delete') {
      await base44.asServiceRole.entities.Evidence.delete(ev.id);
      // Ao apagar a versão mais recente, a anterior volta a contar.
      if (ev.supersedes_id && !ev.superseded) await base44.asServiceRole.entities.Evidence.update(ev.supersedes_id, { superseded: false }).catch(() => null);
      await logAudit(base44, 'evidence_deleted', {
        user_email: user.email, customer_id: ev.customer_id, entity_type: 'Evidence', entity_id: ev.id,
        details: `Evidência «${ev.title}» apagada (o ficheiro permanece no repositório ${ev.storage_provider})`,
      });
      return json({ success: true });
    }

    return json({ error: 'Ação desconhecida' }, 400);
  } catch (error) {
    return json({ error: error?.message || 'Erro' }, error instanceof LicenseError ? error.status : 400);
  }
}





