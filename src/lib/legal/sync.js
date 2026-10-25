/**
 * Sincroniza a Biblioteca Legal com as entidades da aplicação (Framework, FrameworkControl, Question).
 *
 * Regras:
 *  - Apenas texto oficial: enunciados, descrições e medidas são copiados literalmente das fontes.
 *  - Registos criados pela sincronização levam `source_ref` (referência oficial). É por aí que são reconhecidos
 *    em sincronizações seguintes (atualizados, nunca duplicados).
 *  - Perguntas antigas de referenciais oficiais (sem `source_ref`) ou que deixaram de constar das fontes são
 *    DESATIVADAS (is_active = false), nunca apagadas — as respostas de avaliações anteriores mantêm-se.
 *  - Perguntas criadas para uma avaliação concreta (assessment_id) não são tocadas.
 */
import { loadLegal, flattenQnrcs, LEVELS, catalog } from './index';
import { FRAMEWORK_NAMES } from '@/lib/frameworkConstants';

const LEVEL_PT = { basico: 'Básico', substancial: 'Substancial', elevado: 'Elevado' };
const REG_URL = 'https://files.diariodarepublica.pt/2s/2026/06/118000000/0003200120.pdf';
const CHUNK = 50;

const inst = (id) => catalog.instruments.find((i) => i.id === id) || {};

function qnrcsGuidance(k) {
  const parts = [k.description];
  for (const lv of LEVELS) {
    const m = k.measures?.[lv];
    if (m) parts.push(`Medida mínima — nível ${LEVEL_PT[lv]} (Reg. 756/2026, Anexo III): ${m.measure}\nCritério de verificação: ${m.verification}`);
  }
  const refs = Object.entries(k.references || {}).map(([fw, ids]) => `${fw}: ${ids.join(', ')}`).join(' · ');
  if (refs) parts.push(`Referências oficiais: ${refs}`);
  return parts.join('\n\n');
}

const bullets = (arr) => (arr || []).join('\n');

