// Envio de email por SMTP genérico (Microsoft 365, Gmail, SendGrid, Mailgun, servidor próprio…).
import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { HttpError, escapeHtml } from '../util.js';

let transport = null;

export const emailConfigured = () => Boolean(config.smtp.host);

function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transport;
}

const looksLikeHtml = (s) => /<\/?[a-z][\s\S]*>/i.test(String(s || ''));

/** Equivalente a base44.integrations.Core.SendEmail({ to, subject, body, from_name }). */
export async function sendEmail({ to, subject, body, from_name, html, text } = {}) {
  const recipients = (Array.isArray(to) ? to : String(to || '').split(','))
    .map((s) => String(s).trim()).filter(Boolean);
  if (!recipients.length) throw new HttpError(400, 'SendEmail: destinatário em falta');
  if (!subject) throw new HttpError(400, 'SendEmail: assunto em falta');
  const content = html ?? body ?? text ?? '';
  const isHtml = html !== undefined || looksLikeHtml(content);

  if (!emailConfigured()) {
    console.warn(`[email] SMTP não configurado — email para ${recipients.join(', ')} não enviado. Assunto: ${subject}`);
    if (!config.isProduction) console.warn(`[email] conteúdo:\n${String(content).slice(0, 2000)}`);
    return { success: false, skipped: true, reason: 'smtp_not_configured' };
  }

  const fromName = (from_name || config.smtp.fromName).replace(/["<>\r\n]/g, '');
  const info = await getTransport().sendMail({
    from: `"${fromName}" <${config.smtp.from}>`,
    to: recipients.join(', '),
    subject: String(subject).replace(/[\r\n]+/g, ' '),
    ...(isHtml ? { html: content, text: String(content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() } : { text: content }),
  });
  return { success: true, id: info.messageId };
}

/** Modelo simples para emails de sistema (verificação, recuperação, convites). */
export function systemEmail({ title, intro, code, buttonLabel, buttonUrl, outro }) {
  const btn = buttonUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(buttonUrl)}" style="background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(buttonLabel)}</a></p>
       <p style="font-size:12px;color:#64748b">Se o botão não funcionar, copie este endereço: ${escapeHtml(buttonUrl)}</p>`
    : '';
  const codeBlock = code
    ? `<p style="font-size:28px;letter-spacing:6px;font-weight:bold;margin:24px 0">${escapeHtml(code)}</p>`
    : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#0f172a">
    <h2 style="margin-bottom:8px">${escapeHtml(title)}</h2>
    <p>${escapeHtml(intro)}</p>${codeBlock}${btn}
    ${outro ? `<p style="color:#475569">${escapeHtml(outro)}</p>` : ''}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
    <p style="font-size:12px;color:#94a3b8">${escapeHtml(config.smtp.fromName)}</p>
  </div>`;
}
