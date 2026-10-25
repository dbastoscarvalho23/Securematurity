# AGENTS.md — Securematurity / AnkoraOne

## App overview
Base44 app (Vite + React 18 frontend) that connects to the Base44 cloud backend.
- GitHub repo: `dbastoscarvalho23/Securematurity`
- Internal app name (in `base44/config.jsonc`): `AnkoraOne`
- Backend URL is provided via `VITE_BASE44_APP_BASE_URL` (proxied by the base44 vite-plugin under `/api`).

## Running the app (sandbox)
```
docker compose -f docker-compose.base44.yml up -d
```
- Node 22 image, repo bind-mounted at `/app`, `npm install && npm run dev` (Vite dev server on port 5173, mapped to host 3000). Edits hot-reload without rebuilds; `node_modules` lives in a named Docker volume, not on the host.
- Secrets (`VITE_BASE44_APP_ID`, `VITE_BASE44_APP_BASE_URL`) are delivered via `/run/base44/app.env`; `./.env.base44-defaults` (committed, empty placeholders) is listed first in `env_file:` so compose boots even on checkouts without the platform file, and real values (listed last) override it.
- Vite `server.host: true` + `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` env var handle the preview proxy hostname; `CHOKIDAR_USEPOLLING=true` makes file watch reliable on bind mounts.
- This is a frontend-only app: all data/auth goes through the Base44 cloud backend (`@base44/sdk` client in `src/api/base44Client.js`).
- Unauthenticated visitors land on `/login`; a 401 "[Base44 SDK Error] Authentication required" console error on that page is expected pre-login behavior.
- Dev verification: `curl -s http://localhost:3000/` should return the index HTML with the Vite dev client; `docker compose -f docker-compose.base44.yml logs web` shows the "Proxy enabled: /api -> ..." line once the SDK env vars are present.
- Preview autenticada: a sessão vive no iframe; validar fluxos com preview_execute_code.

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

## Notes / quirks
- This is a frontend-only Vite + React app; all data/auth goes through the Base44
  cloud backend (`@base44/sdk` client in `src/api/base44Client.js`).
- Unauthenticated visitors land on `/login`; a 401 "[Base44 SDK Error] Authentication
  required" console error on that page is expected pre-login behavior.
- Dev verification: `curl -s http://localhost:3000/` should return the index HTML with
  the Vite dev client; `docker compose -f docker-compose.base44.yml logs web` shows
  the "Proxy enabled: /api -> ..." line once the SDK env vars are present.
- `Landing.jsx` was removed (was orphaned); orphan `landing_*` translation keys were cleaned from `translations-ui.js`.
- `OAuthConsent.jsx` is a platform-managed MCP consent page, NOT routed in `App.jsx`; it references `base44/mcp/config.json` (a platform-managed file not exported to GitHub).
- `FrameworkControl` entity is used by the AI agent (framework_guide) but not directly in frontend code.
- All 46 JSONC files validated; no broken `@/` imports across `src/`.

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