/** Constrói a lista oficial de referenciais, controlos e perguntas. */
export async function buildOfficialSet() {
  const [qnrcs, nis2, rx, dora, isa6, isa27] = await Promise.all(
    ['qnrcs', 'nis2', 'regexec2690', 'dora', 'isa6', 'isa2027'].map((k) => loadLegal(k)));

  const frameworks = [];
  const add = (fw) => { frameworks.push({ ...fw, controls: [], questions: [] }); return frameworks[frameworks.length - 1]; };

  // QNRCS — Reg. 756/2026, Anexos I e III
  const q = add({ code: 'QNRC', name: FRAMEWORK_NAMES.QNRC, version: '2026 (Reg. 756/2026)', reference_url: REG_URL,
    description: 'Quadro Nacional de Referência para a Cibersegurança — Anexo I do Regulamento n.º 756/2026 (CNCS). Medidas mínimas por nível de conformidade no Anexo III.' });
  for (const k of flattenQnrcs(qnrcs)) {
    const domain = `${k.category.id} — ${k.category.name}`;
    const ref = `Reg. 756/2026, Anexo I, ${k.id} (pág. ${k.page})`;
    q.controls.push({ control_id: k.id, domain, title: k.statement, description: qnrcsGuidance(k), source_ref: ref, source_url: REG_URL, min_level: k.min_level || '' });
    q.questions.push({ control_id: k.id, domain, domain_pt: domain, question_text: k.statement, question_text_pt: k.statement,
      guidance: qnrcsGuidance(k), guidance_pt: qnrcsGuidance(k), source_ref: ref });
  }

  // NIS2 — Diretiva (UE) 2022/2555, art. 20.º e art. 21.º, n.º 2
  const n = add({ code: 'NIS2', name: FRAMEWORK_NAMES.NIS2, version: '2022/2555', reference_url: inst('nis2').official_url,
    description: 'Medidas de gestão dos riscos de cibersegurança da Diretiva (UE) 2022/2555 (art. 21.º, n.º 2) e responsabilidades dos órgãos de gestão (art. 20.º). Em Portugal: Regime Jurídico da Cibersegurança (DL 125/2025) e QNRCS.' });
  const art20 = nis2.articles.find((a) => a.number === '20.º');
  for (const [i, par] of (art20?.text || '').split(/\n(?=\d+\.\s)/).entries()) {
    if (!par.trim()) continue;
    const id = `NIS2-20.${i + 1}`;
    n.controls.push({ control_id: id, domain: 'Art. 20.º — Governação', title: par.trim(), description: par.trim(), source_ref: `Diretiva (UE) 2022/2555, art. 20.º, n.º ${i + 1}` });
  }
  for (const m of nis2.art21_measures) {
    const id = `NIS2-21.2.${m.letter}`;
    const domain = `Art. 21.º, n.º 2, alínea ${m.letter})`;
    n.controls.push({ control_id: id, domain, title: m.text, description: `${nis2.art21_chapeau}\n${m.letter}) ${m.text}`, source_ref: m.ref });
    n.questions.push({ control_id: id, domain, domain_pt: domain, question_text: m.text, question_text_pt: m.text,
      guidance: `${nis2.art21_chapeau}\nRequisitos técnicos detalhados (prestadores digitais): Regulamento de Execução (UE) 2024/2690, Anexo.`,
      guidance_pt: `${nis2.art21_chapeau}\nRequisitos técnicos detalhados (prestadores digitais): Regulamento de Execução (UE) 2024/2690, Anexo.`, source_ref: m.ref });
  }

  // Regulamento de Execução (UE) 2024/2690 — Anexo
  const r = add({ code: 'EU_2024_2690', name: FRAMEWORK_NAMES.EU_2024_2690, version: '2024/2690', reference_url: inst('regexec2690').official_url,
    description: 'Requisitos técnicos e metodológicos das medidas do art. 21.º, n.º 2, da Diretiva NIS2 para prestadores de serviços digitais (Anexo).' });
  for (const req of rx.annex_requirements) {
    const ref = `Reg. Exec. (UE) 2024/2690, Anexo, ponto ${req.id}`;
    const title = (req.subsection || req.section).replace(/^\d+(\.\d+)*\.?\s*/, '');
    r.controls.push({ control_id: req.id, domain: req.section, title: `${req.id} — ${title}`, description: req.text, source_ref: ref });
    r.questions.push({ control_id: req.id, domain: req.section, domain_pt: req.section, question_text: `${req.id} — ${title}`, question_text_pt: `${req.id} — ${title}`,
      guidance: req.text, guidance_pt: req.text, source_ref: ref });
  }

  // DORA — obrigações por pilar
  const PILLARS = { governacao: 'Governação', gestao_risco_tic: 'Gestão do risco TIC', incidentes: 'Incidentes', testes: 'Testes de resiliência operacional digital', terceiros_tic: 'Risco de terceiros TIC', partilha_informacao: 'Partilha de informação' };
  const d = add({ code: 'DORA', name: FRAMEWORK_NAMES.DORA, version: '2022/2554', reference_url: inst('dora').official_url,
    description: 'Regulamento (UE) 2022/2554 relativo à resiliência operacional digital do setor financeiro (DORA), aplicável desde 17 de janeiro de 2025. Lei especial face à NIS2 para as entidades financeiras.' });
  for (const o of dora.obligations) {
    const domain = PILLARS[o.pillar] || o.pillar;
    d.controls.push({ control_id: o.id, domain, title: o.title_pt, description: `${o.text}\n\n${o.ref}`, source_ref: o.ref });
    d.questions.push({ control_id: o.id, domain, domain_pt: domain, question_text: o.title_pt, question_text_pt: o.title_pt,
      guidance: `${o.ref}\n\n${o.text}`, guidance_pt: `${o.ref}\n\n${o.text}`, source_ref: o.ref });
  }

  // VDA ISA (TISAX) — texto literal, inglês
  for (const [code, data] of [['TISAX_ISA6', isa6], ['TISAX_ISA2027', isa27]]) {
    const i = data.instrument;
    const fw = add({ code, name: FRAMEWORK_NAMES[code], version: i.version, reference_url: i.official_url,
      description: `${i.title} ${i.version}. ${i.notice_pt}` });
    for (const c of data.controls) {
      const domain = `${c.catalogue} — ${c.chapter}`;
      const guidance = [
        `Objective: ${c.objective}`,
        c.must?.length && `Requirements (must):\n${bullets(c.must)}`,
        c.should?.length && `Requirements (should):\n${bullets(c.should)}`,
        c.high?.length && `Additional requirements for high protection needs:\n${bullets(c.high)}`,
        c.very_high?.length && `Additional requirements for very high protection needs:\n${bullets(c.very_high)}`,
      ].filter(Boolean).join('\n\n');
      const ref = `${i.short || code} ${c.id}`;
      fw.controls.push({ control_id: c.id, domain, title: c.question, description: guidance, source_ref: ref, source_url: i.official_url });
      fw.questions.push({ control_id: c.id, domain, domain_pt: domain, question_text: c.question, guidance, source_ref: ref });
    }
  }
  return frameworks;
}

