// SheetJS 0.20.3 — distribuição oficial (https://cdn.sheetjs.com), guardada em src/vendor/xlsx.
//
// O pacote `xlsx` publicado no npm está descontinuado na 0.18.5 e tem vulnerabilidades conhecidas
// (CVE-2023-30533, poluição de protótipos em ficheiros com fórmulas; CVE-2024-22363, ReDoS),
// corrigidas apenas na distribuição oficial 0.20.2+. Este módulo é o ponto único de importação:
// os componentes importam de `@/lib/xlsx`, para atualizar a biblioteca num só sítio.
export * from '@/vendor/xlsx/xlsx.mjs';