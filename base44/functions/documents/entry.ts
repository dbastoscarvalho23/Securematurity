import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isPlatformAdmin, userCustomerId } from '../../shared/http.ts';
import { logAudit } from '../../shared/audit.ts';
import { FILE_SCHEME } from '../../shared/storedFile.ts';

/**
 * Documentos de segurança: todas as escritas passam por aqui (o RLS da entidade só deixa o administrador
 * da plataforma escrever diretamente). Assim a aprovação, as versões e as permissões não dependem do browser.
 *
 * Ações:
 *  - save    { document: {id?, title, description, level, version, review_date, tags, framework_codes, file_url,
 *              file_name, customer_id (só admin, só na criação), status?}, change_note? }
 *  - approve { document_id, signature, comments? }      → administrador da plataforma ou do cliente; exige assinatura
 *  - revert  { document_id, version_id }                 → administrador da plataforma ou do cliente
 *  - delete  { document_id }                             → administrador da plataforma ou do cliente
 *
 * Regras:
 *  - «Aprovado» só se obtém com `approve` (assinatura, aprovador e data gravados pelo servidor).
 *  - Um utilizador comum só cria e edita os seus documentos; cada gravação dele envia o documento para revisão.
 *  - Alterar o conteúdo ou o ficheiro de um documento aprovado devolve-o a «Em revisão» e limpa a aprovação.
 *  - Cada alteração, aprovação ou reversão guarda antes uma versão (DocumentVersion) do estado anterior.
 */

const LEVELS = ['policy', 'standard', 'procedure', 'playbook'];
const CONTENT_FIELDS = ['title', 'description', 'level', 'version', 'file_url', 'file_name'];
const str = (v: unknown, n = 500) => (v == null ? '' : String(v)).slice(0, n);
const strList = (v: unknown, n = 30) => (Array.isArray(v) ? v.map((x) => str(x, 80).trim()).filter(Boolean).slice(0, n) : []);
const isDate = (v: unknown) => !v || /^\d{4}-\d{2}-\d{2}$/.test(String(v));

function snapshotOf(doc: any, user: any, note: string) {
  return {
    document_id: doc.id,
    ...(doc.customer_id ? { customer_id: doc.customer_id } : {}),
    version_label: doc.version, title: doc.title, description: doc.description, level: doc.level, status: doc.status,
    file_url: doc.file_url, file_name: doc.file_name, approved_by: doc.approved_by, approved_date: doc.approved_date,
    review_date: doc.review_date, tags: doc.tags, framework_codes: doc.framework_codes,
    changed_by: user.email, change_note: str(note, 500),
  };
}

/**
 * Atualiza o documento. Limpar a data de aprovação usa null; se a validação do esquema recusar null num campo
 * de data, repete a gravação sem esse campo (o aprovador fica vazio e o estado deixa de ser «Aprovado»).
 */
