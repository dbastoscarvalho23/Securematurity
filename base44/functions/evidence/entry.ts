import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isPlatformAdmin, userCustomerId } from '../../shared/http.ts';
import { logAudit } from '../../shared/audit.ts';
import { requireModule, LicenseError } from '../../shared/license.ts';
import { resolveProvider, putFile, getFile, sha256Hex, fromBase64, toBase64, MAX_EXTERNAL_BYTES } from '../../shared/storage.ts';

/**
 * Evidências com ficheiro anexo (privado).
 *
 * Ações:
 *  - provider        { customer_id? } → repositório efetivo do cliente.
 *  - create          { content_base64, file_name, mime_type, ...meta } → o ficheiro chega aqui e é a função que o
 *                     guarda no repositório do cliente (nativo privado, Google Drive, OneDrive ou NAS WebDAV).
 *                     Nunca se aceitam referências de ficheiros vindas do browser.
 *  - download        { evidence_id }  → URL assinado (5 min) ou conteúdo em base64; cada acesso fica na auditoria.
 *  - review          { evidence_id, status: accepted|rejected, notes } → só administrador da plataforma (consultor).
 *  - delete          { evidence_id }  → só administrador da plataforma.
 *
 * meta: title, description, evidence_type, method, collected_at, valid_until, links[{type,id,ref,label}], supersedes_id, customer_id (só admin)
 * O cliente da evidência é sempre o do utilizador; só um administrador da plataforma pode indicar outro.
 */

const TYPES = ['screenshot', 'tool_report', 'contract_licence', 'policy_procedure', 'log_record', 'test_audit_report', 'other'];
const METHODS = ['examine', 'interview', 'test'];
const LINK_TYPES = ['measure', 'control', 'question', 'asset', 'component', 'incident', 'task', 'checklist', 'supplier', 'vulnerability'];
const ALLOWED_MIME = /^(application\/pdf|image\/(png|jpeg|gif|webp)|text\/(plain|csv)|application\/(zip|json|xml|vnd\.openxmlformats-officedocument\.[\w.]+|vnd\.ms-excel|msword|vnd\.oasis\.opendocument\.[\w.]+)|message\/rfc822)$/i;

// Entities a link may point to, checked to belong to the evidence's customer.
const RESTRICTED_LINKS = ['asset', 'component'];
// Entity map:
const LINK_ENTITY = { asset: 'Asset', component: 'Component', incident: 'Incident', task: 'Task', checklist: 'ComplianceChecklist', supplier: 'Supplier', vulnerability: 'Vulnerability' };

const isDate = (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(String(v));
const str = (v, n = 500) => (v == null ? '' : String(v)).slice(0, n);

async function cleanLinks(base44, customerId, links) {
  const out = [];
  for (const l of Array.isArray(links) ? links.slice(0, 50) : []) {
    if (!l || !LINK_TYPES.includes(l.type) || !l.id) continue;
    const ent = LINK_ENTITY[l.type];
    if (ent) {
      const rec = await base44.asServiceRole.entities[ent].get(String(l.id)).catch(() => null);
      if (!rec || rec.customer_id !== customerId) throw new Error(`Ligação inválida: ${l.type} não pertence a este cliente`);
    }
    out.push({ type: l.type, id: str(l.id, 120), ref: str(l.ref, 120), label: str(l.label, 200) });
  }
  return out;
}

async function buildMeta(base44, body, customerId) {
  if (!str(body.title, 200).trim()) throw new Error('Título obrigatório');
  if (!isDate(body.collected_at) || !isDate(body.valid_until)) throw new Error('Datas no formato AAAA-MM-DD');
  const links = await cleanLinks(base44, customerId, body.links);
  let version = 1;
  let supersedes_id = '';
  if (body.supersedes_id) {
    const prev = await base44.asServiceRole.entities.Evidence.get(String(body.supersedes_id)).catch(() => null);
    if (!prev || prev.customer_id !== customerId) throw new Error('Versão anterior inválida');
    if (prev.superseded) throw new Error('Essa evidência já tem uma versão mais recente');
    version = (prev.version || 1) + 1;
    supersedes_id = prev.id;
  }
  const meta = {
    customer_id: customerId,
    title: str(body.title, 200).trim(),
    description: str(body.description, 4000),
    evidence_type: TYPES.includes(body.evidence_type) ? body.evidence_type : 'other',
    method: METHODS.includes(body.method) ? body.method : 'examine',
    collected_at: body.collected_at || new Date().toISOString().slice(0, 10),
    status: 'submitted',
    links,
    link_keys: links.map((l) => `${l.type}:${l.id}`),
    // Evidências de ativos e ferramentas são informação reservada: só administradores do cliente as veem.
    restricted: links.some((l) => RESTRICTED_LINKS.includes(l.type)),
    version,
    superseded: false,
  };
  if (body.valid_until) meta.valid_until = String(body.valid_until);
  if (supersedes_id) meta.supersedes_id = supersedes_id;
  return meta;
}

const startsWith = (b, sig, off = 0) => sig.every((x, i) => b[off + i] === x);

/** Família real do ficheiro, pelos primeiros bytes (não pelo que o browser diz). */
function sniff(b) {
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46])) return 'pdf';
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47])) return 'png';
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(b, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06])) return 'zip';
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'ole';
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(0, Math.min(b.length, 65536)));
    if (/<\s*(html|script|iframe|svg|object|embed)\b/i.test(text)) return 'active';
    return 'text';
  } catch { return 'binary'; }
}

