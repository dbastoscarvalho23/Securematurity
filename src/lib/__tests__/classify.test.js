import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import qnrcs from '@/data/legal/qnrcs.json';
import epr from '@/data/legal/epr-measures.json';
import iso from '@/data/legal/iso27001.json';
import { applicableMeasures, applicableEprMeasures, flattenQnrcs } from '@/lib/legal/index';
import { JOURNEY_TEMPLATE_PT } from '@/lib/legal/journeyTemplate';
import { AI_PURPOSES } from '@/lib/ai';
import { CLASSIFY_FOLDERS as UI_FOLDERS, DOCUMENT_KINDS as UI_KINDS } from '@/lib/intake';
import { REPOSITORY_FOLDERS } from '@/lib/repository';
// Lógica do servidor importada diretamente (o ficheiro não usa imports do Deno).
import {
  buildCandidates, measureCandidates, journeyCandidates, shortlist, scoreCandidates, mentionsCode, tokens, normalizeText,
  validateClassification, candidateToLink, excerptFound, intakeMetrics, CLASSIFY_FOLDERS, DOCUMENT_KINDS, MAX_LINKS,
} from '../../../base44/shared/classify.ts';
import { parsePropfind } from '../../../base44/shared/webdavXml.ts';
import { CLASSIFY_CATALOG } from '../../../base44/shared/classifyCatalog.ts';
import { extractText, xmlToText, sharedStrings, sheetToText, decodeText, MAX_TEXT } from '../../../base44/shared/textExtract.ts';
import { exposedIdentifiers, textHasIdentifier } from '../../../base44/shared/exposedAssets.ts';

const enc = (s) => new TextEncoder().encode(s);

describe('catálogo gerado (base44/shared/classifyCatalog.ts)', () => {
  it('tarefas da jornada iguais a JOURNEY_TEMPLATE_PT (ordem 1, 2, … em cada secção)', () => {
    const expected = JOURNEY_TEMPLATE_PT.flatMap((s) => s.tasks.map((t, i) => ({ section: s.section, section_order: s.section_order, task_order: i + 1, title: t.title, basis: t.basis || '' })));
    expect(CLASSIFY_CATALOG.journey).toEqual(expected);
  });
  it('itens ISO/IEC 27001 iguais a iso27001.json', () => {
    expect(CLASSIFY_CATALOG.iso27001.map((i) => i.id)).toEqual(iso.items.map((i) => i.id));
    expect(CLASSIFY_CATALOG.iso27001[0].title).toBe(iso.items[0].title);
  });
  it('nível mínimo de cada controlo igual a qnrcs.json', () => {
    for (const k of flattenQnrcs(qnrcs)) {
      if (!Object.keys(k.measures || {}).length) continue;
      expect(k.measures[CLASSIFY_CATALOG.qnrcs_min_level[k.id]]).toBeTruthy();
      if (k.min_level && k.measures[k.min_level]) expect(CLASSIFY_CATALOG.qnrcs_min_level[k.id]).toBe(k.min_level);
    }
  });
});

describe('servidor e browser usam as mesmas chaves', () => {
  it('medidas do QNRCS: as mesmas chaves de applicableMeasures', () => {
    for (const level of ['basico', 'substancial', 'elevado']) {
      const server = measureCandidates({ rjc_qualification: 'importante', conformity_level: level }).map((c) => c.key);
      expect(server).toEqual(applicableMeasures(qnrcs, level).map((m) => m.key));
    }
  });
  it('Anexo IV: as mesmas chaves de applicableEprMeasures (com #n nos códigos repetidos)', () => {
    for (const g of ['A', 'B']) {
      const server = measureCandidates({ rjc_qualification: 'publica_relevante', epr_group: g }).map((c) => c.key);
      expect(server).toEqual(applicableEprMeasures(epr, g).map((m) => m.key));
    }
  });
  it('sem qualificação: cada controlo no seu nível mínimo', () => {
    const keys = measureCandidates({ rjc_qualification: 'por_determinar' }).map((c) => c.key);
    expect(keys).toContain('GR.CO-1@substancial');
    expect(new Set(keys.map((k) => k.split('@')[0])).size).toBe(keys.length);
  });
  it('ponto de uso «document_classification» ativo por omissão nos dois lados', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = fs.readFileSync(path.resolve(here, '../../../base44/shared/llm.ts'), 'utf8');
    const start = src.indexOf('export const AI_PURPOSE_DEFAULTS = {');
    const server = Object.fromEntries([...src.slice(start, src.indexOf('};', start)).matchAll(/^\s+(\w+): (true|false),$/gm)].map((m) => [m[1], m[2] === 'true']));
    expect(server).toEqual(Object.fromEntries(AI_PURPOSES.map((p) => [p.key, p.default])));
    expect(server.document_classification).toBe(true);
  });
  it('pastas e tipos de documento iguais aos da interface', () => {
    expect(UI_FOLDERS).toEqual(CLASSIFY_FOLDERS);
    expect(UI_KINDS).toEqual(DOCUMENT_KINDS);
    const keys = REPOSITORY_FOLDERS.map((f) => f.key);
    CLASSIFY_FOLDERS.forEach((k) => expect(keys).toContain(k));
    expect(CLASSIFY_FOLDERS).not.toContain('inbox');
    expect(CLASSIFY_FOLDERS).not.toContain('assets');
  });
});

