// Router HTTP mínimo sobre node:http (sem dependências externas).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { config } from './config.js';
import { HttpError } from './util.js';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf', '.map': 'application/json',
};

export class Router {
  constructor() { this.routes = []; }

  add(method, pattern, handler) {
    const keys = [];
    const regex = new RegExp(`^${pattern.replace(/\/:([A-Za-z_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; })}/?$`);
    this.routes.push({ method, regex, keys, handler });
  }

  get(p, h) { this.add('GET', p, h); }
  post(p, h) { this.add('POST', p, h); }
  put(p, h) { this.add('PUT', p, h); }
  patch(p, h) { this.add('PATCH', p, h); }
  delete(p, h) { this.add('DELETE', p, h); }

  match(method, pathname) {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = pathname.match(r.regex);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method && !(method === 'HEAD' && r.method === 'GET')) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { route: r, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Pedido demasiado grande');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Converte o pedido Node num Request Web (usado para multipart e para as funções). */
export function toWebRequest(req, url, bodyStream = true) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x)); else if (v !== undefined) headers.set(k, v);
  }
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody && bodyStream ? Readable.toWeb(req) : undefined,
    duplex: 'half',
  });
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin || !config.corsOrigins.length) return;
  if (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Automation-Secret');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
}

export function sendJson(res, status, body) {
  if (res.headersSent) return;
  const payload = JSON.stringify(body ?? null);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(payload);
}

function serveStatic(req, res, pathname) {
  if (!config.staticDir) return false;
  if (!['GET', 'HEAD'].includes(req.method)) return false;
  const root = config.staticDir;
  let file = path.normalize(path.join(root, decodeURIComponent(pathname)));
  if (!file.startsWith(root)) return false;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (path.extname(pathname)) return false; // ficheiro em falta -> 404
    file = path.join(root, 'index.html'); // SPA: todas as rotas servem index.html
    if (!fs.existsSync(file)) return false;
  }
  const ext = path.extname(file);
  const immutable = pathname.startsWith('/assets/');
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (req.method === 'HEAD') return res.end(), true;
  fs.createReadStream(file).pipe(res);
  return true;
}

/**
 * Cria o servidor. Cada handler recebe ctx = { req, res, url, params, query, body(), json(), user, ... }.
 * Se devolver um valor (≠ undefined), é enviado como JSON 200.
 */
export function createServer(router, { authenticate }) {
  return http.createServer(async (req, res) => {
    setSecurityHeaders(res);
    applyCors(req, res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const url = new URL(req.url, 'http://localhost');
    let pathname = url.pathname;
    const isApi = pathname === '/api' || pathname.startsWith('/api/');
    if (!isApi) {
      if (serveStatic(req, res, pathname)) return;
      return sendJson(res, 404, { message: 'Não encontrado' });
    }
    pathname = pathname.slice(4) || '/';

    const found = router.match(req.method, pathname);
    if (!found) return sendJson(res, 404, { message: `Rota não encontrada: ${req.method} ${url.pathname}` });
    if (found.methodNotAllowed) return sendJson(res, 405, { message: 'Método não permitido' });

    let bodyBuffer = null;
    const ctx = {
      req, res, url, params: found.params,
      query: Object.fromEntries(url.searchParams),
      ip: (config.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress,
      async buffer(limit = config.maxBodyBytes) {
        if (!bodyBuffer) bodyBuffer = await readBody(req, limit);
        return bodyBuffer;
      },
      async json() {
        const buf = await ctx.buffer();
        if (!buf.length) return {};
        try { return JSON.parse(buf.toString('utf8')); } catch { throw new HttpError(400, 'JSON inválido'); }
      },
      webRequest() { return toWebRequest(req, `${config.apiPublicUrl}${pathname}${url.search}`); },
    };

    try {
      ctx.auth = await authenticate(req);
      ctx.user = ctx.auth?.user || null;
      const result = await found.route.handler(ctx);
      if (result !== undefined && !res.headersSent) sendJson(res, 200, result);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : (Number.isInteger(err?.status) ? err.status : 500);
      if (status >= 500) console.error(`[http] ${req.method} ${url.pathname}:`, err);
      if (!res.headersSent) {
        sendJson(res, status, {
          message: status >= 500 && config.isProduction ? 'Erro interno do servidor' : err.message,
          ...(err.data ? { data: err.data } : {}),
        });
      } else {
        res.end();
      }
    }
  });
}
