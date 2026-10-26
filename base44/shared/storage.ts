import { secrets } from "base44:runtime";
import { parsePropfind } from "./webdavXml.ts";

/**
 * Repositório documental por cliente (tenant).
 *
 * Todos os ficheiros ficam PRIVADOS: nada aqui cria partilhas públicas nem links «qualquer pessoa com o link».
 * Os ficheiros só são lidos pelas funções `files` e `evidence`, depois de confirmarem que quem pede pertence ao
 * cliente do ficheiro.
 *
 *   base44       – armazenamento privado da plataforma (UploadPrivateFile / CreateFileSignedUrl); sem pastas reais,
 *                  a pasta fica registada no campo `folder` do registo
 *   google_drive – a ligação Google Drive da plataforma (conta da empresa), pasta <localização>/<pasta>
 *   one_drive    – a ligação OneDrive da plataforma (conta da empresa), pasta <localização>/<pasta>
 *   webdav       – o NAS / Nextcloud do próprio cliente sobre HTTPS (WebDAV), <pasta base>/<localização>/<pasta>;
 *                  credenciais em StorageConnection com a palavra-passe cifrada (AES-GCM, STORAGE_ENCRYPTION_KEY)
 *
 * Localização: `Customer.storage_root` (ex.: «AnkoraOne/Neora Consulting»); vazio = ROOT/folderFor(cliente).
 * Mudar de repositório ou de localização só afeta os ficheiros novos: os antigos guardam a referência absoluta
 * (id no Drive/OneDrive, caminho completo no NAS) e continuam a abrir onde estão.
 *
 * FTP simples não é suportado de propósito: envia credenciais e ficheiros sem cifra.
 */

export const PROVIDERS = ["base44", "google_drive", "one_drive", "webdav"];
export const MAX_EXTERNAL_BYTES = 8 * 1024 * 1024; // tamanho máximo de pedido/resposta nos repositórios externos
export const ROOT = "AnkoraOne";

// ── Estrutura de pastas (igual para todos os clientes) ───────────────────────
// Manter igual a REPOSITORY_FOLDERS e CONTEXT_FOLDER em src/lib/repository.js (o teste repository.test.js compara).
// «00 Por classificar» (inbox): documentos carregados para classificação (função documentIntake), antes de serem
// indexados como evidência.

export const REPOSITORY_FOLDERS = [
  { key: "inbox", label: "00 Por classificar" },
  { key: "framing", label: "01 Enquadramento" },
  { key: "security_docs", label: "02 Documentos de segurança" },
  { key: "evidence", label: "03 Evidências" },
  { key: "assessments", label: "04 Avaliações" },
  { key: "risks", label: "05 Riscos" },
  { key: "incidents", label: "06 Incidentes" },
  { key: "suppliers", label: "07 Fornecedores" },
  { key: "assets", label: "08 Ativos (restrito)" },
  { key: "training", label: "09 Formação" },
  { key: "reports", label: "10 Relatórios" },
  { key: "ai_drafts", label: "11 Rascunhos de IA aprovados" },
  { key: "other", label: "99 Outros" },
];
const FOLDER_BY_KEY = Object.fromEntries(REPOSITORY_FOLDERS.map((f) => [f.key, f.label]));

/** Nome da pasta (ex.: «03 Evidências») para uma chave; chaves desconhecidas vão para «99 Outros». */
export function folderLabel(key) {
  return FOLDER_BY_KEY[key] || FOLDER_BY_KEY.other;
}

/** Contexto de um ficheiro guardado pela função `files` (StoredFile.context) → pasta. */
export const CONTEXT_FOLDER = {
  qualification: "framing",
  security_document: "security_docs",
  document_version: "security_docs",
  nomination: "security_docs",
  assessment: "assessments",
  risk: "risks",
  incident: "incidents",
  supplier: "suppliers",
  asset: "assets",
  training: "training",
  report: "reports",
  ai_draft: "ai_drafts",
  intake: "inbox",
  task: "other",
  comment: "other",
  framework: "other",
  other: "other",
};

/**
 * Pasta de uma evidência, pelas ligações: ativos/componentes → 08 (restrito); incidente → 06; fornecedor → 07;
 * restantes (medidas, controlos, perguntas, jornada, tarefas, vulnerabilidades) → 03. `hint` só aceita «framing»
 * (relatório de enquadramento) e nunca tira uma evidência restrita da pasta 08.
 */