describe('candidatos de um cliente', () => {
  const checklist = [{ id: 'chk-71', framework: 'RJC_2026', section_order: 7, task_order: 1 }];
  it('ISO/IEC 27001 só quando o cliente o usa', () => {
    const base = { rjc_qualification: 'essencial', conformity_level: 'basico' };
    expect(buildCandidates(base).some((c) => c.kind === 'iso27001')).toBe(false);
    expect(buildCandidates({ ...base, allowed_frameworks: ['ISO27001'] }).some((c) => c.kind === 'iso27001')).toBe(true);
    expect(buildCandidates(base, [{ framework: 'ISO27001_2022' }]).some((c) => c.kind === 'iso27001')).toBe(true);
  });
  it('tarefa da jornada ligada ao registo existente (secção + ordem)', () => {
    const j = journeyCandidates(checklist);
    expect(j).toHaveLength(CLASSIFY_CATALOG.journey.length);
    expect(j.find((c) => c.id === 'journey:7.1').checklist_id).toBe('chk-71');
    expect(j.find((c) => c.id === 'journey:7.2').checklist_id).toBeUndefined();
  });
  it('níveis de documento L1–L4 sempre presentes', () => {
    expect(buildCandidates({}).filter((c) => c.kind === 'doc_level').map((c) => c.code)).toEqual(['L1', 'L2', 'L3', 'L4']);
  });
});

describe('pontuação lexical PT-PT', () => {
  const all = buildCandidates({ rjc_qualification: 'essencial', conformity_level: 'substancial' });
  const text = 'Plano de formação e sensibilização em cibersegurança. Todos os colaboradores recebem formação anual de sensibilização; as equipas técnicas têm formação específica. Registo de presenças.';
  it('normaliza acentos, maiúsculas e palavras vazias', () => {
    expect(normalizeText('Políticas de SEGURANÇA')).toBe('politicas de seguranca');
    expect(tokens('As políticas e a política da entidade')).toEqual(['politic', 'politic']);
  });
  it('um plano de formação fica perto das medidas de formação (PR.FC)', () => {
    const top = shortlist(all, text, 'plano-formacao.docx');
    const ids = top.slice(0, 6).map((s) => s.candidate.id);
    expect(ids.some((id) => id.startsWith('measure:PR.FC-1@'))).toBe(true);
    expect(ids).toContain('journey:7.1');
    expect(top.filter((s) => s.candidate.kind !== 'doc_level').length).toBeLessThanOrEqual(20);
    expect(top.filter((s) => s.candidate.kind === 'doc_level')).toHaveLength(4);
  });
  it('sem texto (PDF), usa o nome do ficheiro', () => {
    const top = shortlist(all, '', 'politica-de-backups.pdf').filter((s) => s.candidate.kind !== 'doc_level');
    expect(top.length).toBeGreaterThan(0);
    expect(top.every((s) => s.score > 0)).toBe(true);
  });
  it('código citado no documento dá bónus, sem confundir A.5.1 com A.5.15', () => {
    const c = { kind: 'iso27001', code: 'A.5.1' };
    expect(mentionsCode(c, 'ver controlo a.5.1 do anexo')).toBe(true);
    expect(mentionsCode(c, 'ver controlo a.5.15 do anexo')).toBe(false);
    const withCode = scoreCandidates(all, 'Ver ID.GA-1.').find((s) => s.candidate.key === 'ID.GA-1@basico');
    expect(withCode.score).toBeGreaterThanOrEqual(3);
  });
});

