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
- `base44/entities/` — 36 entity definitions (JSONC), including Workspace and UserCustomerAssignment.
- `base44/functions/` — 20 backend functions (TypeScript `entry.ts`), including getWorkspaceTree, resolveWorkspaceAccess, migrateExistingWorkspaces, manageAssignment.
- `base44/workflows/` — 8 workflow definitions (JSONC).
- `base44/connectors/` — 2 connectors (googledrive, one_drive).
- `base44/agents/` — 1 AI agent (framework_guide).
- `base44/shared/` — shared utils (automationSecret, escapeHtml, licenseGuard).
- `src/lib/rbac.js` — centralized RBAC: capability-based access control, route→capability mapping, nav group resolver.
- `src/lib/workspace.js` — frontend workspace utilities (tree fetch, access resolution, migration trigger).
- `src/lib/delegation.js` — frontend delegation utilities (UserCustomerAssignment CRUD, resolve user customers).

## Notes / quirks
- `Landing.jsx` was removed (was orphaned); orphan `landing_*` translation keys were cleaned from `translations-ui.js`.
- `OAuthConsent.jsx` is a platform-managed MCP consent page, NOT routed in `App.jsx`; it references `base44/mcp/config.json` (a platform-managed file not exported to GitHub).
- `FrameworkControl` entity is used by the AI agent (framework_guide) but not directly in frontend code.
- All 46 JSONC files validated; no broken `@/` imports across `src/`.
- Phase 2 (Workspace hierarchy): Workspace entity with ancestor-chain tracking; Customer and User entities have `workspace_id`; admin-only `/workspaces` page for tree management; `migrateExistingWorkspaces` creates root workspaces for existing customers idempotently.
- Phase 3 (RBAC overhaul): Centralized `src/lib/rbac.js` with capability-based tiering; RouteGuard and Sidebar both use `canAccess()` and `getNavGroups()` from rbac.js — no more hardcoded route lists.
- Phase 4 (Interface consolidation): New `/organization`, `/configuration`, `/system-status` pages consolidating admin views; all routed and nav-visible via RBAC capabilities.
- Phase 5 (Delegation model): `UserCustomerAssignment` entity with explicit user→customer delegation; `manageAssignment` backend function for CRUD + resolve; `/user-assignments` admin page; `src/lib/delegation.js` frontend utilities.
- Phase 6 (Complete migration — 5 workstreams):
  - **Workstream A (Design System):** HSL CSS variables in `src/index.css` (primitive colors, semantic light/dark tokens, motion/shadow tokens, framework colors); Google Fonts (Work Sans, Inter, Plus Jakarta Sans, JetBrains Mono); scoped `.kb-scope` KB dark theme; component-level overrides (focus-visible, selection, inputs, scrollbars); `tailwind.config.js` with AnkoraOne theme.
  - **Workstream B (RBAC + Licensing):** `src/lib/rbac.js` — 9-role tier system with tenant-only T_* tiers; `can()` does NOT short-circuit master_admin (matrix excludes from compliance); `canAccessRoute()` DOES short-circuit master_admin (route access only). `src/lib/licenseModules.js` — 9 module codes, route-to-module mapping. `src/lib/RoleSimulationContext.jsx` — 9 simulatable roles. `src/lib/sidebarGroups.js` — 3-section grouping with role overrides. `src/components/layout/RouteGuard.jsx` — dual-gating (RBAC + licensing with pre-enforcement).
  - **Workstream C (Dashboard):** `src/pages/Dashboard.jsx` routes by effective role to 5 variants: PlatformAdminDashboard, PartnerDashboard, PlatformTenantDashboard, ExecutiveDashboard, EmployeeDashboard. Platform admin widgets in `src/components/dashboard/platform/`. ContextualHelpDrawer in `src/components/knowledge/`.
  - **Workstream D (Licensing Seeding):** `base44/functions/seedLicenseData/entry.ts` — seeds LicenseTier (4), LicenseModule (9), LicenseEntitlement (~24), LicenseStandard (3), TenantSubscription (1 per customer). Idempotent. Admin-only.
  - **Workstream E (External Access):** `base44/entities/UserCustomerAssignment.jsonc` — full spec fields (assignment_type, access_level, authorized_modules, onboarding_state, is_legacy, expires_at, requested_by, approved_by, reason). `base44/entities/User.jsonc` — expanded role enum (9 roles + legacy aliases) + denormalized arrays (delegated_view/edit_customer_ids, onboarding_customer_ids, breakglass_customer_ids). `base44/shared/accessUtils.ts` — normalizeRole, addToArray, removeFromArray, getDenormalizedField, writeAccessAuditLog. `base44/functions/manageAccess/entry.ts` — delegation + onboarding flows (request/approve/reject/revoke delegation, create/accept/revoke onboarding). `base44/functions/breakGlassAccess/entry.ts` — break-glass start/end (master_admin only, 1-8h TTL, notifies customer admins). `src/pages/ExternalAccess.jsx` — role-specific views with DelegationRequestDialog, OnboardingDialog, BreakGlassDialog. RLS on 12 operational entities updated to use denormalized array checks (no admin short-circuit).
