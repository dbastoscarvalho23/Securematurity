import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { escapeHtml as esc } from '../../shared/escapeHtml.ts';
import { json, getAuthenticatedUser, hasAutomationSecret, canAccessRecord } from '../../shared/http.ts';
import { logEmailSent } from '../../shared/audit.ts';
import { getReminderSettings, buildRecipients } from '../../shared/reminderSettings.ts';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();

  // Support both direct API call (type/document) and entity automation payload (event/data)
  let type, document, previousDocument, user;

  if (body.event && body.data) {
    // Entity automation branch: only platform automations — which carry the
    // shared secret — may trigger this service-role email dispatch. Anonymous
    // callers are rejected before any read/write.
    if (!hasAutomationSecret(req, body)) {
      return json({ error: 'Unauthorized' }, 403);
    }

    // Verify the document exists in the database to prevent spoofed payloads
    const docId = body.data.id;
    if (!docId) return json({ error: 'document id is required' }, 400);
    const realDoc = await base44.asServiceRole.entities.SecurityDocument.get(docId);
    if (!realDoc) return json({ error: 'document not found' }, 404);

    // old_data is caller-supplied, so only accept it when it references the
    // same record — forged "previous" data can no longer skew the email.
    const oldData = body.old_data?.id === docId ? body.old_data : null;

    const newStatus = realDoc.status;
    const oldStatus = oldData?.status;
    if (newStatus === oldStatus) return json({ skipped: 'status unchanged' });

    document = realDoc;
    previousDocument = oldData;

    if (newStatus === 'under_review') type = 'sent_for_review';
    else if (newStatus === 'approved') type = 'approved';
    else return json({ skipped: `status ${newStatus} not actionable` });

    // Use service role for automated calls (no user context)
    user = { full_name: 'System', email: 'system' };
  } else {
    // Direct API call from frontend
    user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    type = body.type;
    previousDocument = body.previousDocument;

    // Do NOT trust body.document — fetch the real record from the database
    // and verify the caller is authorized to trigger its notifications.
    const docId = body.document_id || body.document?.id;
    if (!docId) return json({ error: 'document_id is required' }, 400);
    let realDoc = null;
    try {
      realDoc = await base44.asServiceRole.entities.SecurityDocument.get(docId);
    } catch {
      realDoc = null;
    }
    if (!realDoc) return json({ error: 'document not found' }, 404);

    if (!canAccessRecord(user, realDoc)) return json({ error: 'Forbidden' }, 403);

    // The requested type must match the document's actual stored status, so a
    // caller cannot fire a false "approved" / "sent for review" email.
    if (
      (type === 'sent_for_review' && realDoc.status !== 'under_review') ||
      (type === 'approved' && realDoc.status !== 'approved')
    ) {
      return json({ skipped: `document status ${realDoc.status} does not match type ${type}` });
    }

    document = realDoc;
  }

  if (!document) return json({ error: 'document is required' }, 400);

  const settings = await getReminderSettings(base44.asServiceRole, document.customer_id);

  const LEVEL_LABELS = { policy: 'Policy', standard: 'Standard', procedure: 'Procedure', playbook: 'Playbook' };
  const STATUS_LABELS = { draft: 'Draft', under_review: 'Under Review', approved: 'Approved', deprecated: 'Deprecated' };

  const headerHtml = (title) => `
    <div style="background:#1e3a5f;padding:20px 28px;border-radius:10px 10px 0 0;">
      <h2 style="color:#fff;margin:0;font-size:18px;">📄 ${title}</h2>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">AnkoraOne Security Platform</p>
    </div>`;

  const tableRow = (label, value) =>
    `<tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;width:140px;">${label}</td><td style="padding:6px 12px;">${value}</td></tr>`;

  // ── 1. Document sent for review ──────────────────────────────────────────────
  if (type === 'sent_for_review') {
    if (settings.notify_on_document_review === false) {
      return json({ skipped: 'document review notifications disabled' });
    }

    const recipients = buildRecipients(document.owner_email, settings);
    if (recipients.length === 0) return json({ skipped: 'no recipients' });

    const body = `
      <div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#1e293b;">
        ${headerHtml('Document Sent for Review')}
        <div style="background:#fff;padding:24px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
          <p>Hello,</p>
          <p>The following security document has been submitted for review and requires your attention:</p>
          <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;margin:12px 0;">
            ${tableRow('Title', esc(document.title))}
            ${tableRow('Level', LEVEL_LABELS[document.level] || esc(document.level) || '—')}
            ${tableRow('Status', '<strong>Under Review</strong>')}
            ${document.customer_name ? tableRow('Customer', esc(document.customer_name)) : ''}
            ${document.review_date ? tableRow('Review Date', esc(document.review_date)) : ''}
            ${document.description ? tableRow('Description', esc(document.description)) : ''}
          </table>
          <p>Please log in to the platform to review and approve or request changes.</p>
          <p style="color:#6b7280;font-size:12px;">Submitted by: ${esc(user.full_name || user.email)}</p>
        </div>
      </div>`.trim();

    for (const to of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to,
        subject: `[Review Required] ${esc(document.title)}`,
        body,
      });
    }
    await logEmailSent(base44, {
      user_email: user.email,
      entity_type: 'SecurityDocument',
      entity_id: document.id,
      details: `Document review notification sent to ${recipients.join(', ')} for: ${document.title}`,
    });
    return json({ sent: 'sent_for_review', to: recipients });
  }

  // ── 2. Document approved ────────────────────────────────────────────────────
  if (type === 'approved') {
    if (settings.notify_on_document_approval === false) {
      return json({ skipped: 'document approval notifications disabled' });
    }

    const recipients = buildRecipients(document.owner_email, settings);
    if (recipients.length === 0) return json({ skipped: 'no recipients' });

    const body = `
      <div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#1e293b;">
        ${headerHtml('Document Approved')}
        <div style="background:#fff;padding:24px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
          <p>Hello,</p>
          <p>The following security document has been <strong style="color:#16a34a;">approved</strong>:</p>
          <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;margin:12px 0;">
            ${tableRow('Title', esc(document.title))}
            ${tableRow('Level', LEVEL_LABELS[document.level] || esc(document.level) || '—')}
            ${tableRow('Status', '<strong style="color:#16a34a;">Approved</strong>')}
            ${document.approved_by ? tableRow('Approved By', esc(document.approved_by)) : ''}
            ${document.approved_date ? tableRow('Approval Date', esc(document.approved_date)) : ''}
            ${document.customer_name ? tableRow('Customer', esc(document.customer_name)) : ''}
          </table>
          <p style="color:#6b7280;font-size:12px;">Approved by: ${esc(user.full_name || user.email)}</p>
        </div>
      </div>`.trim();

    for (const to of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to,
        subject: `[Document Approved] ${esc(document.title)}`,
        body,
      });
    }
    await logEmailSent(base44, {
      user_email: user.email,
      entity_type: 'SecurityDocument',
      entity_id: document.id,
      details: `Document approval notification sent to ${recipients.join(', ')} for: ${document.title}`,
    });
    return json({ sent: 'approved', to: recipients });
  }

  return json({ skipped: 'unknown type' });
});