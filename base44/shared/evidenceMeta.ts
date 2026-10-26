/**
 * Metadados e ligações de evidências — as mesmas regras para a função `evidence` (carregamento direto) e para a
 * função `documentIntake` (documento classificado e indexado a partir de «00 Por classificar»).
 */

export const TYPES = ['screenshot', 'tool_report', 'contract_licence', 'policy_procedure', 'log_record', 'test_audit_report', 'other'];
export const METHODS = ['examine', 'interview', 'test'];
export const LINK_TYPES = ['measure', 'control', 'question', 'asset', 'component', 'incident', 'task', 'checklist', 'supplier', 'vulnerability', 'iso27001'];

// Entities a link may point to, checked to belong to the evidence's customer.
export const RESTRICTED_LINKS = ['asset', 'component'];
// Entity map:
export const LINK_ENTITY = { asset: 'Asset', component: 'Component', incident: 'Incident', task: 'Task', checklist: 'ComplianceChecklist', supplier: 'Supplier', vulnerability: 'Vulnerability' };

export const isDate = (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(String(v));
export const str = (v, n = 500) => (v == null ? '' : String(v)).slice(0, n);

export async function cleanLinks(base44, customerId, links) {
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

/** Cliente dos registos ligados (para o administrador que não indicou o cliente); '' se não houver. */
export async function customerFromLinks(base44, links) {
  for (const l of Array.isArray(links) ? links.slice(0, 50) : []) {
    const ent = l && LINK_ENTITY[l.type];
    if (!ent || !l.id) continue;
    const rec = await base44.asServiceRole.entities[ent].get(String(l.id)).catch(() => null);
    if (rec?.customer_id) return rec.customer_id;
  }
  return '';
}

export async function buildMeta(base44, body, customerId) {
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
