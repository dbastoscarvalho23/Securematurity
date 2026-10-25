// Exporta os dados da aplicação Base44 e importa-os para o servidor próprio.
//
// Exemplos:
//   # 1) Exportar para um ficheiro JSON (cópia de segurança, pode correr em qualquer máquina)
//   BASE44_APP_ID=... BASE44_API_KEY=... node scripts/import-from-base44.js --export-only --out base44-dump.json
//
//   # 2) Importar um ficheiro exportado, copiando os ficheiros alojados na Base44 para o armazenamento próprio
//   node scripts/import-from-base44.js --from base44-dump.json --rehost-files
//
//   # 3) Exportar e importar diretamente
//   BASE44_APP_ID=... BASE44_API_KEY=... node scripts/import-from-base44.js --rehost-files
//
// Os ids, datas e autores originais são preservados, por isso as referências entre registos mantêm-se.
// A importação é idempotente: voltar a correr atualiza os registos existentes.
// As palavras-passe não são exportáveis: os utilizadores entram com Google/Microsoft ou usam
// "Esqueci-me da palavra-passe" (ou "Registar" com o mesmo email) no primeiro acesso.
import fs from 'node:fs';
import { migrate, pool } from '../src/db.js';
import { entityNames } from '../src/entities/schemas.js';
import { EntityService } from '../src/entities/service.js';
import { putFile } from '../src/integrations/storage.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };

const APP_ID = process.env.BASE44_APP_ID;
const API_KEY = process.env.BASE44_API_KEY;
const API_URL = (process.env.BASE44_API_URL || 'https://app.base44.com').replace(/\/+$/, '');
const PAGE = 500;
const onlyEntities = option('entities')?.split(',').map((s) => s.trim());

async function fetchEntity(name) {
  const all = [];
  for (let skip = 0; ; skip += PAGE) {
    const url = `${API_URL}/api/apps/${APP_ID}/entities/${encodeURIComponent(name)}?limit=${PAGE}&skip=${skip}&sort=created_date`;
    const res = await fetch(url, { headers: { api_key: API_KEY, 'Content-Type': 'application/json' } });
    if (res.status === 404) return all;
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const page = await res.json();
    const rows = Array.isArray(page) ? page : page.items || page.data || [];
    all.push(...rows);
    if (rows.length < PAGE) return all;
  }
}

async function exportAll() {
  if (!APP_ID || !API_KEY) throw new Error('Defina BASE44_APP_ID e BASE44_API_KEY (chave de API da aplicação na Base44).');
  const dump = { exported_at: new Date().toISOString(), app_id: APP_ID, entities: {} };
  for (const name of onlyEntities || entityNames()) {
    process.stdout.write(`A exportar ${name}… `);
    dump.entities[name] = await fetchEntity(name);
    console.log(dump.entities[name].length);
  }
  return dump;
}

// --- cópia dos ficheiros alojados na Base44 --------------------------------

const FILE_URL_RE = /^https?:\/\/[^\s"']*(base44|supabase\.co\/storage)[^\s"']*$/i;
const rehosted = new Map();

async function rehost(url) {
  if (rehosted.has(url)) return rehosted.get(url);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const filename = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'ficheiro');
    const { file_url } = await putFile(buffer, { filename, contentType: res.headers.get('content-type') || undefined, createdBy: 'import-base44' });
    rehosted.set(url, file_url);
    return file_url;
  } catch (err) {
    console.warn(`  ! não foi possível copiar ${url}: ${err.message}`);
    rehosted.set(url, url);
    return url;
  }
}

async function rewriteFiles(value) {
  if (typeof value === 'string') return FILE_URL_RE.test(value) ? rehost(value) : value;
  if (Array.isArray(value)) return Promise.all(value.map(rewriteFiles));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await rewriteFiles(v);
    return out;
  }
  return value;
}

// --- importação ---------------------------------------------------------------

async function importAll(dump) {
  await migrate();
  const svc = new EntityService({ serviceRole: true, preserveMeta: true });
  const known = new Set(entityNames());
  const entities = dump.entities || dump;

  // Utilizadores primeiro.
  const users = entities.User || [];
  let created = 0;
  for (const u of users) {
    try {
      await svc.createUser({ ...u, is_verified: true });
      created += 1;
    } catch (err) {
      if (!String(err.message).includes('Já existe')) console.warn(`  ! utilizador ${u.email}: ${err.message}`);
    }
  }
  console.log(`User: ${created} criados (${users.length - created} já existiam ou falharam)`);

  for (const [name, records] of Object.entries(entities)) {
    if (name === 'User') continue;
    if (!known.has(name)) { console.warn(`Entidade ignorada (sem definição): ${name}`); continue; }
    if (onlyEntities && !onlyEntities.includes(name)) continue;
    let rows = records;
    if (flag('rehost-files')) rows = await Promise.all(rows.map(rewriteFiles));
    for (let i = 0; i < rows.length; i += PAGE) await svc.bulkCreate(name, rows.slice(i, i + PAGE));
    console.log(`${name}: ${rows.length} registos`);
  }
  if (flag('rehost-files')) {
    const copied = [...rehosted].filter(([from, to]) => from !== to).length;
    console.log(`Ficheiros copiados: ${copied} de ${rehosted.size}`);
  }
}

try {
  const dump = option('from') ? JSON.parse(fs.readFileSync(option('from'), 'utf8')) : await exportAll();
  if (option('out')) {
    fs.writeFileSync(option('out'), JSON.stringify(dump, null, 2));
    console.log(`Exportação guardada em ${option('out')}`);
  }
  if (!flag('export-only')) await importAll(dump);
  console.log('Concluído.');
} catch (err) {
  console.error(`Erro: ${err.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
