# Envio de email pelo domínio ankoraone.com

## Como funciona hoje

| Tipo de email | Quem envia | Remetente atual |
|---|---|---|
| Alertas CVE, tarefas, riscos, documentos, lembretes, questionários, formações, licenças | Funções da app → `base44/shared/mail.ts` | «Daniel Carvalho · AnkoraOne» `<no-reply@base44-apps.com>` |
| Convites, instruções de redefinição de palavra-passe e aviso de acesso aprovado | Função `accountEmails` → `base44/shared/emailTemplates.ts` | «Daniel Carvalho · AnkoraOne» `<no-reply@base44-apps.com>` |
| Ligação de ativação do convite, token de redefinição e código de verificação | Plataforma Base44 (autenticação) | `no-reply@base44-apps.com` |

Os modelos PT-PT dos três emails de acesso estão em `docs/emails/` (ver o README da pasta). O tema visual de todos
os emails — cabeçalho `#070A13` com «ANKORA» branco e «ONE» dourado `#D0A24C`, botão dourado com texto escuro e
rodapé com o contacto de suporte — vive em `base44/shared/emailTemplates.ts`.

Configuração nos segredos da app: `MAIL_PROVIDER`, `MAIL_FROM`, `MAIL_REPLY_TO` (já definidos), mais `RESEND_API_KEY` ou `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`.
Teste: Definições → Aplicação → «Enviar email de teste».

## Passo 1 — emails da app a partir de daniel.carvalho@ankoraone.com (Resend)

1. Criar conta em resend.com e adicionar o domínio `ankoraone.com`.
2. Na Cloudflare (DNS do ankoraone.com), criar os registos que a Resend mostrar, todos em «DNS only»:
   - TXT `resend._domainkey` (DKIM);
   - MX `send` → `feedback-smtp.<região>.amazonses.com` (prioridade 10);
   - TXT `send` → `v=spf1 include:amazonses.com ~all`.
   Estes registos ficam no subdomínio `send` e não mexem no correio atual do domínio (MX da raiz).
3. Recomendado: TXT `_dmarc` → `v=DMARC1; p=none; rua=mailto:daniel.carvalho@ankoraone.com` (se ainda não existir).
4. Criar uma API key («Sending access», só para ankoraone.com) e guardar nos segredos da app:
   `RESEND_API_KEY=<chave>` e `MAIL_PROVIDER=resend`.
5. Enviar o email de teste. Se a Resend falhar, o email segue pelo Base44 e o painel avisa.

Alternativa sem Resend: SMTP da caixa daniel.carvalho@ankoraone.com (Microsoft 365: `smtp.office365.com:587`, exige SMTP AUTH ativo na caixa; Google Workspace: `smtp.gmail.com:587` com palavra-passe de aplicação) e `MAIL_PROVIDER=smtp`.

## Passo 2 — convites e redefinição de palavra-passe

Estes emails são enviados pela autenticação do Base44 e só mudam de endereço com um domínio de email ligado à app:

1. Concluir o domínio `app.ankoraone.com` (CNAME `app` → `base44.onrender.com`, «DNS only»).
2. No Base44 (Dashboard → Domínios → Email), ativar o envio para o domínio ligado e publicar na Cloudflare os 3 CNAME indicados (`em…`, `s1._domainkey`, `s2._domainkey`).
   O endereço fica no domínio ligado à app (ex.: `no-reply@app.ankoraone.com`). Para usar `@ankoraone.com` nestes emails, a raiz `ankoraone.com` teria de apontar para a app, o que tira o site institucional do ar.
3. Textos em PT-PT e com a marca AnkoraOne: Dashboard → Emails → «Application emails» → «Edit with AI» (plano Builder). A API não deixa alterar o ramo principal protegido. Os modelos prontos a colar estão em `docs/emails/` (convite, redefinição de palavra-passe e acesso aprovado); manter as variáveis e a ligação de ação do painel.
4. Os três emails de acesso enviados pela aplicação (`accountEmails`) usam o mesmo tema e já seguem em PT-PT: convite, instruções de redefinição (a partir de Utilizadores, no Backoffice) e aviso de acesso aprovado (quando um administrador atribui o cliente ao utilizador).

Com o domínio de email ativo, a app também pode escrever a pessoas sem conta (ex.: fornecedores nos questionários) até 20 por dia; sem ele, esses envios pelo Base44 falham. Com a Resend esse limite não se aplica.
