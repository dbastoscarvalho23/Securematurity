/**
 * Exportação da documentação técnica para PDF (A4, com capa, índice e rodapé).
 *
 * Lê o mesmo modelo que a página /documentacao-tecnica (`src/lib/docsModel.js`)
 * e o conteúdo narrativo de `src/lib/devDocsData.js`, pelo que o documento
 * descarregado reflete sempre o RBAC e o catálogo de módulos do código.
 */

import { jsPDF } from 'jspdf';
import {
  DATA_MODEL,
  DELEGATION_FLOW,
  DEV_GUIDE,
  DOCS_META,
  LAYERS,
  LICENSE_CATALOG,
  SECURITY_MODEL,
  STACK,
  TENANCY_MODELS,
} from './devDocsData';
import {
  ACTION_ACCENTS,
  ACTION_COLUMNS,
  CAPABILITY_TIER_ENTRIES,
  LEGACY_ALIASES,
  MODULES,
  RESOURCES,
  ROLE_NOTES_BY_CODE,
  ROLES,
  TIER_ACCENTS,
  TIER_LABELS,
  buildAreaMap,
  buildDocsTotals,
  buildModuleCards,
  buildTierLayers,
  capabilityActions,
  resourceLabel,
  visibleResourceCount,
} from './docsModel';

// ─── Paleta ────────────────────────────────────────────────────
const NAVY = [20, 30, 60];
const NAVY_SOFT = [205, 214, 240];
const INK = [30, 41, 59];
const MUTED = [100, 110, 130];
const BORDER = [222, 227, 236];
const SOFT = [245, 247, 250];
const WHITE = [255, 255, 255];
const BLUE = [37, 99, 235];
const TEAL = [13, 148, 136];
const GOLD = [202, 138, 4];
const VIOLET = [124, 58, 237];
const CYAN = [8, 145, 178];
const PINK = [219, 39, 119];
const ORANGE = [234, 88, 12];
const SLATE = [148, 163, 184];

const M = 16;      // margem lateral
const GAP = 4;     // intervalo entre cartões
const CHIP_H = 5;

const SECTION_ACCENTS = [BLUE, VIOLET, TEAL, GOLD, CYAN, PINK, NAVY, SLATE, ORANGE];
const SCOPE_ACCENTS = { Plataforma: NAVY, Parceiro: BLUE, Cliente: TEAL, Externo: GOLD };

const SECTIONS = [
  'Visão geral e arquitetura',
  'Multitenancy e delegação',
  'Papéis',
  'Matriz de capacidades',
  'Módulos e licenciamento',
  'Áreas funcionais',
  'Modelo de segurança',
  'Modelo de dados',
  'Guia de desenvolvimento',
];

// ─── Primitivas de desenho ─────────────────────────────────────

const setFill = (doc, c) => doc.setFillColor(c[0], c[1], c[2]);
const setDraw = (doc, c) => doc.setDrawColor(c[0], c[1], c[2]);
const setText = (doc, c) => doc.setTextColor(c[0], c[1], c[2]);

/** Mistura duas cores (t = peso da segunda). */
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const tint = (accent, t = 0.88) => mix(accent, WHITE, t);

const lineH = (size) => size * 0.3528 * 1.32;
const pageSize = (doc) => ({
  W: doc.internal.pageSize.getWidth(),
  H: doc.internal.pageSize.getHeight(),
});

function newPage(doc, orientation = 'portrait') {
  doc.addPage('a4', orientation);
  return M + 6;
}

function ensure(doc, y, needed, orientation = 'portrait') {
  const { H } = pageSize(doc);
  return y + needed > H - 20 ? newPage(doc, orientation) : y;
}

function text(doc, str, x, y, { size = 9, style = 'normal', color = INK, align = 'left' } = {}) {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  setText(doc, color);
  doc.text(str, x, y, { align });
  return y + lineH(size);
}

function paragraph(doc, str, x, y, w, { size = 8, style = 'normal', color = MUTED } = {}) {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  setText(doc, color);
  const lines = doc.splitTextToSize(str, w);
  doc.text(lines, x, y);
  return y + lines.length * lineH(size);
}

function splitLines(doc, str, w, size = 8) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  return doc.splitTextToSize(String(str ?? ''), w);
}

