#!/usr/bin/env node
/**
 * Gera base44/shared/classifyCatalog.ts: os dados da Biblioteca Legal que a classificação de documentos usa e que não
 * estão em legalPack.ts (nível mínimo de cada controlo do QNRCS, itens do guia ISO/IEC 27001 e tarefas da jornada
 * RJC_2026 em PT-PT).
 *
 * Fonte única: src/data/legal/qnrcs.json, src/data/legal/iso27001.json e src/lib/legal/journeyTemplate.js.
 * Volte a correr depois de os atualizar:
 *     node tools/legal/build_classify_catalog.mjs
 * O teste src/lib/__tests__/classify.test.js confirma que o ficheiro gerado corresponde às fontes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const qnrcs = read('src/data/legal/qnrcs.json');
const iso = read('src/data/legal/iso27001.json');
const { JOURNEY_TEMPLATE_PT } = await import(pathToFileURL(path.join(ROOT, 'src/lib/legal/journeyTemplate.js')).href);

const minLevel = {};
for (const o of qnrcs.objectives) for (const c of o.categories) for (const k of c.controls) {
  const levels = Object.keys(k.measures || {});
  const lv = k.min_level && levels.includes(k.min_level) ? k.min_level : ['basico', 'substancial', 'elevado'].find((l) => levels.includes(l));
  if (lv) minLevel[k.id] = lv;
}

const catalog = {
  qnrcs_min_level: minLevel,
  iso27001: iso.items.map((i) => ({ id: i.id, kind: i.kind, ref: i.ref, title: i.title, description: i.description || '', evidence: i.evidence || '' })),
  journey: JOURNEY_TEMPLATE_PT.flatMap((s) => s.tasks.map((t, idx) => ({
    section: s.section, section_order: s.section_order, task_order: idx + 1, title: t.title, basis: t.basis || '',
  }))),
};

const out = path.join(ROOT, 'base44', 'shared', 'classifyCatalog.ts');
fs.writeFileSync(out, `// GERADO por tools/legal/build_classify_catalog.mjs a partir de src/data/legal e src/lib/legal/journeyTemplate.js — não editar à mão.\nexport const CLASSIFY_CATALOG = ${JSON.stringify(catalog)};\n`);
console.log(out, fs.statSync(out).size, 'bytes;', Object.keys(minLevel).length, 'controlos;', catalog.iso27001.length, 'itens ISO;', catalog.journey.length, 'tarefas');