export function evidenceFolderKey(links, restricted, hint = "") {
  const types = new Set((links || []).map((l) => l?.type));
  if (restricted || types.has("asset") || types.has("component")) return "assets";
  if (hint === "framing") return "framing";
  if (types.has("incident")) return "incidents";
  if (types.has("supplier")) return "suppliers";
  return "evidence";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function safeName(name) {
  const cleaned = String(name || "ficheiro").normalize("NFKD").replace(/[^\w.\- ]+/g, "_").trim();
  return (cleaned || "ficheiro").slice(0, 150);
}

export function folderFor(customer) {
  return safeName(`${customer?.name || "cliente"}-${String(customer?.id || "").slice(-6)}`);
}

/** Como safeName, mas tira primeiro os acentos («Câmara» → «Camara», em vez de «Ca_mara»). */
export function safePathSegment(name) {
  return safeName(String(name || "").normalize("NFKD").replace(/[̀-ͯ]/g, ""));
}

export const STORAGE_ROOT_MAX_SEGMENTS = 6;
export const STORAGE_ROOT_MAX_LENGTH = 200;

/**
 * Valida e normaliza a localização escolhida para o repositório de um cliente.
 * Regras: pastas separadas por «/», cada uma limpa por safePathSegment; sem «.» nem «..»; sem pastas vazias;
 * no máximo 6 pastas e 200 caracteres. Vazio = localização por omissão. Devolve o caminho normalizado ou lança erro.
 * Manter igual a normalizeStorageRoot em src/lib/repository.js.
 */
export function normalizeStorageRoot(input) {
  const raw = String(input ?? "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!raw) return "";
  if (raw.length > STORAGE_ROOT_MAX_LENGTH) throw new Error(`A localização pode ter no máximo ${STORAGE_ROOT_MAX_LENGTH} caracteres`);
  const parts = raw.split("/").map((p) => p.trim());
  if (parts.some((p) => !p)) throw new Error("A localização não pode ter pastas vazias («//»)");
  if (parts.some((p) => /^\.+$/.test(p))) throw new Error("A localização não pode conter «.» nem «..»");
  if (parts.length > STORAGE_ROOT_MAX_SEGMENTS) throw new Error(`A localização pode ter no máximo ${STORAGE_ROOT_MAX_SEGMENTS} pastas`);
  const clean = parts.map(safePathSegment);
  if (clean.some((p) => /^\.+$/.test(p))) throw new Error("A localização não pode conter «.» nem «..»");
  const out = clean.join("/");
  if (out.length > STORAGE_ROOT_MAX_LENGTH) throw new Error(`A localização pode ter no máximo ${STORAGE_ROOT_MAX_LENGTH} caracteres`);
  return out;
}

/** Localização por omissão de um cliente: AnkoraOne/<nome>-<fim do id>. */
export function defaultStorageRoot(customer) {
  return `${ROOT}/${folderFor(customer)}`;
}

/**
 * Pastas da localização efetiva do cliente. Um valor inválido gravado diretamente na entidade (sem passar pela
 * função updateCustomerStorage) é ignorado e usa-se a localização por omissão.
 */
export function rootSegments(customer) {
  let root = "";
  try { root = normalizeStorageRoot(customer?.storage_root); } catch { root = ""; }
  return (root || defaultStorageRoot(customer)).split("/");
}

/** Caminho legível de uma pasta do cliente, ex.: «AnkoraOne/Neora Consulting/03 Evidências». */
export function storageLocation(customer, folderKey) {
  return [...rootSegments(customer), folderLabel(folderKey)].join("/");
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
  if (!PROVIDERS.includes(wanted)) return "base44";
  // Google Drive/OneDrive são contas da plataforma: sem ligação autorizada, os ficheiros ficam no armazenamento
  // nativo privado (em vez de falhar). O NAS do cliente nunca é substituído: sem configuração, o carregamento falha.
  const connector = { google_drive: "googledrive", one_drive: "one_drive" }[wanted];
  if (connector) {
    try {
      const c = await base44.asServiceRole.connectors.getConnection(connector);
      if (!c?.accessToken) return "base44";
    } catch { return "base44"; }
  }
  return wanted;
}

/**
 * Estado da ligação da plataforma ao Google Drive ou OneDrive e a conta (empresa) ligada.
 * Devolve { connected, account } — account = e-mail/nome da conta, ou '' se o serviço não o devolver.
 */
export async function connectedAccount(base44, provider) {
  const connector = { google_drive: "googledrive", one_drive: "one_drive" }[provider];
  if (!connector) return { connected: false, account: "" };
  let token = "";
  try { token = (await base44.asServiceRole.connectors.getConnection(connector))?.accessToken || ""; } catch { token = ""; }
  if (!token) return { connected: false, account: "" };
  try {
    const headers = { Authorization: `Bearer ${token}` };
    if (provider === "google_drive") {
      const r = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)", { headers });
      const d = r.ok ? await r.json() : null;
      return { connected: true, account: String(d?.user?.emailAddress || d?.user?.displayName || "") };
    }
    const r = await fetch("https://graph.microsoft.com/v1.0/me?$select=userPrincipalName,mail,displayName", { headers });
    const d = r.ok ? await r.json() : null;
    return { connected: true, account: String(d?.mail || d?.userPrincipalName || d?.displayName || "") };
  } catch {
    return { connected: true, account: "" };
  }
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

/**
 * Guarda bytes no repositório do cliente, na pasta `folder` (chave de REPOSITORY_FOLDERS).
 * `customer` tem de ser o cliente DO REGISTO a que o ficheiro pertence, nunca o de quem carrega.
 * Devolve { provider, ref, folder (nome da pasta), location (caminho; vazio no armazenamento da plataforma) }.
 */
export async function putFile(base44, customer, provider, { bytes, fileName, mimeType, folder = "other" }) {
  const name = `${Date.now()}-${safeName(fileName)}`;
  const label = folderLabel(folder);
  const segments = [...rootSegments(customer), label];
  const location = segments.join("/");

  if (provider === "base44") {
    const file = new File([bytes], name, { type: mimeType || "application/octet-stream" });
    const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });
    if (!file_uri) throw new Error("Falha no armazenamento privado");
    return { provider, ref: file_uri, folder: label, location: "" };
  }

  if (provider === "google_drive") {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googledrive");
    const auth = { Authorization: `Bearer ${accessToken}` };
    const ensure = async (fname, parent) => {
      const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${fname.replace(/'/g, "\\'")}' and trashed=false` + (parent ? ` and '${parent}' in parents` : ""));
      const l = await (await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, { headers: auth })).json();
      if (l.files?.length) return l.files[0].id;
      const c = await (await fetch("https://www.googleapis.com/drive/v3/files", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ name: fname, mimeType: "application/vnd.google-apps.folder", ...(parent ? { parents: [parent] } : {}) }) })).json();
      if (!c?.id) throw new Error("Não foi possível criar a pasta no Google Drive");
      return c.id;
    };
    let sub = null;
    for (const seg of segments) sub = await ensure(seg, sub);
    const boundary = `ankoraone-${crypto.randomUUID()}`;
    const enc = new TextEncoder();
    const head = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, mimeType, parents: [sub] })}\r\n--${boundary}\r\nContent-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`);
    const tail = enc.encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(head.length + bytes.byteLength + tail.length);
    body.set(head, 0); body.set(new Uint8Array(bytes), head.length); body.set(tail, head.length + bytes.byteLength);
    const up = await (await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", headers: { ...auth, "Content-Type": `multipart/related; boundary=${boundary}` }, body })).json();
    if (!up?.id) throw new Error("Falha no envio para o Google Drive");
    return { provider, ref: up.id, folder: label, location }; // sem permissões de partilha: fica privado na conta ligada
  }

  if (provider === "one_drive") {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("one_drive");
    const path = [...segments, name].map(encodeURIComponent).join("/");
    const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/content`, { method: "PUT", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": mimeType || "application/octet-stream" }, body: bytes });
    const item = await r.json().catch(() => null);
    if (!r.ok || !item?.id) throw new Error("Falha no envio para o OneDrive");
    return { provider, ref: item.id, folder: label, location }; // não é criado nenhum link de partilha
  }

  if (provider === "webdav") {
    const { base, auth, basePath } = await webdavConfig(base44, customer.id);
    let acc = basePath;
    for (const seg of segments) {
      acc = acc ? `${acc}/${seg}` : seg;
      await davMkcol(davUrl(base, acc) + "/", auth);
    }
    const rel = `${acc}/${name}`;
    const r = await fetch(davUrl(base, rel), { method: "PUT", headers: { Authorization: auth, "Content-Type": mimeType || "application/octet-stream" }, body: bytes, redirect: "error" });
    if (!r.ok) throw new Error(`Falha no envio para o NAS (${r.status})`);
    // ref = caminho completo a partir do URL do NAS: continua válido se a localização mudar depois.
    return { provider, ref: rel, folder: label, location: acc };
  }

  throw new Error("Repositório não suportado");
}

