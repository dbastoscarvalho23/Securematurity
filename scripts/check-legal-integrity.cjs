#!/usr/bin/env node
// Integridade da Biblioteca Legal e dos modelos documentais.
//
// Os dados legais (src/data/legal) foram gerados a partir de documentos oficiais e nunca se editam à mão
// (docs/legal/README.md, tools/legal/README.md). Esta verificação recusa qualquer alteração que não venha
// acompanhada da atualização explícita do manifesto, e ainda:
//   - documentos de origem que a licença não deixa distribuir (CIS, ENX, normas ISO) no repositório;
//   - cópias públicas dos modelos (public/modelos) diferentes dos originais (docs/modelos);
//   - textos longos nos ficheiros que só podem ter identificadores ou textos próprios (CIS, ENX, guias ISO).
//
// Uso:
//   node scripts/check-legal-integrity.cjs            verifica (sai com 1 se encontrar problemas)
//   node scripts/check-legal-integrity.cjs --update   regenera o manifesto, depois de uma regeneração revista
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const MANIFEST = 'docs/legal/manifesto.sha256';
const PROTECTED = [
  /^src\/data\/legal\/[^/]+\.json$/,
  /^base44\/shared\/(legalPack|classifyCatalog)\.ts$/, // gerados a partir de src/data/legal
  /^docs\/legal\/[^/]+\.md$/,
  /^docs\/modelos\/[^/]+\/[^/]+\.(docx|xlsx)$/,
  /^public\/modelos\/[^/]+\.(docx|xlsx)$/,
];
// Documentos de origem com direitos reservados ou licença sem uso comercial: nunca no repositório.
const FORBIDDEN = [
  { re: /CIS[_ -]?Controls/i, why: 'CIS Controls (CC BY-NC-ND): só os identificadores entram no repositório' },
  { re: /TISAX[_ -]Participant[_ -]Handbook|TISAX[_ -]Simplified[_ -]Group|ENX[_ -]Fulfilment/i, why: 'documento ENX com todos os direitos reservados' },
  { re: /(^|\/)(ISO|NP|EN)[_ -]?(IEC[_ -]?)?(27001|27002|42001)[^/]*\.(pdf|docx?|epub)$/i, why: 'texto de norma ISO: protegido por direitos de autor' },
];
// Ficheiros que só podem ter identificadores ou textos próprios curtos.
const SHORT_TEXT = {
  'src/data/legal/cis-ids.json': 120,
  'src/data/legal/enx-nis2-isa6.json': 300,
  'src/data/legal/iso27001.json': 400,
  'src/data/legal/iso42001.json': 400,
  'src/data/legal/iso-references.json': 400,
};

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const isProtected = (f) => PROTECTED.some((re) => re.test(f));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const current = new Map(files.filter((f) => isProtected(f) && f !== MANIFEST && fs.existsSync(f)).sort().map((f) => [f, sha(f)]));

if (process.argv.includes('--update')) {
  const body = [...current].map(([f, h]) => `${h}  ${f}`).join('\n') + '\n';
  fs.writeFileSync(MANIFEST, body);
  console.log(`Manifesto atualizado: ${current.size} ficheiros em ${MANIFEST}. Indique no PR a origem oficial da alteração.`);
  process.exit(0);
}

const problems = [];
const recorded = new Map();
if (!fs.existsSync(MANIFEST)) problems.push(`Falta o manifesto ${MANIFEST}`);
else {
  for (const line of fs.readFileSync(MANIFEST, 'utf8').split('\n')) {
    const m = line.match(/^([a-f0-9]{64})\s{2}(.+)$/);
    if (m) recorded.set(m[2], m[1]);
  }
}
for (const [f, h] of current) {
  if (!recorded.has(f)) problems.push(`Ficheiro legal novo, fora do manifesto: ${f}`);
  else if (recorded.get(f) !== h) problems.push(`Ficheiro legal alterado: ${f}`);
}
for (const f of recorded.keys()) if (!current.has(f)) problems.push(`Ficheiro legal removido: ${f}`);

for (const f of files) {
  if (/^src\/vendor\//.test(f)) continue;
  for (const { re, why } of FORBIDDEN) if (re.test(f)) problems.push(`Ficheiro proibido no repositório: ${f} (${why})`);
}

for (const f of files.filter((x) => /^public\/modelos\//.test(x))) {
  const name = path.basename(f);
  const original = files.find((x) => x.startsWith('docs/modelos/') && path.basename(x) === name);
  if (!original) problems.push(`Modelo público sem original em docs/modelos: ${f}`);
  else if (sha(f) !== sha(original)) problems.push(`Modelo público diferente do original: ${f} ≠ ${original}`);
}

for (const f of files.filter((x) => /^src\/data\/legal\/.*\.json$/.test(x))) {
  let data;
  try { data = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { problems.push(`JSON inválido: ${f} (${e.message})`); continue; }
  const limit = SHORT_TEXT[f];
  if (!limit) continue;
  const walk = (o, at) => {
    if (typeof o === 'string') { if (o.length > limit) problems.push(`Texto com ${o.length} caracteres em ${f} (${at}); o máximo é ${limit}: só identificadores ou textos próprios`); }
    else if (Array.isArray(o)) o.forEach((v, i) => walk(v, `${at}[${i}]`));
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, at ? `${at}.${k}` : k);
  };
  walk(data, '');
}

if (problems.length) {
  console.error(`Integridade da Biblioteca Legal: ${problems.length} problema(s)`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nSe a alteração é intencional e vem de uma regeneração a partir dos documentos oficiais (tools/legal/README.md),');
  console.error('corra `node scripts/check-legal-integrity.cjs --update` e indique no PR a fonte e o SHA-256 do documento oficial.');
  process.exit(1);
}
console.log(`Biblioteca Legal íntegra: ${current.size} ficheiros conferidos com o manifesto.`);
