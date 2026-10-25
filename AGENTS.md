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
- Node 22 slim image, repo bind-mounted at `/app`, `npm install && npm run dev` (Vite dev server on port 5173, mapped to host 3000).
- Secrets (`VITE_BASE44_APP_ID`, `VITE_BASE44_APP_BASE_URL`) are delivered via `/run/base44/app.env`.
- Vite `server.host: true` + `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` env var handle the preview proxy hostname.

## Structure
- `src/pages/` — 34 page components; 32 are routed in `App.jsx`.
- `src/components/` — 112 app components + 49 shadcn/ui primitives.
- `base44/entities/` — 34 entity definitions (JSONC).
- `base44/functions/` — 16 backend functions (TypeScript `entry.ts`).
- `base44/workflows/` — 8 workflow definitions (JSONC).
- `base44/connectors/` — 2 connectors (googledrive, one_drive).
- `base44/agents/` — 1 AI agent (framework_guide).
- `base44/shared/` — shared utils (automationSecret, escapeHtml).

## Self-hosted mode (server/)
- `VITE_BACKEND_MODE=selfhosted` switches `src/api/base44Client.js` to `src/api/selfHostedClient.js`, which mirrors the
  `@base44/sdk` surface the app uses (entities, auth, users, functions, integrations.Core, agents) against `server/`.
  Without the variable the app talks to Base44 exactly as before.
- `server/` is a Node.js ≥ 22.18 + PostgreSQL backend that reads `base44/` at startup: entity schemas + RLS,
  functions (run unmodified via a Deno/SDK shim in `server/src/functions/`), workflows (cron + entity triggers,
  jq conditions), the agent and connectors. Keep `base44/` as the source of truth; both modes use it.
- Function code must stay *erasable* TypeScript (no enums/namespaces/parameter properties) so Node's type stripping
  can run it, and may import only `npm:@base44/sdk`, other `npm:` packages listed in `server/package.json`, and
  relative files.
- Tests: `cd server && TEST_DATABASE_URL=postgres://…/scratch_db npm test` (drops that DB's public schema).
- Deploy: `docker-compose.selfhost.yml` (postgres, minio, api, web/nginx). Docs in README.md (European Portuguese).
- `base44/shared/automationSecret.ts` reads `AUTOMATION_SECRET` from the environment; the literal fallback is public
  and is rejected by the self-hosted server.

## Notes / quirks
- `Landing.jsx` was removed (was orphaned); orphan `landing_*` translation keys were cleaned from `translations-ui.js`.
- `OAuthConsent.jsx` is a platform-managed MCP consent page, NOT routed in `App.jsx`; it references `base44/mcp/config.json` (a platform-managed file not exported to GitHub).
- `FrameworkControl` entity is used by the AI agent (framework_guide) but not directly in frontend code.
- All 46 JSONC files validated; no broken `@/` imports across `src/`.
