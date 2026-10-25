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
- Secrets (`VITE_BASE44_APP_ID`, `VITE_BASE44_APP_BASE_URL`) are delivered via `/run/base44/app.env`; `./.env.base44-defaults` (committed, empty placeholders) is listed first in `env_file:` so compose boots even on checkouts without the platform file, and real values override it.
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
- `Landing.jsx` was removed (was orphaned); orphan `landing_*` translation keys were cleaned from `translations-ui.js`.
- `OAuthConsent.jsx` is a platform-managed MCP consent page, NOT routed in `App.jsx`; it references `base44/mcp/config.json` (a platform-managed file not exported to GitHub).
- `FrameworkControl` entity is used by the AI agent (framework_guide) but not directly in frontend code.
- All 46 JSONC files validated; no broken `@/` imports across `src/`.

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
