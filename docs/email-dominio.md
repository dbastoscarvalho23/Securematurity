# Envio de email pelo domínio ankoraone.com

Estado a 26 de outubro de 2026.

| Tipo de email | Quem envia | Remetente |
|---|---|---|
| Alertas CVE, tarefas, riscos, documentos, lembretes, questionários, formações, licenças, testes | Funções da app → `base44/shared/mail.ts` → **Resend** | «Daniel Carvalho · AnkoraOne» `<daniel.carvalho@ankoraone.com>`, respostas para o mesmo endereço |
| Convite, redefinição de palavra-passe, verificação de conta, acesso aprovado | Autenticação do Base44 | «AnkoraOne» `<no-reply@app.ankoraone.com>` quando o domínio de email estiver ativo; até lá, endereço do Base44 |

## Emails da app (Resend)

- Domínio `ankoraone.com` verificado na Resend (região UE, eu-west-1), com os registos DKIM, SPF e MX de `send` na Cloudflare.
- Segredos da app: `MAIL_PROVIDER=resend`, `MAIL_FROM`, `MAIL_REPLY_TO`, `RESEND_API_KEY`.
- Se a Resend falhar para um destinatário, o email segue pelo Base44 e o resultado indica o recurso.
- Teste: Definições → Aplicação → «Enviar email de teste». Histórico: Relatório de Emails.
- Alternativa: `MAIL_PROVIDER=smtp` com `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (Microsoft 365 `smtp.office365.com:587`; Google Workspace `smtp.gmail.com:587`).

## Emails da plataforma (convites e palavra-passe)

- Domínio de email `app.ankoraone.com` ativado na app (remetente `no-reply@app.ankoraone.com`). Fica ativo quando os três CNAME de `docs/dominio-proprio.md` estiverem em «DNS only» e verificados.
- Textos em PT-PT e com a marca AnkoraOne: modelos em `base44/emails/` da app (convite, redefinição, verificação, acesso aprovado). O assunto continua a ser definido pelo Base44.
- Para usar `@ankoraone.com` nestes emails, a raiz do domínio teria de apontar para a app, o que tiraria o site institucional do ar.
