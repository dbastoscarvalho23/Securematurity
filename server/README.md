# Servidor próprio AnkoraOne

Backend Node.js + PostgreSQL que substitui a plataforma Base44. A documentação completa (instalação, migração de dados, configuração e segurança) está no [README principal](../README.md).

## Estrutura

```
src/
  index.js              arranque: migrações, carregamento de base44/, rotas, agendador
  config.js             variáveis de ambiente
  db.js                 PostgreSQL e migrações
  http.js               router HTTP mínimo (node:http)
  entities/             CRUD genérico, filtros → SQL, regras RLS
  auth/                 login, registo com código, recuperação, convites, OAuth
  integrations/         email (SMTP), LLM (Anthropic/OpenAI), ficheiros (local/S3)
  functions/            execução de base44/functions/*/entry.ts (emulação Deno + SDK)
  workflows/            cron, condições jq e motor de workflows
  agents.js             agente de IA com ferramentas sobre entidades
  connectors.js         Google Drive / OneDrive
  routes.js             rotas /api compatíveis com src/api/selfHostedClient.js
scripts/                migrate, create-admin, import-from-base44
test/                   unit.test.js e api.test.js (ponta a ponta)
```

## Dependências

Só três: `pg`, `nodemailer` e `jspdf` (usado por uma função de relatório). HTTP, JWT, scrypt, assinatura S3 (SigV4), cron e multipart usam módulos nativos do Node.js ≥ 22.18. As funções TypeScript correm com o *type stripping* nativo do Node.

## Comandos

```bash
npm start                    # arrancar
npm run dev                  # arrancar com recarregamento automático
npm run migrate              # aplicar migrações
npm run create-admin -- <email> <palavra-passe> [nome]
npm run import:base44 -- --from dump.json --rehost-files   # ver README principal, secção 3
npm test                     # TEST_DATABASE_URL=… para incluir os testes ponta a ponta
```
