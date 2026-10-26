import { describe, it, expect } from 'vitest';
import {
  BRAND,
  escapeHtml,
  actionButton,
  roleLabel,
  inviteEmail,
  passwordResetEmail,
  accessApprovedEmail,
} from '../../../base44/shared/emailTemplates.ts';

const LABEL = 'ativar acesso';
const BUTTON_STYLE = /background:#D0A24C/i;

describe('modelos de email da AnkoraOne', () => {
  it('mantém o cabeçalho e o rodapé da marca', () => {
    const { html } = inviteEmail({ email: 'a@b.pt', role: 'user', actionUrl: 'https://app.exemplo.pt/login' });
    expect(html).toContain('background:#070A13');
    expect(html).toContain('>ANKORA</span><span');
    expect(html).toContain('#D0A24C;">ONE</span>');
    expect(html).toContain('Email automático da plataforma AnkoraOne. Para questões, contacte ');
    expect(html).toContain(`${BRAND.contact}</a>.`);
    expect(html).toContain(`mailto:${BRAND.contact}`);
    expect(BRAND.footer).toBe(
      'Email automático da plataforma AnkoraOne. Para questões, contacte daniel.carvalho@ankoraone.com.'
    );
  });

  it('usa o botão dourado com texto escuro e mantém o link de ação', () => {
    const html = actionButton('Ativar acesso', 'https://app.exemplo.pt/login?email=a%40b.pt');
    expect(html).toMatch(BUTTON_STYLE);
    expect(html).toContain('color:#070A13');
    expect(html).toContain('href="https://app.exemplo.pt/login?email=a%40b.pt"');
  });

  it('escreve o convite em PT-PT com os campos variáveis', () => {
    const mail = inviteEmail({
      email: 'ana@empresa.pt',
      role: 'customer_admin',
      customerName: 'Sabugal',
      invitedBy: 'admin@ankoraone.com',
      actionUrl: 'https://app.exemplo.pt/login',
      expiresInHours: 168,
    });
    expect(mail.subject).toBe('Convite de acesso à plataforma AnkoraOne');
    expect(mail.heading).toBe('Convite de acesso');
    expect(mail.html).toContain('ana@empresa.pt');
    expect(mail.html).toContain('Sabugal');
    expect(mail.html).toContain('admin@ankoraone.com');
    expect(mail.html).toContain('Administrador do cliente');
    expect(mail.html).toContain('7 dias');
    expect(mail.html).toContain('https://app.exemplo.pt/login');
  });

  it('escreve a redefinição de palavra-passe em PT-PT', () => {
    const mail = passwordResetEmail({
      email: 'ana@empresa.pt',
      actionUrl: 'https://app.exemplo.pt/reset-password?token=abc',
      expiresInMinutes: 60,
      requestedAt: '26/10/2026 15:38',
    });
    expect(mail.subject).toBe('Redefinição de palavra-passe — AnkoraOne');
    expect(mail.html).toContain('Definir nova palavra-passe');
    expect(mail.html).toContain('https://app.exemplo.pt/reset-password?token=abc');
    expect(mail.html).toContain('60 minutos');
    expect(mail.html).toContain('26/10/2026 15:38');
    expect(mail.html).not.toMatch(/password reset|click here/i);
  });

  it('escreve o aviso de acesso aprovado em PT-PT', () => {
    const mail = accessApprovedEmail({
      email: 'ana@empresa.pt',
      role: 'user',
      customerName: 'Sabugal',
      approvedBy: 'admin@ankoraone.com',
      approvedAt: '2026-10-26',
      actionUrl: 'https://app.exemplo.pt/',
    });
    expect(mail.subject).toBe('Acesso aprovado — AnkoraOne');
    expect(mail.html).toContain('foi aprovado');
    expect(mail.html).toContain('Entrar na plataforma');
    expect(mail.html).toContain('https://app.exemplo.pt/');
    expect(mail.html).toContain('Sabugal');
  });

  it('traduz os papéis e escapa valores interpolados', () => {
    expect(roleLabel('admin')).toBe('Administrador da plataforma');
    expect(roleLabel('customer_admin')).toBe('Administrador do cliente');
    expect(roleLabel('user')).toBe('Utilizador');
    expect(escapeHtml('<script>"x"</script>')).toBe('&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
    const mail = inviteEmail({ email: '<b>a@b.pt</b>', role: 'user', actionUrl: 'https://app.exemplo.pt/login' });
    expect(mail.html).not.toContain('<b>a@b.pt</b>');
    expect(mail.html).toContain('&lt;b&gt;a@b.pt&lt;/b&gt;');
  });
});
