// Execução das funções de backend Base44 (base44/functions/<nome>/entry.ts) em Node.js.
//
// As funções foram escritas para Deno. Aqui:
//   - o TypeScript é executado com o "type stripping" nativo do Node (>= 22.18);
//   - 'npm:@base44/sdk@x' é redirecionado para ./sdk-shim.js;
//   - 'npm:pacote@versão' é resolvido a partir de server/node_modules;
//   - Deno.serve / Deno.env / Deno.readFile / Deno.writeFile são emulados.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import module from 'node:module';
import { pathToFileURL } from 'node:url';
import { config } from '../config.js';
import { HttpError } from '../util.js';
import { keyFromUrl, getFileMeta, readFileBuffer } from '../integrations/storage.js';

const shimUrl = new URL('./sdk-shim.js', import.meta.url).href;
const runtimeShimUrl = new URL('./runtime-shim.js', import.meta.url).href;
const serverPackageUrl = new URL('../../package.json', import.meta.url).href;

function npmSpecifierToBare(spec) {
  const rest = spec.slice(4); // sem "npm:"
  const m = rest.match(/^(@[^/]+\/[^@/]+|[^@/]+)(?:@[^/]+)?(\/.*)?$/);
  return m ? `${m[1]}${m[2] || ''}` : rest;
}

let hooksInstalled = false;
function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  if (typeof module.registerHooks !== 'function') {
    throw new Error('É necessário Node.js >= 22.15 (module.registerHooks) para executar as funções.');
  }
  module.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith('npm:@base44/sdk')) return { url: shimUrl, shortCircuit: true };
      if (specifier === 'base44:runtime') return { url: runtimeShimUrl, shortCircuit: true };
      if (specifier.startsWith('npm:')) return nextResolve(npmSpecifierToBare(specifier), { ...context, parentURL: serverPackageUrl });
      if (specifier.startsWith('jsr:')) throw new Error(`Importações jsr: não são suportadas (${specifier})`);
      return nextResolve(specifier, context);
    },
  });
}

let capturedHandler = null;

/**
 * Os ficheiros da própria aplicação são lidos diretamente do armazenamento quando uma função os
 * pede por fetch(file_url) — evita depender do acesso da API ao seu próprio endereço público.
 */
function installLocalFileFetch() {
  if (globalThis.fetch.__ankoraLocalFiles) return;
  const originalFetch = globalThis.fetch;
  const wrapped = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url;
    const key = keyFromUrl(url);
    if (key && (!init?.method || init.method === 'GET')) {
      const meta = await getFileMeta(key);
      if (!meta) return new Response('Not found', { status: 404 });
      const buffer = await readFileBuffer(key);
      return new Response(buffer, { status: 200, headers: { 'content-type': meta.content_type || 'application/octet-stream', 'content-length': String(buffer.length) } });
    }
    return originalFetch(input, init);
  };
  wrapped.__ankoraLocalFiles = true;
  globalThis.fetch = wrapped;
}

function installDenoShim() {
  installLocalFileFetch();
  if (globalThis.Deno?.__ankoraShim) return;
  const toU8 = (b) => new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  globalThis.Deno = {
    __ankoraShim: true,
    serve(a, b) {
      capturedHandler = typeof a === 'function' ? a : (typeof b === 'function' ? b : a?.handler);
      return { finished: Promise.resolve(), shutdown: async () => {}, ref() {}, unref() {} };
    },
    env: {
      get: (k) => process.env[k],
      set: (k, v) => { process.env[k] = String(v); },
      has: (k) => k in process.env,
      delete: (k) => { delete process.env[k]; },
      toObject: () => ({ ...process.env }),
    },
    readFile: async (p) => toU8(await fs.promises.readFile(p)),
    writeFile: (p, d) => fs.promises.writeFile(p, d),
    readTextFile: (p) => fs.promises.readFile(p, 'utf8'),
    writeTextFile: (p, d) => fs.promises.writeFile(p, d, 'utf8'),
    makeTempDir: ({ prefix = 'fn-' } = {}) => fs.promises.mkdtemp(path.join(os.tmpdir(), prefix)),
    makeTempFile: async ({ prefix = 'fn-', suffix = '' } = {}) => {
      const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
      const file = path.join(dir, `tmp${suffix}`);
      await fs.promises.writeFile(file, '');
      return file;
    },
    remove: (p, opts = {}) => fs.promises.rm(p, { recursive: Boolean(opts.recursive), force: true }),
    mkdir: (p, opts = {}) => fs.promises.mkdir(p, opts),
    stat: (p) => fs.promises.stat(p),
    cwd: () => process.cwd(),
    errors: { NotFound: class NotFound extends Error {} },
  };
}

