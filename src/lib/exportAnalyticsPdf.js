/**
 * Exportações PDF das páginas analíticas (FA3).
 *
 * A matriz de capacidades declarava `export` em `compliance_metrics` e em
 * `strategic_report` sem qualquer recurso na interface. Este módulo é o
 * recurso: cada função recebe exactamente os números que a página mostra e
 * devolve o mesmo em PDF, no mesmo padrão de `exportReportPdf.js`.
 *
 * Só há um gerador: as duas páginas não repetem código de desenho. Todo o texto
 * sai em PT-PT, como o resto da interface.
 */
import jsPDF from 'jspdf';

const NAVY = [20, 30, 60];
const BLUE = [59, 130, 246];
const TEAL = [16, 155, 133];
const GRAY_LIGHT = [245, 247, 250];
const GRAY_MID = [100, 110, 130];
const GRAY_BORDER = [220, 225, 235];
const WHITE = [255, 255, 255];

// Escala de risco — a mesma dos tokens --risk-* do design system.
const RISK_COLORS = {
  critical: [220, 38, 38],
  high: [249, 115, 22],
  medium: [234, 179, 8],
  low: [34, 197, 94],
};

function setColor(doc, rgb, type = 'text') {
  if (type === 'fill') doc.setFillColor(...rgb);
  else if (type === 'draw') doc.setDrawColor(...rgb);
  else doc.setTextColor(...rgb);
}

