#!/usr/bin/env node
/**
 * Harness de validação multi-identidade — Securematurity.
 *
 * Corre DENTRO do contentor de desenvolvimento:
 *
 *   docker compose -f docker-compose.base44.yml exec -T web \
 *     node tools/validation-harness/run.mjs [--suite=api|ui|all] [--target=local|cloud]
 *
 * (ou `npm run validate:harness`, que faz o mesmo a partir da raiz do repo).
 *
 * Alvos:
 *   local (por omissão) — backend local do `base44 dev`, com identidade
 *     explícita por invocação (`BASE44_DEV_IDENTITY=1` no alvo local).
 *   cloud — backend real, com a sessão real de cada conta. **Só corre com o
 *     interruptor `--target=cloud`**: escreve num backend que persiste, pelo que
 *     nunca é o comportamento por omissão. Os tokens das contas vivem num
 *     ficheiro fora do git (`BASE44_HARNESS_TOKENS`).
 *
 * Suites:
 *   --suite=api   funções de backend, uma identidade por caso (RBAC, âmbito,
 *                 licenciamento/FB1, estados da delegação)
 *   --suite=ui    a camada de decisão do frontend (Sidebar, RouteGuard,
 *                 capacidades por papel, contrato de tenant)
 *   --suite=all   ambas (por omissão)
 *
 * Termina com código não-zero se algum caso falhar (2 = não foi possível
 * começar, por exemplo tokens em falta no alvo cloud).
 */
const args = process.argv.slice(2);
const suiteArg = args.find((arg) => arg.startsWith("--suite="));
const targetArg = args.find((arg) => arg.startsWith("--target="));
const suite = suiteArg ? suiteArg.split("=")[1] : "all";
const target = targetArg ? targetArg.split("=")[1] : process.env.BASE44_HARNESS_TARGET || "local";

if (target !== "local" && target !== "cloud") {
  console.error(`Alvo desconhecido: ${target} (esperado local ou cloud)`);
  process.exit(2);
}

// Tem de estar definido ANTES de os módulos serem carregados: é este valor que
// escolhe o cliente (sessão do CLI + identidade injectada, ou tokens reais).
process.env.BASE44_HARNESS_TARGET = target;

const { createReport, printReport } = await import("./lib/report.mjs");
const { assertCloudReady } = await import("./lib/client.mjs");

if (target === "cloud") {
  try {
    assertCloudReady();
  } catch (error) {
    console.error(`\n${error.message}\n`);
    process.exit(2);
  }
}

const report = createReport();

if (suite === "api" || suite === "all") {
  const { runApiSuite } = await import("./suites/api.mjs");
  await runApiSuite(report);
}
if (suite === "ui" || suite === "all") {
  const { runUiSuite } = await import("./suites/ui.mjs");
  await runUiSuite(report);
}

const ok = printReport(report.rows, {
  title: `Harness de validação multi-identidade — alvo: ${target} — suíte: ${suite}`,
});
process.exit(ok ? 0 : 1);
