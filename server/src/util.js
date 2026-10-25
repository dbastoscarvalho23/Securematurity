// Utilitários partilhados.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export class HttpError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/** Identificador no formato usado pela Base44 (24 caracteres hexadecimais). */
export const newId = () => crypto.randomBytes(12).toString('hex');

export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

/** Remove comentários e vírgulas finais de JSONC, respeitando strings. */
export function parseJsonc(text) {
  let out = '';
  let i = 0;
  let inString = false;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\') { out += next ?? ''; i += 2; continue; }
      if (ch === '"') inString = false;
      i += 1;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; i += 1; continue; }
    if (ch === '/' && next === '/') { while (i < text.length && text[i] !== '\n') i += 1; continue; }
    if (ch === '/' && next === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1; i += 2; continue; }
    out += ch;
    i += 1;
  }
  // Vírgulas finais antes de } ou ] (fora de strings — já não existem comentários).
  out = out.replace(/,(\s*[}\]])/g, (m, g, offset) => (isInsideString(out, offset) ? m : g));
  return JSON.parse(out);
}

function isInsideString(text, offset) {
  let inString = false;
  for (let i = 0; i < offset; i += 1) {
    if (text[i] === '\\' && inString) { i += 1; continue; }
    if (text[i] === '"') inString = !inString;
  }
  return inString;
}

export function readJsoncDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.jsonc') || f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: f, data: parseJsonc(fs.readFileSync(path.join(dir, f), 'utf8')) }));
}

export const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function getPath(obj, dotted) {
  return String(dotted).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

/** Comparação de tempo constante entre strings. */
export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Limitador de tentativas em memória (janela deslizante simples). */
export function createRateLimiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref();
  return (key) => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  };
}
