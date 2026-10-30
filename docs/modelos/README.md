# Modelos e relatórios por referencial

Um pacote por referencial: um documento Word com os modelos (formulários, minutas e relatórios) e um livro Excel com os
registos. Os mesmos ficheiros estão em `public/modelos/` e aparecem na aplicação em **Biblioteca Legal → Modelos**.

| Pasta | Word (modelos) | Excel (registos) |
|---|---|---|
| `rjc-qnrcs/` | M1 registo; M2 responsável de cibersegurança; M3 ponto de contacto permanente; M4 órgãos de gestão; M5 análise de riscos; M6 avaliação de incidente significativo; M7 a M11 notificações (inicial, atualização, fim de impacto, intercalar, final); M12 comunicação aos destinatários; M13 relatório anual | Avaliação QNRCS (153 medidas por nível); ativos acessíveis pela Internet (art. 32.º, reservado); estatística trimestral; incidentes significativos; riscos |
| `nis2/` | N1 incidente significativo (Reg. 2024/2690, arts. 3.º a 14.º); N2 política de segurança dos sistemas de rede e informação; N3 conformidade com o art. 21.º, n.º 2 | 161 requisitos do anexo do Reg. 2024/2690 |
| `dora/` | D1 classificação; D2 notificação inicial; D3 relatório intercalar; D4 relatório final; D5 notificação voluntária de ciberameaça; D6 índice do quadro de gestão do risco TIC (RTS 2024/1774); D7 registo de informação (ITS 2024/2956) | 111 obrigações; 15 modelos do registo de informação |
| `iso27001/` | I1 política; I2 tratamento de riscos; I3 auditoria interna; I4 revisão pela gestão; I5 não conformidades; I6 informação documentada | Declaração de Aplicabilidade (93 controlos, ligação ao QNRCS); riscos; informação documentada |
| `iso42001/` | A1 a A6 como na 27001; A7 avaliação de impacto de sistemas de IA | Declaração de Aplicabilidade (38 controlos); sistemas de IA; Anexo C; riscos; informação documentada |
| `tisax/` | T1 âmbito e objetivos de avaliação; T2 plano de preparação | Autoavaliação VDA ISA 6.0.3 (80 controlos), níveis de maturidade, atribuição e licença |

## Regras do conteúdo

- **Modelos legais (RJC, Reg. 756/2026, NIS2, Reg. 2024/2690, DORA):** cada linha de formulário é uma alínea do
  diploma, lida de `src/data/legal/*.json` e com a redação publicada. Prazos e canais citam o artigo. Nada foi escrito
  de memória.
- **Modelos oficiais da autoridade prevalecem.** O CNCS disponibiliza na plataforma modelos de utilização obrigatória
  para o relatório anual (RJC, art. 30.º, n.º 5; Reg. 756/2026, art. 13.º, n.º 3); o DORA usa os formatos técnicos das
  autoridades de supervisão. Estes ficheiros servem para preparar e validar a informação.
- **ISO/IEC 27001 e 42001:** só numeração e estrutura; títulos e descrições são do guia AnkoraOne. As normas não são
  reproduzidas (ver `../legal/referencias-iso.md`).
- **TISAX:** o catálogo VDA ISA é reproduzido sem alterações e com a atribuição (CC BY-ND 4.0). Nenhum texto dos
  documentos ENX «All rights reserved» é reproduzido; usam-se só factos.
- A lista de ativos do art. 32.º é informação classificada de grau reservado e nunca é enviada à IA.

## Regenerar

Quando a Biblioteca Legal mudar:

```bash
cd docs/modelos/fonte
NODE_PATH=$(npm root -g) node modelos.js   # Word (usa ../../onboarding/fonte/estilo.js)
python3 registos.py                        # Excel
cd ../../.. && cp docs/modelos/*/*.docx docs/modelos/*/*.xlsx public/modelos/
```

Ficheiros novos: acrescentar em `src/lib/legal/templatesCatalog.js` (o teste `templatesCatalog.test.js` confirma que
cada ficheiro do catálogo existe em `public/modelos/`).
