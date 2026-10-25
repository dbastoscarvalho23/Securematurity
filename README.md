# AnkoraOne — Plataforma de Maturidade de Segurança

Plataforma de GRC (governação, risco e conformidade) para avaliação de maturidade em cibersegurança (NIS2, ISO 27001, DL 125/2025 e outros referenciais), gestão de riscos, documentos, fornecedores, incidentes, formação e RGPD.

A aplicação pode funcionar de duas formas, escolhidas por uma única variável (`VITE_BACKEND_MODE`):

| Modo | Backend | Quando usar |
|---|---|---|
| **Base44** (por omissão) | Plataforma Base44 (cloud) | Desenvolvimento no Base44 Builder, ambiente atual |
| **Servidor próprio** (`selfhosted`) | Pasta [`server/`](server/) — Node.js + PostgreSQL | Alojamento em infraestrutura própria, sem dependência da Base44 |

O frontend é o mesmo nos dois modos. No modo servidor próprio, o SDK da Base44 é substituído por um cliente com a mesma interface ([`src/api/selfHostedClient.js`](src/api/selfHostedClient.js)). Por isso as páginas e componentes não precisam de alterações.

---

## Índice

1. [Arquitetura](#1-arquitetura)
2. [Instalação em servidor próprio (Docker)](#2-instalação-em-servidor-próprio-docker)
3. [Migração dos dados da Base44](#3-migração-dos-dados-da-base44)
4. [Configuração](#4-configuração)
5. [Desenvolvimento local](#5-desenvolvimento-local)
6. [Equivalência de funcionalidades](#6-equivalência-de-funcionalidades)
7. [Segurança](#7-segurança)
8. [Operação: cópias de segurança e atualizações](#8-operação-cópias-de-segurança-e-atualizações)
9. [Limitações conhecidas](#9-limitações-conhecidas)
10. [Modo Base44 (como até aqui)](#10-modo-base44-como-até-aqui)

---

## 1. Arquitetura

```
                 ┌───────────────────────── docker-compose.selfhost.yml ─────────────────────────┐
  Navegador ──►  │  web (Nginx)  ──/api──►  api (Node.js 22)  ──►  postgres (PostgreSQL 16)       │
   HTTPS via     │   frontend React          ├─ entidades + RLS        └─ dados, utilizadores,     │
   proxy externo │   compilado (Vite)        ├─ autenticação (JWT)        conversas, execuções     │
                 │                           ├─ 16 funções base44/     ──►  minio (S3)             │
                 │                           ├─ 8 workflows (cron)          └─ ficheiros            │
                 │                           ├─ agente de IA          ──►  SMTP · Anthropic/OpenAI │
                 │                           └─ tempo real (SSE)      ──►  Google/Microsoft OAuth  │
                 └───────────────────────────────────────────────────────────────────────────────┘
```

O backend lê diretamente as definições da pasta [`base44/`](base44/). A Base44 continua a ser a fonte de verdade da lógica de negócio:

| Pasta | Conteúdo | Como é usada no servidor próprio |
|---|---|---|
| `base44/entities/*.jsonc` | 34 entidades (esquema + regras RLS) | Validação, valores por omissão e controlo de acesso por registo |
| `base44/functions/*/entry.ts` | 16 funções de backend | Executadas **sem alterações** em Node.js (emulação de `Deno.serve` e do SDK) |
| `base44/workflows/*.jsonc` | 8 automatismos | Agendamentos cron e gatilhos por alteração de entidades |
| `base44/agents/*.jsonc` | Agente `framework_guide` | Conversas com ferramentas sobre entidades, com as permissões do utilizador |
| `base44/connectors/*.jsonc` | Google Drive, OneDrive | Ligação OAuth feita uma vez pelo administrador |

Qualquer alteração feita no Base44 Builder a estes ficheiros passa a valer também no servidor próprio, após reconstruir a imagem.

---

## 2. Instalação em servidor próprio (Docker)

**Requisitos:** servidor Linux com Docker e Docker Compose v2, 2 vCPU, 4 GB RAM e um domínio com HTTPS.

```bash
git clone https://github.com/dbastoscarvalho23/Securematurity.git ankoraone
cd ankoraone

cp .env.selfhost.example .env.selfhost
nano .env.selfhost        # preencher PUBLIC_URL, segredos, SMTP, chave de IA…

docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost up -d --build
docker compose -f docker-compose.selfhost.yml logs -f api   # acompanhar o arranque
```

No primeiro arranque, o servidor cria as tabelas e o administrador indicado em `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD`. A aplicação fica em `http://<servidor>:8080`.

### HTTPS

Coloque um proxy com certificado à frente da porta `WEB_PORT`. Exemplo com [Caddy](https://caddyserver.com) (certificado Let's Encrypt automático):

```caddyfile
grc.exemplo.pt {
    reverse_proxy 127.0.0.1:8080 {
        flush_interval -1   # necessário para o tempo real (SSE)
    }
}
```

`PUBLIC_URL` tem de coincidir com o endereço HTTPS final, porque é usado nos emails, no OAuth e nos URLs dos ficheiros.

### Criar ou repor um administrador

```bash
docker compose -f docker-compose.selfhost.yml exec api npm run create-admin -- admin@exemplo.pt 'Palavra-Passe-Forte' "Nome Apelido"
```

---

## 3. Migração dos dados da Base44

O script [`server/scripts/import-from-base44.js`](server/scripts/import-from-base44.js) exporta todos os registos através da API da Base44 e importa-os mantendo os **ids, datas e autores originais**, o que preserva as referências entre registos. A importação é idempotente e pode repetir-se.

1. Na Base44, obtenha o **App ID** e uma **chave de API** da aplicação.
2. Exporte para um ficheiro, que serve também de cópia de segurança:
   ```bash
   docker compose -f docker-compose.selfhost.yml exec \
     -e BASE44_APP_ID=xxxxxxxx -e BASE44_API_KEY=xxxxxxxx api \
     node scripts/import-from-base44.js --export-only --out /data/base44-dump.json
   ```
3. Importe, copiando os ficheiros alojados na Base44 para o armazenamento próprio:
   ```bash
   docker compose -f docker-compose.selfhost.yml exec api \
     node scripts/import-from-base44.js --from /data/base44-dump.json --rehost-files
   ```

Para guardar a exportação fora do contentor: `docker compose -f docker-compose.selfhost.yml cp api:/data/base44-dump.json .`

Opções: `--entities Task,RiskItem` limita a importação a algumas entidades, e `--out` guarda a exportação. Use sempre `--rehost-files` ao reimportar; caso contrário, os URLs voltam a apontar para a Base44.

**Palavras-passe:** a Base44 não as exporta. Os utilizadores importados entram com Google ou Microsoft (se configurado), ou definem uma palavra-passe nova em **"Esqueci-me da palavra-passe"** ou em **"Registar"** com o mesmo email. O email é verificado por código antes de a conta ficar ativa.

---

## 4. Configuração

Todas as variáveis estão documentadas em [`.env.selfhost.example`](.env.selfhost.example). As principais:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PUBLIC_URL` | sim | Endereço público da aplicação (`https://…`) |
| `JWT_SECRET`, `AUTOMATION_SECRET` | sim | Segredos aleatórios (`openssl rand -hex 32`); o servidor recusa arrancar sem eles em produção |
| `POSTGRES_PASSWORD`, `S3_*` | sim | Credenciais da base de dados e do MinIO |
| `SMTP_*`, `MAIL_FROM` | recomendada | Envio de notificações, códigos de verificação e convites. Sem SMTP, os emails não são enviados |
| `LLM_PROVIDER` + chave | recomendada | `anthropic` ou `openai` (inclui Azure OpenAI, Ollama e vLLM via `OPENAI_BASE_URL`). Sem IA, as funcionalidades de IA devolvem um aviso |
| `ALLOW_PUBLIC_SIGNUP` | não | `false` (recomendado) limita o registo a convidados |
| `GOOGLE_*`, `MICROSOFT_*` | não | Login com Google/Microsoft e conectores Google Drive/OneDrive |

**Conectores Google Drive / OneDrive:** depois de configurar as credenciais OAuth, um administrador abre **Definições → Armazenamento** e clica em **Ligar conta**. Os tokens ficam guardados e são renovados automaticamente.

---

## 5. Desenvolvimento local

Requisitos: Node.js ≥ 22.18 e PostgreSQL 16 (local ou `docker run -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16`).

```bash
# Backend
cd server
npm install
DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres \
BOOTSTRAP_ADMIN_EMAIL=admin@local.test BOOTSTRAP_ADMIN_PASSWORD=admin12345 \
npm run dev                      # API em http://localhost:3001

# Frontend (noutro terminal, na raiz)
npm install
VITE_BACKEND_MODE=selfhosted npm run dev     # http://localhost:5173, /api encaminhado para :3001
```

Sem SMTP configurado, os códigos de verificação e as ligações de recuperação aparecem no registo do servidor (só fora de produção). Sem `STORAGE_DRIVER=s3`, os ficheiros ficam em `server/data/uploads`.

### Testes

```bash
cd server
npm test                                                        # testes unitários
TEST_DATABASE_URL=postgres://…/ankoraone_test npm test          # + testes ponta a ponta (APAGA essa base de dados)
```

Os testes ponta a ponta arrancam o servidor real e cobrem: registo com código, isolamento entre clientes (RLS), filtros e operações em lote, ficheiros, funções, workflows, tempo real, recuperação de palavra-passe, convites, agente de IA e `InvokeLLM`. Os fornecedores de IA são simulados.

---

## 6. Equivalência de funcionalidades

| SDK Base44 usado pela aplicação | Servidor próprio |
|---|---|
| `entities.X.list / filter / get / create / bulkCreate / update / bulkUpdate / delete / deleteMany` | `GET/POST/PUT/DELETE /api/entities/X…` com os operadores `$in $nin $gt $gte $lt $lte $ne $or $and $exists $regex` |
| `entities.X.subscribe` | Server-Sent Events em `/api/realtime`, filtrados pela RLS |
| Regras RLS das entidades | Aplicadas em SQL (leituras) e verificadas em escritas, incluindo impedir mover registos entre clientes |
| `auth.*` (email/palavra-passe, código, recuperação, Google, Microsoft) | `/api/auth/*`, JWT HS256, palavras-passe com scrypt |
| `users.inviteUser` | `/api/users/invite` (envia email de convite) |
| `functions.invoke` | `/api/functions/<nome>`, que executa `base44/functions/<nome>/entry.ts` |
| `integrations.Core.InvokeLLM` | Anthropic ou API compatível com OpenAI, com `response_json_schema` e `file_urls` |
| `integrations.Core.SendEmail` | SMTP |
| `integrations.Core.UploadFile` | MinIO/S3 ou disco local; URL público impossível de adivinhar, como na Base44 |
| `asServiceRole.connectors.getConnection` | OAuth com renovação automática de tokens |
| `agents.*` (framework_guide) | Conversas persistidas e ferramentas sobre entidades com as permissões do utilizador |
| Workflows agendados e por entidade | Motor próprio (cron com fuso horário, condições jq); histórico em `/api/workflows/runs` |

---

## 7. Segurança

- **Isolamento entre clientes:** as regras RLS de `base44/entities` são aplicadas em todas as leituras (incluindo tempo real e `deleteMany`) e escritas. Um utilizador não consegue criar, ler, alterar nem mover registos de outro cliente. Isto está coberto pelos testes.
- **Perfil do utilizador:** um utilizador comum não pode alterar o próprio `role` nem `customer_id` (via `updateMe` ou `User.update`). Só um administrador o pode fazer, e a alteração de papel termina as sessões abertas.
- **Carimbo de cliente:** quando um utilizador cria um registo sem `customer_id` numa entidade que o tenha, o servidor preenche-o com o cliente do utilizador (`AUTO_STAMP_CUSTOMER_ID`).
- **Segredo de automação:** o valor que estava fixo no repositório (`base44/shared/automationSecret.ts`) **não é aceite** pelo servidor próprio, que usa `AUTOMATION_SECRET`. Esse valor é público no GitHub; trate-o como comprometido.
- **Proteções adicionais:** limite de tentativas em login, códigos e emails; códigos de verificação de uso único com expiração; tokens de recuperação guardados apenas como hash; OAuth com PKCE e validação do destino de retorno; bloqueio de URLs internos em `file_urls` (SSRF); cabeçalhos de segurança no Nginx e na API.
- **Ficheiros:** tal como na Base44, os URLs de ficheiros são públicos, mas contêm 128 bits aleatórios. Não partilhe os links de documentos sensíveis.

---

## 8. Operação: cópias de segurança e atualizações

```bash
# Cópia da base de dados
docker compose -f docker-compose.selfhost.yml exec postgres pg_dump -U ankoraone ankoraone | gzip > backup-$(date +%F).sql.gz
# Cópia dos ficheiros (volume do MinIO)
docker run --rm -v ankoraone_minio-data:/data -v "$PWD":/backup alpine tar czf /backup/ficheiros-$(date +%F).tgz -C /data .

# Atualizar para a versão mais recente do repositório
git pull
docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost up -d --build
```

As migrações da base de dados são aplicadas automaticamente no arranque.

---

## 9. Limitações conhecidas

- `InvokeLLM` com `add_context_from_internet` não pesquisa na web; o parâmetro é ignorado.
- As funções de backend correm no mesmo processo da API. O tempo limite (`FUNCTION_TIMEOUT_MS`) devolve erro, mas não interrompe uma função bloqueada.
- A página `OAuthConsent` (consentimento MCP gerido pela Base44) não se aplica ao servidor próprio.
- O editor visual e as estatísticas do Base44 Builder só funcionam no modo Base44.
- Os eventos de tempo real e os gatilhos de workflows são processados na instância que fez a alteração. Com várias instâncias da API, use `ENABLE_SCHEDULER=true` apenas numa.

---

## 10. Modo Base44 (como até aqui)

Sem `VITE_BACKEND_MODE`, a aplicação continua a usar a Base44:

1. `npm install`
2. Criar `.env.local` com:
   ```
   VITE_BASE44_APP_ID=your_app_id
   VITE_BASE44_APP_BASE_URL=your_backend_url
   ```
3. `npm run dev`

Qualquer alteração enviada para o repositório é refletida no Base44 Builder. Para publicar, abra [Base44.com](https://base44.com) e clique em **Publish**. Documentação: [docs.base44.com](https://docs.base44.com/Integrations/Using-GitHub).