// Família esperada para cada tipo declarado.
function expectedFamily(mime) {
  const m = mime.toLowerCase();
  if (m === 'application/pdf') return ['pdf'];
  if (m === 'image/png') return ['png'];
  if (m === 'image/jpeg') return ['jpeg'];
  if (m === 'image/gif') return ['gif'];
  if (m === 'image/webp') return ['webp'];
  if (m === 'application/zip' || m.includes('openxmlformats') || m.includes('opendocument')) return ['zip'];
  if (m === 'application/vnd.ms-excel' || m === 'application/msword') return ['ole'];
  if (m.startsWith('text/') || m === 'application/json' || m === 'application/xml' || m === 'message/rfc822') return ['text'];
  return [];
}

function checkFile(name, mime, bytes, max) {
  if (!name) throw new Error('Nome do ficheiro em falta');
  if (!ALLOWED_MIME.test(String(mime || ''))) throw new Error('Tipo de ficheiro não permitido');
  if (!bytes.byteLength || bytes.byteLength > max) throw new Error(`Ficheiro vazio ou maior do que ${Math.round(max / 1048576)} MB`);
  if (!expectedFamily(mime).includes(sniff(bytes))) throw new Error('O conteúdo do ficheiro não corresponde ao tipo indicado');
}

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
      const customerId = admin ? (body.customer_id || userCustomerId(user)) : userCustomerId(user);
      if (!customerId) return json({ error: 'Sem cliente associado' }, 403);
      if (!admin && body.customer_id && body.customer_id !== customerId) return json({ error: 'Forbidden' }, 403);
      const customer = await base44.asServiceRole.entities.Customer.get(customerId).catch(() => null);
      if (!customer) return json({ error: 'Cliente inexistente' }, 404);
      const effective = await resolveProvider(base44, customer);
      const wanted = customer.storage_provider || 'base44';
      return json({ provider: effective, wanted, fallback: effective !== wanted });
    }

    if (action === 'create' || action === 'create_external') {
      const customerId = admin ? (body.customer_id || userCustomerId(user)) : userCustomerId(user);
      if (!customerId) return json({ error: 'Sem cliente associado' }, 403);
      if (!admin && body.customer_id && body.customer_id !== customerId) return json({ error: 'Forbidden' }, 403);
      const customer = await base44.asServiceRole.entities.Customer.get(customerId).catch(() => null);
      if (!customer) return json({ error: 'Cliente inexistente' }, 404);
      await requireModule(base44, user, customerId, 'documents_evidence');
      const provider = await resolveProvider(base44, customer);
      const meta = await buildMeta(base44, body, customerId);
      if (meta.restricted && !admin && user.role !== 'customer_admin') return json({ error: 'Só os administradores do cliente podem anexar evidências a ativos e ferramentas' }, 403);
      const mime = str(body.mime_type, 120) || 'application/octet-stream';
      const fileName = str(body.file_name, 200);
      const bytes = fromBase64(body.content_base64);
      checkFile(fileName, mime, bytes, MAX_EXTERNAL_BYTES);
      const ref = (await putFile(base44, customer, provider, { bytes, fileName, mimeType: mime })).ref;

      const sha256 = await sha256Hex(bytes);
      const ev = await base44.asServiceRole.entities.Evidence.create({
        ...meta,
        file_name: fileName,
        mime_type: mime,
        size_bytes: bytes.byteLength,
        sha256,
        storage_provider: provider,
        storage_ref: ref,
        uploaded_by: user.email,
      });
      if (meta.supersedes_id) await base44.asServiceRole.entities.Evidence.update(meta.supersedes_id, { superseded: true });
      await logAudit(base44, 'evidence_created', {
        user_email: user.email, customer_id: customerId, entity_type: 'Evidence', entity_id: ev.id,
        details: `Evidência «${meta.title}» (${provider}, SHA-256 ${sha256.slice(0, 12)}…) ligada a ${meta.link_keys.length} registo(s)`,
      });
      const { storage_ref: _hidden, ...safe } = ev;
      return json({ evidence: safe });
    }

    const ev = body.evidence_id ? await base44.asServiceRole.entities.Evidence.get(String(body.evidence_id)).catch(() => null) : null;
    if (!ev) return json({ error: 'Evidência inexistente' }, 404);
    const sameTenant = userCustomerId(user) && userCustomerId(user) === ev.customer_id;
    if (!admin && !sameTenant) return json({ error: 'Forbidden' }, 403);
    if (!admin && ev.restricted && user.role !== 'customer_admin') return json({ error: 'Forbidden' }, 403);

    if (action === 'download') {
      const file = await getFile(base44, ev.customer_id, ev.storage_provider, ev.storage_ref, ev.mime_type);
      await logAudit(base44, 'evidence_accessed', {
        user_email: user.email, customer_id: ev.customer_id, entity_type: 'Evidence', entity_id: ev.id,
        details: `Acesso ao ficheiro «${ev.file_name}»`,
      });
      if (file.signedUrl) return json({ url: file.signedUrl, expires_in: 300, sha256: ev.sha256 });
      return json({ content_base64: toBase64(file.bytes), mime_type: file.mimeType, file_name: ev.file_name, sha256: ev.sha256 });
    }

    if (!admin) return json({ error: 'Forbidden' }, 403);

    if (action === 'review') {
      if (!['accepted', 'rejected'].includes(body.status)) return json({ error: 'Estado inválido' }, 400);
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



