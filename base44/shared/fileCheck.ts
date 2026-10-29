/**
 * Verificação de ficheiros carregados (evidências e restantes anexos).
 * O tipo é confirmado pelos primeiros bytes, não pelo que o browser declara.
 */

export const ALLOWED_MIME = /^(application\/pdf|image\/(png|jpeg|gif|webp)|text\/(plain|csv|xml|markdown)|application\/(zip|json|xml|vnd\.openxmlformats-officedocument\.[\w.]+|vnd\.ms-excel|vnd\.ms-powerpoint|msword|vnd\.oasis\.opendocument\.[\w.]+)|message\/rfc822)$/i;

const BY_EXT: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json', xml: 'application/xml', zip: 'application/zip',
  eml: 'message/rfc822',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint',
  odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet', odp: 'application/vnd.oasis.opendocument.presentation',
};

/**
 * Tipo normalizado pela extensão. Os browsers declaram tipos diferentes para o mesmo ficheiro
 * (XML como text/xml, CSV como application/vnd.ms-excel no Windows, ZIP como x-zip-compressed);
 * a extensão decide e o conteúdo é depois confirmado por sniff().
 */
export function normalizeMime(fileName: string, declared: string): string {
  const ext = String(fileName || '').toLowerCase().split('.').pop() || '';
  return BY_EXT[ext] || String(declared || 'application/octet-stream').toLowerCase();
}

const startsWith = (b: Uint8Array, sig: number[], off = 0) => sig.every((x, i) => b[off + i] === x);

/** Família real do ficheiro, pelos primeiros bytes. */
export function sniff(b: Uint8Array): string {
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46])) return 'pdf';
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47])) return 'png';
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(b, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06])) return 'zip';
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'ole';
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(0, Math.min(b.length, 65536)));
    if (/<\s*(html|script|iframe|svg|object|embed)\b/i.test(text)) return 'active';
    return 'text';
  } catch {
    // CSV ou TXT exportados em Windows-1252 (acentos) não são UTF-8 válido, mas continuam a ser texto.
    const sample = b.subarray(0, Math.min(b.length, 4096));
    const ctrl = Array.from(sample).filter((x) => x < 9 || (x > 13 && x < 32)).length;
    return ctrl === 0 ? 'text' : 'binary';
  }
}

/** Família esperada para cada tipo. */
export function expectedFamily(mime: string): string[] {
  const m = mime.toLowerCase();
  if (m === 'application/pdf') return ['pdf'];
  if (m === 'image/png') return ['png'];
  if (m === 'image/jpeg') return ['jpeg'];
  if (m === 'image/gif') return ['gif'];
  if (m === 'image/webp') return ['webp'];
  if (m === 'application/zip' || m.includes('openxmlformats') || m.includes('opendocument')) return ['zip'];
  if (m === 'application/vnd.ms-excel' || m === 'application/msword' || m === 'application/vnd.ms-powerpoint') return ['ole', 'text'];
  if (m.startsWith('text/') || m === 'application/json' || m === 'application/xml' || m === 'message/rfc822') return ['text'];
  return [];
}

/** Lança erro (em PT-PT) se o ficheiro não for aceitável. Devolve o tipo normalizado. */
export function checkFile(name: string, declaredMime: string, bytes: Uint8Array, max: number): string {
  if (!name) throw new Error('Nome do ficheiro em falta');
  const mime = normalizeMime(name, declaredMime);
  if (!ALLOWED_MIME.test(mime)) throw new Error('Tipo de ficheiro não permitido');
  if (!bytes.byteLength || bytes.byteLength > max) throw new Error(`Ficheiro vazio ou maior do que ${Math.round(max / 1048576)} MB`);
  if (!expectedFamily(mime).includes(sniff(bytes))) throw new Error('O conteúdo do ficheiro não corresponde ao tipo indicado');
  return mime;
}
