/**
 * Carga os módulos de decisão do frontend em Node.
 *
 * `src/lib/rbac.js`, `sidebarGroups.js`, `licenseModules.js` e
 * `tenantResolver.js` são JavaScript puro, mas o Node não resolve imports ESM
 * sem extensão (`from './rbac'`) nem o alias `@/`. O harness copia-os para um
 * directório temporário e acrescenta a extensão aos imports relativos — assim
 * valida exactamente o mesmo código que a Sidebar e o RouteGuard usam, em vez de
 * uma cópia das regras.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MODULES = ["rbac.js", "sidebarGroups.js", "licenseModules.js", "tenantResolver.js"];

export async function loadFrontendLib(sourceDir = "src/lib") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "validation-harness-"));

  for (const file of MODULES) {
    let source = fs.readFileSync(path.join(sourceDir, file), "utf8");
    source = source.replace(/from\s+(['"])(\.{1,2}\/[^'"]+)\1/g, (match, quote, spec) =>
      spec.endsWith(".js") ? match : `from ${quote}${spec}.js${quote}`,
    );
    fs.writeFileSync(path.join(dir, file), source);
  }

  return {
    dir,
    rbac: await import(pathToFileURL(path.join(dir, "rbac.js")).href),
    sidebar: await import(pathToFileURL(path.join(dir, "sidebarGroups.js")).href),
    licenseModules: await import(pathToFileURL(path.join(dir, "licenseModules.js")).href),
    tenant: await import(pathToFileURL(path.join(dir, "tenantResolver.js")).href),
  };
}
