import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { escapeHtml as esc } from '../../shared/escapeHtml.ts';
import { json, getAuthenticatedUser, isPlatformAdmin, canAccessRecord } from '../../shared/http.ts';
import { logEmailSent } from '../../shared/audit.ts';
import { getReminderSettings, buildRecipients, canUseAdditionalRecipients } from '../../shared/reminderSettings.ts';
import { isAllowedRecipient } from '../../shared/recipients.ts';
import { notificationLimitReached, NOTIFICATION_EMAILS_PER_HOUR } from '../../shared/rateLimit.ts';
import { sendMail } from '../../shared/mail.ts';

/** Limite por hora por utilizador; a automação agendada (sessão de administrador) não é limitada. */
const rateLimited = async (base44, user, isAutomation) =>
  !isAutomation && (await notificationLimitReached(base44, user));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();

  // Support both direct API call (type/document) and entity automation payload (event/data)
  let type, document, previousDocument, user;
  // Automação agendada = chamador é o administrador da plataforma. Os destinatários adicionais só são usados por
  // quem os pode configurar: administrador da plataforma, administrador do cliente, ou essa automação.
  let isAutomation = false;
  let allowAdditional = false;

  if (body.event && body.data) {
    // Entity automation branch: only a platform automation — which runs with the
    // app owner's admin session — may trigger this service-role email dispatch.
    // Anonymous callers are rejected before any read/write.
    if (!isPlatformAdmin(await getAuthenticatedUser(base44))) {
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
    user = { full_name: 'Sistema', email: 'system' };
    isAutomation = true;
    allowAdditional = true;
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
    allowAdditional = canUseAdditionalRecipients(user, realDoc.customer_id);
  }

  if (!document) return json({ error: 'document is required' }, 400);

  const settings = await getReminderSettings(base44.asServiceRole, document.customer_id);

  const LEVEL_LABELS = { policy: 'Política', standard: 'Norma', procedure: 'Procedimento', playbook: 'Playbook' };
  const STATUS_LABELS = { draft: 'Rascunho', under_review: 'Em revisão', approved: 'Aprovado', deprecated: 'Obsoleto' };

  const headerHtml = (title) => `
    <div style="background:#070A13;padding:20px 28px;border-radius:10px 10px 0 0;">
      <h2 style="color:#fff;margin:0;font-size:18px;">${title}</h2>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">AnkoraOne</p>
    </div>`;

  const tableRow = (label, value) =>
    `<tr><td style="padding:6px 12px;background:#f4f4f5;font-weight:600;width:140px;">${label}</td><td style="padding:6px 12px;">${value}</td></tr>`;

  // ── 1. Document sent for review ──────────────────────────────────────────────
  if (type === 'sent_for_review') {
    if (settings.notify_on_document_review === false) {
      return json({ skipped: 'document review notifications disabled' });
    }

    // Quem aprova são os administradores do cliente: o aviso vai para eles (e para os destinatários adicionais),
    // não para o autor do documento.
    const approvers = document.customer_id
      ? (await base44.asServiceRole.entities.User.filter({ customer_id: document.customer_id, role: 'customer_admin' })).map((u) => u.email).filter(Boolean)
      : [];
    const recipients = [...new Set([...approvers, ...buildRecipients(null, settings, allowAdditional)])].filter((e) => e && e !== user.email);
    if (recipients.length === 0) return json({ skipped: 'no recipients' });
    if (await rateLimited(base44, user, isAutomation)) {
      return json({ error: `Atingiu o limite de ${NOTIFICATION_EMAILS_PER_HOUR} avisos por hora. Tente mais tarde.` }, 429);
    }

    const body = `
      <div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#1e293b;">
        ${headerHtml('Documento enviado para revisão')}
        <div style="background:#fff;padding:24px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
          <p>Olá,</p>
          <p>O documento de segurança abaixo foi enviado para revisão e aguarda a sua análise:</p>
          <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;margin:12px 0;">
            ${tableRow('Título', esc(document.title))}
            ${tableRow('Nível', LEVEL_LABELS[document.level] || esc(document.level) || '—')}
            ${tableRow('Estado', '<strong>Em revisão</strong>')}
            ${document.customer_name ? tableRow('Cliente', esc(document.customer_name)) : ''}
            ${document.review_date ? tableRow('Data de revisão', esc(document.review_date)) : ''}
            ${document.description ? tableRow('Descrição', esc(document.description)) : ''}
          </table>
          <p>Inicie sessão na plataforma para aprovar o documento ou pedir alterações.</p>
          <p style="color:#6b7280;font-size:12px;">Enviado por: ${esc(user.full_name || user.email)}</p>
        </div>
      </div>`.trim();

    for (const to of recipients) {
      await sendMail(base44, {
        to,
        subject: `[Revisão pendente] ${esc(document.title)}`,
        body,
      });
    }
    await logEmailSent(base44, {
      user_email: user.email,
      entity_type: 'SecurityDocument',
      entity_id: document.id,
      details: `Aviso de revisão do documento «${document.title}» enviado a ${recipients.join(', ')}`,
    });
    return json({ sent: 'sent_for_review', to: recipients });
  }

  // ── 2. Document approved ────────────────────────────────────────────────────
  if (type === 'approved') {
    if (settings.notify_on_document_approval === false) {
      return json({ skipped: 'document approval notifications disabled' });
    }

    // O autor é um endereço de texto livre escrito por quem cria o documento: só recebe o aviso se constar nos
    // contactos registados do cliente (mesma regra de sendEmail).
    const ownerOk = await isAllowedRecipient(base44, document.customer_id, document.owner_email, { includeExternal: allowAdditional });
    const recipients = buildRecipients(ownerOk ? document.owner_email : null, settings, allowAdditional);
    if (recipients.length === 0) return json({ skipped: 'no recipients' });
    if (await rateLimited(base44, user, isAutomation)) {
      return json({ error: `Atingiu o limite de ${NOTIFICATION_EMAILS_PER_HOUR} avisos por hora. Tente mais tarde.` }, 429);
    }

    const body = `
      <div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#1e293b;">
        ${headerHtml('Documento aprovado')}
        <div style="background:#fff;padding:24px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
          <p>Olá,</p>
          <p>O documento de segurança abaixo foi <strong style="color:#16a34a;">aprovado</strong>:</p>
          <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;margin:12px 0;">
            ${tableRow('Título', esc(document.title))}
            ${tableRow('Nível', LEVEL_LABELS[document.level] || esc(document.level) || '—')}
            ${tableRow('Estado', '<strong style="color:#16a34a;">Aprovado</strong>')}
            ${document.approved_by ? tableRow('Aprovado por', esc(document.approved_by)) : ''}
            ${document.approved_date ? tableRow('Data de aprovação', esc(document.approved_date)) : ''}
            ${document.customer_name ? tableRow('Cliente', esc(document.customer_name)) : ''}
          </table>
          <p style="color:#6b7280;font-size:12px;">Aprovado por: ${esc(user.full_name || user.email)}</p>
        </div>
      </div>`.trim();

    for (const to of recipients) {
      await sendMail(base44, {
        to,
        subject: `[Documento aprovado] ${esc(document.title)}`,
        body,
      });
    }
    await logEmailSent(base44, {
      user_email: user.email,
      entity_type: 'SecurityDocument',
      entity_id: document.id,
      details: `Aviso de aprovação do documento «${document.title}» enviado a ${recipients.join(', ')}`,
    });
    return json({ sent: 'approved', to: recipients });
  }

  return json({ skipped: 'unknown type' });
});