// Estilo comum dos documentos Word da AnkoraOne (manual de onboarding e guias por referencial).
// Cores da aplicação: azul-escuro #070A13, dourado #CFA04A, verde-azulado #26A699.
const fs = require('fs');
const path = require('path');
const {
  Document, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle, Header, Footer, PageNumber,
  TableOfContents, VerticalAlign,
} = require('docx');

const DIR = __dirname;
const NAVY = '070A13', GOLD = 'CFA04A', TEAL = '26A699', INK = '111827', MUTED = '5B6474', LINE = 'D9DEE7', TINT = 'F4F1EA', TEALT = 'E6F5F3';
const GOLD_DARK = '8A6620', TEAL_DARK = '17766C';
const FONT = 'Calibri';
const W = 9638; // largura útil A4 com margens de 2 cm (DXA)

const t = (text, o = {}) => new TextRun({ text, font: FONT, ...o });
const rich = (s) => String(s).split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((x) => (x.startsWith('**') ? t(x.slice(2, -2), { bold: true }) : t(x)));
const p = (runs, o = {}) => new Paragraph({ spacing: { after: 120, line: 288 }, ...o, children: (Array.isArray(runs) ? runs : [runs]).map((r) => (typeof r === 'string' ? t(r) : r)) });
const P = (s, o) => p(rich(s), o);
const note = (s) => p([t(s, { italics: true, color: MUTED, size: 18 })]);
const H1 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [t(s)] });
const H2 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [t(s)] });
const H3 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [t(s)] });
const B = (s, level = 0) => new Paragraph({ numbering: { reference: 'bullets', level }, spacing: { after: 80, line: 276 }, children: rich(s) });
// Listas numeradas: cada referência recomeça em 1. Use uma referência diferente por lista (ver NUMBERED).
const N = (s, ref = 'n1') => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 80, line: 276 }, children: rich(s) });
const NUMBERED = Array.from({ length: 30 }, (_, i) => `n${i + 1}`);
const gap = () => new Paragraph({ spacing: { after: 60 }, children: [] });

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };
function table(headers, rows, widths) {
  const sum = widths.reduce((a, b) => a + b, 0);
  const ws = widths.map((w) => Math.round((w / sum) * W));
  ws[ws.length - 1] += W - ws.reduce((a, b) => a + b, 0);
  const cell = (txt, i, head) => new TableCell({
    width: { size: ws[i], type: WidthType.DXA }, borders,
    shading: head ? { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    children: String(txt).split('\n').map((line) => new Paragraph({ spacing: { after: 40 }, children: head ? [t(line, { bold: true, color: 'FFFFFF', size: 19 })] : rich(line) })),
  });
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: ws,
    rows: [new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, i, true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) }))],
  });
}

// Caixa de destaque (tabela de uma célula com fundo suave)
function callout(title, lines, fill = TINT, accent = GOLD) {
  const b = { style: BorderStyle.SINGLE, size: 4, color: fill };
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: W, type: WidthType.DXA }, shading: { fill, type: ShadingType.CLEAR, color: 'auto' },
      borders: { top: b, bottom: b, left: b, right: b },
      margins: { top: 140, bottom: 140, left: 200, right: 200 },
      children: [new Paragraph({ spacing: { after: 80 }, children: [t(title, { bold: true, color: accent === GOLD ? GOLD_DARK : TEAL_DARK })] }),
        ...lines.map((l) => new Paragraph({ spacing: { after: 60, line: 276 }, children: rich(l) }))],
    })] })],
  });
}
const tip = (title, lines) => callout(title, lines, TEALT, TEAL);

const logoNavy = fs.readFileSync(path.join(DIR, 'logo-navy.png'));
const logoWhite = fs.readFileSync(path.join(DIR, 'logo-white.png'));

/** Capa azul-escura com o logótipo, a etiqueta, o título, o resumo e a versão. */
function cover({ kicker, title, summary, version }) {
  const none = { style: BorderStyle.NONE, size: 0, color: NAVY };
  return [new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [
    new TableRow({ height: { value: 12600, rule: 'atLeast' }, children: [new TableCell({
      width: { size: W, type: WidthType.DXA }, shading: { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' },
      borders: { top: none, bottom: none, left: none, right: none },
      margins: { top: 500, bottom: 500, left: 500, right: 500 }, verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({ spacing: { after: 1400 }, children: [new ImageRun({ type: 'png', data: logoWhite, transformation: { width: 300, height: 68 } })] }),
        new Paragraph({ spacing: { after: 200 }, children: [t(kicker, { color: GOLD, bold: true, size: 22, characterSpacing: 60 })] }),
        new Paragraph({ spacing: { after: 240 }, children: [t(title, { color: 'FFFFFF', bold: true, size: 56 })] }),
        new Paragraph({ spacing: { after: 1600, line: 300 }, children: [t(summary, { color: 'C9CFDA', size: 24 })] }),
        new Paragraph({ spacing: { after: 60 }, children: [t(version, { color: 'C9CFDA', size: 20 })] }),
        new Paragraph({ children: [t('app.ankoraone.com', { color: GOLD, size: 20, bold: true })] }),
      ],
    })] }),
  ] })];
}

const toc = () => [
  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [t('Índice')] }),
  new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-2' }),
  note('Se o índice aparecer vazio, atualize os campos no Word (botão direito → Atualizar campo).'),
];

/** Documento A4 com capa, cabeçalho (logótipo e nome) e rodapé com o número de página. */
function makeDocument({ title, description, headerText, coverChildren, body }) {
  return new Document({
    creator: 'AnkoraOne', features: { updateFields: true }, title, description,
    styles: {
      default: { document: { run: { font: FONT, size: 21, color: INK } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 36, bold: true, color: NAVY, font: FONT }, paragraph: { spacing: { before: 120, after: 240 }, outlineLevel: 0, keepNext: true } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, color: GOLD_DARK, font: FONT }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1, keepNext: true } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true, color: TEAL_DARK, font: FONT }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2, keepNext: true } },
      ],
    },
    numbering: { config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
      ...NUMBERED.map((reference) => ({ reference, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] })),
    ] },
    sections: [
      { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: coverChildren },
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1134, left: 1134, right: 1134 } } },
        headers: { default: new Header({ children: [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 6 } }, children: [new ImageRun({ type: 'png', data: logoNavy, transformation: { width: 110, height: 25 } }), t(`     ${headerText}`, { color: MUTED, size: 16 })] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [t('Página ', { color: MUTED, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, color: MUTED, size: 16 })] })] }) },
        children: body,
      },
    ],
  });
}

module.exports = {
  DIR, NAVY, GOLD, TEAL, INK, MUTED, LINE, TINT, TEALT, GOLD_DARK, TEAL_DARK, W,
  t, rich, p, P, note, H1, H2, H3, B, N, gap, table, callout, tip, cover, toc, makeDocument,
};