async function inChunks(items, fn) {
  for (let i = 0; i < items.length; i += CHUNK) await fn(items.slice(i, i + CHUNK));
}

const differs = (a, b, fields) => fields.some((f) => (a[f] ?? '') !== (b[f] ?? ''));

/**
 * Executa a sincronização. `base44` é o cliente da aplicação (modo Base44 ou servidor próprio).
 * Devolve { created, updated, deactivated }.
 */
export async function syncLegalLibrary(base44, { onProgress } = {}) {
  const stats = { created: 0, updated: 0, deactivated: 0 };
  const progress = (msg) => onProgress?.(msg);
  const official = await buildOfficialSet();

  // 1. Referenciais
  progress('Referenciais');
  const existingFw = await base44.entities.Framework.list('code', 500);
  const fwByCode = Object.fromEntries(existingFw.map((f) => [f.code, f]));
  for (const fw of official) {
    const data = { code: fw.code, name: fw.name, version: fw.version, description: fw.description, reference_url: fw.reference_url, status: 'active' };
    if (fwByCode[fw.code]) {
      if (differs(fwByCode[fw.code], data, ['name', 'version', 'description', 'reference_url', 'status'])) {
        fwByCode[fw.code] = await base44.entities.Framework.update(fwByCode[fw.code].id, data);
        stats.updated += 1;
      }
    } else {
      fwByCode[fw.code] = await base44.entities.Framework.create(data);
      stats.created += 1;
    }
  }
  if (fwByCode.ENISA && fwByCode.ENISA.status !== 'deprecated') {
    await base44.entities.Framework.update(fwByCode.ENISA.id, { status: 'deprecated', name: FRAMEWORK_NAMES.ENISA });
    stats.updated += 1;
  }

  // 2. Controlos e perguntas por referencial
  for (const fw of official) {
    progress(fw.name);
    const framework = fwByCode[fw.code];

    const existingCtl = await base44.entities.FrameworkControl.filter({ framework_code: fw.code }, 'control_id', 5000);
    const ctlById = Object.fromEntries(existingCtl.map((c) => [c.control_id, c]));
    const toCreate = [];
    const toUpdate = [];
    for (const c of fw.controls) {
      const data = { ...c, framework_id: framework.id, framework_code: fw.code };
      const ex = ctlById[c.control_id];
      if (!ex) toCreate.push(data);
      else if (differs(ex, data, ['domain', 'title', 'description', 'source_ref', 'source_url', 'min_level', 'framework_id'])) toUpdate.push({ id: ex.id, ...data });
    }
    await inChunks(toCreate, (b) => base44.entities.FrameworkControl.bulkCreate(b));
    await inChunks(toUpdate, (b) => base44.entities.FrameworkControl.bulkUpdate(b));
    stats.created += toCreate.length;
    stats.updated += toUpdate.length;

    const existingQ = (await base44.entities.Question.filter({ framework_code: fw.code }, 'order_index', 5000)).filter((x) => !x.assessment_id);
    const managed = Object.fromEntries(existingQ.filter((x) => x.source_ref).map((x) => [x.control_id, x]));
    const wanted = new Set(fw.questions.map((x) => x.control_id));
    const qCreate = [];
    const qUpdate = [];
    fw.questions.forEach((x, idx) => {
      const data = { framework_code: fw.code, answer_type: 'maturity_scale', weight: 1, order_index: idx + 1, is_active: true, ...x };
      const ex = managed[x.control_id];
      if (!ex) qCreate.push(data);
      else if (differs(ex, data, ['domain', 'domain_pt', 'question_text', 'question_text_pt', 'guidance', 'guidance_pt', 'source_ref', 'order_index']) || ex.is_active === false) qUpdate.push({ id: ex.id, ...data });
    });
    // Perguntas antigas (sem fonte oficial) ou já não constantes das fontes: desativar
    const qDeactivate = existingQ
      .filter((x) => x.is_active !== false && (!x.source_ref || !wanted.has(x.control_id)))
      .map((x) => ({ id: x.id, is_active: false }));
    await inChunks(qCreate, (b) => base44.entities.Question.bulkCreate(b));
    await inChunks(qUpdate, (b) => base44.entities.Question.bulkUpdate(b));
    await inChunks(qDeactivate, (b) => base44.entities.Question.bulkUpdate(b));
    stats.created += qCreate.length;
    stats.updated += qUpdate.length;
    stats.deactivated += qDeactivate.length;
  }

  // 3. Referencial descontinuado (ENISA): desativar perguntas globais
  if (fwByCode.ENISA) {
    const enisaQ = (await base44.entities.Question.filter({ framework_code: 'ENISA' }, 'order_index', 5000))
      .filter((x) => !x.assessment_id && x.is_active !== false).map((x) => ({ id: x.id, is_active: false }));
    await inChunks(enisaQ, (b) => base44.entities.Question.bulkUpdate(b));
    stats.deactivated += enisaQ.length;
  }
  return stats;
}

