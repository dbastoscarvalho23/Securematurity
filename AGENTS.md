# AGENTS.md — Securematurity / AnkoraOne

## App overview
Base44 app (Vite + React 18 frontend) that connects to the Base44 cloud backend.
- GitHub repo: `dbastoscarvalho23/Securematurity`
- Internal app name (in `base44/config.jsonc`): `AnkoraOne`
- Backend URL is provided via `VITE_BASE44_APP_BASE_URL` (proxied by the base44 vite-plugin under `/api`).
- Vite + React 18 SPA (`src/`), react-router-dom routes in `src/App.jsx`, auth via `src/lib/AuthContext.jsx` (Base44 cloud auth — email/password + OTP email registration; Google/Microsoft SSO redirects only work on a published URL, not in preview).
- Backend = Base44 entities (`base44/entities/*.jsonc`, RLS inside) + functions invoked via `base44.functions.invoke(...)`.
- i18n via `src/lib/LanguageContext` (`t(key)`); audit log via `src/lib/auditLog.js`.

## Running the app (sandbox)
```
docker compose -f docker-compose.base44.yml up -d
```
- Single `web` service: Node 22 image, repo bind-mounted at `/app`, `npm ci && npm run dev` (Vite dev server on port 5173, mapped to host 3000). Edits hot-reload without rebuilds; no image build step. `node_modules` lives in a named Docker volume, not on the host; change a lockfile → restart the service (`docker compose -f docker-compose.base44.yml up -d web`).
- Secrets (`VITE_BASE44_APP_ID`, `VITE_BASE44_APP_BASE_URL`) are delivered via `/run/base44/app.env`; `./.env.base44-defaults` (committed, empty placeholders) is listed first in `env_file:` so compose boots even on checkouts without the platform file, and real values (listed last) override it.
- Vite `server.host: true` + `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` env var handle the preview proxy hostname (passed bare; Vite >= 6.1 appends it to allowedHosts). `BASE44_PREVIEW_MODE` is passed through bare (platform-managed sandbox flag); `CHOKIDAR_USEPOLLING=true` makes file watch reliable on bind mounts.
- This is a frontend-only app: all data/auth goes through the Base44 cloud backend (`@base44/sdk` client in `src/api/base44Client.js`). There is NO local database — all data lives in the Base44 backend entities.
- Unauthenticated visitors land on `/login`; a 401 "[Base44 SDK Error] Authentication required" console error on that page is expected pre-login behavior.
- Dev verification: `curl -s http://localhost:3000/` should return the index HTML with the Vite dev client; `docker compose -f docker-compose.base44.yml logs web` shows the "Proxy enabled: /api -> ..." line once the SDK env vars are present.
- Preview autenticada: a sessão vive no iframe; validar fluxos com preview_execute_code.

