import jsPDF from 'jspdf';

const BRAND_DARK = [20, 30, 60];       // navy
const BRAND_BLUE = [59, 130, 246];     // primary blue
const BRAND_TEAL = [16, 155, 133];     // accent teal
const LIGHT_GRAY = [245, 247, 250];
const MID_GRAY = [100, 110, 130];
const BORDER_GRAY = [220, 225, 235];

const PRIORITY_COLORS = {
  critical: [220, 38, 38],
  high: [249, 115, 22],
  medium: [234, 179, 8],
  low: [100, 110, 130],
};

const FRAMEWORK_NAMES = {
  NIS2: 'NIS2 / DL 125/2025',
  ISO27001: 'ISO/IEC 27001',
  NIST_CSF: 'NIST CSF 2.0',
  CIS_V8: 'CIS Controls v8',
  QNRC: 'QNRC',
};

function setColor(doc, rgb, type = 'text') {
  if (type === 'fill') doc.setFillColor(...rgb);
  else if (type === 'draw') doc.setDrawColor(...rgb);
  else doc.setTextColor(...rgb);
}

function addPage(doc) {
  doc.addPage();
  return addFooter(doc);
}

function addFooter(doc) {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  setColor(doc, BORDER_GRAY, 'draw');
  doc.setLineWidth(0.3);
  doc.line(20, pageH - 14, pageW - 20, pageH - 14);
  setColor(doc, MID_GRAY);
  doc.setFontSize(8);
  doc.text('CyberMaturity Platform · Confidential', 20, pageH - 8);
  doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageW - 20, pageH - 8, { align: 'right' });
  return 20; // reset y to top margin
}

function scoreLabel(score) {
  if (score >= 4.5) return 'Optimizing';
  if (score >= 3.5) return 'Managed';
  if (score >= 2.5) return 'Defined';
  if (score >= 1.5) return 'Developing';
  return 'Initial';
}

