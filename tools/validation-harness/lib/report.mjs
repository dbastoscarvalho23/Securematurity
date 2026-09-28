/**
 * Relatório do harness: cada caso imprime área, identidade, operação e
 * resultado, e o processo termina com código não-zero se algum caso falhar.
 */

export function createReport() {
  const rows = [];
  return {
    rows,
    pass(id, area, detail) {
      rows.push({ id, area, status: "pass", detail });
    },
    fail(id, area, detail) {
      rows.push({ id, area, status: "fail", detail });
    },
    skip(id, area, detail) {
      rows.push({ id, area, status: "skip", detail });
    },
    /**
     * Executa um caso e compara o que aconteceu com o que era esperado.
     * `check` devolve `{ ok, detail }` — ou lança, e o caso conta como falha.
     */
    async case(id, area, description, run) {
      try {
        const result = await run();
        if (result?.skip) {
          rows.push({ id, area, status: "skip", detail: result.detail || description });
        } else if (result?.ok) {
          rows.push({ id, area, status: "pass", detail: result.detail || description });
        } else {
          rows.push({ id, area, status: "fail", detail: `${description} — ${result?.detail || "sem detalhe"}` });
        }
      } catch (error) {
        rows.push({ id, area, status: "fail", detail: `${description} — excepção: ${error.message}` });
      }
    },
  };
}

export function printReport(rows, { title } = {}) {
  const width = Math.max(...rows.map((r) => r.id.length), 4);
  if (title) console.log(`\n${title}`);
  console.log(`${"CASO".padEnd(width)}  ESTADO  ${"ÁREA".padEnd(28)}  DETALHE`);
  console.log("-".repeat(120));
  for (const row of rows) {
    const state = row.status === "pass" ? " ok " : row.status === "skip" ? "n/a " : "FALHA";
    console.log(`${row.id.padEnd(width)}  ${state}   ${row.area.padEnd(28)}  ${row.detail}`);
  }
  const counts = rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
  console.log("-".repeat(120));
  console.log(
    `Total: ${rows.length} · ok: ${counts.pass || 0} · falhas: ${counts.fail || 0} · não verificáveis localmente: ${counts.skip || 0}`,
  );
  return (counts.fail || 0) === 0;
}
