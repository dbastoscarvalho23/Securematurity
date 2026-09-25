# Base44 Dev Environment

## Running the app

```bash
docker compose -f docker-compose.base44.yml up -d
```

The `web` service runs `npm install && npm run dev` (Vite 6, port 5173 → host port 3000)
from a bind-mount of the repo, so edits hot-reload without rebuilds.

## Required secrets (delivered to /run/base44/app.env, outside the repo)

- `VITE_BASE44_APP_ID` — Base44 app ID
- `VITE_BASE44_APP_BASE_URL` — Base44 cloud backend; the @base44 vite plugin enables an
  `/api` proxy to it in dev. Without these the app boots but cannot reach its backend.

`.env.base44-defaults` holds empty placeholders so the container starts before
credentials exist; `/run/base44/app.env` (listed last in `env_file:`) overrides them.

## Notes

- This is a frontend-only Vite + React app; all data/auth goes through the Base44
  cloud backend (`@base44/sdk` client in `src/api/base44Client.js`).
- Unauthenticated visitors land on `/login`; a 401 "[Base44 SDK Error] Authentication
  required" console error on that page is expected pre-login behavior.
- `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` is passed bare so the sandbox preview host
  is accepted by the dev server (Vite >= 6.1).
- Dev verification: `curl -s http://localhost:3000/` should return the index HTML with
  the Vite dev client; `docker compose -f docker-compose.base44.yml logs web` shows
  the "Proxy enabled: /api -> ..." line once the SDK env vars are present.