describe('validação da resposta do modelo', () => {
  const allowed = ['measure:PR.FC-1@basico', 'journey:7.1', 'iso27001:A.6.3', 'doc_level:L1'];
  const text = 'Todos os colaboradores recebem formação anual de sensibilização em cibersegurança.';
  it('só candidatos enviados; níveis de documento não são ligações', () => {
    const v = validateClassification({ links: [{ candidate_id: 'measure:XX-1@basico', confidence: 0.9 }, { candidate_id: 'doc_level:L1', confidence: 0.9 }, { candidate_id: 'journey:7.1', confidence: 0.4 }] }, { allowed, text });
    expect(v.links.map((l) => l.candidate_id)).toEqual(['journey:7.1']);
    expect(v.warnings.length).toBeGreaterThan(0);
  });
  it('excerto confirmado sem distinguir maiúsculas nem espaços; inventado é retirado', () => {
    const v = validateClassification({ links: [
      { candidate_id: 'measure:PR.FC-1@basico', confidence: 0.8, excerpt: 'TODOS os   colaboradores recebem formação', assessment: 'covers' },
      { candidate_id: 'journey:7.1', confidence: 0.7, excerpt: 'Plano aprovado pela administração', assessment: 'partial' },
    ] }, { allowed, text });
    expect(v.links[0].excerpt).toBe('TODOS os colaboradores recebem formação');
    expect(v.links[0].excerpt_dropped).toBe(false);
    expect(v.links[1].excerpt).toBe('');
    expect(v.links[1].excerpt_dropped).toBe(true);
    expect(excerptFound('«todos os colaboradores»', text)).toBe(false);
  });
  it('PDF/imagem: excerto fica marcado como não verificado', () => {
    const v = validateClassification({ links: [{ candidate_id: 'iso27001:A.6.3', confidence: 0.6, excerpt: 'qualquer coisa' }] }, { allowed, text: '' });
    expect(v.links[0].excerpt_unverified).toBe(true);
  });
  it('confiança entre 0 e 1, ordenada, no máximo 8; enums e datas validados', () => {
    const many = Array.from({ length: 12 }, (_, i) => `measure:M-${i}@basico`);
    const v = validateClassification({
      document_kind: 'manual', security_doc_level: 'l2', evidence_type: 'x', method: 'test', issued_date: '2026-02-30', valid_until: '2027-01-31',
      folder_key: 'assets', links: many.map((id, i) => ({ candidate_id: id, confidence: i === 0 ? 7 : i / 20, assessment: 'nope' })),
    }, { allowed: many, text: '' });
    expect(v.links).toHaveLength(MAX_LINKS);
    expect(v.links[0].confidence).toBe(1);
    expect(v.links.map((l) => l.confidence)).toEqual([...v.links.map((l) => l.confidence)].sort((a, b) => b - a));
    expect(v.links[0].assessment).toBe('partial');
    expect(v).toMatchObject({ document_kind: 'outro', security_doc_level: 'L2', evidence_type: 'other', method: 'test', issued_date: '', valid_until: '2027-01-31', folder_key: 'evidence' });
  });
});

describe('ligações da evidência', () => {
  it('medida, ISO e tarefa da jornada no formato dos painéis de evidências', () => {
    const [m] = measureCandidates({ rjc_qualification: 'essencial', conformity_level: 'basico' });
    expect(candidateToLink(m)).toMatchObject({ type: 'measure', id: m.key, ref: m.code });
    expect(candidateToLink({ kind: 'iso27001', code: 'A.5.1', title: 'Políticas' })).toEqual({ type: 'iso27001', id: 'A.5.1', ref: 'A.5.1', label: 'A.5.1 — Políticas' });
    const [j] = journeyCandidates([{ id: 'abc', framework: 'RJC_2026', section_order: 1, task_order: 1 }]);
    expect(candidateToLink(j)).toMatchObject({ type: 'checklist', id: 'abc' });
    expect(candidateToLink(journeyCandidates([])[0])).toBe(null);
    expect(candidateToLink({ kind: 'doc_level', code: 'L1' })).toBe(null);
  });
});

