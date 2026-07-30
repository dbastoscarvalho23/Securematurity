import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import jsPDF from 'npm:jspdf@4.0.0';
import { getAutomationSecret } from "../../shared/automationSecret.ts";

// ─── Color helpers ────────────────────────────────────────────────────────────
const BRAND_DARK = [20, 30, 60];
const BRAND_BLUE = [59, 130, 246];
const BRAND_TEAL = [16, 155, 133];
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

function sc(doc, rgb, type = 'text') {
  if (type === 'fill') doc.setFillColor(...rgb);
  else if (type === 'draw') doc.setDrawColor(...rgb);
  else doc.setTextColor(...rgb);
}

function addPage(doc) { doc.addPage(); return 20; }

function scoreLabel(score) {
  if (score >= 4.5) return 'Optimizing';
  if (score >= 3.5) return 'Managed';
  if (score >= 2.5) return 'Defined';
  if (score >= 1.5) return 'Developing';
  return 'Initial';
}

function riskScore(impact, likelihood) { return (impact || 0) * (likelihood || 0); }

function buildPdf(reportData, monthLabel, customerName) {
  const { risks, tasks, recommendations, assessments } = reportData;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;

  // ─── COVER PAGE ────────────────────────────────────────────────────────────
  sc(doc, BRAND_DARK, 'fill');
  doc.rect(0, 0, W, 80, 'F');
  sc(doc, BRAND_BLUE, 'fill');
  doc.rect(0, 80, W, 4, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  sc(doc, [200, 210, 255]);
  doc.text('ANKORAONE PLATFORM', 20, 28);

  doc.setFontSize(22);
  sc(doc, [255, 255, 255]);
  doc.text('Annual Cybersecurity Report', 20, 44);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  sc(doc, [180, 195, 230]);
  doc.text(`Monthly Snapshot — ${monthLabel}`, 20, 56);
  if (customerName) doc.text(customerName, 20, 66);

  // Stats badge
  sc(doc, BRAND_BLUE, 'fill');
  doc.roundedRect(W - 62, 22, 44, 44, 4, 4, 'F');
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  sc(doc, [255, 255, 255]);
  doc.text(String(risks.length), W - 40, 42, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  sc(doc, [200, 220, 255]);
  doc.text('total risks', W - 40, 52, { align: 'center' });
  doc.text(`${tasks.length} tasks`, W - 40, 60, { align: 'center' });

  // Summary
  let y = 98;
  const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const critCount = risks.filter(r => riskScore(r.impact, r.likelihood) >= 16).length;
  const highCount = risks.filter(r => { const s = riskScore(r.impact, r.likelihood); return s >= 9 && s < 16; }).length;
  const taskDone = tasks.filter(t => t.status === 'done').length;
  const recPending = recommendations.filter(r => r.status === 'pending').length;

  const summaryMeta = [
    ['Report Period', monthLabel],
    ['Generated', generated],
    ...(customerName ? [['Customer / Scope', customerName]] : [['Customer / Scope', 'All Customers']]),
    ['Total Risks', String(risks.length)],
    ['Critical / High Risks', `${critCount} Critical, ${highCount} High`],
    ['Total Tasks', `${tasks.length} (${taskDone} completed)`],
    ['Pending Recommendations', String(recPending)],
    ['Assessments (This Year)', String(assessments.length)],
  ];

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  sc(doc, BRAND_DARK);
  doc.text('Executive Summary', 20, y);
  y += 8;

  sc(doc, BRAND_BLUE, 'draw');
  doc.setLineWidth(0.5);
  doc.line(20, y, W - 20, y);
  y += 8;

  summaryMeta.forEach(([label, value]) => {
    sc(doc, MID_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(label, 22, y);
    sc(doc, BRAND_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(value, 100);
    doc.text(lines, 90, y);
    y += lines.length * 6 + 1;
  });

  // ─── PAGE 2: RISK OVERVIEW ─────────────────────────────────────────────────
  y = addPage(doc);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  sc(doc, BRAND_DARK);
  doc.text('Risk Overview', 20, y);
  y += 10;

  // Severity distribution bar
  const riskTotal = risks.length;
  if (riskTotal > 0) {
    const medCount = risks.filter(r => { const s = riskScore(r.impact, r.likelihood); return s >= 4 && s < 9; }).length;
    const lowCount = risks.filter(r => riskScore(r.impact, r.likelihood) < 4).length;
    const barW = W - 40;
    const barX = 20;

    sc(doc, BRAND_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Risk Severity Distribution', 20, y);
    y += 6;

    const segments = [
      { count: critCount, color: [220, 38, 38], label: 'Critical' },
      { count: highCount, color: [249, 115, 22], label: 'High' },
      { count: medCount, color: [234, 179, 8], label: 'Medium' },
      { count: lowCount, color: MID_GRAY, label: 'Low' },
    ];
    let segX = barX;
    segments.forEach(({ count, color }) => {
      const w = (count / riskTotal) * barW;
      if (w > 0) {
        sc(doc, color, 'fill');
        doc.rect(segX, y, w, 6, 'F');
        segX += w;
      }
    });
    y += 10;
    let legX = barX;
    segments.forEach(({ count, color, label }) => {
      if (count === 0) return;
      sc(doc, color, 'fill');
      doc.roundedRect(legX, y, 3, 3, 0.5, 0.5, 'F');
      sc(doc, MID_GRAY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`${label}: ${count}`, legX + 5, y + 3);
      legX += 38;
    });
    y += 10;
  }

  // Top 20 risks table
  const sortedRisks = [...risks].sort((a, b) => riskScore(b.impact, b.likelihood) - riskScore(a.impact, a.likelihood)).slice(0, 20);
  if (sortedRisks.length > 0) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    sc(doc, BRAND_DARK);
    doc.text('Top Risks by Score', 20, y);
    y += 8;

    sc(doc, LIGHT_GRAY, 'fill');
    doc.rect(20, y - 5, W - 40, 7, 'F');
    sc(doc, MID_GRAY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Risk Title', 24, y);
    doc.text('Category', W - 80, y);
    doc.text('Score', W - 40, y);
    doc.text('Status', W - 22, y);
    y += 4;

    sortedRisks.forEach(risk => {
      const score = riskScore(risk.impact, risk.likelihood);
      const level = score >= 16 ? 'critical' : score >= 9 ? 'high' : score >= 4 ? 'medium' : 'low';
      const rowH = 8;
      if (y + rowH > H - 20) { y = addPage(doc); }

      const prioColor = PRIORITY_COLORS[level] || MID_GRAY;
      sc(doc, prioColor, 'fill');
      doc.rect(20, y - 4, 3, rowH, 'F');

      sc(doc, BRAND_DARK);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const title = risk.title?.length > 60 ? risk.title.substring(0, 57) + '...' : (risk.title || '—');
      doc.text(title, 26, y);
      sc(doc, MID_GRAY);
      doc.setFontSize(7.5);
      doc.text(risk.category || '—', W - 80, y);
      sc(doc, prioColor);
      doc.setFont('helvetica', 'bold');
      doc.text(String(score), W - 38, y);
      sc(doc, MID_GRAY);
      doc.setFont('helvetica', 'normal');
      doc.text((risk.status || '').replace('_', ' '), W - 22, y);

      sc(doc, BORDER_GRAY, 'draw');
      doc.setLineWidth(0.2);
      doc.line(20, y + 3, W - 20, y + 3);
      y += rowH;
    });
  }

  // ─── PAGE 3: TASKS & RECOMMENDATIONS ──────────────────────────────────────
  y = addPage(doc);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  sc(doc, BRAND_DARK);
  doc.text('Measures & Recommendations', 20, y);
  y += 10;

  // Tasks summary
  const taskInProg = tasks.filter(t => t.status === 'in_progress').length;
  const taskTodo = tasks.filter(t => t.status === 'todo').length;
  const taskBlocked = tasks.filter(t => t.status === 'blocked').length;
  const taskPct = tasks.length > 0 ? Math.round((taskDone / tasks.length) * 100) : 0;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  sc(doc, BRAND_DARK);
  doc.text('Task Status', 20, y);
  y += 8;

  const taskBoxes = [
    { label: 'Done', value: taskDone, color: BRAND_TEAL },
    { label: 'In Progress', value: taskInProg, color: [234, 179, 8] },
    { label: 'To Do', value: taskTodo, color: MID_GRAY },
    { label: 'Blocked', value: taskBlocked, color: [220, 38, 38] },
  ];
  let bx = 20;
  taskBoxes.forEach(({ label, value, color }) => {
    sc(doc, LIGHT_GRAY, 'fill');
    sc(doc, BORDER_GRAY, 'draw');
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, y, 40, 16, 2, 2, 'FD');
    sc(doc, color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(String(value), bx + 20, y + 9, { align: 'center' });
    sc(doc, MID_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(label, bx + 20, y + 14.5, { align: 'center' });
    bx += 44;
  });
  y += 22;

  const barX2 = 20;
  const barFull = W - 40;
  sc(doc, BORDER_GRAY, 'fill');
  doc.roundedRect(barX2, y, barFull, 4, 1, 1, 'F');
  sc(doc, BRAND_TEAL, 'fill');
  doc.roundedRect(barX2, y, (barFull * taskPct) / 100, 4, 1, 1, 'F');
  sc(doc, BRAND_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`${taskPct}% complete`, barX2 + barFull + 2, y + 3);
  y += 14;

  // Recommendations summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  sc(doc, BRAND_DARK);
  doc.text('Top Pending Recommendations', 20, y);
  y += 8;

  const sortOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const topRecs = [...recommendations]
    .filter(r => r.status !== 'completed' && r.status !== 'dismissed')
    .sort((a, b) => (sortOrder[a.priority] ?? 4) - (sortOrder[b.priority] ?? 4))
    .slice(0, 15);

  topRecs.forEach((rec) => {
    const titleLines = doc.splitTextToSize(rec.title || '', W - 64);
    const cardH = 12 + titleLines.length * 5;
    if (y + cardH > H - 20) { y = addPage(doc); }

    sc(doc, LIGHT_GRAY, 'fill');
    sc(doc, BORDER_GRAY, 'draw');
    doc.setLineWidth(0.3);
    doc.roundedRect(20, y, W - 40, cardH, 2, 2, 'FD');
    const col = PRIORITY_COLORS[rec.priority] || MID_GRAY;
    sc(doc, col, 'fill');
    doc.roundedRect(20, y, 4, cardH, 1, 1, 'F');

    sc(doc, col, 'fill');
    doc.roundedRect(28, y + 3, 22, 6, 1, 1, 'F');
    sc(doc, [255, 255, 255]);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text((rec.priority || 'medium').toUpperCase(), 39, y + 7.5, { align: 'center' });

    if (rec.framework_code) {
      sc(doc, BORDER_GRAY, 'fill');
      doc.roundedRect(54, y + 3, 26, 6, 1, 1, 'F');
      sc(doc, MID_GRAY);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(rec.framework_code.replace('_', ' '), 67, y + 7.5, { align: 'center' });
    }

    sc(doc, BRAND_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(titleLines, 28, y + 12);
    y += cardH + 3;
  });

  // ─── FOOTER ON ALL PAGES ──────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const ph = H;
    const pw = W;
    sc(doc, BORDER_GRAY, 'draw');
    doc.setLineWidth(0.3);
    doc.line(20, ph - 14, pw - 20, ph - 14);
    sc(doc, MID_GRAY);
    doc.setFontSize(8);
    doc.text('AnkoraOne Platform · Monthly Snapshot · Confidential', 20, ph - 8);
    doc.text(`Page ${i} of ${totalPages}`, pw - 20, ph - 8, { align: 'right' });
  }

  // Return as ArrayBuffer
  return doc.output('arraybuffer');
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both scheduled (via shared automation secret) and manual admin trigger.
    // Anonymous callers are rejected — access is never granted merely because
    // base44.auth.me() threw.
    let isScheduled = false;

    const automationSecret = await getAutomationSecret(req);
    if (automationSecret) {
      isScheduled = true;
    } else {
      try {
        const user = await base44.auth.me();
        if (user?.role !== 'admin') {
          return Response.json({ error: 'Admin access required' }, { status: 403 });
        }
      } catch {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }
    }

    const sr = base44.asServiceRole;

    // Determine month label (current month being snapshotted)
    const now = new Date();
    const monthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Check for duplicate snapshot this month to avoid re-runs
    const existing = await sr.entities.SecurityDocument.filter({
      tags: { $in: [`monthly_snapshot_${monthKey}`] },
    });
    if (existing.length > 0) {
      return Response.json({
        message: `Monthly snapshot for ${monthLabel} already exists.`,
        document_id: existing[0].id,
      });
    }

    // Fetch data
    const [risks, tasks, recommendations, assessments] = await Promise.all([
      sr.entities.RiskItem.list('-created_date', 5000),
      sr.entities.Task.list('-created_date', 5000),
      sr.entities.Recommendation.list('-created_date', 5000),
      sr.entities.Assessment.list('-created_date', 500),
    ]);

    const reportData = { risks, tasks, recommendations, assessments };

    // Build PDF
    const pdfBuffer = buildPdf(reportData, monthLabel, null);

    // Upload file — write to /tmp then read as bytes for multipart upload
    const fileName = `Annual_Cybersecurity_Report_${monthKey}.pdf`;
    const tmpPath = `/tmp/${fileName}`;
    await Deno.writeFile(tmpPath, new Uint8Array(pdfBuffer));
    const fileBytes = await Deno.readFile(tmpPath);
    const pdfFile = new File([fileBytes], fileName, { type: 'application/pdf' });
    const { file_url } = await sr.integrations.Core.UploadFile({ file: pdfFile });

    // Create SecurityDocument record
    const doc = await sr.entities.SecurityDocument.create({
      title: `Annual Cybersecurity Report — ${monthLabel}`,
      level: 'policy',
      status: 'approved',
      description: `Automatically generated monthly snapshot of the Annual Cybersecurity Report for ${monthLabel}. Covers all customers.`,
      version: '1.0',
      file_url,
      file_name: fileName,
      tags: ['monthly_snapshot', `monthly_snapshot_${monthKey}`, 'annual_report', 'automated'],
      approved_by: 'AnkoraOne Platform (Automated)',
      approved_date: new Date().toISOString().split('T')[0],
    });

    // Create DocumentVersion record for the audit trail
    await sr.entities.DocumentVersion.create({
      document_id: doc.id,
      version_label: '1.0',
      title: doc.title,
      description: doc.description,
      level: 'policy',
      status: 'approved',
      file_url,
      file_name: fileName,
      tags: doc.tags,
      approved_by: doc.approved_by,
      approved_date: doc.approved_date,
      changed_by: isScheduled ? 'system@automated' : 'admin',
      change_note: `Monthly snapshot automatically generated for ${monthLabel}.`,
    });

    return Response.json({
      success: true,
      message: `Monthly snapshot created for ${monthLabel}.`,
      document_id: doc.id,
      file_url,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});