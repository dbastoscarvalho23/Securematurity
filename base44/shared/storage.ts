import { secrets } from "base44:runtime";

/**
 * Per-customer evidence repositories.
 *
 * Every file is kept PRIVATE: nothing here creates public or "anyone with the link"
 * shares. Files are read back only through the `evidence` function, after it has
 * checked that the caller belongs to the file's customer.
 *
 *   base44       – Base44 private storage (UploadPrivateFile / CreateFileSignedUrl)
 *   google_drive – the platform's Google Drive connection, folder AnkoraOne/<customer>
 *   one_drive    – the platform's OneDrive connection, folder AnkoraOne/<customer>
 *   webdav       – the customer's own NAS / Nextcloud over HTTPS (WebDAV), credentials in
 *                  StorageConnection with the password encrypted (AES-GCM, STORAGE_ENCRYPTION_KEY)
 *
 * Plain FTP is deliberately not supported: it sends credentials and files unencrypted.
 */

export const PROVIDERS = ["base44", "google_drive", "one_drive", "webdav"];
export const MAX_EXTERNAL_BYTES = 8 * 1024 * 1024; // request/response size used for external repositories
const ROOT = "AnkoraOne";

// ── Helpers ──────────────────────────────────────────────────────────────────

export function safeName(name) {
  const cleaned = String(name || "ficheiro").normalize("NFKD").replace(/[^\w.\- ]+/g, "_").trim();
  return (cleaned || "ficheiro").slice(0, 150);
}

export function folderFor(customer) {
  return safeName(`${customer?.name || "cliente"}-${String(customer?.id || "").slice(-6)}`);
}

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function toBase64(bytes) {
  const u8 = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64) {
  const bin = atob(String(b64 || ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── Encryption of repository credentials ─────────────────────────────────────

async function encryptionKey() {
  const raw = secrets.get("STORAGE_ENCRYPTION_KEY");
  if (!raw || String(raw).length < 32) throw new Error("STORAGE_ENCRYPTION_KEY não configurada (mínimo 32 caracteres)");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(raw)));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(String(plain)));
  return `v1:${toBase64(iv)}:${toBase64(ct)}`;
}

export async function decryptSecret(enc) {
  const [v, ivB64, ctB64] = String(enc || "").split(":");
  if (v !== "v1") throw new Error("Credencial em formato desconhecido");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(ivB64) }, await encryptionKey(), fromBase64(ctB64));
  return new TextDecoder().decode(pt);
}

// ── SSRF guard for customer-supplied WebDAV hosts ────────────────────────────

/** Expande um IPv6 para 8 grupos de 16 bits (aceita a forma com IPv4 no fim). */
function ipv6Groups(ip) {
  let h = ip.toLowerCase().split("%")[0];
  const v4 = h.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) {
    const p = v4[1].split(".").map(Number);
    h = h.slice(0, -v4[1].length) + ((p[0] << 8) | p[1]).toString(16) + ":" + ((p[2] << 8) | p[3]).toString(16);
  }
  const [head, tail] = h.includes("::") ? h.split("::") : [h, null];
  const hs = head ? head.split(":") : [];
  const ts = tail ? tail.split(":") : [];
  const fill = tail === null ? [] : Array(8 - hs.length - ts.length).fill("0");
  const g = [...hs, ...fill, ...ts].map((x) => parseInt(x || "0", 16));
  return g.length === 8 && g.every((n) => n >= 0 && n <= 0xffff) ? g : null;
}

function isPrivateV4(a, b) {
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

export function isPrivateIp(ip) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return isPrivateV4(a, b);
  }
  const g = ipv6Groups(ip);
  if (!g) return true; // formato desconhecido: recusar
  const v4of = (hi) => isPrivateV4(hi >> 8, hi & 0xff);
  if (g.slice(0, 5).every((n) => n === 0) && (g[5] === 0xffff || g[5] === 0)) return g[5] === 0 && g[6] === 0 ? true : v4of(g[6]); // ::ffff:a.b.c.d e ::a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b) return true; // NAT64
  if (g[0] === 0x2002) return true; // 6to4 (IPv4 embutido)
  if (g[0] === 0x2001 && g[1] === 0) return true; // Teredo
  if (g.every((n, i) => (i < 7 ? n === 0 : n <= 1))) return true; // :: e ::1
  return (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xff00) === 0xff00;
}