describe('extração de texto (base44/shared/textExtract.ts)', () => {
  it('DOCX: parágrafos em linhas, sem etiquetas', () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>Política de</w:t></w:r><w:r><w:t xml:space="preserve"> cópias &amp; reposição</w:t></w:r></w:p><w:p><w:r><w:t>Aprovada em 2026-01-15</w:t></w:r></w:p></w:body></w:document>';
    expect(xmlToText(xml, ['w:p'])).toBe('Política de cópias & reposição\nAprovada em 2026-01-15');
    const unzip = (_b, opts) => {
      expect(opts.filter({ name: 'word/document.xml', size: 1, originalSize: 10 })).toBe(true);
      expect(opts.filter({ name: 'word/document.xml', size: 1, originalSize: 50 * 1024 * 1024 })).toBe(false);
      return { 'word/document.xml': enc(xml) };
    };
    const ex = extractText(new Uint8Array([0x50, 0x4b, 3, 4]), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', unzip);
    expect(ex).toMatchObject({ method: 'docx', native: false });
    expect(ex.text).toContain('cópias & reposição');
  });
  it('XLSX: sharedStrings e valores', () => {
    const ss = '<sst><si><t>Ativo</t></si><si><r><t>Respons</t></r><r><t>ável</t></r></si></sst>';
    expect(sharedStrings(ss)).toEqual(['Ativo', 'Responsável']);
    const sheet = '<sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Servidor</t></is></c><c r="B2"><v>42</v></c></row></sheetData>';
    expect(sheetToText(sheet, sharedStrings(ss))).toBe('Ativo\tResponsável\nServidor\t42');
  });
  it('PPTX: diapositivos pela ordem', () => {
    const unzip = () => ({ 'ppt/slides/slide10.xml': enc('<a:p><a:r><a:t>Dez</a:t></a:r></a:p>'), 'ppt/slides/slide2.xml': enc('<a:p><a:r><a:t>Dois</a:t></a:r></a:p>') });
    const ex = extractText(new Uint8Array(4), 'application/vnd.openxmlformats-officedocument.presentationml.presentation', unzip);
    expect(ex.text).toBe('Diapositivo 1\nDois\n\nDiapositivo 2\nDez');
  });
  it('texto, Windows-1252 e limite de 60 000 caracteres; PDF e imagens sem texto local', () => {
    expect(extractText(enc('a  b\r\n\r\n\r\nc'), 'text/plain').text).toBe('a b\n\nc');
    expect(decodeText(new Uint8Array([0x50, 0x6f, 0x6c, 0xed, 0x74, 0x69, 0x63, 0x61]))).toBe('Política');
    const big = extractText(enc('x'.repeat(MAX_TEXT + 10)), 'text/csv');
    expect(big.text).toHaveLength(MAX_TEXT);
    expect(big.truncated).toBe(true);
    expect(extractText(new Uint8Array(4), 'application/pdf')).toMatchObject({ text: '', native: true });
    expect(extractText(new Uint8Array(4), 'application/msword')).toMatchObject({ text: '', method: 'none' });
    expect(extractText(new Uint8Array(4), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', () => { throw new Error('zip'); }).text).toBe('');
  });
});

describe('ativos expostos (art. 32.º)', () => {
  it('coincidência exata de IP/FQDN', () => {
    const ids = exposedIdentifiers([{ internet_exposed: true, ip_address: '10.0.0.1', fqdn: 'https://vpn.exemplo.pt/x' }, { internet_exposed: false, ip_address: '8.8.8.8' }]);
    expect(ids).toEqual(['10.0.0.1', 'vpn.exemplo.pt']);
    expect(textHasIdentifier('acesso por VPN.exemplo.pt', ids)).toBe(true);
    expect(textHasIdentifier('servidor 10.0.0.15', ids)).toBe(false);
    expect(textHasIdentifier('servidor 8.8.8.8', ids)).toBe(false);
  });
});
describe('qualidade das propostas (intakeMetrics)', () => {
  const keyOf = (id) => ({ 'measure:a': 'measure:A', 'measure:b': 'measure:B', 'iso27001:c': 'iso27001:5.1', 'journey:x': null }[id] ?? null);
  const cls = (links, extra = {}) => ({ classified_at: '2026-10-01T10:00:00Z', provider: 'claude', model: 'm', links, ...extra });
  const intakes = [
    { status: 'accepted', decided_at: '2026-10-01T10:10:00Z', classification: cls([{ candidate_id: 'measure:a', confidence: 0.9 }, { candidate_id: 'measure:b', confidence: 0.4 }]),
      accepted_links: [{ type: 'measure', id: 'A' }, { type: 'iso27001', id: '9.9' }] },
    { status: 'accepted', decided_at: '2026-10-01T10:30:00Z', classification: cls([{ candidate_id: 'iso27001:c', confidence: 0.6 }, { candidate_id: 'journey:x', confidence: 0.9 }]),
      accepted_links: [{ type: 'iso27001', id: '5.1' }] },
    { status: 'rejected', classification: cls([{ candidate_id: 'measure:a', confidence: 0.9 }]) },
    { status: 'proposed', classification: cls([{ candidate_id: 'measure:a', confidence: 0.9 }]) },
    { status: 'accepted', accepted_links: [{ type: 'measure', id: 'A' }] }, // indexado à mão, sem proposta
    { status: 'pending' },
  ];
  const m = intakeMetrics(intakes, keyOf);
  it('conta estados e só mede documentos indexados com proposta', () => {
    expect(m.total).toBe(6);
    expect(m.by_status).toEqual({ accepted: 3, rejected: 1, proposed: 1, pending: 1 });
    expect(m.classified).toBe(4);
    expect(m.reviewed).toBe(2);
    expect(m.rejected_after_proposal).toBe(1);
  });
  it('ligações mantidas, retiradas e acrescentadas (candidatos sem ligação ficam de fora)', () => {
    expect(m.links).toEqual({ proposed: 3, kept: 2, dropped: 1, added: 1, kept_rate: 0.667, from_proposal_rate: 0.667 });
    expect(m.documents_all_kept).toBe(1);
    expect(m.documents_none_kept).toBe(0);
  });
  it('taxa por faixa de confiança e mediana do tempo até à decisão', () => {
    const band = Object.fromEntries(m.by_confidence.map((b) => [b.band, b]));
    expect(band.high).toMatchObject({ proposed: 1, kept: 1, kept_rate: 1 });
    expect(band.medium).toMatchObject({ proposed: 1, kept: 1 });
    expect(band.low).toMatchObject({ proposed: 1, kept: 0, kept_rate: 0 });
    expect(m.median_minutes_to_decision).toBe(20);
    expect(m.by_engine).toEqual([{ engine: 'claude · m', documents: 2, proposed: 3, kept: 2, kept_rate: 0.667 }]);
  });
  it('sem dados devolve taxas nulas', () => {
    const e = intakeMetrics([], keyOf);
    expect(e.links.kept_rate).toBeNull();
    expect(e.median_minutes_to_decision).toBeNull();
  });
});

describe('WebDAV PROPFIND (parsePropfind)', () => {
  const xml = `<?xml version="1.0"?>
<D:multistatus xmlns:D="DAV:">
  <D:response><D:href>/dav/AnkoraOne/Cliente/00%20Por%20classificar/</D:href>
    <D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop></D:propstat></D:response>
  <D:response><D:href>/dav/AnkoraOne/Cliente/00%20Por%20classificar/Pol%C3%ADtica%20de%20seguran%C3%A7a.docx</D:href>
    <D:propstat><D:prop><D:resourcetype/><D:getcontentlength>2048</D:getcontentlength>
    <D:getcontenttype>application/vnd.openxmlformats-officedocument.wordprocessingml.document</D:getcontenttype></D:prop></D:propstat></D:response>
  <D:response><D:href>/dav/AnkoraOne/Cliente/00%20Por%20classificar/antigos/</D:href>
    <D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop></D:propstat></D:response>
</D:multistatus>`;
  it('lê nomes, tamanhos e pastas com qualquer prefixo', () => {
    const r = parsePropfind(xml);
    expect(r).toHaveLength(3);
    expect(r[0]).toMatchObject({ collection: true, self: true });
    expect(r[1]).toMatchObject({ name: 'Política de segurança.docx', size: 2048, collection: false, self: false });
    expect(r[2]).toMatchObject({ name: 'antigos', collection: true, self: false });
    expect(parsePropfind(xml.replace(/D:/g, 'd:').replace(/xmlns:D/, 'xmlns:d'))[1].name).toBe('Política de segurança.docx');
  });
  it('resposta vazia ou inválida não falha', () => {
    expect(parsePropfind('')).toEqual([]);
    expect(parsePropfind('<html>erro</html>')).toEqual([]);
  });
});
