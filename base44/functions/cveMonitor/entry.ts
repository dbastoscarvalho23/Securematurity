import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isPlatformAdmin, userCustomerId } from '../../shared/http.ts';
import { logAudit } from '../../shared/audit.ts';
import { requireModule, getEntitlements, LicenseError } from '../../shared/license.ts';
import { sendMail } from '../../shared/mail.ts';

/**
 * Monitorização de CVE por fabricante do inventário de ativos (fonte: NVD do NIST, API 2.0).
 * Ao NVD só seguem nomes de fabricante/produto CPE — nunca IPs, FQDN ou outros dados do inventário.
 *
 * Ações (admin da plataforma ou customer_admin do próprio cliente):
 *  - suggest      { keyword }               → fabricantes/produtos CPE que correspondem ao nome do inventário
 *  - save_watch   { id?, watch }            → fabricante vigiado (gravidade mínima, ativos abrangidos)
 *  - delete_watch { id }
 *  - check        { customer_id? }          → verifica agora os fabricantes do cliente
 *  - set_alert    { id, status }            → acknowledged | dismissed | new
 *  - convert      { id }                    → cria o registo em Vulnerabilidades
 *  - run_all                                → todos os clientes (workflow agendado; a sessão do proprietário da app autoriza)
 */

const NVD = 'https://services.nvd.nist.gov/rest/json';
const CPE_PART = /^[a-z0-9._\-~!+]{1,100}$/;
const MAX_WINDOW_DAYS = 120; // limite do NVD para intervalos de datas
const FIRST_RUN_DAYS = 30;
const MAX_GROUPS_PER_RUN = 40;
const RANK = { high: 1, critical: 2 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nvdDate = (d) => d.toISOString().replace('Z', ''); // sem desvio = UTC
const days = (n) => n * 86400000;
const str = (v, n = 300) => (v == null ? '' : String(v)).slice(0, n);
const normVendor = (s) => String(s || '').trim().toLowerCase().replace(/[\s,.]+(inc|ltd|llc|gmbh|corp|corporation|co|sa|s\.a|lda|ag|bv)\.?$/i, '').replace(/\s+/g, '_');

async function nvdGet(path, params) {
  const url = `${NVD}/${path}?${new URLSearchParams(params)}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, redirect: 'error' });
    if (r.ok) return r.json();
    if (![403, 429, 503].includes(r.status)) throw new Error(`NVD respondeu ${r.status}`);
    await sleep(8000);
  }
  throw new Error('NVD indisponível ou limite de pedidos atingido');
}
const pause = () => sleep(6500); // 5 pedidos por 30 s (limite anónimo do NVD)

/** Gravidade e pontuação CVSS preferindo a entrada «Primary»: v3.1, depois v4.0, depois v3.0. */
function cvssOf(cve) {
  const m = cve.metrics || {};
  for (const [k, ver] of [['cvssMetricV31', '3.1'], ['cvssMetricV40', '4.0'], ['cvssMetricV30', '3.0']]) {
    const list = m[k] || [];
    if (!list.length) continue;
    const pick = list.find((x) => x.type === 'Primary') || list[0];
    const d = pick.cvssData || {};
    return { score: d.baseScore, severity: String(d.baseSeverity || '').toLowerCase(), vector: d.vectorString || '', version: ver };
  }
  return null;
}

async function fetchCves(vendor, product, since, until) {
  const out = [];
  let start = 0;
  for (;;) {
    const data = await nvdGet('cves/2.0', {
      virtualMatchString: `cpe:2.3:*:${vendor}:${product || '*'}`,
      lastModStartDate: nvdDate(since), lastModEndDate: nvdDate(until),
      resultsPerPage: '2000', startIndex: String(start),
    });
    for (const v of data.vulnerabilities || []) if (v.cve && v.cve.vulnStatus !== 'Rejected') out.push(v.cve);
    start += data.resultsPerPage || 0;
    if (!data.resultsPerPage || start >= (data.totalResults || 0) || start > 10000) break;
    await pause();
  }
  return out;
}

/** Corre os fabricantes vigiados indicados; agrupa por fabricante/produto para poupar pedidos ao NVD. */
async function runWatches(base44, allWatches) {
  const db = base44.asServiceRole.entities;
  // Só os clientes com o módulo «cve_monitoring» na licença efetiva.
  const allowed = {};
  for (const id of [...new Set(allWatches.map((w) => w.customer_id))]) {
    const ent = await getEntitlements(base44, id).catch(() => null);
    allowed[id] = Boolean(ent?.effective && ent.modules.includes('cve_monitoring'));
  }
  const watches = allWatches.filter((w) => allowed[w.customer_id]);
  const now = new Date();
  const groups = {};
  for (const w of watches) (groups[`${w.cpe_vendor}|${w.cpe_product || ''}`] ||= []).push(w);
  const keys = Object.keys(groups)
    .sort((a, b) => Math.min(...groups[a].map((w) => Date.parse(w.last_checked_at || 0))) - Math.min(...groups[b].map((w) => Date.parse(w.last_checked_at || 0))))
    .slice(0, MAX_GROUPS_PER_RUN);
  const known = {}; // customer_id → Set(cve_id)
  const created = {}; // customer_id → alerts
  let errors = 0;

  for (const [i, key] of keys.entries()) {
    const list = groups[key];
    const sinceOf = (w) => new Date(Math.max(w.last_checked_at ? Date.parse(w.last_checked_at) - days(1) : now - days(FIRST_RUN_DAYS), now - days(MAX_WINDOW_DAYS)));
    const since = new Date(Math.min(...list.map((w) => sinceOf(w).getTime())));
    const [vendor, product] = key.split('|');
    let cves = [];
    try {
      if (i > 0) await pause();
      cves = await fetchCves(vendor, product, since, now);
    } catch (e) {
      errors += 1;
      for (const w of list) await db.CveWatch.update(w.id, { last_error: str(e?.message, 300) }).catch(() => null);
      continue;
    }
    for (const w of list) {
      const wSince = sinceOf(w).getTime();
      if (!known[w.customer_id]) {
        const prev = await db.CveAlert.filter({ customer_id: w.customer_id }, '-created_date', 10000);
        known[w.customer_id] = new Set(prev.map((a) => a.cve_id));
      }
      for (const c of cves) {
        const s = cvssOf(c);
        if (!s || !RANK[s.severity] || RANK[s.severity] < RANK[w.min_severity || 'critical']) continue;
        // Emissão recente (com margem para a análise tardia do NVD) ou entrada recente no catálogo KEV da CISA.
        const recent = Date.parse(c.published) >= wSince - days(30);
        const kevNew = c.cisaExploitAdd && Date.parse(c.cisaExploitAdd) >= wSince - days(1);
        if (!recent && !kevNew) continue;
        if (known[w.customer_id].has(c.id)) continue;
        known[w.customer_id].add(c.id);
        const desc = (c.descriptions || []).find((d) => d.lang === 'en')?.value || '';
        const alert = await db.CveAlert.create({
          customer_id: w.customer_id, watch_id: w.id, cve_id: c.id, severity: s.severity, cvss_score: s.score,
          cvss_version: s.version, cvss_vector: str(s.vector, 200), published: c.published, last_modified: c.lastModified,
          description: str(desc, 4000), manufacturer: w.manufacturer || vendor, cpe_vendor: vendor, cpe_product: product || '',
          asset_codes: w.asset_codes || [], kev: Boolean(c.cisaExploitAdd), ...(c.cisaExploitAdd ? { kev_added: c.cisaExploitAdd } : {}),
          references: (c.references || []).map((r) => str(r.url, 500)).filter((u) => /^https:\/\//.test(u)).slice(0, 15),
          status: 'new',
        }).catch(() => null);
        if (alert) (created[w.customer_id] ||= []).push({ alert, watch: w });
      }
      await db.CveWatch.update(w.id, { last_checked_at: now.toISOString(), last_error: '' }).catch(() => null);
    }
  }

  // Notificações: uma por cliente e por execução.
  for (const [customerId, items] of Object.entries(created)) {
    const customer = await db.Customer.get(customerId).catch(() => null);
    const recipients = (await db.User.filter({ customer_id: customerId }).catch(() => [])).filter((u) => u.role === 'customer_admin');
    const crit = items.filter((x) => x.alert.severity === 'critical').length;
    const kev = items.filter((x) => x.alert.kev).length;
    const top = items.slice().sort((a, b) => (b.alert.cvss_score || 0) - (a.alert.cvss_score || 0)).slice(0, 5)
      .map((x) => `${x.alert.cve_id} (${x.alert.cvss_score}, ${x.alert.manufacturer})`).join(', ');
    const title = `${items.length} CVE novo(s) nos fabricantes vigiados`;
    const message = `${crit} crítico(s)${kev ? `, ${kev} com exploração ativa conhecida (CISA KEV)` : ''}: ${top}`;
    for (const u of recipients) {
      await db.Notification.create({ user_email: u.email, customer_id: customerId, title, message, link: '/assets?tab=cve', entity_type: 'CveAlert', type: 'general', is_read: false }).catch(() => null);
      if (items.some((x) => x.watch.notify_email !== false)) {
        await sendMail(base44, {
          to: u.email,
          subject: `[AnkoraOne] ${title}${customer?.name ? ` — ${customer.name}` : ''}`,
          body: `${message}\n\nVeja os alertas em Ativos e ferramentas → Alertas CVE. Fonte: NVD (NIST).`,
        }).catch(() => null);
      }
    }
    await logAudit(base44, 'cve_alerts_created', { user_email: 'system', customer_id: customerId, entity_type: 'CveAlert', details: `${title}: ${message}`.slice(0, 1000) });
  }
  const total = Object.values(created).reduce((n, l) => n + l.length, 0);
  return { groups: keys.length, pending_groups: Object.keys(groups).length - keys.length, alerts: total, errors };
}

function cleanWatch(input, assetsByCode) {
  const vendor = String(input.cpe_vendor || '').trim().toLowerCase();
  const product = String(input.cpe_product || '').trim().toLowerCase();
  if (!CPE_PART.test(vendor)) throw new Error('Fabricante CPE inválido');
  if (product && !CPE_PART.test(product)) throw new Error('Produto CPE inválido');
  const codes = (Array.isArray(input.asset_codes) ? input.asset_codes : []).map((c) => String(c).trim()).filter((c) => assetsByCode.has(c)).slice(0, 1000);
  return {
    manufacturer: str(input.manufacturer || vendor, 200), cpe_vendor: vendor, cpe_product: product,
    min_severity: input.min_severity === 'high' ? 'high' : 'critical', asset_codes: codes,
    enabled: input.enabled !== false, notify_email: input.notify_email !== false,
  };
}

const severityToVuln = (s) => (s === 'critical' ? 'critical' : 'high');
const dueDate = (sev) => { const d = new Date(); d.setDate(d.getDate() + (sev === 'critical' ? 7 : 30)); return d.toISOString().slice(0, 10); };

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await readJson(req);

    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const admin = isPlatformAdmin(user);

    // Sem ação indicada, o workflow agendado pede a verificação de todos os clientes.
    // A identidade que ele traz (proprietário da app, administrador) é a autorização —
    // nenhum segredo fica escrito no ficheiro do workflow.
    if (!body.action) {
      if (!admin) return json({ error: 'Forbidden' }, 403);
      const watches = await base44.asServiceRole.entities.CveWatch.filter({ enabled: true }, 'last_checked_at', 5000);
      return json(await runWatches(base44, watches));
    }
    if (!admin && user.role !== 'customer_admin') return json({ error: 'Forbidden' }, 403);
    const action = body.action;
    const db = base44.asServiceRole.entities;
    if (!admin) await requireModule(base44, user, userCustomerId(user), 'cve_monitoring');

    if (action === 'suggest') {
      const keyword = str(body.keyword, 80).trim();
      if (keyword.length < 2) return json({ items: [] });
      const data = await nvdGet('cpes/2.0', { keywordSearch: keyword, resultsPerPage: '500' });
      const seen = {};
      for (const p of data.products || []) {
        const parts = String(p.cpe?.cpeName || '').split(':');
        if (parts.length < 5) continue;
        const k = `${parts[3]}|${parts[4]}`;
        seen[k] ||= { cpe_vendor: parts[3], cpe_product: parts[4], title: (p.cpe.titles || [])[0]?.title || '', count: 0 };
        seen[k].count += 1;
      }
      const items = Object.values(seen).sort((a, b) => b.count - a.count).slice(0, 60);
      const vendors = [...new Set(items.map((i) => i.cpe_vendor))];
      return json({ items, vendors, hint: normVendor(keyword) });
    }

    if (action === 'run_all') {
      if (!admin) return json({ error: 'Forbidden' }, 403);
      const watches = await db.CveWatch.filter({ enabled: true }, 'last_checked_at', 5000);
      return json(await runWatches(base44, watches));
    }

    const own = userCustomerId(user);
    const resolveCustomer = (requested) => {
      const id = admin ? String(requested || own || '') : own;
      if (!id) throw new Error('Sem cliente associado');
      if (!admin && requested && requested !== own) throw new Error('Forbidden');
      return id;
    };
    const ownedRecord = async (ent, id) => {
      const rec = id ? await db[ent].get(String(id)).catch(() => null) : null;
      if (!rec || (!admin && rec.customer_id !== own)) throw new Error('Registo inexistente');
      return rec;
    };

    if (action === 'save_watch') {
      const prev = body.id ? await ownedRecord('CveWatch', body.id) : null;
      const customerId = prev ? prev.customer_id : resolveCustomer(body.customer_id);
      const assets = await db.Asset.filter({ customer_id: customerId }, 'asset_code', 10000);
      const data = cleanWatch(body.watch || {}, new Set(assets.map((a) => a.asset_code)));
      const dup = await db.CveWatch.filter({ customer_id: customerId, cpe_vendor: data.cpe_vendor, cpe_product: data.cpe_product });
      if (dup.some((w) => w.id !== prev?.id)) return json({ error: 'Este fabricante/produto já está a ser vigiado' }, 409);
      const rec = prev ? await db.CveWatch.update(prev.id, data) : await db.CveWatch.create({ ...data, customer_id: customerId });
      await logAudit(base44, prev ? 'cve_watch_updated' : 'cve_watch_created', { user_email: user.email, customer_id: customerId, entity_type: 'CveWatch', entity_id: rec.id, details: `${data.cpe_vendor}:${data.cpe_product || '*'} (≥ ${data.min_severity})` });
      return json({ watch: rec });
    }

    if (action === 'delete_watch') {
      const prev = await ownedRecord('CveWatch', body.id);
      await db.CveWatch.delete(prev.id);
      await logAudit(base44, 'cve_watch_deleted', { user_email: user.email, customer_id: prev.customer_id, entity_type: 'CveWatch', entity_id: prev.id, details: `${prev.cpe_vendor}:${prev.cpe_product || '*'}` });
      return json({ success: true });
    }

    if (action === 'check') {
      const customerId = resolveCustomer(body.customer_id);
      const watches = (await db.CveWatch.filter({ customer_id: customerId, enabled: true }, 'last_checked_at', 200)).slice(0, 8);
      return json(await runWatches(base44, watches));
    }

    if (action === 'set_alert') {
      const a = await ownedRecord('CveAlert', body.id);
      if (!['acknowledged', 'dismissed', 'new'].includes(body.status)) return json({ error: 'Estado inválido' }, 400);
      const rec = await db.CveAlert.update(a.id, { status: body.status, handled_by: user.email, handled_at: new Date().toISOString() });
      return json({ alert: rec });
    }

    if (action === 'convert') {
      const a = await ownedRecord('CveAlert', body.id);
      if (a.vulnerability_id) return json({ error: 'Alerta já convertido', vulnerability_id: a.vulnerability_id }, 409);
      const customer = await db.Customer.get(a.customer_id).catch(() => null);
      const assets = await db.Asset.filter({ customer_id: a.customer_id }, 'asset_code', 10000);
      const byCode = Object.fromEntries(assets.map((x) => [x.asset_code, x]));
      const affected = (a.asset_codes || []).map((c) => (byCode[c] ? `${c} ${byCode[c].name}${byCode[c].model_version ? ` (${byCode[c].model_version})` : ''}` : c));
      const sev = severityToVuln(a.severity);
      const v = await db.Vulnerability.create({
        customer_id: a.customer_id, customer_name: customer?.name || '',
        title: `${a.cve_id} — ${a.manufacturer}${a.cpe_product ? ` ${a.cpe_product}` : ''}`,
        description: `${a.description}\n\nFonte: NVD (NIST). Confirmar se a versão instalada está afetada.`.slice(0, 5000),
        severity: sev, cve_id: a.cve_id, cvss_score: a.cvss_score, cvss_vector: a.cvss_vector, status: 'open',
        affected_asset: affected.join('; ').slice(0, 1000),
        discovered_date: new Date().toISOString().slice(0, 10), discovered_by: 'Monitorização CVE (NVD)',
        due_date: dueDate(sev), exploit_available: Boolean(a.kev), patch_available: false,
        references: [`https://nvd.nist.gov/vuln/detail/${a.cve_id}`, ...(a.references || [])].slice(0, 15),
      });
      await db.CveAlert.update(a.id, { status: 'converted', vulnerability_id: v.id, handled_by: user.email, handled_at: new Date().toISOString() });
      await logAudit(base44, 'cve_alert_converted', { user_email: user.email, customer_id: a.customer_id, entity_type: 'Vulnerability', entity_id: v.id, details: `${a.cve_id} registado como vulnerabilidade (${sev})` });
      return json({ vulnerability: v });
    }

    return json({ error: 'Ação desconhecida' }, 400);
  } catch (error) {
    const msg = error?.message || 'Erro';
    return json({ error: msg }, error instanceof LicenseError ? error.status : msg === 'Forbidden' ? 403 : 400);
  }
}