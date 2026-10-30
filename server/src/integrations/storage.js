// Armazenamento de ficheiros: disco local ou S3 compatível (MinIO, AWS S3, Wasabi, Backblaze…).
// A assinatura AWS SigV4 é feita aqui para evitar dependências pesadas.
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { Readable } from 'node:stream';
import { config } from '../config.js';
import { query } from '../db.js';
import { HttpError } from '../util.js';

const KEY_RE = /^[a-f0-9]{32}(\.[a-z0-9]{1,10})?$/;

function safeExtension(filename) {
  const ext = path.extname(String(filename || '')).toLowerCase().replace(/[^a-z0-9.]/g, '');
  return ext.length > 1 && ext.length <= 11 ? ext : '';
}

export const fileUrl = (key) => `${config.apiPublicUrl}/files/${key}`;

/** Extrai a chave interna a partir de um URL devolvido por UploadFile (ou null se for externo). */
export function keyFromUrl(url) {
  const prefix = `${config.apiPublicUrl}/files/`;
  if (typeof url !== 'string') return null;
  const rel = url.startsWith(prefix) ? url.slice(prefix.length) : (url.startsWith('/api/files/') ? url.slice('/api/files/'.length) : null);
  return rel && KEY_RE.test(rel) ? rel : null;
}

// ---------------------------------------------------------------------------
// S3 SigV4
// ---------------------------------------------------------------------------

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const hashHex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const encodeRfc3986 = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

