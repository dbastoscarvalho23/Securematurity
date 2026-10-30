import { secrets } from "base44:runtime";

/**
 * Envio de email da AnkoraOne — ponto único para todas as funções.
 *
 * Fornecedor escolhido pelo segredo MAIL_PROVIDER:
 *  - "base44" (omissão): integração Core.SendEmail. O endereço é o do Base44
 *    (ou o domínio de email configurado na app); só o nome do remetente muda.
 *  - "resend": API da Resend com domínio próprio verificado (ex.: ankoraone.com).
 *      RESEND_API_KEY obrigatório.
 *
 * Remetente: MAIL_FROM («Daniel Carvalho <daniel.carvalho@ankoraone.com>»),
 * resposta: MAIL_REPLY_TO (opcional). Sem MAIL_FROM usa-se DEFAULT_FROM.
 * Se o fornecedor próprio falhar, o email segue pelo Base44 para não se perder.
 *
 * Os segredos são lidos em cada pedido (secrets.get() devolve undefined no carregamento do módulo).
 */

export const DEFAULT_FROM = "Daniel Carvalho · AnkoraOne <daniel.carvalho@ankoraone.com>";

type MailInput = {
  to: string | string[];
  subject: string;
  /** HTML (fragmento) ou texto simples — o texto é convertido em parágrafos. */
  body: string;
  /** Título opcional mostrado no cabeçalho do email. */
  heading?: string;
};

export type MailResult = { sent: number; provider: string; fallback?: boolean; errors?: string[] };

function secret(name: string): string {
  try {
    const v = secrets.get(name);
    return typeof v === "string" ? v.trim() : "";
  } catch {
    return "";
  }
}

export function mailConfig() {
  const from = secret("MAIL_FROM") || DEFAULT_FROM;
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return {
    provider: (secret("MAIL_PROVIDER") || "base44").toLowerCase(),
    from,
    fromName: (m ? m[1] : "").replace(/^"|"$/g, "") || "AnkoraOne",
    fromEmail: m ? m[2] : from,
    replyTo: secret("MAIL_REPLY_TO") || (m ? m[2] : from),
  };
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'" };

/** Assunto em texto simples: sem entidades HTML nem quebras de linha. */
export function cleanSubject(subject: string): string {
  return String(subject || "")
    .replace(/&(amp|lt|gt|quot|#39|#x27);/g, (e) => ENTITIES[e] || e)
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 250);
}

function escapeText(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Converte texto simples em HTML (parágrafos e quebras de linha); HTML passa como está. */
export function toHtmlFragment(body: string): string {
  const b = String(body || "");
  if (/<\/?(p|div|table|br|ul|ol|h\d|strong|a)\b/i.test(b)) return b;
  return b
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 14px;">${escapeText(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Moldura AnkoraOne (cores do tema: navy #070A13, dourado #D0A24C). */
export function wrapHtml(fragment: string, heading?: string): string {
  return `<!DOCTYPE html><html lang="pt-PT"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Work Sans',Arial,Helvetica,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
<tr><td style="background:#070A13;padding:22px 28px;border-bottom:3px solid #D0A24C;">
<span style="font-size:20px;font-weight:700;letter-spacing:1px;color:#ffffff;">ANKORA</span><span style="font-size:20px;font-weight:700;letter-spacing:1px;color:#D0A24C;">ONE</span>
${heading ? `<div style="margin-top:6px;font-size:13px;color:#94a3b8;">${escapeText(heading)}</div>` : ""}
</td></tr>
<tr><td style="padding:28px;font-size:14px;line-height:1.55;">${fragment}</td></tr>
<tr><td style="padding:16px 28px 22px;border-top:1px solid #e2e8f0;font-size:11px;line-height:1.5;color:#64748b;">
Mensagem enviada pela plataforma AnkoraOne. Recebeu-a por ter uma conta ou uma tarefa associada na plataforma.
</td></tr></table></td></tr></table></body></html>`;
}

async function sendViaBase44(base44: any, to: string, subject: string, html: string, fromName: string) {
  await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body: html, from_name: fromName });
}

async function sendViaResend(cfg: ReturnType<typeof mailConfig>, to: string[], subject: string, html: string) {
  const key = secret("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY em falta");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: cfg.from, to, subject, html, reply_to: cfg.replyTo }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/**
 * Envia um email com a moldura AnkoraOne. Nunca lança exceções: devolve quantos seguiram e os erros.
 */
export async function sendMail(base44: any, input: MailInput): Promise<MailResult> {
  const cfg = mailConfig();
  const recipients = [...new Set((Array.isArray(input.to) ? input.to : [input.to]).map((x) => String(x || "").trim().toLowerCase()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))];
  if (!recipients.length) return { sent: 0, provider: cfg.provider, errors: ["sem destinatários válidos"] };
  const subject = cleanSubject(input.subject);
  const html = wrapHtml(toHtmlFragment(input.body), input.heading);
  const errors: string[] = [];

  const own = cfg.provider === "resend";
  let sent = 0;
  let fellBack = false;
  // Um envio por destinatário: ninguém vê os endereços dos outros, e uma falha não repete os já enviados.
  for (const to of recipients) {
    if (own) {
      try {
        await sendViaResend(cfg, [to], subject, html);
        sent++;
        continue;
      } catch (e) {
        errors.push(`${to} (${cfg.provider}): ${String((e as Error)?.message || e)}`);
        console.error("[mail] fornecedor próprio falhou, a usar Base44:", errors[errors.length - 1]);
        fellBack = true;
      }
    }
    try {
      await sendViaBase44(base44, to, subject, html, cfg.fromName);
      sent++;
    } catch (e) {
      errors.push(`${to}: ${String((e as Error)?.message || e)}`);
    }
  }
  return { sent, provider: cfg.provider, ...(fellBack ? { fallback: true } : {}), ...(errors.length ? { errors } : {}) };
}