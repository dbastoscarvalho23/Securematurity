import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { json, readJson, getAuthenticatedUser, isPlatformAdmin, userCustomerId } from '../../shared/http.ts';
import { logAudit } from '../../shared/audit.ts';
import { getEntitlements, subscriptionState } from '../../shared/license.ts';
import { LICENSE_PUBLIC_KEY, LICENSE_KEY_ID, SEED_MODULES, SEED_ENTITLEMENTS, SEED_TIERS, SEED_STANDARDS } from '../../shared/licenseCatalog.ts';

/**
 * Consola de licenças (bundles, módulos, subscrições, certificados assinados).
 *  - me                 { customer_id? }  → licença efetiva (qualquer utilizador; não-admin só a do seu cliente)
 *  - verify             { jws }           → valida a assinatura e se o certificado está revogado
 *  Só administrador da plataforma:
 *  - seed, save_module, save_tier, publish_tier, save_standard
 *  - set_subscription   { customer_id, subscription, standards?, overrides? }
 *  - issue_certificate  { customer_id, valid_until? }   - revoke_certificate { id, reason }
 */

const CODE = /^[a-z0-9_]{2,60}$/;
const STD = /^[A-Z0-9_]{2,40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v, n = 500) => (v == null ? '' : String(v)).slice(0, n);
const dateOrNull = (v) => (v && DATE.test(String(v)) ? String(v) : null);
const numOrNull = (v) => (v === '' || v == null ? null : Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : null);
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uText = (s) => b64u(new TextEncoder().encode(s));
const fromB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const canonical = (v) => (Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : v && typeof v === 'object'
  ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v));

async function signJws(payload) {
  const pk = secrets.get('LICENSE_SIGNING_KEY');
  if (!pk) throw new Error('Segredo LICENSE_SIGNING_KEY em falta');
  const key = await crypto.subtle.importKey('pkcs8', fromB64(pk), { name: 'Ed25519' }, false, ['sign']);
  const head = b64uText(canonical({ alg: 'EdDSA', kid: LICENSE_KEY_ID, typ: 'ankoraone-license+jws' }));
  const body = b64uText(canonical(payload));
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}

