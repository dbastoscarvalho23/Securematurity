/**
 * Contexto legal comum incluído nos prompts de IA (recomendações, geração de perguntas).
 * Apenas referências oficiais — ver a Biblioteca Legal (/legal-library) para os textos integrais.
 */
export const LEGAL_AI_CONTEXT = `Legal context (Portugal) — use ONLY these references and never invent articles, deadlines or requirements:
- Regime Jurídico da Cibersegurança (RJC), approved by Decreto-Lei n.º 125/2025, transposing Directive (EU) 2022/2555 (NIS2).
- Regulamento do CNCS n.º 756/2026: Annex I QNRCS (107 controls, IDs such as ID.GA-1, PR.GI-3, DE.MC-2); Annex III minimum measures per conformity level (básico, substancial, elevado — cumulative); Annex IV measures for relevant public entities (Groups A and B).
- RJC arts. 27.º, n.os 1 e 2, 28.º a 30.º e 33.º take effect on 22-06-2028.
- Incident notification under the RJC: initial notification within 24 h, update within 72 h, end-of-impact notification within 24 h of the end of impact, final report within 30 working days.
- Financial entities: Regulation (EU) 2022/2554 (DORA). Digital providers: Implementing Regulation (EU) 2024/2690.
- ISO/IEC 27001:2022 Annex A themes: A.5 Organizational, A.6 People, A.7 Physical, A.8 Technological controls.
- The ENISA framework code is deprecated: do not produce new content for it.
Write any Portuguese text in European Portuguese (Portugal).`;