const handlers = new Map();
let loadPromise = null;

/** Carrega todas as funções (uma vez, de forma sequencial para capturar cada Deno.serve). */
export function loadFunctions() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    installHooks();
    installDenoShim();
    const dir = path.join(config.base44Dir, 'functions');
    if (!fs.existsSync(dir)) return handlers;
    for (const name of fs.readdirSync(dir).sort()) {
      const entry = ['entry.ts', 'entry.js', 'index.ts', 'index.js'].map((f) => path.join(dir, name, f)).find((f) => fs.existsSync(f));
      if (!entry) continue;
      capturedHandler = null;
      try {
        const mod = await import(pathToFileURL(entry).href);
        const handler = capturedHandler || (typeof mod.default === 'function' ? mod.default : null);
        if (!handler) { console.warn(`[functions] ${name}: nenhum handler encontrado (Deno.serve ou export default)`); continue; }
        handlers.set(name, handler);
      } catch (err) {
        console.error(`[functions] falha ao carregar ${name}:`, err.message);
      }
    }
    console.log(`[functions] ${handlers.size} funções carregadas: ${[...handlers.keys()].join(', ')}`);
    return handlers;
  })();
  return loadPromise;
}

export const functionNames = () => [...handlers.keys()];

async function parseResponse(response) {
  if (!(response instanceof Response)) {
    return { status: 200, headers: { 'content-type': 'application/json' }, data: response ?? null, raw: null };
  }
  const contentType = response.headers.get('content-type') || '';
  const headers = Object.fromEntries(response.headers.entries());
  const buf = Buffer.from(await response.arrayBuffer());
  let data;
  if (contentType.includes('application/json')) {
    try { data = JSON.parse(buf.toString('utf8')); } catch { data = buf.toString('utf8'); }
  } else if (contentType.startsWith('text/') || contentType === '') {
    const text = buf.toString('utf8');
    try { data = JSON.parse(text); } catch { data = text; }
  } else {
    data = null;
  }
  return { status: response.status, headers, data, raw: buf };
}

/**
 * Invoca uma função.
 * @param {string} name
 * @param {any} body               Corpo JSON enviado à função.
 * @param {object} opts
 * @param {string} [opts.token]    Token do utilizador (para base44.auth.me()).
 * @param {object} [opts.headers]  Cabeçalhos adicionais.
 */
export async function invokeFunction(name, body, { token = null, headers = {} } = {}) {
  await loadFunctions();
  const handler = handlers.get(name);
  if (!handler) throw new HttpError(404, `Função desconhecida: ${name}`);
  const reqHeaders = new Headers({ 'content-type': 'application/json', ...headers });
  if (token) reqHeaders.set('authorization', `Bearer ${token}`);
  const request = new Request(`${config.apiPublicUrl}/functions/${encodeURIComponent(name)}`, {
    method: 'POST', headers: reqHeaders, body: JSON.stringify(body ?? {}),
  });

  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new HttpError(504, `A função ${name} excedeu o tempo limite`)), config.functionTimeoutMs);
  });
  try {
    const response = await Promise.race([Promise.resolve().then(() => handler(request)), timeout]);
    return await parseResponse(response);
  } finally {
    clearTimeout(timer);
  }
}
