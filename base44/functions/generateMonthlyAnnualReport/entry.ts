import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, getAuthenticatedUser, isPlatformAdmin } from '../../shared/http.ts';
import { getAutomationSecret } from '../../shared/automationSecret.ts';
import { buildPdf } from './pdf.ts';

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both scheduled (via shared automation secret) and manual admin trigger.
    // Anonymous callers are rejected — access is never granted merely because
    // base44.auth.me() threw.
    const isScheduled = !!(await getAutomationSecret(req));
    if (!isScheduled) {
      const user = await getAuthenticatedUser(base44);
      if (!isPlatformAdmin(user)) {
        return json({ error: 'Admin access required' }, 403);
      }
    }

    const sr = base44.asServiceRole;

    // Determine month label (current month being snapshotted)
    const now = new Date();
    const monthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const monthLabelPt = now.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Check for duplicate snapshot this month to avoid re-runs
    const existing = await sr.entities.SecurityDocument.filter({
      tags: { $in: [`monthly_snapshot_${monthKey}`] },
    });
    if (existing.length > 0) {
      return json({
        message: `Já existe o retrato mensal de ${monthLabelPt}.`,
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
      title: `Relatório Anual de Cibersegurança: ${monthLabelPt}`,
      level: 'policy',
      status: 'approved',
      description: `Retrato mensal do Relatório Anual de Cibersegurança de ${monthLabelPt}, gerado automaticamente. Inclui todos os clientes.`,
      version: '1.0',
      file_url,
      file_name: fileName,
      tags: ['monthly_snapshot', `monthly_snapshot_${monthKey}`, 'annual_report', 'automated'],
      approved_by: 'AnkoraOne (automático)',
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
      change_note: `Retrato mensal de ${monthLabelPt} gerado automaticamente.`,
    });

    return json({
      success: true,
      message: `Retrato mensal de ${monthLabelPt} criado.`,
      document_id: doc.id,
      file_url,
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});
