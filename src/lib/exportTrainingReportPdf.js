import jsPDF from 'jspdf';
import { format, parseISO } from 'date-fns';
import { pt, enUS } from 'date-fns/locale';

const BRAND_DARK = [20, 30, 60];
const BRAND_BLUE = [59, 130, 246];
const BRAND_TEAL = [16, 155, 133];
const LIGHT_GRAY = [245, 247, 250];
const MID_GRAY = [100, 110, 130];
const BORDER_GRAY = [220, 225, 235];
const WARN = [249, 115, 22];

function setColor(doc, rgb, type = 'text') {
  if (type === 'fill') doc.setFillColor(...rgb);
  else if (type === 'draw') doc.setDrawColor(...rgb);
  else doc.setTextColor(...rgb);
}

function fmtDate(iso, locale) {
  if (!iso) return '—';
  const d = parseISO(iso);
  if (isNaN(d)) return '—';
  return format(d, 'dd MMM yyyy · HH:mm', { locale });
}

/**
 * Generates an individual training compliance report (PDF) for a collaborator.
 * @param {object} user - TrainingUser record
 * @param {array} enrollments - TrainingEnrollment records for this user
 * @param {array} trainings - Training records (customer-wide, to join details)
 * @param {object} customer - { name }
 * @param {function} t - translation function
 * @param {string} language - 'en' | 'pt'
 */
