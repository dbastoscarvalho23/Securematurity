import { invokeFn } from '@/lib/invokeFn';

/** Chamadas à função «cveMonitor» (fonte: NVD do NIST). Ao NVD só seguem nomes de fabricante/produto. */
const call = (payload) => invokeFn('cveMonitor', payload);

export const suggestCpe = (keyword) => call({ action: 'suggest', keyword });
export const saveWatch = (customerId, watch, id) => call({ action: 'save_watch', customer_id: customerId, id, watch });
export const deleteWatch = (id) => call({ action: 'delete_watch', id });
export const checkNow = (customerId) => call({ action: 'check', customer_id: customerId });
export const setAlertStatus = (id, status) => call({ action: 'set_alert', id, status });
export const convertAlert = (id) => call({ action: 'convert', id });

export const OPEN_ALERT = ['new', 'acknowledged'];
export const nvdUrl = (cve) => `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cve)}`;

/** Fabricantes distintos do inventário (ativos em uso), com os respetivos ativos. */
export function manufacturersOf(assets) {
  const out = {};
  for (const a of assets) {
    if (a.lifecycle === 'retired') continue;
    const name = String(a.manufacturer || '').trim();
    if (!name) continue;
    const k = name.toLowerCase();
    (out[k] ||= { name, assets: [] }).assets.push(a);
  }
  return Object.values(out).sort((x, y) => y.assets.length - x.assets.length || x.name.localeCompare(y.name));
}

/** Sugestão inicial do nome CPE a partir do nome do fabricante (ex.: «Fortinet, Inc.» → fortinet). */
export const guessCpeVendor = (name) => String(name || '').trim().toLowerCase()
  .replace(/[,.]?\s+(inc|ltd|llc|gmbh|corp|corporation|co|s\.?a|lda|ag|bv|plc)\.?$/i, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
