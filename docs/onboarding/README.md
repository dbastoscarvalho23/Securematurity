# Onboarding de novos clientes

Material de arranque para clientes que adotam o Regime Jurídico da Cibersegurança (NIS2), a ISO/IEC 27001 e a
ISO/IEC 42001.

| Ficheiro | Conteúdo |
|---|---|
| `AnkoraOne-Manual-Onboarding.docx` | Manual (v1.2, outubro de 2026): preparação, criação da conta, navegação, uso diário (incluindo repositório documental e classificação de documentos), guia por referencial, primeiros 90 dias, glossário |
| `AnkoraOne-Apresentacao-Onboarding.pptx` | Apresentação de 20 diapositivos para a sessão de arranque (35 a 45 minutos) |
| `guias/AnkoraOne-Guia-NIS2.docx` | Guia de implementação do RJC (NIS2): obrigações por área, medidas mínimas, roteiro, jornada completa com a base legal, prazos, lista de verificação |
| `guias/AnkoraOne-Guia-ISO27001.docx` | Guia de implementação da ISO/IEC 27001:2022: estrutura, informação documentada, roteiro, Declaração de Aplicabilidade, análise de lacunas, ligação ao RJC, certificação, anexo com os 93 controlos |
| `guias/AnkoraOne-Guia-ISO42001.docx` | Guia de implementação da ISO/IEC 42001:2023: estrutura, avaliação de impacto, integração com a 27001, roteiro, Anexo C, certificação, anexo com os 38 controlos |

Cores e tipografia seguem o tema da aplicação: azul-escuro `#070A13`, dourado `#CFA04A`, verde-azulado `#26A699`.

## Regenerar

Os ficheiros são gerados por código em `fonte/` (CommonJS; `fonte/package.json` evita o `"type": "module"` do projeto):

```bash
cd docs/onboarding/fonte
npm i docx pptxgenjs react react-dom react-icons sharp   # se ainda não estiverem instalados
node manual.js   # → fonte/AnkoraOne-Manual-Onboarding.docx (copiar para docs/onboarding/)
node deck.js     # → fonte/AnkoraOne-Apresentacao-Onboarding.pptx (copiar para docs/onboarding/)
node guias.js    # → docs/onboarding/guias/*.docx
```

- `estilo.js` tem o estilo comum dos documentos Word (capa, títulos, tabelas, caixas).
- `guias.js` lê os dados da Biblioteca Legal (`src/data/legal/qnrcs.json`, `epr-measures.json`, `iso27001.json`,
  `iso42001.json` e `src/lib/legal/journeyTemplate.js`): tarefas, cláusulas, controlos e contagens ficam iguais aos da
  plataforma. Volte a gerar os guias quando esses dados mudarem.
- `deck.js` aplica as cores ao tema do PowerPoint através de um script opcional (`APPLY_THEME=/caminho/apply_theme.js`).
  Sem ele, o deck é gerado na mesma, mas alguns textos usam as cores de tema por omissão do Office.

## Ao atualizar

- Qualquer alteração de menus, módulos, prazos ou referenciais na aplicação deve ser refletida aqui e na versão (capa).
- Os prazos legais citados vêm dos textos oficiais da Biblioteca Legal (`src/data/legal/`).
- As normas ISO são descritas como guias de preparação: não são reproduzidas (ver `docs/legal/referencias-iso.md`).
