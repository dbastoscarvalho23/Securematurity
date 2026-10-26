/**
 * Modelos dos emails transacionais da AnkoraOne.
 *
 * Um único módulo define a moldura visual e os três emails de acesso
 * (convite, redefinição de palavra-passe e acesso aprovado), para que todas as
 * comunicações da plataforma tenham o mesmo aspeto:
 *  - cabeçalho azul-escuro #070A13 com «ANKORA» branco e «ONE» dourado #D0A24C;
 *  - botão dourado #D0A24C com texto escuro #070A13;
 *  - rodapé com o contacto de suporte da plataforma.
 *
 * O link de ação (`actionUrl`) e todos os campos variáveis são mantidos em cada
 * modelo. O módulo não importa nada para poder ser usado pelas funções backend e
 * pelo gerador de `docs/emails/` (ver `tools/emails/README.md`).
 */

export const BRAND = {
  navy: '#070A13',
  gold: '#D0A24C',
  page: '#f4f5f7',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  contact: 'daniel.carvalho@ankoraone.com',
  footer: 'Email automático da plataforma AnkoraOne. Para questões, contacte daniel.carvalho@ankoraone.com.',
  font: "'Work Sans', Arial, Helvetica, sans-serif",
};

/** Escapa valores interpolados nos modelos (nomes de clientes, emails, ligações). */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Botão dourado com texto escuro. */
export function actionButton(label, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;"><tr><td style="background:${BRAND.gold};border-radius:6px;">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 24px;font-size:14px;font-weight:600;line-height:1.2;color:${BRAND.navy};text-decoration:none;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

/** Lista de campos variáveis (rótulo / valor). */
export function detailRows(rows) {
  const visible = (rows || []).filter((r) => r && r.value !== undefined && r.value !== null && String(r.value).trim() !== '');
  if (!visible.length) return '';
  const cells = visible
    .map(
      (r) =>
        `<tr><td style="padding:6px 0;font-size:13px;color:${BRAND.muted};width:44%;vertical-align:top;">${escapeHtml(r.label)}</td>` +
        `<td style="padding:6px 0;font-size:13px;color:${BRAND.text};font-weight:600;vertical-align:top;">${escapeHtml(r.value)}</td></tr>`
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:18px 0 4px;border-top:1px solid ${BRAND.border};border-bottom:1px solid ${BRAND.border};">${cells}</table>`;
}

/** Ligação em texto simples, para clientes de email que não mostram o botão. */
function linkFallback(url) {
  return `<p style="margin:0 0 14px;font-size:12px;color:${BRAND.muted};">Se o botão não abrir, copie este endereço para o navegador:<br>
<a href="${escapeHtml(url)}" style="color:${BRAND.navy};text-decoration:underline;word-break:break-all;">${escapeHtml(url)}</a></p>`;
}

/** Nota final em texto secundário. */
function note(text) {
  return `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:${BRAND.muted};">${text}</p>`;
}

/**
 * Moldura comum: cabeçalho, conteúdo e rodapé.
 * `content` é HTML (fragmento) já construído pelos modelos abaixo.
 */
export function emailFrame({ heading, content, preheader } = {}) {
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>`
    : '';
  return `<!DOCTYPE html><html lang="pt-PT"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(heading || 'AnkoraOne')}</title></head>
<body style="margin:0;padding:0;background:${BRAND.page};font-family:${BRAND.font};color:${BRAND.text};">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.page};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:10px;overflow:hidden;">
<tr><td style="background:${BRAND.navy};padding:22px 28px;border-bottom:3px solid ${BRAND.gold};">
<span style="font-size:20px;font-weight:700;letter-spacing:1px;color:#ffffff;">ANKORA</span><span style="font-size:20px;font-weight:700;letter-spacing:1px;color:${BRAND.gold};">ONE</span>
${heading ? `<div style="margin-top:8px;font-size:14px;color:#e2e8f0;">${escapeHtml(heading)}</div>` : ''}
</td></tr>
<tr><td style="padding:28px;font-size:14px;line-height:1.6;">${content || ''}</td></tr>
<tr><td style="padding:16px 28px 22px;border-top:1px solid ${BRAND.border};font-size:11px;line-height:1.5;color:${BRAND.muted};">
Email automático da plataforma AnkoraOne. Para questões, contacte <a href="mailto:${BRAND.contact}" style="color:${BRAND.muted};text-decoration:underline;">${BRAND.contact}</a>.
</td></tr></table></td></tr></table></body></html>`;
}

const ROLE_LABELS = {
  admin: 'Administrador da plataforma',
  customer_admin: 'Administrador do cliente',
  user: 'Utilizador',
};

/** Nome do papel tal como aparece nos emails. */
export function roleLabel(role) {
  return ROLE_LABELS[role] || ROLE_LABELS.user;
}

/**
 * Convite de acesso à plataforma.
 * Campos variáveis: email, role, customerName, invitedBy, actionUrl, expiresInHours.
 */
export function inviteEmail({ email, role, customerName, invitedBy, actionUrl, expiresInHours } = {}) {
  const hours = Number(expiresInHours);
  const hasExpiry = Number.isFinite(hours) && hours > 0;
  const days = hasExpiry ? Math.max(1, Math.round(hours / 24)) : null;
  const content = `<p style="margin:0 0 14px;">Foi criado um acesso à plataforma AnkoraOne para <strong>${escapeHtml(email)}</strong>.</p>
<p style="margin:0 0 14px;">Use o botão abaixo para ativar o acesso e definir a palavra-passe.</p>
${actionButton('Ativar acesso', actionUrl)}
${linkFallback(actionUrl)}
${detailRows([
    { label: 'Email', value: email },
    { label: 'Papel', value: roleLabel(role) },
    { label: 'Cliente', value: customerName },
    { label: 'Convidado por', value: invitedBy },
    { label: 'Validade do convite', value: days ? `${days} ${days === 1 ? 'dia' : 'dias'}` : null },
  ])}
${note(`${days ? `O convite é pessoal e expira em ${days} ${days === 1 ? 'dia' : 'dias'}.` : 'O convite é pessoal.'} No primeiro acesso é pedida a definição da palavra-passe. Se não esperava este convite, ignore esta mensagem e avise <a href="mailto:${BRAND.contact}" style="color:${BRAND.muted};">${BRAND.contact}</a>.`)}`;
  return {
    subject: 'Convite de acesso à plataforma AnkoraOne',
    heading: 'Convite de acesso',
    html: emailFrame({ heading: 'Convite de acesso', preheader: 'Foi criado um acesso à plataforma AnkoraOne.', content }),
  };
}

/**
 * Redefinição de palavra-passe.
 * Campos variáveis: email, actionUrl, expiresInMinutes, requestedAt.
 */
export function passwordResetEmail({ email, actionUrl, expiresInMinutes, requestedAt } = {}) {
  const minutes = Number(expiresInMinutes);
  const hasExpiry = Number.isFinite(minutes) && minutes > 0;
  const content = `<p style="margin:0 0 14px;">Foi pedida a redefinição da palavra-passe da conta <strong>${escapeHtml(email)}</strong> na plataforma AnkoraOne.</p>
<p style="margin:0 0 14px;">Use o botão abaixo para definir a nova palavra-passe.</p>
${actionButton('Definir nova palavra-passe', actionUrl)}
${linkFallback(actionUrl)}
${detailRows([
    { label: 'Conta', value: email },
    { label: 'Pedido a', value: requestedAt },
    { label: 'Validade da ligação', value: hasExpiry ? `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}` : null },
  ])}
${note(`${hasExpiry ? `A ligação é de uso único e expira em ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.` : 'A ligação é de uso único.'} Se não pediu a redefinição, ignore esta mensagem: a palavra-passe atual mantém-se. Para questões, contacte <a href="mailto:${BRAND.contact}" style="color:${BRAND.muted};">${BRAND.contact}</a>.`)}`;
  return {
    subject: 'Redefinição de palavra-passe — AnkoraOne',
    heading: 'Redefinição de palavra-passe',
    html: emailFrame({ heading: 'Redefinição de palavra-passe', preheader: 'Pedido de redefinição da palavra-passe.', content }),
  };
}

/**
 * Acesso aprovado.
 * Campos variáveis: email, role, customerName, approvedBy, approvedAt, actionUrl.
 */
export function accessApprovedEmail({ email, role, customerName, approvedBy, approvedAt, actionUrl } = {}) {
  const content = `<p style="margin:0 0 14px;">O acesso de <strong>${escapeHtml(email)}</strong> à plataforma AnkoraOne foi aprovado.</p>
<p style="margin:0 0 14px;">A conta está ativa e pode ser usada com a palavra-passe já definida.</p>
${actionButton('Entrar na plataforma', actionUrl)}
${linkFallback(actionUrl)}
${detailRows([
    { label: 'Email', value: email },
    { label: 'Papel', value: roleLabel(role) },
    { label: 'Cliente', value: customerName },
    { label: 'Aprovado por', value: approvedBy },
    { label: 'Data', value: approvedAt },
  ])}
${note(`A partir de agora o acesso inclui as avaliações, as evidências e os relatórios do cliente indicado. Para questões, contacte <a href="mailto:${BRAND.contact}" style="color:${BRAND.muted};">${BRAND.contact}</a>.`)}`;
  return {
    subject: 'Acesso aprovado — AnkoraOne',
    heading: 'Acesso aprovado',
    html: emailFrame({ heading: 'Acesso aprovado', preheader: 'O acesso à plataforma foi aprovado.', content }),
  };
}
