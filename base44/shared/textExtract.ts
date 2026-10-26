/**
 * Extração de texto de um documento carregado, no servidor (função documentIntake).
 *
 *  - text/*, CSV, JSON, XML, Markdown, email (.eml) → texto (UTF-8; se não for UTF-8 válido, Windows-1252)
 *  - DOCX → word/document.xml, sem etiquetas, com as mudanças de parágrafo
 *  - XLSX → sharedStrings + valores das folhas (uma linha por linha da folha, células separadas por tabulação)
 *  - PPTX → texto de cada diapositivo, pela ordem
 *  - ODT/ODS/ODP → content.xml
 *  - PDF e imagens → sem texto local: o modelo lê o ficheiro diretamente (native = true)
 *  - DOC/XLS/PPT antigos (OLE) → sem texto local
 *
 * O ZIP é aberto pela função `unzip` recebida (na função: unzipSync de npm:fflate), para este módulo não depender
 * de imports do Deno e poder ser testado no Vitest. Texto limitado a MAX_TEXT caracteres.
 */

export const MAX_TEXT = 60000;
// Cada entrada do ZIP descomprimida não pode passar disto (proteção contra «zip bombs»).
const MAX_ENTRY_BYTES = 20 * 1024 * 1024;

export type Unzip = (bytes: Uint8Array, opts?: { filter?: (f: { name: string; size: number; originalSize: number }) => boolean }) => Record<string, Uint8Array>;

export type Extracted = { text: string; method: string; native: boolean; truncated: boolean };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Limpa espaços: linhas sem espaços repetidos e no máximo uma linha vazia seguida. */
export function tidy(s: string): string {
  return s.replace(/\r\n?/g, '\n').replace(/[ \t\f\v ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

const utf8 = (b?: Uint8Array) => (b ? new TextDecoder('utf-8').decode(b) : '');

/** XML de texto (DOCX/ODT/PPTX): fim de parágrafo e quebras → nova linha; tabulação → espaço; resto das etiquetas sai. */
export function xmlToText(xml: string, paragraphTags: string[] = ['w:p', 'a:p', 'text:p', 'text:h']): string {
  let s = String(xml || '');
  for (const tag of paragraphTags) s = s.split(`</${tag}>`).join('\n');
  s = s.replace(/<(w:br|w:cr|a:br|text:line-break)\b[^>]*\/?>/g, '\n').replace(/<(w:tab|text:tab|text:s)\b[^>]*\/?>/g, ' ');
  s = s.replace(/<[^>]+>/g, '');
  return tidy(decodeEntities(s));
}

/** Texto de cada <si> de sharedStrings.xml (pode ter vários <t> em execuções <r>). */
export function sharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const m of String(xml || '').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const parts = [...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]);
    out.push(decodeEntities(parts.join('')));
  }
  return out;
}

/** Valores de uma folha XLSX: uma linha por <row>, células separadas por tabulação. */
export function sheetToText(xml: string, shared: string[]): string {
  const rows: string[] = [];
  for (const r of String(xml || '').matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1] || '';
      const inner = c[2] || '';
      const type = (attrs.match(/\bt="([^"]+)"/) || [])[1] || '';
      let v = '';
      if (type === 'inlineStr') v = [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('');
      else {
        const raw = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '';
        v = type === 's' ? (shared[Number(raw)] ?? '') : raw;
      }
      v = decodeEntities(v).trim();
      if (v) cells.push(v);
    }
    if (cells.length) rows.push(cells.join('\t'));
  }
  return rows.join('\n');
}

const num = (name: string) => Number((name.match(/(\d+)\.xml$/) || [])[1] || 0);

function cap(text: string, method: string, native = false): Extracted {
  const clean = String(text || '');
  return { text: clean.slice(0, MAX_TEXT), method, native, truncated: clean.length > MAX_TEXT };
}

/**
 * Texto de um documento. `mime` é o tipo já confirmado por checkFile (shared/fileCheck.ts).
 * Erros de leitura do ZIP não interrompem o pedido: devolvem texto vazio (a classificação usa então o nome).
 */
export function extractText(bytes: Uint8Array, mime: string, unzip?: Unzip): Extracted {
  const m = String(mime || '').toLowerCase();
  if (m === 'application/pdf' || m.startsWith('image/')) return cap('', 'native', true);
  if (m.startsWith('text/') || m === 'application/json' || m === 'application/xml' || m === 'message/rfc822') {
    const raw = decodeText(bytes.subarray(0, MAX_TEXT * 4));
    // XML: tira as etiquetas, para a pontuação não contar nomes de elementos.
    return cap(m.includes('xml') ? tidy(decodeEntities(raw.replace(/<[^>]+>/g, ' '))) : tidy(raw), 'text');
  }
  const isOoxml = m.includes('openxmlformats');
  const isOdf = m.includes('opendocument');
  if (!unzip || (!isOoxml && !isOdf)) return cap('', 'none');
  let files: Record<string, Uint8Array>;
  try {
    files = unzip(bytes, {
      filter: (f) => f.originalSize <= MAX_ENTRY_BYTES && (
        f.name === 'word/document.xml' || f.name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name)
        || /^ppt\/slides\/slide\d+\.xml$/.test(f.name) || f.name === 'content.xml'),
    });
  } catch {
    return cap('', 'none');
  }
  if (isOdf) return cap(xmlToText(utf8(files['content.xml']), ['text:p', 'text:h']), 'odf');
  if (m.includes('wordprocessingml')) return cap(xmlToText(utf8(files['word/document.xml']), ['w:p']), 'docx');
  if (m.includes('spreadsheetml')) {
    const shared = sharedStrings(utf8(files['xl/sharedStrings.xml']));
    const sheets = Object.keys(files).filter((n) => n.startsWith('xl/worksheets/')).sort((a, b) => num(a) - num(b));
    return cap(sheets.map((n) => sheetToText(utf8(files[n]), shared)).filter(Boolean).join('\n\n'), 'xlsx');
  }
  if (m.includes('presentationml')) {
    const slides = Object.keys(files).filter((n) => n.startsWith('ppt/slides/')).sort((a, b) => num(a) - num(b));
    return cap(slides.map((n, i) => `Diapositivo ${i + 1}\n${xmlToText(utf8(files[n]), ['a:p'])}`).join('\n\n'), 'pptx');
  }
  return cap('', 'none');
}