/**
 * Aceita apenas https:// para um nome DNS cujos endereços sejam todos públicos. Falha fechado: sem resolução DNS
 * disponível, ou com um IP literal no lugar do nome, o pedido é recusado. É chamada antes de cada pedido ao NAS.
 * Risco residual: entre esta verificação e a ligação do fetch, um DNS malicioso pode mudar a resposta (rebinding);
 * o endereço só pode ser configurado por um administrador da plataforma, e os redirecionamentos estão desativados.
 */
export async function assertPublicHttpsUrl(url) {
  let u;
  try { u = new URL(url); } catch { throw new Error("URL inválido"); }
  if (u.protocol !== "https:") throw new Error("O repositório tem de usar HTTPS");
  if (u.username || u.password) throw new Error("Não inclua credenciais no URL");
  if (u.port && !["443", "5006", "8443"].includes(u.port)) throw new Error("Porta não permitida (use 443, 5006 ou 8443)");
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (/^[\d.]+$/.test(host) || host.includes(":")) throw new Error("Use o nome DNS do NAS, não um endereço IP");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) throw new Error("Endereço privado não permitido");
  if (typeof Deno.resolveDns !== "function") throw new Error("Resolução DNS indisponível: ligação recusada");
  let addrs = [];
  for (const t of ["A", "AAAA"]) {
    try { addrs = addrs.concat(await Deno.resolveDns(host, t)); } catch { /* sem registos deste tipo */ }
  }
  if (!addrs.length) throw new Error("Não foi possível resolver o anfitrião");
  if (addrs.some((a) => isPrivateIp(String(a)))) throw new Error("O anfitrião resolve para um endereço privado");
  return u;
}

// ── Provider resolution ──────────────────────────────────────────────────────

export async function resolveProvider(base44, customer) {
  let enabled = null;
  try {
    const cfg = (await base44.asServiceRole.entities.StorageSettings.list())[0];
    enabled = cfg?.enabled_providers?.length ? cfg.enabled_providers : null;
  } catch { enabled = null; }
  const wanted = customer?.storage_provider || "base44";
  if (wanted === "base44") return "base44";
  if (enabled && !enabled.includes(wanted)) return "base44";
  return PROVIDERS.includes(wanted) ? wanted : "base44";
}

async function webdavConfig(base44, customerId) {
  const rows = await base44.asServiceRole.entities.StorageConnection.filter({ customer_id: customerId, provider: "webdav" });
  const cfg = rows[0];
  if (!cfg) throw new Error("Repositório NAS (WebDAV) do cliente ainda não configurado");
  const base = await assertPublicHttpsUrl(cfg.base_url);
  const password = cfg.password_enc ? await decryptSecret(cfg.password_enc) : "";
  const auth = "Basic " + btoa(`${cfg.username || ""}:${password}`);
  const basePath = String(cfg.base_path || "").replace(/^\/+|\/+$/g, "");
  return { base, auth, basePath };
}

function davUrl(base, ...parts) {
  const path = parts.filter(Boolean).map((p) => String(p).split("/").map(encodeURIComponent).join("/")).join("/");
  return new URL(path, base.href.endsWith("/") ? base.href : base.href + "/").href;
}

async function davMkcol(url, auth) {
  const r = await fetch(url, { method: "MKCOL", headers: { Authorization: auth }, redirect: "error" });
  if (![201, 405, 301].includes(r.status) && !r.ok) throw new Error(`WebDAV MKCOL falhou (${r.status})`);
}

export async function testWebdav(base44, customerId) {
  const { base, auth, basePath } = await webdavConfig(base44, customerId);
  const url = davUrl(base, basePath);
  const r = await fetch(url, { method: "PROPFIND", headers: { Authorization: auth, Depth: "0" }, redirect: "error" });
  if (r.status === 401 || r.status === 403) throw new Error("Credenciais recusadas pelo servidor");
  if (!(r.status === 207 || r.ok)) throw new Error(`Servidor respondeu ${r.status}`);
  return true;
}

// ── Put / get ────────────────────────────────────────────────────────────────