/**
 * Importa os CIS Controls a partir do ficheiro oficial (.xlsx) do próprio cliente.
 * O texto fica apenas no espaço de quem o importa (licença CC BY-NC-ND 4.0 do CIS).
 */
export async function importCisXlsx(base44, file) {
  const mod = await import('xlsx');
  const XLSX = mod.read ? mod : mod.default;
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheetName = wb.SheetNames.find((n) => /^Controls v8/i.test(n));
  if (!sheetName) throw new Error('Folha «Controls v8.x» não encontrada — utilize o ficheiro oficial dos CIS Controls.');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true });
  const header = rows[0].map((h) => String(h || '').trim());
  const col = (name) => header.indexOf(name);
  const [cC, cS, cA, cF, cT, cD, c1, c2, c3] = ['CIS Control', 'CIS Safeguard', 'Asset Class', 'Security Function', 'Title', 'Description', 'IG1', 'IG2', 'IG3'].map(col);
  if (cC < 0 || cT < 0) throw new Error('Cabeçalhos inesperados no ficheiro dos CIS Controls.');

  const version = sheetName.replace(/^Controls\s*/i, '');
  let fw = (await base44.entities.Framework.filter({ code: 'CIS_V8' }))[0];
  const fwData = { code: 'CIS_V8', name: `CIS Controls ${version}`, version, reference_url: 'https://www.cisecurity.org/controls',
    description: 'CIS Critical Security Controls — importado do ficheiro oficial do cliente. Licença CC BY-NC-ND 4.0 (© Center for Internet Security, Inc.).', status: 'active' };
  fw = fw ? await base44.entities.Framework.update(fw.id, fwData) : await base44.entities.Framework.create(fwData);

  const controls = [];
  const questions = [];
  let current = null;
  let seq = 0;
  for (const row of rows.slice(1)) {
    if (row[cC] == null || row[cC] === '') continue;
    const n = parseInt(String(row[cC]).replace(/ /g, '').trim(), 10);
    if (Number.isNaN(n)) continue;
    if (row[cS] == null || row[cS] === '') {
      current = { n, title: String(row[cT] || '').trim() };
      seq = 0;
      controls.push({ control_id: `CIS-${n}`, domain: `CIS ${n} — ${current.title}`, title: current.title, description: String(row[cD] || ''), source_ref: `CIS Controls ${version}, controlo ${n}` });
      continue;
    }
    seq += 1; // a folha guarda «4.10» como 4.1: a numeração é sequencial dentro de cada controlo
    const id = `CIS-${n}.${seq}`;
    const igs = [[c1, 'IG1'], [c2, 'IG2'], [c3, 'IG3']].filter(([c]) => c >= 0 && row[c]).map(([, l]) => l);
    const domain = `CIS ${n} — ${current?.title || ''}`;
    const guidance = `${row[cD] || ''}\n\nAsset class: ${row[cA] || '—'} · Security function: ${row[cF] || '—'} · ${igs.join(', ')}`;
    controls.push({ control_id: id, domain, title: String(row[cT] || '').trim(), description: guidance, source_ref: `CIS Controls ${version}, salvaguarda ${n}.${seq}` });
    questions.push({ framework_code: 'CIS_V8', control_id: id, domain, question_text: `${n}.${seq} — ${String(row[cT] || '').trim()}`, guidance,
      answer_type: 'maturity_scale', weight: 1, order_index: questions.length + 1, is_active: true, source_ref: `CIS Controls ${version}, salvaguarda ${n}.${seq}` });
  }

  const exCtl = Object.fromEntries((await base44.entities.FrameworkControl.filter({ framework_code: 'CIS_V8' }, 'control_id', 5000)).map((c) => [c.control_id, c]));
  const cCreate = [];
  const cUpdate = [];
  for (const c of controls) {
    const data = { ...c, framework_id: fw.id, framework_code: 'CIS_V8' };
    if (exCtl[c.control_id]) cUpdate.push({ id: exCtl[c.control_id].id, ...data }); else cCreate.push(data);
  }
  await inChunks(cCreate, (b) => base44.entities.FrameworkControl.bulkCreate(b));
  await inChunks(cUpdate, (b) => base44.entities.FrameworkControl.bulkUpdate(b));

  const exQ = (await base44.entities.Question.filter({ framework_code: 'CIS_V8' }, 'order_index', 5000)).filter((x) => !x.assessment_id);
  const managed = Object.fromEntries(exQ.filter((x) => x.source_ref).map((x) => [x.control_id, x]));
  const qCreate = questions.filter((x) => !managed[x.control_id]);
  const qUpdate = questions.filter((x) => managed[x.control_id]).map((x) => ({ id: managed[x.control_id].id, ...x }));
  const qDeactivate = exQ.filter((x) => !x.source_ref && x.is_active !== false).map((x) => ({ id: x.id, is_active: false }));
  await inChunks(qCreate, (b) => base44.entities.Question.bulkCreate(b));
  await inChunks(qUpdate, (b) => base44.entities.Question.bulkUpdate(b));
  await inChunks(qDeactivate, (b) => base44.entities.Question.bulkUpdate(b));
  return { safeguards: questions.length, controls: controls.length - questions.length };
}
