import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // This is a scheduled/system function — use service role
    const today = new Date();
    const in30Days = new Date(today);
    in30Days.setDate(today.getDate() + 30);

    const todayStr = today.toISOString().split('T')[0];
    const in30Str = in30Days.toISOString().split('T')[0];

    // Fetch all docs with a review_date set
    const allDocs = await base44.asServiceRole.entities.SecurityDocument.list('-review_date', 1000);

    const dueSoon = allDocs.filter(doc => {
      if (!doc.review_date || !doc.owner_email) return false;
      if (doc.status === 'deprecated') return false;
      return doc.review_date >= todayStr && doc.review_date <= in30Str;
    });

    if (dueSoon.length === 0) {
      return Response.json({ sent: 0, message: 'No documents due for review in the next 30 days.' });
    }

    // Group by owner_email to send one email per owner
    const byOwner = {};
    for (const doc of dueSoon) {
      if (!byOwner[doc.owner_email]) byOwner[doc.owner_email] = [];
      byOwner[doc.owner_email].push(doc);
    }

    let sent = 0;
    const errors = [];

    for (const [ownerEmail, docs] of Object.entries(byOwner)) {
      const docList = docs.map(d => {
        const daysLeft = Math.ceil((new Date(d.review_date) - today) / (1000 * 60 * 60 * 24));
        return `• <strong>${d.title}</strong> (${d.level}) — Review due: ${d.review_date} (<strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>)`;
      }).join('<br/>');

      const body = `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
          <div style="background: #1e3a5f; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h2 style="color: #fff; margin: 0; font-size: 20px;">📋 Document Review Reminder</h2>
            <p style="color: #94a3b8; margin: 6px 0 0; font-size: 14px;">CyberMaturity Security Platform</p>
          </div>
          <div style="background: #fff; padding: 28px 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin: 0 0 16px;">Hello,</p>
            <p style="margin: 0 0 16px;">The following security document${docs.length > 1 ? 's are' : ' is'} due for review within the next <strong>30 days</strong>. Please review and update ${docs.length > 1 ? 'them' : 'it'} as needed.</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 0 0 20px; line-height: 2;">
              ${docList}
            </div>
            <p style="margin: 0 0 8px; font-size: 14px; color: #64748b;">Please log in to the platform to review and update these documents. If the document has already been reviewed, update the review date to avoid further reminders.</p>
            <p style="margin: 20px 0 0; font-size: 13px; color: #94a3b8;">— CyberMaturity Platform · Automated Notification</p>
          </div>
        </div>
      `;

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: ownerEmail,
          subject: `[Action Required] ${docs.length} security document${docs.length > 1 ? 's' : ''} due for review`,
          body,
        });
        await base44.asServiceRole.entities.AuditLog.create({
          action: 'email_sent',
          user_email: 'system',
          entity_type: 'SecurityDocument',
          details: `Review reminder sent to ${ownerEmail} for ${docs.length} document${docs.length > 1 ? 's' : ''}: ${docs.map(d => d.title).join(', ')}`,
        });
        sent++;
      } catch (e) {
        errors.push({ owner: ownerEmail, error: e.message });
      }
    }

    return Response.json({
      sent,
      total_docs: dueSoon.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});