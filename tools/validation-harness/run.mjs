#!/usr/bin/env node
/**
 * Harness de validação multi-identidade — Securematurity.
 *
 * Corre DENTRO do contentor de desenvolvimento, contra o backend local:
 *
 *   docker compose -f docker-compose.base44.yml exec -T web \
 *     node tools/validation-harness/run.mjs
 *
 * (ou `npm run validate:harness`, que faz o mesmo a partir da raiz do repo).
 *
 * Suites:
 *   --suite=api   funções de backend, uma identidade por caso (RBAC, âmbito,
 *                 licenciamento/FB1, estados da delegação)
 *   --suite=ui    a camada de decisão do frontend (Sidebar, RouteGuard,
 *                 capacidades por papel, contrato de tenant)
 *   --suite=all   ambas (por omissão)
 *
 * Termina com código não-zero se algum caso falhar. A identidade explícita só
 * é honrada porque `BASE44_DEV_IDENTITY=1` está definida no compose local.
 */
import { createReport, printReport } from "./lib/report.mjs";
import { runApiSuite } from "./suites/api.mjs";
import { runUiSuite } from "./suites/ui.mjs";

const suiteArg = process.argv.find((arg) => arg.startsWith("--suite="));
const suite = suiteArg ? suiteArg.split("=")[1] : "all";

const report = createReport();

if (suite === "api" || suite === "all") {
  await runApiSuite(report);
}
if (suite === "ui" || suite === "all") {
  await runUiSuite(report);
}

const ok = printReport(report.rows, {
  title: `Harness de validação multi-identidade — suíte: ${suite}`,
});
process.exit(ok ? 0 : 1);
