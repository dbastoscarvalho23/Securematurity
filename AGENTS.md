# Securematurity — notas de desenvolvimento

## Stack
- Vite 6 + React 18 + Tailwind, backend é o Base44 SDK (`@base44/sdk` / `@base44/vite-plugin`) — sem backend local.
- Dev server: `npx vite --host 0.0.0.0 --port 5173` dentro do container (compose mapeia 3000->5173).
- `npm install` corre no arranque do container (node_modules num volume Docker, não no host).

## Setup Base44
- `docker compose -f docker-compose.base44.yml up -d` arranca tudo; segredos vêm de `/run/base44/app.env` (`VITE_BASE44_APP_ID`, `VITE_BASE44_APP_BASE_URL`).
- O plugin base44 faz proxy de `/api` para a app Base44 — sem CORS a configurar.

## Verificar
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` → 200.
- Preview autenticada: a sessão vive no iframe; validar fluxos com preview_execute_code.

## Convenções
- UI em PT-PT. Seletor "Todos os clientes" usa a string `'all'` como sentinel (Radix Select não aceita valores nulos).
- Dados de teste: clientes Sabugal, TechNova, Neora Consulting Lda.
- Não configurar SSO Google/Microsoft — o redirect falha no host de preview (dead end conhecido).