async function updateDoc(db: any, id: string, data: Record<string, unknown>) {
  try {
    return await db.SecurityDocument.update(id, data);
  } catch (e) {
    if (!('approved_date' in data) || data.approved_date !== null) throw e;
    const { approved_date: _drop, ...rest } = data;
    return await db.SecurityDocument.update(id, rest);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const admin = isPlatformAdmin(user);
    const isCA = user.role === 'customer_admin';
    const own = userCustomerId(user);
    const db = base44.asServiceRole.entities;
    const body = await readJson(req);
    const action = String(body.action || '');

    const canManage = (doc: any) => admin || (isCA && own && doc.customer_id === own);
    const canEdit = (doc: any) => canManage(doc) || (own && doc.customer_id === own && doc.owner_email === user.email);

    /** O ficheiro indicado tem de ser um ficheiro privado do mesmo cliente, ou o que o documento já tinha. */
    async function checkFileRef(url: string, customerId: string, previous?: string) {
      if (!url || url === previous) return;
      if (!url.startsWith(FILE_SCHEME)) throw new Error('O ficheiro tem de ser carregado pela plataforma');
      const f = await db.StoredFile.get(url.slice(FILE_SCHEME.length)).catch(() => null);
      if (!f || (f.customer_id || '') !== (customerId || '')) throw new Error('Ficheiro inválido para este cliente');
    }

    if (action === 'save') {
      const d = body.document || {};
      const fields: Record<string, unknown> = {
        title: str(d.title, 200).trim(),
        description: str(d.description, 4000),
        level: LEVELS.includes(d.level) ? d.level : 'policy',
        version: str(d.version, 40),
        review_date: d.review_date || null,
        tags: strList(d.tags),
        framework_codes: strList(d.framework_codes),
        file_url: str(d.file_url, 300),
        file_name: str(d.file_name, 200),
      };
      if (String(fields.title).length < 3) return json({ error: 'Título com pelo menos 3 caracteres' }, 400);
      if (!isDate(fields.review_date)) return json({ error: 'Data de revisão no formato AAAA-MM-DD' }, 400);
      if (!fields.review_date) delete fields.review_date;

      if (!d.id) {
        const customerId = admin ? str(d.customer_id, 64) : own;
        if (!customerId) return json({ error: admin ? 'Escolha o cliente' : 'Sem cliente associado' }, 400);
        const customer = await db.Customer.get(customerId).catch(() => null);
        if (!customer) return json({ error: 'Cliente inexistente' }, 404);
        await checkFileRef(String(fields.file_url), customerId);
        const status = (admin || isCA) && d.status === 'under_review' ? 'under_review' : (admin || isCA ? 'draft' : 'under_review');
        const doc = await db.SecurityDocument.create({ ...fields, customer_id: customerId, customer_name: customer.name || '', owner_email: user.email, status });
        await logAudit(base44, 'document_created', { user_email: user.email, customer_id: customerId, entity_type: 'SecurityDocument', entity_id: doc.id, details: `Documento criado: ${fields.title} (${status === 'draft' ? 'rascunho' : 'em revisão'})` });
        return json({ document: doc, status_changed: true });
      }

      const prev = await db.SecurityDocument.get(str(d.id, 64)).catch(() => null);
      if (!prev) return json({ error: 'Documento inexistente' }, 404);
      if (!canEdit(prev)) return json({ error: 'Sem permissão para editar este documento' }, 403);
      await checkFileRef(String(fields.file_url), prev.customer_id, prev.file_url);
      const contentChanged = CONTENT_FIELDS.some((k) => String(fields[k] ?? '') !== String(prev[k] ?? ''));
      let status = prev.status;
      if (!canManage(prev)) status = 'under_review';
      else if (['draft', 'under_review', 'deprecated'].includes(d.status)) status = d.status;
      if (prev.status === 'approved' && contentChanged && status === 'approved') status = 'under_review';
      const update: Record<string, unknown> = { ...fields, status };
      if (status !== 'approved') { update.approved_by = ''; update.approved_date = null; }
      await db.DocumentVersion.create(snapshotOf(prev, user, str(body.change_note, 300) || 'Alteração do documento'));
      const doc = await updateDoc(db, prev.id, update);
      await logAudit(base44, 'document_updated', { user_email: user.email, customer_id: prev.customer_id, entity_type: 'SecurityDocument', entity_id: prev.id, details: `Documento alterado: ${fields.title}${status !== prev.status ? ` (estado: ${prev.status} → ${status})` : ''}` });
      return json({ document: doc, status_changed: status !== prev.status, previous_status: prev.status });
    }

    const doc = body.document_id ? await db.SecurityDocument.get(str(body.document_id, 64)).catch(() => null) : null;
    if (!doc) return json({ error: 'Documento inexistente' }, 404);
    if (!canManage(doc)) return json({ error: 'Só o administrador do cliente pode fazer esta operação' }, 403);

    if (action === 'approve') {
      const signature = str(body.signature, 200).trim();
      if (!signature) return json({ error: 'A assinatura é obrigatória' }, 400);
      if (!['under_review', 'draft'].includes(doc.status)) return json({ error: 'Só documentos em rascunho ou em revisão podem ser aprovados' }, 409);
      const approver = user.display_name || user.full_name || user.email;
      const comments = str(body.comments, 1000);
      await db.DocumentVersion.create(snapshotOf(doc, user, `Estado antes da aprovação por ${approver}${comments ? ` — ${comments}` : ''}`));
      const updated = await db.SecurityDocument.update(doc.id, { status: 'approved', approved_by: approver, approved_date: new Date().toISOString().slice(0, 10) });
      await logAudit(base44, 'document_approved', { user_email: user.email, customer_id: doc.customer_id, entity_type: 'SecurityDocument', entity_id: doc.id, details: `Documento aprovado por ${approver} (assinado como «${signature}»)${comments ? ` — ${comments}` : ''}: ${doc.title}` });
      return json({ document: updated });
    }

    if (action === 'revert') {
      const v = await db.DocumentVersion.get(str(body.version_id, 64)).catch(() => null);
      if (!v || v.document_id !== doc.id) return json({ error: 'Versão inexistente' }, 404);
      await db.DocumentVersion.create(snapshotOf(doc, user, `Estado antes de repor a versão ${v.version_label || v.id}`));
      const updated = await updateDoc(db, doc.id, {
        title: v.title, description: v.description, level: v.level, file_url: v.file_url, file_name: v.file_name,
        ...(v.review_date ? { review_date: v.review_date } : {}), tags: v.tags || [], framework_codes: v.framework_codes || [], version: v.version_label,
        status: 'under_review', approved_by: '', approved_date: null,
      });
      await logAudit(base44, 'document_version_reverted', { user_email: user.email, customer_id: doc.customer_id, entity_type: 'SecurityDocument', entity_id: doc.id, details: `«${doc.title}» reposto na versão ${v.version_label || v.id}; volta a revisão` });
      return json({ document: updated, status_changed: true, previous_status: doc.status });
    }

    if (action === 'delete') {
      await db.SecurityDocument.delete(doc.id);
      await logAudit(base44, 'document_deleted', { user_email: user.email, customer_id: doc.customer_id, entity_type: 'SecurityDocument', entity_id: doc.id, details: `Documento apagado: ${doc.title}` });
      return json({ deleted: true });
    }

    return json({ error: 'Ação desconhecida' }, 400);
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
});

