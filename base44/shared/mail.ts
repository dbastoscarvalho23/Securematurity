import { secrets } from "base44:runtime";
import { emailFrame } from "./emailTemplates.ts";

/**
 * Envio de email da AnkoraOne — ponto único para todas as funções.
 *
 * Fornecedor escolhido pelo segredo MAIL_PROVIDER:
 *  - "base44" (omissão): integração Core.SendEmail. O endereço é o do Base44
 *    (ou o domínio de email configurado na app); só o nome do remetente muda.
 *  - "resend": API da Resend com domínio próprio verificado (ex.: ankoraone.com).
 *      RESEND_API_KEY obrigatório.
 *  - "smtp": servidor SMTP do domínio (Microsoft 365, Google Workspace, …).
 *      SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS obrigatórios.
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

/**
 * Moldura AnkoraOne de todos os emails da plataforma (alertas, notificações,
 * questionários, convites, redefinição de palavra-passe e acesso aprovado).
 * O desenho vive em `emailTemplates.ts`: cabeçalho #070A13 com «ANKORA» branco e
 * «ONE» dourado #D0A24C, botão dourado com texto escuro e rodapé com o contacto.
 */
export function wrapHtml(fragment: string, heading?: string): string {
  return emailFrame({ heading, content: fragment });
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

async function sendViaSmtp(cfg: ReturnType<typeof mailConfig>, to: string[], subject: string, html: string) {
  const host = secret("SMTP_HOST"), user = secret("SMTP_USER"), pass = secret("SMTP_PASS");
  if (!host || !user || !pass) throw new Error("SMTP_HOST, SMTP_USER e SMTP_PASS em falta");
  const port = Number(secret("SMTP_PORT") || 587);
  const nodemailer = (await import("npm:nodemailer@6.9.16")).default;
  const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass }, requireTLS: port !== 465 });
  await transport.sendMail({ from: cfg.from, to, subject, html, replyTo: cfg.replyTo });
}

/**
 * Envia um email com a moldura AnkoraOne. Nunca lança exceções: devolve quantos seguiram e os erros.
 */
export async function sendMail(base44: any, input: MailInput): Promise<MailResult> {
  const cfg = mailConfig();
  const recipients = [...new Set((Array.isArray(input.to) ? input.to : [input.to]).map((x) => String(x || "").trim().toLowerCase()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))];
  if (!recipients.length) return { sent: 0, provider: cfg.provider, errors: ["sem destinatários válidos"] };
  const subject = cleanSubject(input.subject);
  // Os modelos de `emailTemplates.ts` chegam já como documento completo (com o
  // cabeçalho e o rodapé da marca): nesse caso não se aplica a moldura outra vez.
  const html = /^\s*(<!DOCTYPE|<html[\s>])/i.test(input.body)
    ? input.body
    : wrapHtml(toHtmlFragment(input.body), input.heading);
  const errors: string[] = [];

  const own = cfg.provider === "resend" || cfg.provider === "smtp";
  let sent = 0;
  let fellBack = false;
  // Um envio por destinatário: ninguém vê os endereços dos outros, e uma falha não repete os já enviados.
  for (const to of recipients) {
    if (own) {
      try {
        if (cfg.provider === "resend") await sendViaResend(cfg, [to], subject, html);
        else await sendViaSmtp(cfg, [to], subject, html);
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
