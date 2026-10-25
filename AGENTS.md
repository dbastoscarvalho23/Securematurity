# AGENTS.md — Securematurity (imported Base44 app)

Non-obvious setup/verification notes. Manifests (package.json, vite.config.js) are the source of truth for dependencies/scripts.

## Stack
- Vite + React 18 SPA. Backend is the **Base44 cloud** — no local DB. Auth is cloud auth (email/password + OTP registration; Google/Microsoft SSO only works on a published URL, not in preview).
- Frontend SDK config comes from env: `VITE_BASE44_APP_ID`, `VITE_BASE44_APP_BASE_URL` (user secrets in `/run/base44/app.env`).

## Run (Base44 sandbox)
- `docker compose -f docker-compose.base44.yml up -d` — node:22 container, source bind-mounted, `npm ci` + `vite` dev server on 0.0.0.0:5173 → host 3000.
- `vite.config.js` gates `server.host/allowedHosts` on `BASE44_PREVIEW_MODE === '1'` + `BASE44_SANDBOX_HOST_DOMAIN` (wildcard, sandbox id rotates). With the flag unset, original behavior (no server overrides).
- Entity schemas live in `base44/entities/*.jsonc`; SDK client in `src/api/base44Client.js`; auth context in `src/lib/AuthContext.jsx`.

## Verify
- Dev server: `curl -s http://localhost:3000/` should return the Vite-served index (source, not a prebuilt bundle).
- Auth flows are cloud OTP/SSO — interactive login must be done by the user in the preview.
- Routes: /login, /register, /dashboard, /customers, /assessments, /assessments/:id, /evidence, /security-documents, /compliance-metrics.
- Test data (created via UI in the Base44 cloud project): 5 customers; TechNova has 2 completed assessments (scores 3.3 / 2.8); draft NIS 2 assessment for Município do Sabugal has **no questions** (0/0) — don't use it for evidence testing.