/** Stores bytes in the customer's repository. Returns { provider, ref }. */
export async function putFile(base44, customer, provider, { bytes, fileName, mimeType, subfolder = "evidencias" }) {
  const name = `${Date.now()}-${safeName(fileName)}`;
  const folder = folderFor(customer);

  if (provider === "base44") {
    const file = new File([bytes], name, { type: mimeType || "application/octet-stream" });
    const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });
    if (!file_uri) throw new Error("Falha no armazenamento privado");
    return { provider, ref: file_uri };
  }

  if (provider === "google_drive") {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googledrive");
    const auth = { Authorization: `Bearer ${accessToken}` };
    const ensure = async (fname, parent) => {
      const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${fname.replace(/'/g, "\\'")}' and trashed=false` + (parent ? ` and '${parent}' in parents` : ""));
      const l = await (await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, { headers: auth })).json();
      if (l.files?.length) return l.files[0].id;
      const c = await (await fetch("https://www.googleapis.com/drive/v3/files", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ name: fname, mimeType: "application/vnd.google-apps.folder", ...(parent ? { parents: [parent] } : {}) }) })).json();
      return c.id;
    };
    const root = await ensure(ROOT, null);
    const cust = await ensure(folder, root);
    const sub = await ensure(subfolder, cust);
    const boundary = `ankoraone-${crypto.randomUUID()}`;
    const enc = new TextEncoder();
    const head = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, mimeType, parents: [sub] })}\r\n--${boundary}\r\nContent-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`);
    const tail = enc.encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(head.length + bytes.byteLength + tail.length);
    body.set(head, 0); body.set(new Uint8Array(bytes), head.length); body.set(tail, head.length + bytes.byteLength);
    const up = await (await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", headers: { ...auth, "Content-Type": `multipart/related; boundary=${boundary}` }, body })).json();
    if (!up?.id) throw new Error("Falha no envio para o Google Drive");
    return { provider, ref: up.id }; // no sharing permission: the file stays private to the connected account
  }

  if (provider === "one_drive") {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("one_drive");
    const path = [ROOT, folder, subfolder, name].map(encodeURIComponent).join("/");
    const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/content`, { method: "PUT", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": mimeType || "application/octet-stream" }, body: bytes });
    const item = await r.json().catch(() => null);
    if (!r.ok || !item?.id) throw new Error("Falha no envio para o OneDrive");
    return { provider, ref: item.id }; // no sharing link is created
  }

  if (provider === "webdav") {
    const { base, auth, basePath } = await webdavConfig(base44, customer.id);
    let acc = basePath;
    for (const seg of [ROOT, folder, subfolder]) {
      acc = acc ? `${acc}/${seg}` : seg;
      await davMkcol(davUrl(base, acc) + "/", auth);
    }
    const rel = `${acc}/${name}`;
    const r = await fetch(davUrl(base, rel), { method: "PUT", headers: { Authorization: auth, "Content-Type": mimeType || "application/octet-stream" }, body: bytes, redirect: "error" });
    if (!r.ok) throw new Error(`Falha no envio para o NAS (${r.status})`);
    return { provider, ref: rel };
  }

  throw new Error("Repositório não suportado");
}

/** Reads a stored file. Returns { signedUrl } for Base44, or { bytes, mimeType } otherwise. */
export async function getFile(base44, customerId, provider, ref, mimeType) {
  if (provider === "base44") {
    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: ref, expires_in: 300 });
    return { signedUrl: signed_url };
  }
  let r;
  if (provider === "google_drive") {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googledrive");
    r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(ref)}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } });
  } else if (provider === "one_drive") {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("one_drive");
    r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(ref)}/content`, { headers: { Authorization: `Bearer ${accessToken}` } });
  } else if (provider === "webdav") {
    const { base, auth } = await webdavConfig(base44, customerId);
    r = await fetch(davUrl(base, ref), { headers: { Authorization: auth }, redirect: "error" });
  } else {
    throw new Error("Repositório não suportado");
  }
  if (!r.ok) throw new Error(`Não foi possível ler o ficheiro (${r.status})`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.byteLength > MAX_EXTERNAL_BYTES) throw new Error("Ficheiro demasiado grande para descarregar por esta via");
  return { bytes, mimeType: mimeType || r.headers.get("content-type") || "application/octet-stream" };
}