async function verifyJws(jws) {
  const [h, p, s] = String(jws || '').trim().split('.');
  if (!h || !p || !s) return { valid: false, reason: 'Formato inválido' };
  const key = await crypto.subtle.importKey('spki', fromB64(LICENSE_PUBLIC_KEY), { name: 'Ed25519' }, false, ['verify']);
  const ok = await crypto.subtle.verify({ name: 'Ed25519' }, key, fromB64u(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return { valid: false, reason: 'Assinatura inválida' };
  return { valid: true, header: JSON.parse(new TextDecoder().decode(fromB64u(h))), payload: JSON.parse(new TextDecoder().decode(fromB64u(p))) };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const admin = isPlatformAdmin(user);
    const body = await readJson(req);
    const db = base44.asServiceRole.entities;
    const action = body.action;
    const changeLog = (fields) => db.LicenseChangeLog.create({ actor_email: user.email, actor_role: user.role, ...fields }).catch(() => null);

    if (action === 'me') {
      const own = userCustomerId(user);
      const customerId = admin ? String(body.customer_id || own || '') : own;
      if (!customerId) return json({ state: admin ? 'admin' : 'none', modules: [], effective: admin });
      if (!admin && body.customer_id && body.customer_id !== own) return json({ error: 'Forbidden' }, 403);
      const ent = await getEntitlements(base44, customerId);
      const s = ent.subscription;
      const month = new Date().toISOString().slice(0, 7);
      const usage = (await db.LicenseUsageRecord.filter({ customer_id: customerId, month, feature: 'ai' }))[0]?.usage_count || 0;
      return json({
        customer_id: customerId, state: ent.state, effective: ent.effective, tier_code: ent.tier_code, modules: ent.modules,
        standards: ent.standards, seat_limit: ent.seat_limit, ai_quota_monthly: ent.ai_quota_monthly, ai_used_month: usage,
        expires_date: s?.expires_date || null, trial_ends_at: s?.trial_ends_at || null, grace_until: s?.grace_until || null,
      });
    }

    if (action === 'verify') {
      if (!admin && user.role !== 'customer_admin') return json({ error: 'Forbidden' }, 403);
      const r = await verifyJws(body.jws);
      if (!r.valid) return json(r);
      // Um customer_admin só verifica certificados do seu cliente; os outros são «inválidos» (sem revelar se são genuínos).
      if (!admin && r.payload.customer?.id !== userCustomerId(user)) return json({ valid: false, reason: 'Certificado inválido para este cliente' });
      const cert = (await db.LicenseCertificate.filter({ serial: r.payload.serial }))[0];
      const today = new Date().toISOString().slice(0, 10);
      return json({ ...r, status: cert?.status || 'unknown', expired: Boolean(r.payload.valid_until && today > r.payload.valid_until) });
    }

    if (!admin) return json({ error: 'Forbidden' }, 403);

    if (action === 'seed') {
      const created = { modules: 0, entitlements: 0, tiers: 0, standards: 0 };
      const has = async (ent, field, code) => (await db[ent].filter({ [field]: code })).length > 0;
      for (const m of SEED_MODULES) if (!(await has('LicenseModule', 'code', m.code))) { await db.LicenseModule.create({ is_active: true, ...m }); created.modules += 1; }
      for (const [code, name, module_code] of SEED_ENTITLEMENTS) if (!(await has('LicenseEntitlement', 'code', code))) { await db.LicenseEntitlement.create({ code, name, module_code, is_active: true }); created.entitlements += 1; }
      for (const t of SEED_TIERS) if (!(await has('LicenseTier', 'code', t.code))) { await db.LicenseTier.create({ ...t, version: 1, is_active: true, published_at: new Date().toISOString(), published_by_email: user.email }); created.tiers += 1; }
      for (const [code, name] of SEED_STANDARDS) if (!(await has('LicenseStandard', 'code', code))) { await db.LicenseStandard.create({ code, name, offered: true, is_active: true }); created.standards += 1; }
      await changeLog({ action: 'seed_catalog', entity_type: 'LicenseCatalog', after: created });
      return json({ created });
    }

    if (action === 'save_module') {
      const m = body.module || {};
      if (!CODE.test(m.code || '')) return json({ error: 'Código inválido (a-z, 0-9, _)' }, 400);
      const data = { code: m.code, name: str(m.name, 120), description: str(m.description, 500), tier_code: str(m.tier_code, 60), display_order: numOrNull(m.display_order) ?? 99, is_active: m.is_active !== false };
      const prev = (await db.LicenseModule.filter({ code: m.code }))[0];
      const rec = prev ? await db.LicenseModule.update(prev.id, data) : await db.LicenseModule.create(data);
      await changeLog({ action: prev ? 'update_module' : 'create_module', entity_type: 'LicenseModule', entity_id: rec.id, before: prev || {}, after: data });
      return json({ module: rec });
    }

    if (action === 'save_tier') {
      // Grava como rascunho; só «publish_tier» altera os módulos que os clientes recebem.
      const t = body.tier || {};
      if (!CODE.test(t.code || '')) return json({ error: 'Código inválido (a-z, 0-9, _)' }, 400);
      const known = new Set((await db.LicenseModule.list('display_order', 200)).map((m) => m.code));
      const draft = (Array.isArray(t.modules_draft) ? t.modules_draft : []).filter((c) => known.has(c));
      const prev = (await db.LicenseTier.filter({ code: t.code }))[0];
      const data = {
        code: t.code, name: str(t.name, 120), description: str(t.description, 1000), commercial_value: str(t.commercial_value, 200),
        display_order: numOrNull(t.display_order) ?? 99, is_active: t.is_active !== false, is_partner_tier: Boolean(t.is_partner_tier),
        modules_draft: draft, has_draft: true, draft_note: str(t.draft_note, 500), draft_at: new Date().toISOString(), draft_by_email: user.email,
      };
      const rec = prev ? await db.LicenseTier.update(prev.id, data) : await db.LicenseTier.create({ ...data, modules: [], version: 0 });
      await changeLog({ action: 'save_tier_draft', entity_type: 'LicenseTier', entity_id: rec.id, before: { modules: prev?.modules || [] }, after: { modules_draft: draft } });
      return json({ tier: rec });
    }

    if (action === 'publish_tier') {
      const prev = (await db.LicenseTier.filter({ code: String(body.code || '') }))[0];
      if (!prev) return json({ error: 'Bundle inexistente' }, 404);
      if (!prev.has_draft || !Array.isArray(prev.modules_draft)) return json({ error: 'Sem rascunho para publicar' }, 400);
      const rec = await db.LicenseTier.update(prev.id, {
        modules: prev.modules_draft, modules_draft: [], has_draft: false, draft_note: '', draft_by_email: '',
        version: (prev.version || 0) + 1, published_at: new Date().toISOString(), published_by_email: user.email,
      });
      await changeLog({ action: 'publish_tier', entity_type: 'LicenseTier', entity_id: prev.id, changed_fields: ['modules'], before: { modules: prev.modules, version: prev.version }, after: { modules: prev.modules_draft, version: (prev.version || 0) + 1 }, reason: prev.draft_note || null });
      // Os registos TenantModule de origem «tier» dos clientes deste bundle passam a refletir a nova versão.
      for (const sub of await db.TenantSubscription.filter({ tier_code: prev.code }, '-created_date', 2000)) await syncTenantModules(db, sub, prev.modules_draft, user.email);
      return json({ tier: rec });
    }

    if (action === 'save_standard') {
      const s = body.standard || {};
      if (!STD.test(s.code || '')) return json({ error: 'Código inválido' }, 400);
      const data = { code: s.code, name: str(s.name, 200), description: str(s.description, 500), offered: s.offered !== false, is_active: s.is_active !== false };
      const prev = (await db.LicenseStandard.filter({ code: s.code }))[0];
      const rec = prev ? await db.LicenseStandard.update(prev.id, data) : await db.LicenseStandard.create(data);
      return json({ standard: rec });
    }

    const customerId = String(body.customer_id || '');
    const customer = customerId ? await db.Customer.get(customerId).catch(() => null) : null;

    if (action === 'set_subscription') {
      if (!customer) return json({ error: 'Cliente inexistente' }, 404);
      const s = body.subscription || {};
      const tier = (await db.LicenseTier.filter({ code: String(s.tier_code || '') }))[0];
      if (!tier) return json({ error: 'Bundle inexistente' }, 400);
      const known = new Set((await db.LicenseModule.list('display_order', 200)).map((m) => m.code));
      const data = {
        customer_id: customerId, customer_name: customer.name, tier_code: tier.code,
        addon_codes: (s.addon_codes || []).filter((c) => known.has(c) && !(tier.modules || []).includes(c)),
        status: ['trial', 'active', 'suspended', 'closed'].includes(s.status) ? s.status : 'active',
        started_date: dateOrNull(s.started_date) || new Date().toISOString().slice(0, 10),
        expires_date: dateOrNull(s.expires_date), trial_ends_at: dateOrNull(s.trial_ends_at), grace_until: dateOrNull(s.grace_until),
        seat_limit: numOrNull(s.seat_limit), ai_quota_monthly: numOrNull(s.ai_quota_monthly), quota_warn_pct: numOrNull(s.quota_warn_pct) ?? 80,
        notes: str(s.notes, 2000),
      };
      if (!data.seat_limit || data.seat_limit < 5) return json({ error: 'Indique o número de utilizadores (mínimo 5)' }, 400);
      if (data.status !== 'trial') data.trial_ends_at = null;
      if (data.status === 'closed') { data.closed_at = new Date().toISOString(); data.closed_reason = str(s.closed_reason, 500); }
      else { data.closed_at = null; data.closed_reason = ''; }
      const prev = (await db.TenantSubscription.filter({ customer_id: customerId }, '-created_date', 5))[0];
      if (prev && prev.expires_date && data.expires_date && data.expires_date > prev.expires_date) { data.renewal_count = (prev.renewal_count || 0) + 1; data.last_renewed_at = new Date().toISOString(); }
      const sub = prev ? await db.TenantSubscription.update(prev.id, data) : await db.TenantSubscription.create(data);
      await syncTenantModules(db, { ...sub, ...data }, tier.modules || [], user.email);

      // Ativações/desativações manuais (substituem as anteriores).
      if (Array.isArray(body.overrides)) {
        for (const tm of await db.TenantModule.filter({ customer_id: customerId, source: 'manual' }, '-created_date', 500)) await db.TenantModule.delete(tm.id);
        const seenO = new Set();
        for (const o of body.overrides.slice(0, 50)) {
          if (!known.has(o.module_code) || seenO.has(o.module_code)) continue;
          seenO.add(o.module_code);
          await db.TenantModule.create({ customer_id: customerId, module_code: o.module_code, status: o.status === 'inactive' ? 'inactive' : 'active', source: 'manual', reason: str(o.reason, 300) || 'Manual', activated_at: new Date().toISOString(), ...(dateOrNull(o.expires_at) ? { expires_at: o.expires_at } : {}) });
        }
      }
      // Referenciais licenciados → também passam a ser os referenciais permitidos do cliente.
      if (Array.isArray(body.standards)) {
        const valid = new Set((await db.LicenseStandard.list('code', 200)).map((x) => x.code));
        const wanted = body.standards.filter((c) => valid.has(c));
        const current = await db.TenantStandard.filter({ customer_id: customerId }, 'standard_code', 200);
        for (const ts of current) if (!wanted.includes(ts.standard_code)) await db.TenantStandard.update(ts.id, { status: 'none' });
        for (const code of wanted) {
          const ex = current.find((x) => x.standard_code === code);
          if (ex) { if (ex.status !== 'active') await db.TenantStandard.update(ex.id, { status: 'active', activated_at: new Date().toISOString() }); }
          else await db.TenantStandard.create({ customer_id: customerId, standard_code: code, status: 'active', activated_at: new Date().toISOString() });
        }
        // Referenciais fora do catálogo de licenças (ex.: antigos) mantêm-se como estavam.
        const outside = (customer.allowed_frameworks || []).filter((c) => !valid.has(c));
        await db.Customer.update(customerId, { allowed_frameworks: [...new Set([...wanted, ...outside])] });
      }
      // A licença passa a ser a fonte dos lugares: o limite do cliente fica igual e os extras antigos são incorporados.
      await db.Customer.update(customerId, { user_seat_limit: data.seat_limit, user_seat_addon_count: 0 });
      const changed = Object.keys(data).filter((k) => JSON.stringify(prev?.[k] ?? null) !== JSON.stringify(data[k] ?? null));
      await changeLog({ customer_id: customerId, customer_name: customer.name, action: prev ? 'update_subscription' : 'create_subscription', entity_type: 'TenantSubscription', entity_id: sub.id, changed_fields: changed, before: prev ? Object.fromEntries(changed.map((k) => [k, prev[k] ?? null])) : {}, after: Object.fromEntries(changed.map((k) => [k, data[k] ?? null])), reason: str(body.reason, 500) || null });
      await logAudit(base44, 'license_changed', { user_email: user.email, customer_id: customerId, entity_type: 'TenantSubscription', entity_id: sub.id, details: `Licença ${tier.name} (${data.status}) — ${changed.join(', ') || 'sem alterações'}` });
      return json({ subscription: sub, entitlements: await getEntitlements(base44, customerId) });
    }

    if (action === 'issue_certificate') {
      if (!customer) return json({ error: 'Cliente inexistente' }, 404);
      const ent = await getEntitlements(base44, customerId);
      if (!ent.subscription) return json({ error: 'O cliente não tem subscrição' }, 400);
      if (!ent.effective) return json({ error: `A subscrição não está ativa (${ent.state})` }, 400);
      const sub = ent.subscription;
      const tier = (await db.LicenseTier.filter({ code: sub.tier_code }))[0];
      const today = new Date().toISOString().slice(0, 10);
      const maxDate = (...d) => d.filter(Boolean).sort().pop() || null;
      const validUntil = dateOrNull(body.valid_until) || (ent.state === 'trial' ? sub.trial_ends_at || null : maxDate(sub.expires_date, sub.grace_until));
      const serial = `ANK-${today.replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const payload = {
        v: 1, serial, issuer: 'AnkoraOne', issued_at: new Date().toISOString(), issued_by: user.email,
        customer: { id: customerId, name: customer.name, nif: customer.nif || null },
        tier: { code: sub.tier_code, name: tier?.name || sub.tier_code, version: tier?.version || null },
        modules: [...ent.modules].sort(), addons: [...(sub.addon_codes || [])].sort(), standards: [...ent.standards].sort(),
        seats: sub.seat_limit ?? null, ai_quota_monthly: sub.ai_quota_monthly ?? null, state: ent.state,
        valid_from: today, valid_until: validUntil,
      };
      const jws = await signJws(payload);
      for (const c of await db.LicenseCertificate.filter({ customer_id: customerId, status: 'active' })) await db.LicenseCertificate.update(c.id, { status: 'superseded' });
      const cert = await db.LicenseCertificate.create({ customer_id: customerId, customer_name: customer.name, serial, status: 'active', payload: canonical(payload), jws, key_id: LICENSE_KEY_ID, valid_from: today, ...(validUntil ? { valid_until: validUntil } : {}), issued_at: payload.issued_at, issued_by: user.email });
      await changeLog({ customer_id: customerId, customer_name: customer.name, action: 'issue_certificate', entity_type: 'LicenseCertificate', entity_id: cert.id, after: { serial, tier: payload.tier.code, modules: payload.modules, valid_until: validUntil } });
      await logAudit(base44, 'license_certificate_issued', { user_email: user.email, customer_id: customerId, entity_type: 'LicenseCertificate', entity_id: cert.id, details: `Certificado ${serial} (${payload.tier.name})` });
      return json({ certificate: cert });
    }

    if (action === 'revoke_certificate') {
      const cert = await db.LicenseCertificate.get(String(body.id || '')).catch(() => null);
      if (!cert) return json({ error: 'Certificado inexistente' }, 404);
      const rec = await db.LicenseCertificate.update(cert.id, { status: 'revoked', revoked_at: new Date().toISOString(), revoked_reason: str(body.reason, 500) });
      await changeLog({ customer_id: cert.customer_id, customer_name: cert.customer_name, action: 'revoke_certificate', entity_type: 'LicenseCertificate', entity_id: cert.id, reason: str(body.reason, 500) || null, before: { status: cert.status }, after: { status: 'revoked' } });
      return json({ certificate: rec });
    }

    return json({ error: 'Ação desconhecida' }, 400);
  } catch (error) {
    return json({ error: error?.message || 'Erro' }, 400);
  }
}

/** Mantém os TenantModule de origem «tier»/«addon» iguais ao bundle publicado e aos extras da subscrição. */
async function syncTenantModules(db, sub, tierModules, actor) {
  const want = new Map();
  for (const c of tierModules || []) want.set(c, 'tier');
  for (const c of sub.addon_codes || []) if (!want.has(c)) want.set(c, 'addon');
  const active = ['trial', 'active'].includes(sub.status) && subscriptionState(sub) !== 'expired';
  const rows = (await db.TenantModule.filter({ customer_id: sub.customer_id }, '-created_date', 500)).filter((r) => r.source !== 'manual');
  const now = new Date().toISOString();
  for (const r of rows) {
    const src = want.get(r.module_code);
    const status = src && active ? 'active' : 'inactive';
    if (r.status !== status || r.source !== src) await db.TenantModule.update(r.id, { status, source: src || r.source, ...(status === 'inactive' ? { deactivated_at: now } : { activated_at: now }), reason: src ? `${src === 'tier' ? 'Bundle' : 'Extra'} ${sub.tier_code}` : `Removido por ${actor}` });
    want.delete(r.module_code);
  }
  for (const [code, src] of want) await db.TenantModule.create({ customer_id: sub.customer_id, module_code: code, status: active ? 'active' : 'inactive', source: src, activated_at: now, reason: `${src === 'tier' ? 'Bundle' : 'Extra'} ${sub.tier_code}` });
}