function today(locale) {
  return new Date().toLocaleDateString(locale || 'pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Cabana de capa: faixa escura com o título e o subtítulo. */
function cover(doc, title, subtitle, locale) {
  const W = doc.internal.pageSize.getWidth();
  setColor(doc, NAVY, 'fill');
  doc.rect(0, 0, W, 42, 'F');
  setColor(doc, BLUE, 'fill');
  doc.rect(0, 42, W, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setColor(doc, [200, 210, 255]);
  doc.text('ANKORAONE PLATFORM', 20, 15);

  doc.setFontSize(17);
  setColor(doc, WHITE);
  doc.text(title, 20, 29);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setColor(doc, [180, 195, 230]);
  doc.text(`${subtitle}  ·  ${today(locale)}`, 20, 37);
}

/** Rodapé em todas as páginas. */
function footers(doc) {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.getHeight();
    const W = doc.internal.pageSize.getWidth();
    setColor(doc, GRAY_BORDER, 'draw');
    doc.setLineWidth(0.3);
    doc.line(20, H - 14, W - 20, H - 14);
    setColor(doc, GRAY_MID);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('AnkoraOne Platform · Confidencial', 20, H - 8);
    doc.text(`Página ${i} de ${total}`, W - 20, H - 8, { align: 'right' });
  }
}

function sectionTitle(doc, y, text) {
  setColor(doc, NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text(text, 20, y);
  setColor(doc, BLUE, 'draw');
  doc.setLineWidth(0.5);
  doc.line(20, y + 2.5, doc.internal.pageSize.getWidth() - 20, y + 2.5);
  return y + 10;
}

/** Cartões de indicador (4 por linha). */
function kpiRow(doc, y, items) {
  const W = doc.internal.pageSize.getWidth();
  const boxW = (W - 40 - 12) / 4;
  let x = 20;
  items.slice(0, 4).forEach((item) => {
    setColor(doc, GRAY_LIGHT, 'fill');
    setColor(doc, GRAY_BORDER, 'draw');
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, boxW, 20, 2, 2, 'FD');

    setColor(doc, item.color || BLUE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(String(item.value ?? '—'), x + boxW / 2, y + 10, { align: 'center' });

    setColor(doc, GRAY_MID);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(doc.splitTextToSize(item.label, boxW - 6), x + boxW / 2, y + 14.5, { align: 'center' });

    x += boxW + 4;
  });
  return y + 26;
}

/** Lista de barras horizontais (nome + valor). */
function barList(doc, y, rows, color) {
  const W = doc.internal.pageSize.getWidth();
  const barW = W - 40 - 12;
  const max = Math.max(...rows.map((r) => r.value || 0), 1);

  rows.forEach((row) => {
    setColor(doc, GRAY_MID);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(doc.splitTextToSize(String(row.label), barW - 20)[0], 20, y + 3);
    doc.text(String(row.value ?? 0), W - 20, y + 3, { align: 'right' });

    setColor(doc, GRAY_BORDER, 'fill');
    doc.roundedRect(20, y + 5, barW, 2.5, 1, 1, 'F');
    setColor(doc, row.color || color || BLUE, 'fill');
    doc.roundedRect(20, y + 5, (barW * (row.value || 0)) / max, 2.5, 1, 1, 'F');
    y += 12;
  });
  return y;
}

/** Tabela simples de duas colunas. */
function simpleTable(doc, y, headers, rows) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  setColor(doc, GRAY_LIGHT, 'fill');
  doc.rect(20, y, W - 40, 7, 'F');
  setColor(doc, GRAY_MID);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(headers[0], 24, y + 5);
  doc.text(headers[1], W - 24, y + 5, { align: 'right' });
  y += 10;

  rows.forEach((row) => {
    if (y > H - 25) return;
    setColor(doc, NAVY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(doc.splitTextToSize(String(row[0]), W - 40 - 40)[0], 24, y);
    setColor(doc, GRAY_MID);
    doc.text(String(row[1] ?? '—'), W - 24, y, { align: 'right' });
    setColor(doc, GRAY_BORDER, 'draw');
    doc.setLineWidth(0.2);
    doc.line(20, y + 2.5, W - 20, y + 2.5);
    y += 9;
  });
  return y;
}

function save(doc, name) {
  footers(doc);
  doc.save(`${name.replace(/[^\w.-]+/g, '_')}.pdf`);
}

/**
 * PDF das Métricas de Conformidade (incidentes, vulnerabilidades, DSR, RoPA).
 */
export function exportComplianceMetricsPdf({
  locale = 'pt-PT',
  kpis = [],
  nis2 = [],
  incidentStatus = [],
  vulnSeverity = [],
  vulnStatus = [],
  dsrTypes = [],
  sla = [],
} = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  cover(doc, 'Métricas de Conformidade', 'Incidentes, vulnerabilidades, DSR e RoPA', locale);

  let y = 56;
  if (kpis.length) {
    y = sectionTitle(doc, y, 'Indicadores');
    y = kpiRow(doc, y, kpis);
  }
  if (nis2.length) {
    y = sectionTitle(doc, y, 'Notificações NIS2 (prazos)');
    y = kpiRow(doc, y, nis2);
  }
  y = sectionTitle(doc, y, 'Incidentes por estado');
  y = barList(doc, y, incidentStatus, BLUE);
  y = sectionTitle(doc, y, 'Vulnerabilidades abertas por severidade');
  y = barList(
    doc,
    y,
    vulnSeverity.map((row) => ({ ...row, color: RISK_COLORS[row.risk] })),
    BLUE,
  );
  if (y > 220) { doc.addPage(); y = 30; }
  y = sectionTitle(doc, y, 'Vulnerabilidades por estado');
  y = barList(doc, y, vulnStatus, TEAL);
  y = sectionTitle(doc, y, 'Pedidos de titular por tipo (RGPD)');
  y = barList(doc, y, dsrTypes, TEAL);
  if (sla.length) {
    if (y > 230) { doc.addPage(); y = 30; }
    y = sectionTitle(doc, y, 'SLA e conservação');
    y = simpleTable(doc, y, ['Indicador', 'Valor'], sla);
  }

  save(doc, `AnkoraOne_Metricas_Conformidade_${new Date().toISOString().slice(0, 10)}`);
}

/**
 * PDF do Relatório Estratégico (maturidade, frameworks, recomendações).
 */
export function exportStrategicReportPdf({
  locale = 'pt-PT',
  customerName = '',
  kpis = [],
  frameworks = [],
  trend = [],
  priorities = [],
  assessments = [],
} = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  cover(doc, 'Relatório Estratégico', customerName || 'Todas as organizações', locale);

  let y = 56;
  if (kpis.length) {
    y = sectionTitle(doc, y, 'Indicadores de maturidade');
    y = kpiRow(doc, y, kpis);
  }
  y = sectionTitle(doc, y, 'Maturidade por framework');
  y = frameworks.length
    ? barList(doc, y, frameworks.map((f) => ({ label: f.label, value: f.value })), BLUE)
    : (doc.setFont('helvetica', 'normal'), doc.setFontSize(9), setColor(doc, GRAY_MID), doc.text('Sem dados de framework.', 20, y), y + 10);

  if (trend.length) {
    if (y > 220) { doc.addPage(); y = 30; }
    y = sectionTitle(doc, y, 'Tendência de maturidade por período');
    y = simpleTable(doc, y, ['Período', 'Maturidade'], trend);
  }
  if (priorities.length) {
    if (y > 220) { doc.addPage(); y = 30; }
    y = sectionTitle(doc, y, 'Recomendações por prioridade');
    y = barList(doc, y, priorities, TEAL);
  }
  if (assessments.length) {
    if (y > 210) { doc.addPage(); y = 30; }
    y = sectionTitle(doc, y, 'Avaliações recentes');
    simpleTable(doc, y, ['Avaliação', 'Maturidade'], assessments);
  }

  save(doc, `AnkoraOne_Relatorio_Estrategico_${new Date().toISOString().slice(0, 10)}`);
}
