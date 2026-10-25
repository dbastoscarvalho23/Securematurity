# AGENTS.md — Securematurity (Base44 dev environment)

## Environment
- App runs via `docker compose -f docker-compose.base44.yml up -d`. Single `web` service: node:22, repo bind-mounted at `/app`, Vite dev server on `0.0.0.0:5173`, published on host port **3000**.
- Dependencies are installed on container start (`npm ci` in the compose `command`) — no image build step. Change a lockfile → restart the service (`docker compose -f docker-compose.base44.yml up -d web`).
- Vite host/origin allowlist is handled by `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` (platform sets it; Vite >= 6.1 appends to `allowedHosts`). `BASE44_PREVIEW_MODE` is passed through bare.
- Platform secrets arrive in `/run/base44/app.env` (outside the repo, mounted via `env_file:`). Required: `VITE_BASE44_APP_ID`, `VITE_BASE44_APP_BASE_URL` (Base44 cloud backend — this app has NO local database; all data lives in the Base44 backend entities defined in `base44/entities/`).

## App structure
- Vite + React 18 SPA (`src/`), react-router-dom routes in `src/App.jsx`, auth via `src/lib/AuthContext.jsx` (Base44 cloud auth — email/password + OTP email registration; Google/Microsoft SSO redirects only work on a published URL, not in preview).
- Backend = Base44 entities (`base44/entities/*.jsonc`, RLS inside) + functions invoked via `base44.functions.invoke(...)`.
- i18n via `src/lib/LanguageContext` (`t(key)`); audit log via `src/lib/auditLog.js`.

## Verify
- Lint: `docker compose -f docker-compose.base44.yml exec -T web npm run lint`
- Manual: curl `http://localhost:3000/` for real content; exercise flows via the preview browser (login required for anything behind RouteGuard).
- Test records created via UI must be deleted in the same session (data persists in the Base44 backend across branches).
