# Onboarding de novos clientes

Material de arranque para clientes que adotam o Regime Jurídico da Cibersegurança (NIS2) e a ISO/IEC 27001.

| Ficheiro | Conteúdo |
|---|---|
| `AnkoraOne-Manual-Onboarding.docx` | Manual (v1.1, outubro de 2026): preparação, criação da conta, navegação, uso diário, guia por referencial, primeiros 90 dias, glossário |
| `AnkoraOne-Apresentacao-Onboarding.pptx` | Apresentação de 18 diapositivos para a sessão de arranque (30 a 40 minutos) |

Cores e tipografia seguem o tema da aplicação: azul-escuro `#070A13`, dourado `#CFA04A`, verde-azulado `#26A699`.

## Regenerar

Os ficheiros são gerados por código em `fonte/`:

```bash
cd docs/onboarding/fonte
npm i docx pptxgenjs react react-dom react-icons sharp   # se ainda não estiverem instalados
node manual.js   # → AnkoraOne-Manual-Onboarding.docx
node deck.js     # → AnkoraOne-Apresentacao-Onboarding.pptx
```

`deck.js` aplica as cores ao tema do PowerPoint através de um script opcional (`APPLY_THEME=/caminho/apply_theme.js`). Sem ele, o deck é gerado na mesma, mas alguns textos usam as cores de tema por omissão do Office: confirme o resultado antes de distribuir.

## Ao atualizar

- Qualquer alteração de menus, módulos, prazos ou referenciais na aplicação deve ser refletida aqui e na versão (capa do manual).
- Os prazos legais citados vêm dos textos oficiais da Biblioteca Legal (`src/data/legal/`).
- A ISO/IEC 27001 é descrita como guia de preparação: a norma não está reproduzida (ver `docs/legal/README.md`).