## Verify
- Tests: `docker compose -f docker-compose.base44.yml exec -T web npm test` (Vitest + jsdom + @testing-library/react; config in `vitest.config.js` — no @base44 vite-plugin, no injected session; tests run offline against mocked backend clients, `src/test/setup.js` polyfills jsdom's matchMedia).
- Auth flow tests: `src/components/__tests__/ProtectedRoute.test.jsx` (unauthenticated → redirect to /login), `src/lib/__tests__/AuthCycle.test.jsx` (AuthProvider + ProtectedRoute with mocked base44 client), `src/components/layout/__tests__/RouteGuard.test.jsx` (role matrix).
- Lint: `docker compose -f docker-compose.base44.yml exec -T web npm run lint`
- Manual: exercise flows via the preview browser (login required for anything behind RouteGuard).
- Test records created via UI must be deleted in the same session (data persists in the Base44 backend across branches).

## Structure
- `src/pages/` — 34 page components; 32 are routed in `App.jsx`.
- `src/components/` — 112 app components + 49 shadcn/ui primitives.
- `base44/entities/` — 34 entity definitions (JSONC).
- `base44/functions/` — 16 backend functions (TypeScript `entry.ts`).
- `base44/workflows/` — 8 workflow definitions (JSONC).
- `base44/connectors/` — 2 connectors (googledrive, one_drive).
- `base44/agents/` — 1 AI agent (framework_guide).
- `base44/shared/` — shared utils used by all functions: `http.ts` (json/readJson response+parse helpers, auth gates `getAuthenticatedUser`/`isStaffRole`/`isPlatformAdmin`, record-level `canAccessRecord`, automation gate `authorizeAutomationOrAdmin`/`isAutomationCaller`), `audit.ts` (`logAudit`/`logEmailSent`), `reminderSettings.ts` (`getReminderSettings`, `buildRecipients`), `riskLevel.ts` (`riskScore`, `scoreLevel`), `escapeHtml.ts`.
- Backend conventions: all functions import the SDK pinned at `npm:@base44/sdk@0.8.44`; responses use the `json(data, status)` helper; scheduled workflows (`base44/workflows/`) call functions with the app owner's session, so the platform-admin check is the automation gate — no shared secret in workflow files.

## Backoffice (`/backoffice`, admin-only)
- Shell: `src/pages/backoffice/BackofficeLayout.jsx` (sub-nav: Visão geral, Clientes, Utilizadores, Auditoria).
- Overview: `src/pages/backoffice/BackofficeOverview.jsx` (moved from `src/pages/Admin.jsx`, which was removed; `/admin` redirects to `/backoffice`).
- User management: `src/components/backoffice/UserManagementPanel.jsx` (extracted from Settings "Users" tab; Settings reuses it). User lists must go through the `listUsers` backend function — direct `User.list()` is denied by RLS (403).
- Frameworks tab extracted into `src/components/backoffice/FrameworksPanel.jsx` (reused by Settings "Frameworks" tab and the `/backoffice/frameworks` route).
- P2 done: `manageUser` backend function consolidates all User entity mutations (`update`/`delete` actions; admin full control, customer_admin restricted to own tenant, profile-only updates and 'user'-only deletes). `adminUpdateUser`/`adminDeleteUser` were removed. Remaining direct mutations (CustomerUsersPanel/CustomerSeatSection unlink + role change, Settings delete) invoke `manageUser`.
- `listUsers` accepts `{ page, pageSize }` returning `{ users, total }` (admin: `list(sort,limit,skip)`; customer_admin: filtered `filter(query, ...)`); unpaged calls stay backward-compatible.
- Backoffice drill-downs (Users, Assessments) fetch server-side pages (`DRILL_DOWN_PAGE_SIZE = 25`); Customers/Risks/Tasks drill-downs still read the dashboard's capped lists. Search applies within the loaded page.
- RouteGuard lists and Sidebar were mirrored for the new paths.

## Notes / quirks
- Unauthenticated visitors land on `/login`; a 401 "[Base44 SDK Error] Authentication required" console error on that page is expected pre-login behavior.
- Workflows run as the app owner (platform admin), confirmed with a temporary probe on 26/10/2026; `authorizeAutomationOrAdmin` and `isAutomationCaller` in `http.ts` only accept a platform admin. The old `AUTOMATION_SECRET` is no longer read by any function.
- `Landing.jsx` was removed (was orphaned); orphan `landing_*` translation keys were cleaned from `translations-ui.js`.
- `OAuthConsent.jsx` is a platform-managed MCP consent page, NOT routed in `App.jsx`; it references `base44/mcp/config.json` (a platform-managed file not exported to GitHub).
- `FrameworkControl` entity is used by the AI agent (framework_guide) but not directly in frontend code.

## Convenções
- UI em PT-PT. Seletor "Todos os clientes" usa a string `'all'` como sentinel (Radix Select não aceita valores nulos).
- Dados de teste: clientes Sabugal, TechNova, Neora Consulting Lda.
- Não configurar SSO Google/Microsoft — o redirect falha no host de preview (dead end conhecido).

## Legal Library (`/legal-library`)
- Official data only, in `src/data/legal/*.json` (DL 125/2025 + RJC, Reg. CNCS 756/2026 with QNRCS and Annexes III/IV,
  NIS2, Reg. Exec. 2024/2690, DORA + RTS/ITS, VDA ISA 6/2027, TISAX facts, CIS identifiers). Sources, hashes and licences:
  `docs/legal/README.md`. Regeneration: `tools/legal/README.md`. Never hand-edit legal texts.
- Access via `src/lib/legal/index.js` (`loadLegal(key)` lazy-loads; `catalog` is eager). Mapping graph:
  `src/lib/frameworkMappings.js`. Framework names/domains: `src/lib/frameworkConstants.js`.
- `src/lib/legal/sync.js` upserts Framework/FrameworkControl/Question by `source_ref` (admin button in Settings →
  Frameworks); questions are deactivated, never deleted. CIS texts are licence-restricted (CC BY-NC-ND): only imported
  from the customer's own xlsx, never committed.
- Compliance journey: framework `RJC_2026` (`src/lib/legal/journeyTemplate.js`); legacy `RJCS` journeys stay read-only
  with a button to create the new one. Minimum-measures checklist: framework `RJC_MEDIDAS_MINIMAS`.
- Incident deadlines (RJC 24 h / 72 h / 24 h after end of impact / 30 working days; DORA RTS 2025/301):
  `incidentDeadlines()` in `src/lib/complianceUtils.js`.
- AI prompts append `LEGAL_AI_CONTEXT` (`src/lib/legal/aiContext.js`).

## Evidências, ativos e ferramentas (`/assets`, `/evidence`)
- `Evidence` só é criada pela função `evidence` (service role): o ficheiro (≤ 8 MB, base64) chega à função, que
  confirma o tipo pelos primeiros bytes, calcula o SHA-256 e o guarda no repositório do cliente — nunca se aceitam
  referências de ficheiros vindas do browser. `storage_ref` não é legível por ninguém (FLS read false). Versões por
  `supersedes_id` (a anterior fica `superseded`). Evidências ligadas a ativos/ferramentas ficam `restricted` (só
  customer_admin e admin). Downloads por `action: 'download'` (URL assinado de 300 s ou base64), sempre auditados.
- Repositório documental (detalhe em `docs/repositorio-documental.md`): repositório efetivo por cliente em
  `resolveProvider()` (`base44/shared/storage.ts`, respeita `StorageSettings.enabled_providers`). Nativo =
  `UploadPrivateFile` no servidor; Google Drive/OneDrive = uma ligação da plataforma (conta da empresa), sem
  partilhas; `webdav` = NAS do cliente (HTTPS, nome DNS com IPs públicos, portas 443/5006/8443, sem
  redirecionamentos; credenciais em `StorageConnection` cifradas com o segredo `STORAGE_ENCRYPTION_KEY`; só o admin
  grava/testa; `updateCustomerStorage` só aceita `webdav` com o NAS testado). FTP não é suportado de propósito.
- Localização: `Customer.storage_root` (vazio = `AnkoraOne/<folderFor(cliente)>`), validada por
  `normalizeStorageRoot` (≤ 6 pastas, ≤ 200 caracteres, sem `.`/`..`/vazias) e única entre clientes; só gravada pela
  função `updateCustomerStorage` (admin: qualquer cliente; customer_admin: o seu), que também grava
  `storage_configured_at`. UI: `src/components/storage/RepositorySettings.jsx` (ficha do cliente e Definições).
- Estrutura única de 13 pastas («00 Por classificar» incluída): `REPOSITORY_FOLDERS`/`CONTEXT_FOLDER`/`evidenceFolderKey` em `storage.ts`, cópia em
  `src/lib/repository.js` (o teste `repository.test.js` compara). `putFile(..., { folder })` grava em
  `<localização>/<pasta>` e devolve `folder` e `location`, guardados em `StoredFile`/`Evidence` (`folder`,
  `storage_location`); no nativo não há pastas reais e é o campo `folder` que agrupa.
- Cliente do ficheiro = cliente do registo, nunca o de quem carrega: `resolveFileTenant()` em
  `base44/shared/storedFile.ts` (função `files`, por `context_id`); na função `evidence` o admin indica o cliente ou
  este sai das ligações (sem fallback para o cliente do admin). Mudar repositório/localização só afeta ficheiros
  novos: as refs guardadas são absolutas.
- Vista consolidada: `/repository` (`src/pages/Repository.jsx`, menu Governar, módulo `documents_evidence`), abre só
  por `openFile`/`openEvidence`.
- `Asset`/`AssetHistory`/`Component`: leitura só admin e customer_admin do tenant (lista do art. 32.º é «reservado»);
  escritas só pela função `assets` (tenant, validação e histórico escritos no servidor).
  Importação no browser (`src/lib/assets.js`, SheetJS) com os cabeçalhos do modelo em `public/templates/`; upsert por
  `asset_code`. Catálogo de ferramentas → alíneas NIS2: `src/lib/legal/toolCatalog.js`.
- Alertas CVE (`CveWatch`/`CveAlert`, função `cveMonitor`, workflow «CVE Monitor» a cada 4 h): por fabricante do
  inventário, com o nome CPE do NVD (API 2.0, `virtualMatchString` + janela `lastMod*` ≤ 120 dias). Alerta quando o CVE
  é recente (ou entrou no KEV da CISA) e a gravidade CVSS (v3.1 → v4.0 → v3.0, entrada Primary) atinge a mínima
  escolhida (`critical` ≥ 9,0; `high` ≥ 7,0). Ao NVD só seguem nomes CPE. Segredo opcional `NVD_API_KEY`
  (50 pedidos/30 s em vez de 5). «Registar vulnerabilidade» cria o `Vulnerability` com prazo de 7/30 dias.

## Licenciamento (`/backoffice/licensing`)
- Modelo igual ao da produção: `LicenseModule`, `LicenseEntitlement`, `LicenseTier` (bundle com rascunho → publicar,
  versão), `LicenseStandard`, `TenantSubscription`, `TenantModule` (origem tier/addon/manual), `TenantStandard`,
  `LicenseChangeLog`, `LicenseUsageRecord`, `LicenseCertificate`. Só o admin escreve (função `licensing`).
- Módulos efetivos: `getEntitlements()` em `base44/shared/license.ts` (bundle ∪ extras ± manuais, só módulos ativos,
  só com subscrição efetiva: trial/active/grace). Sem subscrição = modo «legacy» (tudo ativo). `requireModule()` nas
  funções `evidence` (criar), `assets` e `cveMonitor`; admin passa sempre. No browser: `ROUTE_MODULES` em
  `src/lib/licensing.js` (Sidebar e RouteGuard). Mantenha `subscriptionState()` igual nos dois ficheiros.
- Certificados: JWS EdDSA (Ed25519) com o segredo `LICENSE_SIGNING_KEY` (PKCS8 base64); chave pública e `kid` em
  `base44/shared/licenseCatalog.ts`. Ao rodar a chave, mantenha a pública antiga para verificar certificados antigos.
- Limite conhecido: as regras RLS do Base44 não leem a subscrição, por isso só `evidence`, `assets` e `cveMonitor`
  recusam no servidor; nos restantes módulos (avaliações, risco, incidentes, fornecedores, relatórios) a licença só
  esconde menu e rotas. No servidor próprio (Node.js + PostgreSQL) aplicar `requireModule` em todas as rotas.
- Lugares: com subscrição, `Customer.user_seat_limit` = `seat_limit` da licença (mínimo 5) e o campo fica bloqueado
  na ficha do cliente.

## Assistente de IA (função `aiDraft`, módulo `ai_assistant`)
- Fontes: só textos oficiais em `base44/shared/legalPack.ts`, gerado por `python3 tools/legal/build_ai_pack.py` a partir
  de `src/data/legal/` (voltar a gerar quando a Biblioteca Legal mudar). Pontos do Reg. 2024/2690 são sugeridos por
  semelhança de texto e aparecem marcados como «relacionado por semelhança».
- Estruturas: `base44/shared/aiTemplates.ts`. Os relatórios seguem as alíneas do DL 125/2025 (art. 30.º anual;
  arts. 42.º a 44.º incidentes); secções `fixed` (contacto, estatística trimestral) são preenchidas pelo código.
- Validação: citações fora das fontes são removidas; artigos/prazos não presentes nas fontes e chavões geram avisos.
  O resultado é `AiDraft` (rascunho); nunca é evidência. Evidências `restricted` (ativos/ferramentas) não vão à IA.
- Fornecedor: segredo `AI_PROVIDER` (`base44` por defeito; `anthropic` exige `ANTHROPIC_API_KEY` e `ANTHROPIC_MODEL`).
  Cada pedido consome a quota `ai` (`LicenseUsageRecord`).
- Escolha do fornecedor e chamada ao modelo: `base44/shared/llm.ts` (`callLLM`), usada por `aiDraft` e `aiAssist`.
- Pedidos de IA da interface: só por `aiAssist(purpose, { prompt, schema, customerId })` em `src/lib/ai.js` (função
  `aiAssist`: sessão, módulo `ai_assistant`, quota `ai`, auditoria `ai_assist`, `purpose` numa lista fechada, recusa 422
  se o pedido contiver IP/FQDN de um `Asset` com `internet_exposed`). Nunca usar `InvokeLLM` no browser.

## Classificação de documentos (função `documentIntake`, entidade `DocumentIntake`)
- Repositório → «Por classificar» (`src/components/repository/IntakePanel.jsx`, `IntakeReviewDialog.jsx`): carregar
  para «00 Por classificar» (`StoredFile` contexto `intake`), pré-seleção sem IA, proposta do modelo (ponto de uso
  `document_classification`, ativo por omissão) e indexação confirmada por uma pessoa. Detalhe em
  `docs/repositorio-documental.md`.
- Lógica pura em `base44/shared/classify.ts` (candidatos, pontuação, validação, ligações) e
  `base44/shared/textExtract.ts` (o ZIP chega por `unzip` injetado: fflate na função); ambos testados diretamente em
  `src/lib/__tests__/classify.test.js`. Dados extra da Biblioteca Legal em `base44/shared/classifyCatalog.ts`, gerado por
  `node tools/legal/build_classify_catalog.mjs` (voltar a gerar quando a jornada, o QNRCS ou o guia ISO mudarem).
- Regras partilhadas com outras funções: `buildMeta` em `base44/shared/evidenceMeta.ts` (também usada pela função
  `evidence`) e `containsExposedAsset` em `base44/shared/exposedAssets.ts` (também usada por `aiAssist`).
- Indexar cria `Evidence` «Por rever» com o mesmo ficheiro e nunca altera o estado de medidas ou tarefas.
- Em lote: «Classificar todos» no browser chama `classify` um documento de cada vez (até 25, para no 429/402/403).
  `scan` lê a pasta «00 Por classificar» do Google Drive, OneDrive ou NAS (`listFolder` em `storage.ts`, PROPFIND em
  `webdavXml.ts`) e cria `DocumentIntake` (`source: folder_scan`) para ficheiros que ainda não têm `StoredFile`, até 20
  por pedido. `metrics` devolve `intakeMetrics()` de `classify.ts` (ligações propostas mantidas, acrescentadas à mão,
  taxa por faixa de confiança); `accepted_candidates` guarda os candidatos escolhidos ao indexar.

## Escrita
- Todo o texto visível segue `docs/style/pt-pt.md` (PT-PT, AO90, sem chavões). Chaves novas sem ficheiro próprio:
  `src/lib/translations-extra.js` (prefixo `x_`). Termo oficial: «cadeia de abastecimento».

## Agendamentos
- App nativa AnkoraOne_DC_Repo: os agendados e os de evento correm no próprio Base44 (`base44/workflows/`, 8 ativos;
  «Data Retention Purge» fica inativo e só se corre à mão). Os workflows chamam as funções com a sessão do proprietário
  da app (administrador da plataforma). O antigo agendador por GitHub Actions foi removido.
