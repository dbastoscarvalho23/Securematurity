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
- `base44/shared/` — shared utils used by all functions: `http.ts` (json/readJson response+parse helpers, auth gates `getAuthenticatedUser`/`isStaffRole`/`isPlatformAdmin`, record-level `canAccessRecord`, automation gate `authorizeAutomationOrAdmin`), `automationSecret.ts` (shared automation secret + `hasAutomationSecret`/`getAutomationSecret`), `audit.ts` (`logAudit`/`logEmailSent`), `reminderSettings.ts` (`getReminderSettings`, `buildRecipients`), `riskLevel.ts` (`riskScore`, `scoreLevel`), `escapeHtml.ts`.
- Backend conventions: all functions import the SDK pinned at `npm:@base44/sdk@0.8.44`; responses use the `json(data, status)` helper; scheduled/system automations pass the shared secret via workflow `args.automation_secret` (also `x-automation-secret` header) — see the 4 "Notify"/reminders/purge workflows.

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
- The automation secret value lives ONLY in the platform's Secrets (`AUTOMATION_SECRET`), read per request via `secrets.get()` in `base44/shared/automationSecret.ts` — never hardcode it in functions or workflows (`${ secrets.AUTOMATION_SECRET }` in workflow args, `x-automation-secret` header for manual triggers). Rotating it is a dashboard-only operation.
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
- `Evidence` só é criada pela função `evidence` (service role): valida o tenant, as ligações (`links`/`link_keys`
  `tipo:id`), MIME e tamanho, calcula SHA-256 e versiona por `supersedes_id`. O browser nunca recebe `storage_ref`;
  downloads por `action: 'download'` (URL assinado de 300 s ou base64) e ficam na auditoria.
- Repositório efetivo por cliente: `resolveProvider()` em `base44/shared/storage.ts` (respeita
  `StorageSettings.enabled_providers`); o frontend pergunta-o com `action: 'provider'`. Nativo = `UploadPrivateFile`;
  Google Drive/OneDrive = conta da plataforma, pasta `AnkoraOne/<cliente>/evidencias`, sem partilhas; `webdav` = NAS do
  cliente (HTTPS obrigatório, IPs públicos, credenciais em `StorageConnection` cifradas com o segredo
  `STORAGE_ENCRYPTION_KEY`). FTP não é suportado de propósito. Os anexos antigos (`uploadFile`) continuam no nativo
  para clientes `webdav`.
- `Asset`/`AssetHistory`/`Component`: só admin e customer_admin do tenant (lista do art. 32.º é «reservado»).
  Importação no browser (`src/lib/assets.js`, SheetJS) com os cabeçalhos do modelo em `public/templates/`; upsert por
  `asset_code`. Catálogo de ferramentas → alíneas NIS2: `src/lib/legal/toolCatalog.js`.