/** Nº de linhas que um texto ocupa numa dada largura. */
const measure = (doc, str, w, size = 8) => splitLines(doc, str, w, size).length;

function bar(doc, x, top, w, pct, accent, h = 2.4) {
  setFill(doc, BORDER);
  doc.roundedRect(x, top, w, h, h / 2, h / 2, 'F');
  setFill(doc, accent);
  doc.roundedRect(x, top, Math.max(0.8, (w * Math.min(pct, 100)) / 100), h, h / 2, h / 2, 'F');
  return top + h;
}

function chipWidth(doc, label, size = 7) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  return doc.getTextWidth(label) + 4;
}

function drawChip(doc, label, x, top, { accent = SLATE, filled = false, size = 7 } = {}) {
  const w = chipWidth(doc, label, size);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  if (filled) {
    setFill(doc, accent);
    doc.roundedRect(x, top, w, CHIP_H, 1.4, 1.4, 'F');
    setText(doc, WHITE);
  } else {
    setFill(doc, tint(accent, 0.9));
    setDraw(doc, tint(accent, 0.6));
    doc.setLineWidth(0.25);
    doc.roundedRect(x, top, w, CHIP_H, 1.4, 1.4, 'FD');
    setText(doc, accent);
  }
  doc.text(label, x + 2, top + CHIP_H * 0.7);
  return w;
}

const drawChipRight = (doc, label, rightX, top, options) => {
  const w = chipWidth(doc, label, options?.size);
  drawChip(doc, label, rightX - w, top, options);
};

/** Linha de chips com quebra automática; devolve o `y` seguinte. */
function chipRow(doc, labels, x, top, maxX, { accent = SLATE, size = 7, gap = 1.6 } = {}) {
  let cx = x;
  let cy = top;
  labels.forEach(({ label, filled }) => {
    const w = chipWidth(doc, label, size);
    if (cx + w > maxX && cx > x) {
      cx = x;
      cy += CHIP_H + gap;
    }
    drawChip(doc, label, cx, cy, { accent, filled, size });
    cx += w + gap;
  });
  return cy + CHIP_H;
}

/** Altura que uma linha de chips vai ocupar. */
function chipRowHeight(doc, labels, width, size = 7, gap = 1.6) {
  let lines = 1;
  let used = 0;
  labels.forEach(({ label }) => {
    const w = chipWidth(doc, label, size) + gap;
    if (used + w > width && used > 0) {
      lines += 1;
      used = 0;
    }
    used += w;
  });
  return lines * CHIP_H + (lines - 1) * gap;
}

function card(doc, x, y, w, h, { fill = SOFT, accent, radius = 2 } = {}) {
  setFill(doc, fill);
  setDraw(doc, BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, radius, radius, 'FD');
  if (accent) {
    setFill(doc, accent);
    doc.roundedRect(x, y, 1.6, h, 0.8, 0.8, 'F');
  }
}

function bulletList(doc, items, x, y, w, { size = 7.5, color = MUTED } = {}) {
  items.forEach((item) => {
    setFill(doc, SLATE);
    doc.circle(x + 1, y - 1.1, 0.7, 'F');
    y = paragraph(doc, item, x + 3.4, y, w - 3.4, { size, color }) + 1;
  });
  return y;
}

const bulletsHeight = (doc, items, w, size = 7.5) =>
  items.reduce((total, item) => total + measure(doc, item, w - 3.4, size) * lineH(size) + 1, 0);

