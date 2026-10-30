#!/usr/bin/env node
// Procura nomes por definir nas funções do Base44 (base44/functions e base44/shared).
// As funções correm em Deno e não passam por nenhum compilador antes de serem publicadas,
// por isso uma variável removida só falha em produção. Exemplo: `isScheduled` no
// relatório mensal, depois do PR #45.
//
// Uso: node scripts/check-function-names.cjs   (sai com código 1 se encontrar algum)
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOTS = ['base44/functions', 'base44/shared'];
const GLOBALS = new Set(['Deno']); // fornecidos pelo runtime do Base44

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|js)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(r));
const program = ts.createProgram(files, {
  allowJs: true,
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  types: [],
  skipLibCheck: true,
});

const found = [];
for (const d of ts.getPreEmitDiagnostics(program)) {
  // 2304: Cannot find name 'x'.  2552: Cannot find name 'x'. Did you mean 'y'?
  if (!d.file || (d.code !== 2304 && d.code !== 2552)) continue;
  const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ');
  const name = (msg.match(/name '([^']+)'/) || [])[1];
  if (GLOBALS.has(name)) continue;
  const { line } = d.file.getLineAndCharacterOfPosition(d.start);
  found.push(`${path.relative(process.cwd(), d.file.fileName)}:${line + 1}  ${msg}`);
}

if (found.length) {
  console.error(`Nomes por definir nas funções (${found.length}):`);
  for (const f of found) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`Funções verificadas: ${files.length} ficheiros, sem nomes por definir.`);
