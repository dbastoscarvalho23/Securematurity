#!/bin/sh
# Sandbox dev entrypoint: runs the app against a LOCAL Base44 backend.
#
# `base44 dev` serves this branch's backend functions (Deno) and entities from a
# local in-memory database, and spawns the frontend dev server (vite) with
# VITE_BASE44_APP_BASE_URL pointed at that local backend.
#
# Requires an authenticated CLI session ("base44 login"), kept in the
# base44-cli-auth volume mounted at /root/.base44.
set -e

# Dev-only tooling (Base44 CLI + Deno runtime for the functions) lives outside
# the repo — never add it to package.json.
command -v base44 >/dev/null 2>&1 || npm install -g base44@latest deno

npm install

# Link this clone to its app. base44/.app.jsonc is gitignored, so a fresh clone
# has no pointer; dev refuses --app-id/BASE44_APP_ID and needs this file.
node -e 'const fs=require("fs");const id=(process.env.VITE_BASE44_APP_ID||"").replace(/[^0-9a-f]/gi,"");if(!id){console.error("VITE_BASE44_APP_ID is missing");process.exit(1)}fs.writeFileSync("base44/.app.jsonc",JSON.stringify({id},null,2)+"\n");console.log("Linked local project to app "+id.slice(0,6)+"...")'

exec base44 dev
