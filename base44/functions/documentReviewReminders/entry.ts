import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { escapeHtml } from "../../shared/escapeHtml.ts";
import { json, authorizeAutomationOrAdmin } from "../../shared/http.ts";
import { logEmailSent } from "../../shared/audit.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authorization: scheduled automation (shared secret) or manual platform admin.
    // Anonymous external callers are rejected before any service-role query / email dispatch.
    const forbidden = await authorizeAutomationOrAdmin(req, base44);
    if (forbidden) return forbidden;

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
      return json({ sent: 0, message: 'Não há documentos com revisão prevista nos próximos 30 dias.' });
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
        return `• <strong>${escapeHtml(d.title)}</strong> (${escapeHtml(d.level)}) · Revisão até ${d.review_date} (<strong>${daysLeft} dia${daysLeft !== 1 ? 's' : ''}</strong>)`;
      }).join('<br/>');

      const body = `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
          <div style="background: #1e3a5f; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h2 style="color: #fff; margin: 0; font-size: 20px;">Lembrete de revisão de documentos</h2>
            <p style="color: #94a3b8; margin: 6px 0 0; font-size: 14px;">AnkoraOne</p>
          </div>
          <div style="background: #fff; padding: 28px 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin: 0 0 16px;">Olá,</p>
            <p style="margin: 0 0 16px;">${docs.length > 1 ? 'Os documentos de segurança abaixo têm' : 'O documento de segurança abaixo tem'} revisão prevista nos próximos <strong>30 dias</strong>. Reveja e atualize ${docs.length > 1 ? 'os documentos' : 'o documento'} se for necessário.</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 0 0 20px; line-height: 2;">
              ${docList}
            </div>
            <p style="margin: 0 0 8px; font-size: 14px; color: #64748b;">Inicie sessão na plataforma para rever e atualizar. Se a revisão já foi feita, atualize a data de revisão para deixar de receber este lembrete.</p>
            <p style="margin: 20px 0 0; font-size: 13px; color: #94a3b8;">AnkoraOne · Notificação automática</p>
          </div>
        </div>
      `;

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: ownerEmail,
          subject: `[Ação necessária] ${docs.length} documento${docs.length > 1 ? 's' : ''} de segurança com revisão prevista`,
          body,
        });
        await logEmailSent(base44, {
          user_email: 'system',
          entity_type: 'SecurityDocument',
          details: `Review reminder sent to ${ownerEmail} for ${docs.length} document${docs.length > 1 ? 's' : ''}: ${docs.map(d => d.title).join(', ')}`,
        });
        sent++;
      } catch (e) {
        errors.push({ owner: ownerEmail, error: e.message });
      }
    }

    return json({
      sent,
      total_docs: dueSoon.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});