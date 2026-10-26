import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isPlatformAdmin, userCustomerId } from '../../shared/http.ts';
import { logAudit } from '../../shared/audit.ts';

/**
 * Escritas no inventário de ativos e nas ferramentas (Asset, Component, AssetHistory).
 * As entidades só aceitam escritas de administradores; esta função (service role) é o único caminho para o
 * customer_admin, e garante o tenant, valida os campos e escreve o histórico no servidor.
 *
 * Ações (customer_id só é aceite de um administrador da plataforma):
 *  - asset_save      { id?, asset }
 *  - asset_delete    { id }
 *  - import          { assets: [..], tools: [..] }   (até 500 de cada por pedido; o browser envia em lotes)
 *  - component_save  { id?, component }
 *  - component_delete{ id }
 */

const TYPES = ['physical', 'software', 'network', 'supplier_service', 'data', 'service', 'facility'];
const CRIT = ['low', 'medium', 'high', 'critical'];
const LIFE = ['planned', 'production', 'retiring', 'retired'];
const TEXT = { asset_code: 60, name: 200, service: 300, description: 2000, manufacturer: 200, model_version: 120, operating_system: 120, app_server_software: 200, location: 200, owner: 200, supplier: 200, ip_address: 300, fqdn: 500, notes: 2000 };
const SCALE = ['confidentiality', 'integrity', 'authenticity', 'availability'];
const REQUIRED = ['asset_code', 'name', 'asset_type', 'service', 'owner', 'internet_exposed', 'confidentiality', 'integrity', 'authenticity', 'availability', 'criticality', 'lifecycle', 'last_review'];
const ASSET_FIELDS = [...Object.keys(TEXT), 'asset_type', 'criticality', 'lifecycle', 'internet_exposed', 'logging_required', ...SCALE, 'rto_hours', 'rpo_hours', 'end_of_support', 'last_review', 'dependencies'];
const TOOL_CATS = ['asset_inventory', 'vuln_scanning', 'pentest', 'firewall', 'edr', 'software_mgmt', 'siem', 'backup', 'mfa', 'iam', 'crypto', 'awareness', 'incident_mgmt', 'change_mgmt'];
const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/\d{1,2})?$/;
const IPV6 = /^[0-9a-f:]+(\/\d{1,3})?$/i;
const FQDN = /^(?=.{1,253}$)([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/i;
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());
const list = (v, max, n = 100) => (Array.isArray(v) ? v : String(v || '').split(/[;,\n]/)).map((x) => String(x).trim().slice(0, n)).filter(Boolean).slice(0, max);

/** Normaliza e valida um ativo; `partial` = só os campos presentes (importação de atualização). */
function cleanAsset(input, partial) {
  const out = {};
  const errors = [];
  for (const f of ASSET_FIELDS) {
    if (!(f in input)) continue;
    const v = input[f];
    if (v === undefined) continue;
    if (f in TEXT) out[f] = v == null ? '' : String(v).trim().slice(0, TEXT[f]);
    else if (f === 'asset_type') { if (TYPES.includes(v)) out[f] = v; else errors.push('Tipo de ativo inválido'); }
    else if (f === 'criticality') { if (CRIT.includes(v)) out[f] = v; else errors.push('Criticidade inválida'); }
    else if (f === 'lifecycle') { if (LIFE.includes(v)) out[f] = v; else errors.push('Fase do ciclo de vida inválida'); }
    else if (f === 'internet_exposed' || f === 'logging_required') { if (typeof v === 'boolean') out[f] = v; else errors.push(`${f}: valor Sim/Não inválido`); }
    else if (SCALE.includes(f)) { const n = Number(v); if (v != null && [1, 2, 3, 4].includes(n)) out[f] = n; else errors.push(`${f}: escala de 1 a 4`); }
    else if (f === 'rto_hours' || f === 'rpo_hours') { if (v === null || v === '') out[f] = null; else if (Number(v) >= 0) out[f] = Number(v); else errors.push(`${f}: número inválido`); }
    else if (f === 'end_of_support' || f === 'last_review') { if (v === null || v === '') out[f] = null; else if (isDate(String(v))) out[f] = String(v); else errors.push(`${f}: data inválida`); }
    else if (f === 'dependencies') out[f] = list(v, 100);
  }
  if (!partial) for (const f of REQUIRED) if (out[f] === undefined || out[f] === '' || out[f] === null) errors.push(`Obrigatório: ${f}`);
  const ips = list(out.ip_address, 50, 60);
  if (ips.some((ip) => !IPV4.test(ip) && !IPV6.test(ip))) errors.push('Endereço IP inválido');
  if (list(out.fqdn, 50, 253).some((h) => !FQDN.test(h))) errors.push('FQDN inválido');
  return { data: out, errors };
}

function cleanComponent(input, admin) {
  const errors = [];
  if (!TOOL_CATS.includes(input.category)) errors.push('Categoria fora do catálogo');
  const product = String(input.product || '').trim().slice(0, 200);
  if (!product) errors.push('Produto obrigatório');
  const data = {
    category: input.category, product,
    vendor: String(input.vendor || '').trim().slice(0, 200), version: String(input.version || '').trim().slice(0, 100),
    asset_codes: list(input.asset_codes, 500, 60), nis2_letters: list(input.nis2_letters, 10, 1).filter((l) => LETTERS.includes(l)),
    regexec_points: String(input.regexec_points || '').slice(0, 60), qnrcs_controls: list(input.qnrcs_controls, 20, 20),
    owner: String(input.owner || '').trim().slice(0, 200), status: input.status === 'retired' ? 'retired' : 'active',
    notes: String(input.notes || '').slice(0, 2000),
  };
  if (admin && typeof input.coverage_confirmed === 'boolean') data.coverage_confirmed = input.coverage_confirmed;
  return { data, errors };
}

function diff(before, after) {
  const out = {};
  for (const f of Object.keys(after)) {
    const a = before?.[f] ?? '';
    const b = after[f] ?? '';
    if (JSON.stringify(a) !== JSON.stringify(b)) out[f] = [a, b];
  }
  return out;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const admin = isPlatformAdmin(user);
    if (!admin && user.role !== 'customer_admin') return json({ error: 'Forbidden' }, 403);
    const body = await readJson(req);
    const own = userCustomerId(user);
    const customerId = admin ? String(body.customer_id || own || '') : own;
    if (!customerId) return json({ error: 'Sem cliente associado' }, 403);
    if (!admin && body.customer_id && body.customer_id !== customerId) return json({ error: 'Forbidden' }, 403);
    const customer = await base44.asServiceRole.entities.Customer.get(customerId).catch(() => null);
    if (!customer) return json({ error: 'Cliente inexistente' }, 404);

    const db = base44.asServiceRole.entities;
    const history = (asset, action, changes) => db.AssetHistory.create({
      customer_id: customerId, asset_id: asset.id, asset_code: asset.asset_code, action,
      changes: JSON.stringify(changes || {}).slice(0, 20000), user_email: user.email,
    }).catch(() => null);
    const owned = async (ent, id) => {
      const rec = id ? await db[ent].get(String(id)).catch(() => null) : null;
      if (!rec || rec.customer_id !== customerId) throw new Error('Registo inexistente');
      return rec;
    };
    const audit = (action, entity_type, entity_id, details) => logAudit(base44, action, { user_email: user.email, customer_id: customerId, entity_type, entity_id, details });

    if (body.action === 'asset_save') {
      const prev = body.id ? await owned('Asset', body.id) : null;
      const { data, errors } = cleanAsset(body.asset || {}, false);
      if (errors.length) return json({ error: errors[0], errors }, 400);
      const dup = await db.Asset.filter({ customer_id: customerId, asset_code: data.asset_code });
      if (dup.some((a) => a.id !== prev?.id)) return json({ error: 'Já existe um ativo com este ID' }, 409);
      if (prev) {
        const changes = diff(prev, data);
        const rec = await db.Asset.update(prev.id, data);
        await history({ ...prev, ...data }, 'update', changes);
        await audit('asset_updated', 'Asset', prev.id, `Ativo ${data.asset_code} atualizado (${Object.keys(changes).length} campo(s))`);
        return json({ asset: rec });
      }
      const rec = await db.Asset.create({ ...data, customer_id: customerId });
      await history(rec, 'create', diff({}, data));
      await audit('asset_created', 'Asset', rec.id, `Ativo ${data.asset_code} criado`);
      return json({ asset: rec });
    }

    if (body.action === 'asset_delete') {
      const prev = await owned('Asset', body.id);
      await history(prev, 'delete', {});
      await db.Asset.delete(prev.id);
      await audit('asset_deleted', 'Asset', prev.id, `Ativo ${prev.asset_code} eliminado`);
      return json({ success: true });
    }

    if (body.action === 'component_save') {
      const prev = body.id ? await owned('Component', body.id) : null;
      const { data, errors } = cleanComponent(body.component || {}, admin);
      if (errors.length) return json({ error: errors[0], errors }, 400);
      const rec = prev ? await db.Component.update(prev.id, data) : await db.Component.create({ ...data, customer_id: customerId });
      await audit(prev ? 'component_updated' : 'component_created', 'Component', rec.id, `${data.category}: ${data.product}`);
      return json({ component: rec });
    }

    if (body.action === 'component_delete') {
      const prev = await owned('Component', body.id);
      await db.Component.delete(prev.id);
      await audit('component_deleted', 'Component', prev.id, prev.product);
      return json({ success: true });
    }

    if (body.action === 'import') {
      const assets = Array.isArray(body.assets) ? body.assets.slice(0, 500) : [];
      const tools = Array.isArray(body.tools) ? body.tools.slice(0, 500) : [];
      const existing = await db.Asset.filter({ customer_id: customerId }, 'asset_code', 10000);
      const byCode = Object.fromEntries(existing.map((a) => [a.asset_code, a]));
      const result = { created: 0, updated: 0, unchanged: 0, tools: 0, failed: [] };
      const seen = new Set();
      for (const [i, input] of assets.entries()) {
        const code = String(input?.asset_code || '').trim();
        const prev = byCode[code];
        const { data, errors } = cleanAsset(input || {}, Boolean(prev));
        if (!code || seen.has(code)) errors.push(!code ? 'ID em falta' : 'ID repetido no ficheiro');
        seen.add(code);
        if (errors.length) { result.failed.push({ index: i, code, error: errors[0] }); continue; }
        try {
          if (prev) {
            const changes = diff(prev, data);
            if (!Object.keys(changes).length) { result.unchanged += 1; continue; }
            await db.Asset.update(prev.id, data);
            await history({ ...prev, ...data }, 'import', changes);
            result.updated += 1;
          } else {
            const rec = await db.Asset.create({ ...data, customer_id: customerId });
            byCode[code] = rec;
            await history(rec, 'import', diff({}, data));
            result.created += 1;
          }
        } catch (e) { result.failed.push({ index: i, code, error: e?.message || 'Erro' }); }
      }
      if (tools.length) {
        const comps = await db.Component.filter({ customer_id: customerId }, 'category', 2000);
        const key = (c) => `${c.category}|${String(c.product || '').trim().toLowerCase()}`;
        const byKey = Object.fromEntries(comps.map((c) => [key(c), c]));
        const seenT = new Set();
        for (const [i, input] of tools.entries()) {
          const { data, errors } = cleanComponent(input || {}, false);
          const k = key(data);
          if (seenT.has(k)) errors.push('Ferramenta repetida no ficheiro');
          seenT.add(k);
          if (errors.length) { result.failed.push({ index: i, tool: data.product, error: errors[0] }); continue; }
          try {
            const prev = byKey[k];
            if (prev) {
              // Mantém o estado e as ligações existentes quando o ficheiro não as indica.
              const patch = { ...data, status: prev.status || 'active' };
              if (!data.asset_codes.length) delete patch.asset_codes;
              if (!data.notes) delete patch.notes;
              if (!data.owner) delete patch.owner;
              await db.Component.update(prev.id, patch);
            } else {
              byKey[k] = await db.Component.create({ ...data, customer_id: customerId });
            }
            result.tools += 1;
          } catch (e) { result.failed.push({ index: i, tool: data.product, error: e?.message || 'Erro' }); }
        }
      }
      await audit('assets_imported', 'Asset', customerId, `Importação: ${result.created} criado(s), ${result.updated} atualizado(s), ${result.unchanged} sem alterações, ${result.tools} ferramenta(s), ${result.failed.length} falha(s)`);
      return json(result);
    }

    return json({ error: 'Ação desconhecida' }, 400);
  } catch (error) {
    return json({ error: error?.message || 'Erro' }, 400);
  }
}