export function exportTrainingReportPdf(user, enrollments, trainings, customer, t, language) {
  const locale = language === 'pt' ? pt : enUS;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const tMap = {};
  trainings.forEach(tr => { tMap[tr.id] = tr; });

  const completed = enrollments.filter(e => e.attendance_status === 'attended');
  const pending = enrollments.filter(e => e.attendance_status !== 'attended');
  const total = enrollments.length;
  const completionRate = total ? Math.round((completed.length / total) * 100) : 0;

  const fullName = user.full_name || '—';
  const genDate = format(new Date(), 'dd MMMM yyyy', { locale });

  // ─── COVER HEADER ───────────────────────────────────────────────────────────
  setColor(doc, BRAND_DARK, 'fill');
  doc.rect(0, 0, W, 78, 'F');
  setColor(doc, BRAND_BLUE, 'fill');
  doc.rect(0, 78, W, 4, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  setColor(doc, [200, 210, 255]);
  doc.text('CYBERMATURITY PLATFORM', 20, 26);

  doc.setFontSize(22);
  setColor(doc, [255, 255, 255]);
  doc.text(t('training_report_title'), 20, 42);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  setColor(doc, [180, 195, 230]);
  doc.text(fullName, 20, 54);
  doc.text(customer?.name || '', 20, 64);

  // Completion badge
  setColor(doc, BRAND_TEAL, 'fill');
  doc.roundedRect(W - 56, 24, 40, 44, 4, 4, 'F');
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  setColor(doc, [255, 255, 255]);
  doc.text(`${completionRate}%`, W - 36, 44, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  setColor(doc, [220, 240, 235]);
  doc.text(t('training_report_completion'), W - 36, 54, { align: 'center' });

  // ─── COLLABORATOR INFO ──────────────────────────────────────────────────────
  let y = 96;
  const meta = [
    [t('training_report_collaborator'), fullName],
    [t('training_report_position'), user.position || '—'],
    [t('training_report_department'), user.department || '—'],
    [t('training_report_email'), user.email || '—'],
    [t('training_report_customer'), customer?.name || '—'],
    [t('training_report_generated'), genDate],
  ];

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  setColor(doc, BRAND_DARK);
  doc.text(t('training_report_info'), 20, y);
  y += 6;
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
    const lines = doc.splitTextToSize(String(value), 100);
    doc.text(lines, 80, y);
    y += lines.length * 5.5 + 1.5;
  });

  // ─── SUMMARY STATS ─────────────────────────────────────────────────────────
  y += 4;
  const stats = [
    { label: t('training_report_total'), value: String(total), color: BRAND_BLUE },
    { label: t('training_report_completed'), value: String(completed.length), color: BRAND_TEAL },
    { label: t('training_report_pending'), value: String(pending.length), color: pending.length ? WARN : MID_GRAY },
  ];
  let sx = 20;
  stats.forEach(({ label, value, color }) => {
    setColor(doc, LIGHT_GRAY, 'fill');
    setColor(doc, BORDER_GRAY, 'draw');
    doc.setLineWidth(0.3);
    doc.roundedRect(sx, y, 52, 20, 2, 2, 'FD');
    setColor(doc, color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(value, sx + 26, y + 11, { align: 'center' });
    setColor(doc, MID_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(label, sx + 26, y + 17, { align: 'center' });
    sx += 56;
  });

  // Progress bar
  y += 26;
  setColor(doc, BORDER_GRAY, 'fill');
  doc.roundedRect(20, y, W - 40, 5, 1, 1, 'F');
  setColor(doc, BRAND_TEAL, 'fill');
  doc.roundedRect(20, y, ((W - 40) * completionRate) / 100, 5, 1, 1, 'F');
  setColor(doc, BRAND_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`${completionRate}%`, W - 20, y + 3.8, { align: 'right' });

  // ─── COMPLETED TRAININGS ────────────────────────────────────────────────────
  y += 14;
  y = renderSection(doc, t('training_report_completed_list'), completed, tMap, t, locale, true, y, W, H);
  // ─── PENDING TRAININGS ─────────────────────────────────────────────────────
  y = renderSection(doc, t('training_report_pending_list'), pending, tMap, t, locale, false, y + 8, W, H);

  // ─── PROOF / DISCLAIMER PAGE ────────────────────────────────────────────────
  doc.addPage();
  setColor(doc, BRAND_DARK, 'fill');
  doc.rect(0, 0, W, 22, 'F');
  setColor(doc, BRAND_BLUE, 'fill');
  doc.rect(0, 22, W, 2, 'F');
  setColor(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CyberMaturity Platform', 20, 14);

  let py = 40;
  setColor(doc, BRAND_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(t('training_report_proof_title'), 20, py);
  py += 8;

  const proof = t('training_report_proof_body', {
    name: fullName,
    customer: customer?.name || '—',
    completed: completed.length,
    total,
    rate: completionRate,
  });
  setColor(doc, MID_GRAY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const proofLines = doc.splitTextToSize(proof, W - 40);
  doc.text(proofLines, 20, py);
  py += proofLines.length * 5.5 + 8;

  setColor(doc, BRAND_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(t('training_report_notice_title'), 20, py);
  py += 7;

  const notice = t('training_report_notice_body', { customer: customer?.name || '—', date: genDate });
  setColor(doc, MID_GRAY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const noticeLines = doc.splitTextToSize(notice, W - 40);
  doc.text(noticeLines, 20, py);

  // Signature line
  py += noticeLines.length * 5 + 18;
  setColor(doc, BORDER_GRAY, 'draw');
  doc.setLineWidth(0.3);
  doc.line(20, py, 90, py);
  setColor(doc, MID_GRAY);
  doc.setFontSize(8);
  doc.text(customer?.name || '', 20, py + 5);

  // ─── FOOTERS ────────────────────────────────────────────────────────────────
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
    doc.text(`${fullName} · ${t('training_report_title')}`, pw / 2, ph - 8, { align: 'center' });
    doc.text(`Page ${i} of ${totalPages}`, pw - 20, ph - 8, { align: 'right' });
  }

  const filename = `${fullName.replace(/[^a-z0-9]/gi, '_')}_Training_Report.pdf`;
  doc.save(filename);
}

function renderSection(doc, title, items, tMap, t, locale, isCompleted, startY, W, H) {
  let y = startY;
  if (y > H - 50) { doc.addPage(); y = 30; }
  const col = isCompleted ? BRAND_TEAL : WARN;

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  setColor(doc, BRAND_DARK);
  doc.text(title, 20, y);
  y += 4;
  setColor(doc, col, 'fill');
  doc.rect(20, y, W - 40, 1.5, 'F');
  y += 8;

  if (items.length === 0) {
    setColor(doc, MID_GRAY);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text(isCompleted ? t('training_report_no_completed') : t('training_report_no_pending'), 22, y);
    return y;
  }

  items.forEach((enr, idx) => {
    const tr = tMap[enr.training_id] || {};
    const titleLines = doc.splitTextToSize(enr.training_title || tr.title || '—', W - 48);
    const metaLine = [
      fmtDate(tr.scheduled_date || enr.scheduled_date, locale),
      tr.topic ? t(`training_topic_${tr.topic}`) : '',
      tr.modality ? t(`training_modality_${tr.modality}`) : '',
      tr.duration_minutes ? `${tr.duration_minutes} min` : '',
    ].filter(Boolean).join('  ·  ');
    const meta2 = [tr.trainer, tr.location].filter(Boolean).join('  ·  ');
    const cardH = 8 + titleLines.length * 5.5 + (metaLine ? 5 : 0) + (meta2 ? 5 : 0) + (!isCompleted ? 5 : 0) + 4;

    if (y + cardH > H - 20) {
      doc.addPage();
      y = 30;
    }

    // Card
    setColor(doc, LIGHT_GRAY, 'fill');
    setColor(doc, BORDER_GRAY, 'draw');
    doc.setLineWidth(0.3);
    doc.roundedRect(18, y, W - 36, cardH, 2, 2, 'FD');
    // Status stripe
    setColor(doc, col, 'fill');
    doc.roundedRect(18, y, 4, cardH, 1, 1, 'F');

    // Index
    setColor(doc, MID_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`#${idx + 1}`, 26, y + 7);

    // Title
    setColor(doc, BRAND_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(titleLines, 32, y + 7);

    let ly = y + 7 + titleLines.length * 5.5;
    if (metaLine) {
      setColor(doc, MID_GRAY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const ml = doc.splitTextToSize(metaLine, W - 56);
      doc.text(ml, 32, ly);
      ly += ml.length * 4.5;
    }
    if (meta2) {
      setColor(doc, MID_GRAY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const ml = doc.splitTextToSize(meta2, W - 56);
      doc.text(ml, 32, ly);
      ly += ml.length * 4.5;
    }
    if (!isCompleted) {
      const statusLabel = t(`training_enrollment_attendance_${enr.attendance_status || 'invited'}`);
      setColor(doc, WARN, 'fill');
      doc.roundedRect(32, ly - 3, 34, 6, 1, 1, 'F');
      setColor(doc, [255, 255, 255]);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(statusLabel, 49, ly + 1, { align: 'center' });
    }

    y += cardH + 4;
  });

  return y;
}