function sectionHeading(doc, y, index, title, accent) {
  const { W } = pageSize(doc);
  setFill(doc, accent);
  doc.roundedRect(M, y, 7.5, 7.5, 1.6, 1.6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  setText(doc, WHITE);
  doc.text(String(index), M + 3.75, y + 5.3, { align: 'center' });
  doc.setFontSize(14);
  setText(doc, NAVY);
  doc.text(title, M + 11, y + 5.6);
  setDraw(doc, tint(accent, 0.55));
  doc.setLineWidth(0.6);
  doc.line(M, y + 10.5, W - M, y + 10.5);
  return y + 17;
}

const bandTitle = (doc, y, label, accent) =>
  text(doc, label.toUpperCase(), M, y, { size: 7.5, style: 'bold', color: accent });

const roleLabel = (role, t) => (t && t(`role_${role}`)) || role;

// ─── Secções ───────────────────────────────────────────────────

function cover(doc) {
  const { W } = pageSize(doc);
  const totals = buildDocsTotals();

  setFill(doc, NAVY);
  doc.rect(0, 0, W, 84, 'F');
  setFill(doc, BLUE);
  doc.rect(0, 84, W, 2.5, 'F');

  text(doc, 'ANKORAONE PLATFORM', M, 22, { size: 9, style: 'bold', color: NAVY_SOFT });
  text(doc, 'Documentação técnica', M, 38, { size: 26, style: 'bold', color: WHITE });
  text(doc, `${DOCS_META.app} · ${DOCS_META.branch}`, M, 48, { size: 11, style: 'bold', color: NAVY_SOFT });
  paragraph(doc, DOCS_META.scope, M, 58, W - 2 * M - 4, { size: 8.5, color: [180, 195, 230] });
  text(doc, `Gerado em ${new Date().toLocaleDateString('pt-PT')}`, M, 77, { size: 8, color: [150, 168, 210] });

  let y = 96;
  const tiles = [
    { label: 'Papéis', value: totals.roles, accent: BLUE },
    { label: 'Módulos', value: totals.modules, accent: TEAL },
    { label: 'Tiers', value: totals.tiers, accent: GOLD },
    { label: 'Áreas funcionais', value: totals.areas, accent: VIOLET },
    { label: 'Entidades', value: totals.entities, accent: CYAN },
    { label: 'Funções backend', value: totals.functions, accent: PINK },
  ];
  const tileW = (W - 2 * M - GAP * (tiles.length - 1)) / tiles.length;
  tiles.forEach((tile, i) => {
    const x = M + i * (tileW + GAP);
    card(doc, x, y, tileW, 18, { accent: tile.accent });
    text(doc, String(tile.value), x + tileW / 2, y + 9, { size: 16, style: 'bold', color: tile.accent, align: 'center' });
    text(doc, tile.label, x + tileW / 2, y + 15, { size: 6.5, color: MUTED, align: 'center' });
  });
  y += 30;

  y = bandTitle(doc, y, 'Identificação do documento', BLUE) + 1;
  [
    ['Aplicação', DOCS_META.app],
    ['App ID', DOCS_META.appId],
    ['Branch', DOCS_META.branch],
    ['Público', DOCS_META.audience],
  ].forEach(([label, value]) => {
    text(doc, label, M + 1, y, { size: 8, style: 'bold', color: MUTED });
    y = paragraph(doc, value, M + 42, y, W - 2 * M - 44, { size: 8, color: INK }) + 1.4;
  });

  y += 6;
  y = bandTitle(doc, y, 'Índice', BLUE) + 1;
  SECTIONS.forEach((title, i) => {
    setFill(doc, SECTION_ACCENTS[i] || BLUE);
    doc.circle(M + 2, y - 1.1, 1.1, 'F');
    y = text(doc, `${i + 1}. ${title}`, M + 6, y, { size: 9, style: 'bold', color: INK }) + 0.6;
  });
}

function sectionArchitecture(doc) {
  const accent = SECTION_ACCENTS[0];
  const { W } = pageSize(doc);
  let y = sectionHeading(doc, newPage(doc, 'portrait'), 1, SECTIONS[0], accent);

  y = bandTitle(doc, y, 'Stack e princípios', accent) + 1;
  const cols = 2;
  const colW = (W - 2 * M - GAP) / cols;
  for (let i = 0; i < STACK.length; i += cols) {
    const row = STACK.slice(i, i + cols);
    const heights = row.map((item) => 10 + measure(doc, item.value, colW - 8, 8) * lineH(8));
    const h = Math.max(...heights);
    y = ensure(doc, y, h + GAP);
    row.forEach((item, c) => {
      const x = M + c * (colW + GAP);
      card(doc, x, y, colW, h, { accent });
      text(doc, item.label.toUpperCase(), x + 4.5, y + 5, { size: 7, style: 'bold', color: accent });
      paragraph(doc, item.value, x + 4.5, y + 8.6, colW - 8, { size: 8, color: INK });
    });
    y += h + GAP;
  }

  y = ensure(doc, y + 4, 40);
  y = bandTitle(doc, y, 'Camadas de controlo (permissiva → restritiva)', accent) + 1;
  LAYERS.forEach((layer, index) => {
    const layerAccent = [BLUE, GOLD, TEAL][index] || BLUE;
    const h = 13 + measure(doc, layer.detail, W - 2 * M - 22, 8) * lineH(8);
    y = ensure(doc, y, h + GAP);
    card(doc, M, y, W - 2 * M, h, { accent: layerAccent, fill: tint(layerAccent, 0.94) });
    setFill(doc, layerAccent);
    doc.roundedRect(M + 4, y + 3.5, 6, 6, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    setText(doc, WHITE);
    doc.text(String(layer.order), M + 7, y + 7.8, { align: 'center' });
    text(doc, layer.title, M + 13, y + 5.5, { size: 9, style: 'bold', color: layerAccent });
    const ty = paragraph(doc, layer.detail, M + 13, y + 9.5, W - 2 * M - 22, { size: 8, color: INK });
    text(doc, layer.location, M + 13, ty + 1.6, { size: 6.5, style: 'bold', color: MUTED });
    y += h + GAP;
  });
}

function sectionTenancy(doc) {
  const accent = SECTION_ACCENTS[1];
  const { W } = pageSize(doc);
  let y = sectionHeading(doc, newPage(doc, 'portrait'), 2, SECTIONS[1], accent);

  const cols = 2;
  const colW = (W - 2 * M - GAP) / cols;
  const accents = [BLUE, VIOLET, TEAL, GOLD];

  for (let i = 0; i < TENANCY_MODELS.length; i += cols) {
    const row = TENANCY_MODELS.slice(i, i + cols);
    const heights = row.map((model) => 16 + measure(doc, model.description, colW - 8, 7.5) * lineH(7.5));
    const h = Math.max(...heights);
    y = ensure(doc, y, h + GAP);
    row.forEach((model, c) => {
      const modelAccent = accents[i + c] || BLUE;
      const x = M + c * (colW + GAP);
      card(doc, x, y, colW, h, { accent: tint(modelAccent, 0.5), fill: tint(modelAccent, 0.95) });
      text(doc, model.name, x + 4.5, y + 5.5, { size: 9, style: 'bold', color: modelAccent });
      const ty = paragraph(doc, model.description, x + 4.5, y + 9.5, colW - 8, { size: 7.5, color: INK });
      chipRow(doc, model.fields.map((label) => ({ label })), x + 4.5, ty + 1.5, x + colW - 4, { accent: modelAccent, size: 6 });
    });
    y += h + GAP;
  }

  y = ensure(doc, y + 4, 24);
  y = bandTitle(doc, y, 'Ciclo de delegação', accent) + 1;
  DELEGATION_FLOW.forEach((step, index) => {
    y = ensure(doc, y, 10);
    setFill(doc, tint(accent, 0.85));
    doc.circle(M + 2.5, y + 1.5, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setText(doc, accent);
    doc.text(String(index + 1), M + 2.5, y + 2.6, { align: 'center' });
    y = paragraph(doc, step, M + 8, y + 3, W - 2 * M - 8, { size: 8, color: INK }) + 1.6;
  });
}

function sectionRoles(doc, t) {
  const accent = SECTION_ACCENTS[2];
  const { W } = pageSize(doc);
  let y = sectionHeading(doc, newPage(doc, 'portrait'), 3, SECTIONS[2], accent);
  const bodyW = W - 2 * M - 20;

  ROLES.forEach((role) => {
    const note = ROLE_NOTES_BY_CODE.get(role) || {};
    const roleAccent = SCOPE_ACCENTS[note.scope] || TEAL;
    const h = 17 + measure(doc, note.summary, bodyW - 32, 8) * lineH(8);
    y = ensure(doc, y, h + GAP);
    card(doc, M, y, W - 2 * M, h, {});
    drawChip(doc, roleLabel(role, t), M + 4, y + 3.5, { accent: roleAccent, filled: true, size: 7.5 });
    text(doc, `${note.scope || '—'} · ${role}`, M + 4, y + 12.5, { size: 6.5, style: 'bold', color: MUTED });
    paragraph(doc, note.summary, M + 4, y + 17, bodyW - 32, { size: 8, color: INK });

    const visible = visibleResourceCount(role);
    const barW = 26;
    const barX = W - M - 5 - barW;
    bar(doc, barX, y + 4.5, barW, (visible / RESOURCES.length) * 100, roleAccent, 2.6);
    text(doc, `${visible}/${RESOURCES.length} recursos`, barX + barW / 2, y + 11.5, {
      size: 6.5,
      style: 'bold',
      color: roleAccent,
      align: 'center',
    });
    y += h + GAP;
  });
}

function sectionCapabilityMatrix(doc, t) {
  const accent = SECTION_ACCENTS[3];
  let y = newPage(doc, 'landscape');
  const { W, H } = pageSize(doc);
  y = sectionHeading(doc, y, 4, SECTIONS[3], accent);

  let cx = M;
  ACTION_COLUMNS.forEach((action) => {
    cx += drawChip(doc, `${action.letter} = ${action.label}`, cx, y, { accent: ACTION_ACCENTS[action.key] }) + 1.6;
  });
  y += 9;

  const labelW = 58;
  const colW = (W - 2 * M - labelW) / ROLES.length;

  const header = () => {
    setFill(doc, NAVY);
    doc.rect(M, y, W - 2 * M, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setText(doc, WHITE);
    doc.text('Recurso', M + 2, y + 6.2);
    ROLES.forEach((role, i) => {
      doc.setFontSize(6);
      const lines = doc.splitTextToSize(roleLabel(role, t), colW - 2);
      doc.text(lines, M + labelW + i * colW + colW / 2, y + 4.4, { align: 'center' });
    });
    y += 12;
  };
  header();

  RESOURCES.forEach((resource, index) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const labelLines = doc.splitTextToSize(resourceLabel(resource), labelW - 4);
    const rowH = Math.max(labelLines.length * 3.4, 5.5) + 1.6;
    if (y + rowH > H - 18) {
      y = newPage(doc, 'landscape');
      header();
    }
    if (index % 2 === 1) {
      setFill(doc, SOFT);
      doc.rect(M, y - 1.2, W - 2 * M, rowH + 1.2, 'F');
    }
    setText(doc, INK);
    doc.text(labelLines, M + 2, y + 3.2);
    ROLES.forEach((role, i) => {
      const actions = capabilityActions(resource, role);
      const cellX = M + labelW + i * colW + colW / 2;
      if (!actions.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        setText(doc, [201, 206, 216]);
        doc.text('–', cellX, y + 3.2, { align: 'center' });
        return;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      const spacing = 3.4;
      const startX = cellX - ((actions.length - 1) * spacing) / 2;
      actions.forEach((action, ai) => {
        setText(doc, ACTION_ACCENTS[action.key]);
        doc.text(action.letter, startX + ai * spacing, y + 3.2, { align: 'center' });
      });
    });
    y += rowH;
  });

  if (y + 9 > H - 18) {
    y = newPage(doc, 'landscape');
    header();
  }
  setFill(doc, [232, 237, 246]);
  doc.rect(M, y - 1, W - 2 * M, 7.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setText(doc, MUTED);
  doc.text('Recursos com leitura', M + 2, y + 4);
  ROLES.forEach((role, i) => {
    text(doc, String(visibleResourceCount(role)), M + labelW + i * colW + colW / 2, y + 4, {
      size: 7,
      style: 'bold',
      color: INK,
      align: 'center',
    });
  });
  y += 14;

  y = bandTitle(doc, y, 'Tiers de capacidade reutilizados pela matriz', accent) + 1;
  CAPABILITY_TIER_ENTRIES.forEach(([name, roles]) => {
    const labels = roles.map((role) => ({ label: roleLabel(role, t) }));
    const h = chipRowHeight(doc, labels, W - 2 * M - 36, 7) + 6;
    y = ensure(doc, y, h, 'landscape');
    card(doc, M, y, W - 2 * M, h, {});
    text(doc, name, M + 4, y + 5.5, { size: 7.5, style: 'bold', color: MUTED });
    chipRow(doc, labels, M + 36, y + 2.6, W - M - 4, { accent, size: 7 });
    y += h + 2;
  });
}

function sectionModules(doc) {
  const accent = SECTION_ACCENTS[4];
  const { W } = pageSize(doc);
  let y = sectionHeading(doc, newPage(doc, 'portrait'), 5, SECTIONS[4], accent);

  const modules = buildModuleCards();
  const moduleName = new Map(modules.map((module) => [module.code, module.name]));

  y = bandTitle(doc, y, 'Escada de tiers (cumulativa)', accent) + 1;
  buildTierLayers().forEach((layer) => {
    const labels = layer.modules.map((code) => ({
      label: `${layer.added.includes(code) ? '+ ' : ''}${moduleName.get(code) || code}`,
      filled: layer.added.includes(code),
    }));
    const h = chipRowHeight(doc, labels, W - 2 * M - 42, 7) + 8;
    y = ensure(doc, y, h + GAP);
    card(doc, M, y, W - 2 * M, h, { fill: tint(layer.accent, 0.95), accent: layer.accent });
    text(doc, layer.label, M + 4.5, y + 5.5, { size: 9, style: 'bold', color: layer.accent });
    text(doc, `${layer.modules.length} módulos · ${layer.available ? 'comercializável' : 'não vendido'}`, M + 4.5, y + 9.8, {
      size: 6.5,
      color: MUTED,
    });
    chipRow(doc, labels, M + 38, y + 3.4, W - M - 4, { accent: layer.accent, size: 7 });
    y += h + GAP;
  });
  y = paragraph(
    doc,
    `Alias legado: ${LEGACY_ALIASES.map(([from, to]) => `${from} → ${to}`).join(', ')} — mantido apenas para registos antigos.`,
    M,
    y + 1.5,
    W - 2 * M,
    { size: 7, color: MUTED }
  ) + 6;

  y = ensure(doc, y, 30);
  y = bandTitle(doc, y, `Catálogo de módulos (${MODULES.length})`, accent) + 1;

  const cols = 2;
  const colW = (W - 2 * M - GAP) / cols;
  const tierLabels = (module) =>
    module.tiers.length ? module.tiers.map((tier) => ({ label: TIER_LABELS[tier] })) : [{ label: 'Fora da oferta' }];

  for (let i = 0; i < modules.length; i += cols) {
    const row = modules.slice(i, i + cols);
    const layouts = row.map((module) => {
      const tierChips = tierLabels(module);
      const routeChips = module.routes.map((route) => ({ label: route }));
      const descLines = measure(doc, module.description, colW - 8, 7.5);
      const tierRowH = chipRowHeight(doc, tierChips, colW - 8, 6.5);
      const routeRowH = chipRowHeight(doc, routeChips, colW - 8, 6.5);
      return { tierChips, routeChips, descLines, tierRowH, routeRowH, h: 14 + descLines * lineH(7.5) + tierRowH + routeRowH };
    });
    const h = Math.max(...layouts.map((layout) => layout.h));
    y = ensure(doc, y, h + GAP);
    row.forEach((module, c) => {
      const layout = layouts[c];
      const x = M + c * (colW + GAP);
      card(doc, x, y, colW, h, { accent: module.accent });
      text(doc, module.name, x + 4.5, y + 5.5, { size: 9, style: 'bold', color: module.accent });
      text(doc, module.code, x + 4.5, y + 9, { size: 6.5, style: 'bold', color: MUTED });
      const ty = paragraph(doc, module.description, x + 4.5, y + 12.5, colW - 8, { size: 7.5, color: INK });
      chipRow(doc, layout.tierChips, x + 4.5, ty + 1.5, x + colW - 4, { accent: module.accent, size: 6.5 });
      chipRow(doc, layout.routeChips, x + 4.5, ty + 1.5 + layout.tierRowH + 1.6, x + colW - 4, {
        accent: module.accent,
        size: 6.5,
      });
    });
    y += h + GAP;
  }

  // FB7 — o catálogo é curado em código; as entidades são o espelho semeado.
  y = ensure(doc, y, 24);
  y = bandTitle(doc, y, 'Catálogo comercial: onde vive e como se altera', accent) + 1;
  for (let i = 0; i < LICENSE_CATALOG.length; i += cols) {
    const row = LICENSE_CATALOG.slice(i, i + cols);
    const heights = row.map((block) => 11 + bulletsHeight(doc, block.items, colW - 10, 7.5));
    const h = Math.max(...heights);
    y = ensure(doc, y, h + GAP);
    row.forEach((block, c) => {
      const x = M + c * (colW + GAP);
      card(doc, x, y, colW, h, { accent });
      text(doc, block.title, x + 4.5, y + 5.5, { size: 8.5, style: 'bold', color: NAVY });
      bulletList(doc, block.items, x + 4.5, y + 10, colW - 10, { size: 7.5 });
    });
    y += h + GAP;
  }
}

function sectionAreas(doc) {
  const accent = SECTION_ACCENTS[5];
  const { W } = pageSize(doc);
  let y = sectionHeading(doc, newPage(doc, 'portrait'), 6, SECTIONS[5], accent);

  buildAreaMap().forEach((area) => {
    const nameX = M + 52;
    const chipRight = W - M - 4;
    const nameW = chipRight - nameX - 52;
    const itemRows = area.items.map((item) => ({ item, lines: measure(doc, item.name, nameW, 7.5) }));
    const h = 15 + measure(doc, area.description, W - 2 * M - 8, 7.5) * lineH(7.5) + itemRows.reduce((total, row) => total + Math.max(3.8, row.lines * 3.6), 0);
    y = ensure(doc, y, h + GAP);
    card(doc, M, y, W - 2 * M, h, {});
    text(doc, area.area, M + 4, y + 5.6, { size: 9, style: 'bold', color: NAVY });
    if (area.requiredTier) {
      drawChipRight(doc, `Tier mínimo: ${TIER_LABELS[area.requiredTier]}`, chipRight, y + 3.4, {
        accent: TIER_ACCENTS[area.requiredTier],
        size: 6.5,
      });
    } else {
      drawChipRight(doc, 'Transversal (sem módulo)', chipRight, y + 3.4, { accent: SLATE, size: 6.5 });
    }
    let ty = paragraph(doc, area.description, M + 4, y + 9.4, W - 2 * M - 8, { size: 7.5, color: MUTED });
    itemRows.forEach(({ item, lines }) => {
      text(doc, item.route, M + 4, ty + 2.6, { size: 6.5, style: 'bold', color: INK });
      paragraph(doc, item.name, nameX, ty + 2.6, nameW, { size: 7.5, color: INK });
      if (item.module) {
        drawChipRight(doc, item.moduleName, chipRight, ty - 1, { accent: item.accent, size: 6 });
      } else {
        drawChipRight(doc, 'só RBAC', chipRight, ty - 1, { accent: SLATE, size: 6 });
      }
      ty += Math.max(3.8, lines * 3.6);
    });
    y += h + GAP;
  });
}

function sectionSecurity(doc) {
  const accent = SECTION_ACCENTS[6];
  const { W } = pageSize(doc);
  let y = sectionHeading(doc, newPage(doc, 'portrait'), 7, SECTIONS[6], accent);

  const cols = 2;
  const colW = (W - 2 * M - GAP) / cols;
  for (let i = 0; i < SECURITY_MODEL.length; i += cols) {
    const row = SECURITY_MODEL.slice(i, i + cols);
    const heights = row.map((block) => 11 + bulletsHeight(doc, block.items, colW - 10, 7.5));
    const h = Math.max(...heights);
    y = ensure(doc, y, h + GAP);
    row.forEach((block, c) => {
      const x = M + c * (colW + GAP);
      card(doc, x, y, colW, h, { accent });
      text(doc, block.title, x + 4.5, y + 5.5, { size: 8.5, style: 'bold', color: NAVY });
      bulletList(doc, block.items, x + 4.5, y + 10, colW - 10, { size: 7.5 });
    });
    y += h + GAP;
  }
}

function sectionData(doc) {
  const accent = SECTION_ACCENTS[7];
  const { W } = pageSize(doc);
  let y = sectionHeading(doc, newPage(doc, 'portrait'), 8, SECTIONS[7], accent);

  const groupBlock = (group, chips) => {
    const labels = group.items.map((label) => ({ label }));
    const h = 9 + chipRowHeight(doc, labels, W - 2 * M - 8, 6.5);
    y = ensure(doc, y, h + GAP);
    card(doc, M, y, W - 2 * M, h, {});
    text(doc, group.group, M + 4, y + 5.6, { size: 8.5, style: 'bold', color: NAVY });
    chipRow(doc, labels, M + 4, y + 7.6, W - M - 4, { accent: chips, size: 6.5 });
    y += h + GAP;
  };

  y = bandTitle(doc, y, `Entidades (${buildDocsTotals().entities})`, accent) + 1;
  DATA_MODEL.entities.forEach((group) => groupBlock(group, BLUE));

  y = ensure(doc, y + 3, 20);
  y = bandTitle(doc, y, `Funções de backend (${buildDocsTotals().functions})`, accent) + 1;
  DATA_MODEL.functions.forEach((group) => groupBlock(group, TEAL));

  y = ensure(doc, y + 3, 30);
  y = bandTitle(doc, y, 'Workflows agendados', accent) + 1;
  y = bulletList(doc, DATA_MODEL.workflows, M + 1, y + 1, W - 2 * M, { size: 8, color: INK }) + 4;

  y = ensure(doc, y, 30);
  y = bandTitle(doc, y, 'Utilitários partilhados (base44/shared)', accent) + 1;
  DATA_MODEL.shared.forEach((item) => {
    y = ensure(doc, y, 6);
    text(doc, item.name, M + 1, y + 3, { size: 7.5, style: 'bold', color: INK });
    y = paragraph(doc, item.note, M + 46, y + 3, W - 2 * M - 46, { size: 7.5, color: MUTED }) + 1;
  });

  y = ensure(doc, y + 4, 24);
  y = bandTitle(doc, y, 'Integrações', accent) + 1;
  DATA_MODEL.integrations.forEach((item) => {
    y = paragraph(doc, `${item.name} — ${item.note}`, M + 1, y + 3, W - 2 * M - 2, { size: 8, color: INK }) + 1;
  });
}

function sectionDev(doc) {
  const accent = SECTION_ACCENTS[8];
  const { W } = pageSize(doc);
  let y = sectionHeading(doc, newPage(doc, 'portrait'), 9, SECTIONS[8], accent);

  y = bandTitle(doc, y, 'Comandos do ambiente local', accent) + 1;
  DEV_GUIDE.commands.forEach((item) => {
    const h = 14.5;
    y = ensure(doc, y, h + GAP);
    card(doc, M, y, W - 2 * M, h, {});
    text(doc, item.label, M + 4, y + 5.5, { size: 8.5, style: 'bold', color: NAVY });
    setFill(doc, [238, 241, 247]);
    doc.roundedRect(M + 4, y + 7.6, W - 2 * M - 8, 5.4, 1, 1, 'F');
    text(doc, item.command, M + 6, y + 11.4, { size: 7, style: 'bold', color: INK });
    y += h + GAP;
  });

  y = ensure(doc, y + 3, 30);
  y = bandTitle(doc, y, 'Particularidades a conhecer', accent) + 1;
  bulletList(doc, DEV_GUIDE.quirks, M + 1, y + 2, W - 2 * M, { size: 8, color: INK });
}

// ─── Entrada ───────────────────────────────────────────────────

/**
 * Gera e descarrega a documentação técnica em PDF.
 * @param {object} [options]
 * @param {function} [options.t] - tradutor da UI (rótulos de papel); PT por omissão.
 */
export function exportTechnicalDocsPdf({ t } = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  cover(doc);
  sectionArchitecture(doc);
  sectionTenancy(doc);
  sectionRoles(doc, t);
  sectionCapabilityMatrix(doc, t);
  sectionModules(doc);
  sectionAreas(doc);
  sectionSecurity(doc);
  sectionData(doc);
  sectionDev(doc);

  const total = doc.internal.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    const { W, H } = pageSize(doc);
    setDraw(doc, BORDER);
    doc.setLineWidth(0.3);
    doc.line(M, H - 12, W - M, H - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setText(doc, MUTED);
    doc.text(`${DOCS_META.app} · Documento interno · ${DOCS_META.branch}`, M, H - 7.5);
    doc.text(`Página ${i} de ${total}`, W - M, H - 7.5, { align: 'right' });
  }

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`Documentacao_Tecnica_${DOCS_META.app}_${date}.pdf`);
}

export default exportTechnicalDocsPdf;
