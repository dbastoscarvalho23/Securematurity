#!/bin/sh
# Sandbox dev entrypoint — um alvo de cada vez, sempre no porto 3000.
#
# BASE44_PREVIEW_TARGET decide o que arranca (nunca os dois ao mesmo tempo):
#
#   local (por omissão) — `base44 dev`: as funções desta branch correm em Deno e
#     as entidades numa base local em memória, e o vite serve /api para esse
#     backend local. É o alvo de desenvolvimento normal.
#
#   cloud — só o vite, com /api proxied ao backend REAL indicado por
#     VITE_BASE44_APP_BASE_URL (vem de /run/base44/app.env; o proxy é do
#     `@base44/vite-plugin`). Sessões reais, RLS avaliada a sério e dados que
#     persistem.
#
# Consequência do alvo nuvem: não há backend local, pelo que a identidade de
# teste (`BASE44_DEV_IDENTITY` + `x-base44-dev-actor`) e a isenção de limitação
# de ritmo simplesmente não existem lá — a identidade é a sessão real de cada
# conta e os limites são os de produção.
set -e

TARGET="${BASE44_PREVIEW_TARGET:-local}"

# Lido pelo frontend (indicador discreto do alvo). VITE_* é a única forma de
# expor um valor ao browser; nunca é um valor de host resolvido, só o nome do
# alvo, que é o mesmo em qualquer ambiente.
export VITE_BASE44_PREVIEW_TARGET="$TARGET"

npm install

if [ "$TARGET" = "cloud" ]; then
  if [ -z "$VITE_BASE44_APP_BASE_URL" ]; then
    echo "BASE44_PREVIEW_TARGET=cloud exige VITE_BASE44_APP_BASE_URL (o backend real) em /run/base44/app.env." >&2
    exit 1
  fi
  echo "Alvo cloud: apenas o frontend, com /api proxied ao backend real."
  exec npm run dev -- --host 0.0.0.0
fi

# ─── Alvo local ────────────────────────────────────────────────────────────
# Ferramentas só de desenvolvimento (CLI Base44 + Deno para as funções) vivem
# fora do repositório — nunca acrescentar a package.json.
command -v base44 >/dev/null 2>&1 || npm install -g base44@latest deno

# Link this clone to its app. base44/.app.jsonc is gitignored, so a fresh clone
# has no pointer; dev refuses --app-id/BASE44_APP_ID and needs this file.
node -e 'const fs=require("fs");const id=(process.env.VITE_BASE44_APP_ID||"").replace(/[^0-9a-f]/gi,"");if(!id){console.error("VITE_BASE44_APP_ID is missing");process.exit(1)}fs.writeFileSync("base44/.app.jsonc",JSON.stringify({id},null,2)+"\n");console.log("Linked local project to app "+id.slice(0,6)+"...")'

# Identidade explícita do invocador (harness multi-identidade) e a sua isenção de
# limitação de ritmo. Exclusivas deste alvo: o `devActor.ts` e o `rateLimit.ts`
# só honram o cabeçalho quando esta variável vale exactamente "1". O backend
# local é lançado daqui, pelo que herda a variável — e um ambiente implantado
# nunca a vê.
export BASE44_DEV_IDENTITY=1

exec base44 dev
