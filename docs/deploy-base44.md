# Publicação no Base44

A plataforma corre na app nativa **AnkoraOne_DC_Repo** (id `6adf8df867faaf60a171efa5`, plano Enterprise), servida em `https://app.ankoraone.com`. Substitui a app importada **Securematurity** (id `6ab5373e7f8f586c80cb9ed8`), onde as funções nunca ficaram ativas em produção. A antiga fica como cópia de segurança até a nova estar confirmada.

## Fluxo de alterações

1. Alteração num ramo deste repositório e pull request revisto; integração no `main`.
2. Sincronização para a app: no terminal da app (sandbox do Base44), `git fetch` deste repositório e `git checkout FETCH_HEAD -- <ficheiros>`; o Base44 grava as alterações e aplica as entidades.
3. Checkpoint com o nome da alteração (permite repor a versão anterior).
4. Publicação: botão **Publish** no editor, `POST /api/apps/{app_id}/deploy`, ou **Actions → Publicar no Base44 → Run workflow** neste repositório. A publicação inclui frontend, funções, entidades e os workflows agendados de `base44/workflows/`.

O workflow `deploy-base44.yml` só publica o que já está na app; não envia código. Requer o segredo `BASE44_API_KEY` (token pessoal com acesso de edição à app).

## Agendamentos

Os agendamentos (alertas CVE, lembretes de revisão e de prazos, relatório mensal, purga de retenção) e as notificações por evento correm nos workflows do próprio Base44 e chamam as funções com o valor de `AUTOMATION_SECRET` nos argumentos. Os workflows do Base44 não leem segredos, por isso o valor fica escrito na definição de cada workflow (editor → Workflows) e não neste repositório: os ficheiros de `base44/workflows/` são só referência. Se rodar o segredo, atualize-o na app, em cada workflow e no GitHub.

A purga de retenção (`Data Retention Purge`) fica pausada até os prazos de conservação estarem revistos. O workflow `scheduler-base44.yml` corre uma função à mão, como recurso; usa o segredo `AUTOMATION_SECRET` do repositório, que tem de ter o mesmo valor do da app.

## Segredos da app

| Segredo | Uso |
|---|---|
| `AUTOMATION_SECRET` | Autoriza as chamadas dos agendamentos |
| `STORAGE_ENCRYPTION_KEY` | Cifra as palavras-passe das ligações de armazenamento (WebDAV/NAS) |
| `LICENSE_SIGNING_KEY` | Chave privada Ed25519 (PKCS8 base64) que assina os certificados de licença; a pública está em `base44/shared/licenseCatalog.ts` |
| `MAIL_PROVIDER`, `MAIL_FROM`, `MAIL_REPLY_TO`, `RESEND_API_KEY` | Envio de email pelo domínio ankoraone.com (ver `docs/email-dominio.md`) |
| `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | IA: `claude` usa o Claude e recorre ao LLM do Base44 se falhar; `base44` usa só o Base44 |
| `NVD_API_KEY` | Opcional: limite mais alto na consulta de CVE |

Os valores não ficam neste repositório.

## Depois de alterar dados de referência

Quando `src/data/legal/` muda, um administrador deve correr **Backoffice → Frameworks → Sincronizar com a Biblioteca Legal**.