export function exportReportPdf(assessment, recommendations) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();  // 210
  const H = doc.internal.pageSize.getHeight(); // 297

  // ─── COVER PAGE ──────────────────────────────────────────────────────────────
  // Full dark header band
  setColor(doc, BRAND_DARK, 'fill');
  doc.rect(0, 0, W, 80, 'F');

  // Accent stripe
  setColor(doc, BRAND_BLUE, 'fill');
  doc.rect(0, 80, W, 4, 'F');

  // Title block
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  setColor(doc, [200, 210, 255]);
  doc.text('CYBERMATURITY PLATFORM', 20, 28);

  doc.setFontSize(24);
  setColor(doc, [255, 255, 255]);
  doc.text('Security Assessment Report', 20, 44);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  setColor(doc, [180, 195, 230]);
  doc.text(assessment.title, 20, 56);
  doc.text(`${assessment.customer_name}  ·  ${assessment.period}`, 20, 66);

  // Score badge
  const score = assessment.overall_score?.toFixed(1) || '—';
  setColor(doc, BRAND_BLUE, 'fill');
  doc.roundedRect(W - 60, 22, 42, 42, 4, 4, 'F');
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  setColor(doc, [255, 255, 255]);
  doc.text(score, W - 39, 42, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  setColor(doc, [200, 220, 255]);
  doc.text('out of 5.0', W - 39, 52, { align: 'center' });
  doc.text(scoreLabel(assessment.overall_score), W - 39, 60, { align: 'center' });

  // Meta block
  let y = 98;
  const meta = [
    ['Customer', assessment.customer_name],
    ['Assessment Period', assessment.period],
    ['Completed Date', assessment.completed_date || 'N/A'],
    ['Frameworks', (assessment.frameworks || []).map(f => FRAMEWORK_NAMES[f] || f).join(', ')],
    ['Overall Score', `${score} / 5.0  (${scoreLabel(assessment.overall_score)})`],
    ['Total Recommendations', String(recommendations.length)],
  ];

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  setColor(doc, BRAND_DARK);
  doc.text('Executive Summary', 20, y);
  y += 8;

  setColor(doc, BRAND_BLUE, 'draw');
  doc.setLineWidth(0.5);
  doc.line(20, y, W - 20, y);
  y += 8;

  meta.forEach(([label, value]) => {
    setColor(doc, MID_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(label, 22, y);

    setColor(doc, BRAND_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(value, 100);
    doc.text(lines, 90, y);
    y += lines.length * 6 + 1;
  });

  // ─── PAGE 2: FRAMEWORK SCORES ────────────────────────────────────────────────
  addPage(doc);
  y = 30;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  setColor(doc, BRAND_DARK);
  doc.text('Framework Maturity Scores', 20, y);
  y += 10;

  const frameworkScores = assessment.framework_scores || [];
  frameworkScores.forEach(fs => {
    const name = FRAMEWORK_NAMES[fs.framework_code] || fs.framework_code;
    const pct = (fs.score / 5) * 100;
    const barW = W - 80;

    // Card background
    setColor(doc, LIGHT_GRAY, 'fill');
    setColor(doc, BORDER_GRAY, 'draw');
    doc.setLineWidth(0.3);
    doc.roundedRect(18, y, W - 36, 26, 2, 2, 'FD');

    setColor(doc, BRAND_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(name, 24, y + 8);

    setColor(doc, MID_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(scoreLabel(fs.score), 24, y + 15);

    // Score number
    setColor(doc, BRAND_BLUE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(fs.score.toFixed(1), W - 24, y + 10, { align: 'right' });

    // Progress bar track
    const barX = 24;
    const barY = y + 19;
    setColor(doc, BORDER_GRAY, 'fill');
    doc.roundedRect(barX, barY, barW, 3, 1, 1, 'F');

    // Progress bar fill
    setColor(doc, BRAND_BLUE, 'fill');
    doc.roundedRect(barX, barY, (barW * pct) / 100, 3, 1, 1, 'F');

    y += 32;

    // Domain scores
    if (fs.domain_scores?.length) {
      fs.domain_scores.forEach(ds => {
        const dpct = (ds.score / 5) * 100;
        setColor(doc, MID_GRAY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const truncated = ds.domain.length > 50 ? ds.domain.substring(0, 47) + '...' : ds.domain;
        doc.text(truncated, 28, y + 4);
        doc.text(ds.score.toFixed(1), W - 24, y + 4, { align: 'right' });

        setColor(doc, BORDER_GRAY, 'fill');
        doc.roundedRect(28, y + 6, barW - 8, 2, 0.5, 0.5, 'F');
        setColor(doc, BRAND_TEAL, 'fill');
        doc.roundedRect(28, y + 6, ((barW - 8) * dpct) / 100, 2, 0.5, 0.5, 'F');
        y += 11;

        if (y > H - 30) {
          addPage(doc);
          y = 30;
        }
      });
      y += 4;
    }

    if (y > H - 30) {
      addPage(doc);
      y = 30;
    }
  });

  // ─── RECOMMENDATIONS ─────────────────────────────────────────────────────────
  if (recommendations.length > 0) {
    addPage(doc);
    y = 30;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    setColor(doc, BRAND_DARK);
    doc.text('AI-Generated Recommendations', 20, y);
    y += 4;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    setColor(doc, MID_GRAY);
    doc.text(`${recommendations.length} prioritized improvement actions`, 20, y + 6);
    y += 14;

    // Priority summary counts
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    recommendations.forEach(r => { if (counts[r.priority] !== undefined) counts[r.priority]++; });
    const summaryLabels = Object.entries(counts).filter(([, v]) => v > 0);
    let sx = 20;
    summaryLabels.forEach(([priority, count]) => {
      const col = PRIORITY_COLORS[priority] || MID_GRAY;
      setColor(doc, col, 'fill');
      doc.roundedRect(sx, y, 28, 10, 2, 2, 'F');
      setColor(doc, [255, 255, 255]);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`${count} ${priority}`, sx + 14, y + 6.5, { align: 'center' });
      sx += 32;
    });
    y += 18;

    const sortOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...recommendations].sort((a, b) => (sortOrder[a.priority] ?? 4) - (sortOrder[b.priority] ?? 4));

    sorted.forEach((rec, idx) => {
      const titleLines = doc.splitTextToSize(rec.title, W - 64);
      const descLines = doc.splitTextToSize(rec.description || '', W - 52);
      const cardH = 14 + titleLines.length * 5.5 + (rec.description ? descLines.length * 4.5 + 4 : 0);

      if (y + cardH > H - 20) {
        addPage(doc);
        y = 30;
      }

      // Card
      setColor(doc, LIGHT_GRAY, 'fill');
      setColor(doc, BORDER_GRAY, 'draw');
      doc.setLineWidth(0.3);
      doc.roundedRect(18, y, W - 36, cardH, 2, 2, 'FD');

      // Priority stripe on left
      const col = PRIORITY_COLORS[rec.priority] || MID_GRAY;
      setColor(doc, col, 'fill');
      doc.roundedRect(18, y, 4, cardH, 1, 1, 'F');

      // Index
      setColor(doc, MID_GRAY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`#${idx + 1}`, 26, y + 8);

      // Priority badge
      setColor(doc, col, 'fill');
      doc.roundedRect(34, y + 3.5, 22, 7, 1, 1, 'F');
      setColor(doc, [255, 255, 255]);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(rec.priority.toUpperCase(), 45, y + 8.5, { align: 'center' });

      // Framework badge
      if (rec.framework_code) {
        setColor(doc, BORDER_GRAY, 'fill');
        setColor(doc, BORDER_GRAY, 'draw');
        doc.roundedRect(60, y + 3.5, 28, 7, 1, 1, 'FD');
        setColor(doc, MID_GRAY);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(rec.framework_code.replace('_', ' '), 74, y + 8.5, { align: 'center' });
      }

      // Meta: effort + timeline
      const metaX = rec.framework_code ? 94 : 64;
      if (rec.effort || rec.timeline) {
        setColor(doc, MID_GRAY);
        doc.setFontSize(7);
        const metaParts = [rec.effort && `Effort: ${rec.effort}`, rec.timeline && rec.timeline.replace(/_/g, ' ')].filter(Boolean);
        doc.text(metaParts.join('  ·  '), metaX, y + 8.5);
      }

      // Title
      let ty = y + 16;
      setColor(doc, BRAND_DARK);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(titleLines, 26, ty);
      ty += titleLines.length * 5.5;

      // Description
      if (rec.description) {
        setColor(doc, MID_GRAY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(descLines, 26, ty + 2);
      }

      y += cardH + 4;
    });
  }

  // ─── FINAL PAGE: DISCLAIMER ──────────────────────────────────────────────────
  addPage(doc);
  y = 30;

  setColor(doc, BRAND_DARK, 'fill');
  doc.rect(0, 0, W, 20, 'F');
  setColor(doc, BRAND_BLUE, 'fill');
  doc.rect(0, 20, W, 2, 'F');

  setColor(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CyberMaturity Platform', 20, 13);

  y = 36;
  setColor(doc, BRAND_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Important Notice', 20, y);
  y += 8;

  const disclaimer = `This report was generated by the CyberMaturity Platform based on self-assessment responses and AI-assisted analysis. The maturity scores and recommendations contained herein reflect the information provided at the time of assessment and should be reviewed by qualified cybersecurity professionals before implementation.\n\nThis document is confidential and intended solely for the use of ${assessment.customer_name}. Unauthorized disclosure, copying, or distribution is strictly prohibited.\n\nGenerated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  setColor(doc, MID_GRAY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const disclaimerLines = doc.splitTextToSize(disclaimer, W - 40);
  doc.text(disclaimerLines, 20, y);

  // Add all footers
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    const pw = doc.internal.pageSize.getWidth();
    setColor(doc, BORDER_GRAY, 'draw');
    doc.setLineWidth(0.3);
    doc.line(20, ph - 14, pw - 20, ph - 14);
    setColor(doc, MID_GRAY);
    doc.setFontSize(8);
    doc.text('CyberMaturity Platform · Confidential', 20, ph - 8);
    doc.text(`Page ${i} of ${totalPages}`, pw - 20, ph - 8, { align: 'right' });
  }

  const filename = `${assessment.customer_name?.replace(/[^a-z0-9]/gi, '_')}_${assessment.period}_Report.pdf`;
  doc.save(filename);
}