function s3Request(method, key, { body, contentType } = {}) {
  const s3 = config.storage.s3;
  if (!s3.bucket || !s3.accessKeyId || !s3.secretAccessKey) throw new HttpError(500, 'Armazenamento S3 sem configuração completa');
  const endpoint = new URL(s3.endpoint || `https://s3.${s3.region}.amazonaws.com`);
  const host = s3.forcePathStyle ? endpoint.host : `${s3.bucket}.${endpoint.host}`;
  const basePath = endpoint.pathname.replace(/\/+$/, '');
  const canonicalPath = `${basePath}${s3.forcePathStyle ? `/${encodeRfc3986(s3.bucket)}` : ''}/${key.split('/').map(encodeRfc3986).join('/')}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const payloadHash = body ? hashHex(body) : hashHex('');
  const headers = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  if (contentType) headers['content-type'] = contentType;
  const signedHeaders = Object.keys(headers).sort();
  const canonicalRequest = [method, canonicalPath, '', ...signedHeaders.map((h) => `${h}:${headers[h]}`), '', signedHeaders.join(';'), payloadHash].join('\n');
  const scope = `${date}/${s3.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, hashHex(canonicalRequest)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${s3.secretAccessKey}`, date), s3.region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${s3.accessKeyId}/${scope}, SignedHeaders=${signedHeaders.join(';')}, Signature=${signature}`;
  const { host: _h, ...sendHeaders } = headers;
  return fetch(`${endpoint.protocol}//${host}${canonicalPath}`, { method, headers: { ...sendHeaders, Authorization: authorization }, body });
}

// ---------------------------------------------------------------------------
// API pública do módulo
// ---------------------------------------------------------------------------

/** Guarda um ficheiro e devolve { key, file_url }. */
export async function putFile(buffer, { filename, contentType, createdBy, isPrivate = false } = {}) {
  const key = `${crypto.randomBytes(16).toString('hex')}${safeExtension(filename)}`;
  const type = contentType || 'application/octet-stream';
  if (config.storage.driver === 's3') {
    const res = await s3Request('PUT', key, { body: buffer, contentType: type });
    if (!res.ok) throw new HttpError(502, `Falha ao guardar no S3 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  } else {
    await fs.promises.mkdir(config.storage.localDir, { recursive: true });
    await fs.promises.writeFile(path.join(config.storage.localDir, key), buffer);
  }
  await query('INSERT INTO files (key, filename, content_type, size, created_by, private) VALUES ($1, $2, $3, $4, $5, $6)',
    [key, filename ? String(filename).slice(0, 255) : null, type, buffer.length, createdBy || null, Boolean(isPrivate)]);
  return { key, file_url: fileUrl(key) };
}

export async function getFileMeta(key) {
  if (!KEY_RE.test(key)) return null;
  const { rows } = await query('SELECT * FROM files WHERE key = $1', [key]);
  return rows[0] || null;
}

/** Devolve um stream Web com o conteúdo. */
export async function readFileStream(key) {
  if (config.storage.driver === 's3') {
    const res = await s3Request('GET', key);
    if (!res.ok) throw new HttpError(res.status === 404 ? 404 : 502, 'Ficheiro indisponível');
    return Readable.fromWeb(res.body);
  }
  const file = path.join(config.storage.localDir, key);
  if (!fs.existsSync(file)) throw new HttpError(404, 'Ficheiro não encontrado');
  return fs.createReadStream(file);
}

export async function readFileBuffer(key) {
  const stream = await readFileStream(key);
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks);
}

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:');
}

/** Bloqueia pedidos a endereços internos (proteção contra SSRF). */
async function assertPublicUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new HttpError(400, `URL inválido: ${url}`); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new HttpError(400, 'Apenas URLs http(s) são permitidos');
  const addresses = await dns.lookup(parsed.hostname, { all: true }).catch(() => []);
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new HttpError(400, `O endereço ${parsed.hostname} não é permitido`);
  }
}

/** Obtém o conteúdo de um URL — local (sem rede) ou externo. */
export async function fetchFileUrl(url) {
  const key = keyFromUrl(url);
  if (key) {
    const meta = await getFileMeta(key);
    return { buffer: await readFileBuffer(key), contentType: meta?.content_type || 'application/octet-stream', filename: meta?.filename || key };
  }
  await assertPublicUrl(url);
  const res = await fetch(url, { redirect: 'error' });
  if (!res.ok) throw new HttpError(502, `Não foi possível obter ${url} (${res.status})`);
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') || 'application/octet-stream', filename: path.basename(new URL(url).pathname) };
}

// ---------------------------------------------------------------------------
// Ficheiros privados (equivalente a UploadPrivateFile e CreateFileSignedUrl)
// ---------------------------------------------------------------------------

export const PRIVATE_PREFIX = 'private/';
const MAX_SIGNED_SECONDS = 3600;
// Chave própria, derivada do segredo JWT, para que uma assinatura de ficheiro nunca valha como token.
const signingKey = () => crypto.createHmac('sha256', config.jwtSecret).update('ankoraone:private-files').digest();
const signatureOf = (key, exp) => crypto.createHmac('sha256', signingKey()).update(`${key}.${exp}`).digest('hex');

/** Guarda um ficheiro privado e devolve { file_uri } no formato private/<chave>. */
export async function putPrivateFile(buffer, opts = {}) {
  const { key } = await putFile(buffer, { ...opts, isPrivate: true });
  return { file_uri: `${PRIVATE_PREFIX}${key}` };
}

/** Ligação temporária para um ficheiro privado (validade entre 1 s e 1 hora; 5 minutos por omissão). */
export function signedUrlFor(fileUri, expiresIn = 300, now = Date.now()) {
  const key = String(fileUri || '').startsWith(PRIVATE_PREFIX) ? String(fileUri).slice(PRIVATE_PREFIX.length) : String(fileUri || '');
  if (!KEY_RE.test(key)) throw new HttpError(400, 'file_uri inválido');
  const seconds = Math.min(Math.max(Math.floor(Number(expiresIn)) || 300, 1), MAX_SIGNED_SECONDS);
  const exp = Math.floor(now / 1000) + seconds;
  return `${fileUrl(key)}?exp=${exp}&sig=${signatureOf(key, exp)}`;
}

/** Um ficheiro público descarrega-se sempre; um privado só com assinatura válida e dentro do prazo. */
export function privateAccessAllowed(meta, searchParams, now = Date.now()) {
  if (!meta?.private) return true;
  const exp = Number(searchParams.get('exp'));
  const sig = String(searchParams.get('sig') || '');
  if (!Number.isInteger(exp) || exp < now / 1000) return false;
  const want = signatureOf(meta.key, exp);
  return sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}