/**
 * Lista os ficheiros de uma pasta do repositório externo do cliente (Google Drive, OneDrive ou NAS), sem criar
 * pastas nem alterar nada. O repositório da plataforma não tem pastas reais: devolve lista vazia.
 * Devolve { location, files: [{ ref, name, size, mimeType }] }; `ref` tem o mesmo formato que putFile devolve,
 * para poder ser lido com getFile. Subpastas e documentos nativos do Google (sem conteúdo binário) ficam de fora,
 * e são contados em `ignored`.
 */
export async function listFolder(base44, customer, provider, folder = "inbox", max = 500) {
  const segments = [...rootSegments(customer), folderLabel(folder)];
  const location = segments.join("/");
  const files = [];
  let ignored = 0;

  if (provider === "google_drive") {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googledrive");
    const auth = { Authorization: `Bearer ${accessToken}` };
    const q = (s) => encodeURIComponent(s);
    let parent = null;
    for (const seg of segments) {
      const cond = `mimeType='application/vnd.google-apps.folder' and name='${seg.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}' and trashed=false` + (parent ? ` and '${parent}' in parents` : "");
      const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q(cond)}&fields=files(id)`, { headers: auth });
      if (!r.ok) throw new Error(`Não foi possível ler o Google Drive (${r.status})`);
      const l = await r.json();
      if (!l.files?.length) return { location, files, ignored };
      parent = l.files[0].id;
    }
    let pageToken = "";
    do {
      const cond = `'${parent}' in parents and trashed=false`;
      const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q(cond)}&pageSize=200&fields=nextPageToken,files(id,name,size,mimeType)${pageToken ? `&pageToken=${q(pageToken)}` : ""}`, { headers: auth });
      if (!r.ok) throw new Error(`Não foi possível ler o Google Drive (${r.status})`);
      const l = await r.json();
      for (const f of l.files || []) {
        if (String(f.mimeType || "").startsWith("application/vnd.google-apps.")) { ignored += 1; continue; }
        files.push({ ref: f.id, name: String(f.name || ""), size: Number(f.size || 0), mimeType: String(f.mimeType || "") });
      }
      pageToken = l.nextPageToken || "";
    } while (pageToken && files.length < max);
    return { location, files: files.slice(0, max), ignored };
  }

  if (provider === "one_drive") {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("one_drive");
    const path = segments.map(encodeURIComponent).join("/");
    let url = `https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/children?$select=id,name,size,file,folder&$top=200`;
    while (url && files.length < max) {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (r.status === 404) return { location, files, ignored };
      if (!r.ok) throw new Error(`Não foi possível ler o OneDrive (${r.status})`);
      const d = await r.json();
      for (const it of d.value || []) {
        if (!it.file) { ignored += 1; continue; }
        files.push({ ref: it.id, name: String(it.name || ""), size: Number(it.size || 0), mimeType: String(it.file?.mimeType || "") });
      }
      url = d["@odata.nextLink"] || "";
    }
    return { location, files: files.slice(0, max), ignored };
  }

  if (provider === "webdav") {
    const { base, auth, basePath } = await webdavConfig(base44, customer.id);
    const acc = [basePath, ...segments].filter(Boolean).join("/");
    const r = await fetch(davUrl(base, acc) + "/", { method: "PROPFIND", headers: { Authorization: auth, Depth: "1", "Content-Type": "application/xml" }, redirect: "error" });
    if (r.status === 404) return { location: acc, files, ignored };
    if (!(r.status === 207 || r.ok)) throw new Error(`Não foi possível ler o NAS (${r.status})`);
    const xml = await r.text();
    for (const e of parsePropfind(xml)) {
      if (e.collection) { ignored += e.self ? 0 : 1; continue; }
      if (!e.name) continue;
      files.push({ ref: `${acc}/${e.name}`, name: e.name, size: e.size, mimeType: e.mimeType });
      if (files.length >= max) break;
    }
    return { location: acc, files, ignored };
  }

  return { location: "", files, ignored };
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


