# Emails da plataforma — modelos AnkoraOne (PT-PT)

Modelos dos três emails de acesso, com a marca e o tema da plataforma:

| Ficheiro | Email | Assunto |
|---|---|---|
| `public/emails/convite.html` | Convite de acesso | Convite de acesso à plataforma AnkoraOne |
| `public/emails/redefinicao-palavra-passe.html` | Redefinição de palavra-passe | Redefinição de palavra-passe — AnkoraOne |
| `public/emails/acesso-aprovado.html` | Acesso aprovado | Acesso aprovado — AnkoraOne |

Desenho: cabeçalho azul-escuro `#070A13` com «ANKORA» branco e «ONE» dourado `#D0A24C`, botão dourado com texto
escuro e rodapé com o contacto de suporte. O mesmo desenho é usado em todos os emails enviados pela aplicação
(alertas, notificações, lembretes, questionários, formações), a partir de `base44/shared/emailTemplates.ts`.

## Onde se aplicam

1. **Emails enviados pela aplicação** (`accountEmails`, `sendEmail`, notificações): o desenho já vem do código —
   nada a fazer. As funções backend usam `base44/shared/mail.ts`, que aplica a moldura de `emailTemplates.ts`.
2. **Emails de autenticação do Base44** (convite com ligação de ativação, redefinição com token, código de
   verificação): são enviados pela plataforma. Para lhes dar o mesmo aspeto, colar o HTML destes ficheiros em
   Base44 → Dashboard → Emails → «Application emails» (ver `docs/email-dominio.md`). **Manter as variáveis e a
   ligação de ação que o painel apresenta** — os valores `{{…}}` destes ficheiros são marcadores de posição.

Campos variáveis usados nos modelos:

| Modelo | Campos |
|---|---|
| Convite | `email`, `papel`, `cliente`, `convidado_por`, `validade do convite`, `action_url` |
| Redefinição | `email`, `data do pedido`, `validade da ligação`, `action_url` |
| Acesso aprovado | `email`, `papel`, `cliente`, `aprovado por`, `data`, `action_url` |

## Textos

Sem saudações nem exclamações, conforme `docs/style/pt-pt.md`. O rodapé de todos os emails é:
«Email automático da plataforma AnkoraOne. Para questões, contacte daniel.carvalho@ankoraone.com.»

## Pré-visualizar e regerar

Na aplicação, abrir `/emails/convite.html`, `/emails/redefinicao-palavra-passe.html` e `/emails/acesso-aprovado.html`
para ver o resultado.

Os HTML são gerados a partir do módulo usado pelas funções backend, para não haver duas versões do desenho. Numa
linha, dentro do contentor:

```
docker compose -f docker-compose.base44.yml exec -T web sh -c 'npx esbuild base44/shared/emailTemplates.ts --bundle --format=esm --outfile=/tmp/et.mjs && cat > /tmp/render.mjs <<"EOF"
import fs from "node:fs";
import { inviteEmail, passwordResetEmail, accessApprovedEmail } from "/tmp/et.mjs";
const out = "/app/public/emails";
fs.mkdirSync(out, { recursive: true });
const write = (file, html) => fs.writeFileSync(`${out}/${file}`, `${html}\n`);
write("convite.html", inviteEmail({ email: "{{email}}", role: "user", customerName: "{{cliente}}", invitedBy: "{{convidado_por}}", actionUrl: "{{action_url}}" }).html);
write("redefinicao-palavra-passe.html", passwordResetEmail({ email: "{{email}}", actionUrl: "{{action_url}}", requestedAt: "{{data_do_pedido}}" }).html);
write("acesso-aprovado.html", accessApprovedEmail({ email: "{{email}}", role: "user", customerName: "{{cliente}}", approvedBy: "{{aprovado_por}}", approvedAt: "{{data_da_aprovacao}}", actionUrl: "{{action_url}}" }).html);
EOF
node /tmp/render.mjs'
```
