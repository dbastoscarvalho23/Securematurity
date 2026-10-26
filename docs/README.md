# Documentação da AnkoraOne

Índice da documentação técnica e de operação. Tudo em português de Portugal (regras em `style/pt-pt.md`).

## Plataforma

| Documento | Conteúdo |
|---|---|
| [arquitetura.md](arquitetura.md) | Componentes, diagrama, fluxos de ficheiros, documentos, IA, licenças e email |
| [../AGENTS.md](../AGENTS.md) | Regras de comportamento da aplicação (evidências, licenças, IA, agendamentos), para quem altera o código |
| [ia.md](ia.md) | Motor de IA, pontos onde o assistente está ativo e regras |
| [repositorio-documental.md](repositorio-documental.md) | Repositório de cada cliente: opções, localização, estrutura de pastas e segurança |
| [../README.md](../README.md) | Instalação, rotas e estrutura do projeto |

## Operação

| Documento | Conteúdo |
|---|---|
| [deploy-base44.md](deploy-base44.md) | App nativa AnkoraOne_DC_Repo, fluxo de alterações, publicação, agendamentos e segredos |
| [dominio-proprio.md](dominio-proprio.md) | `app.ankoraone.com` na Cloudflare e registos de email |
| [email-dominio.md](email-dominio.md) | Envio pela Resend com `@ankoraone.com` e emails da plataforma |
| [../base44/emails/](../base44/emails/) | Modelos em PT-PT dos emails de convite, redefinição, verificação e acesso aprovado (cópia do que está na app) |

## Conteúdo legal e referenciais

| Documento | Conteúdo |
|---|---|
| [legal/README.md](legal/README.md) | Fontes oficiais da Biblioteca Legal, licenças, datas e ISO/IEC 27001 (guia próprio, por validar com a norma) |
| [../tools/legal/README.md](../tools/legal/README.md) | Como regenerar os dados legais |

## Segurança

| Documento | Conteúdo |
|---|---|
| [security/tenant-isolation-tests.md](security/tenant-isolation-tests.md) | Testes de isolamento entre clientes |

## Clientes

| Documento | Conteúdo |
|---|---|
| [onboarding/](onboarding/README.md) | Manual (Word) e apresentação (PowerPoint) de onboarding, com o código que os gera |

## Documentos de trabalho fora do repositório

- «Securematurity — Arquitetura e Auditoria» (Claude Docs): resumo executivo, validações, análise da arquitetura e pendentes.
- «AnkoraOne — Plano de migração para servidor próprio (Node.js + PostgreSQL)» (Claude Docs).

Ao alterar a aplicação, atualize o documento correspondente no mesmo pedido de alteração.
