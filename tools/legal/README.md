# Ferramentas da Biblioteca Legal

Geram `src/data/legal/*.json` a partir dos documentos oficiais listados em `docs/legal/README.md`.

Requisitos: Python 3.11+, `pdfplumber` e `openpyxl` (`pip install pdfplumber openpyxl`).

## Passos

1. Colocar os documentos oficiais numa pasta de trabalho, por exemplo `work/src/`, e definir `export LEGAL_WORKDIR=$PWD/work`.
2. Extrair o texto dos PDFs:
   - `python3 tools/legal/extract/pt/extract.py <pdf> <saida.json>` (texto por página, sem notas de rodapé), ou `extract2.py` para a variante compacta.
3. Dados estruturados (gravam em `$LEGAL_WORKDIR/data/`):
   - QNRCS (Anexo I): `python3 tools/legal/parse_qnrcs.py <texto do Regulamento obtido com pdftotext -layout> $LEGAL_WORKDIR/data/qnrcs.json`
   - Medidas mínimas (Anexos III e IV): `python3 tools/legal/parse_measures.py <0003200120.pdf> $LEGAL_WORKDIR/data/measures.json`
   - CIS (só identificadores): `python3 tools/legal/cis_ids.py <CIS_Controls_Version_8.1.2.xlsx> src/data/legal/cis-ids.json`
   - RJC, Reg. 756/2026 e DORA/RTS: scripts em `tools/legal/extract/pt/` (`build.py`, `oblig_spec.py`, `dorapar.py`, `lib.py`).
   - NIS2 e Reg. Exec. 2024/2690: scripts em `tools/legal/extract/eu/` (`nis2_build.py`, `rx_build.py`, `annex_nis2.py`, `final.py`).
   - ISA 6 / ISA 2027 / ENX / TISAX: extraídos das folhas de cálculo VDA e dos PDFs ENX, mantendo só o permitido pela licença (ver `docs/legal/README.md`).
4. Montar os ficheiros finais: `python3 tools/legal/build_data.py $LEGAL_WORKDIR/data src/data/legal`

Os scripts de `extract/` foram usados uma vez para a versão atual e esperam a estrutura de pastas descrita acima. Reveja sempre o resultado contra o PDF (página indicada em cada elemento, campo `page`) antes de publicar.

## Pacotes do servidor

Depois de mudar `src/data/legal/` ou `src/lib/legal/journeyTemplate.js`, voltar a gerar os dados que as funções usam:

- `python3 tools/legal/build_ai_pack.py` → `base44/shared/legalPack.ts` (textos oficiais citáveis pela IA)
- `node tools/legal/build_classify_catalog.mjs` → `base44/shared/classifyCatalog.ts` (nível mínimo dos controlos,
  guias ISO/IEC 27001 e 42001 e tarefas da jornada, para a classificação de documentos)
- `python3 tools/legal/build_iso27001.py` e `python3 tools/legal/build_iso42001.py` → guias ISO; `python3 tools/legal/build_iso_refs_doc.py` →
  `docs/legal/referencias-iso.md` (registo das fontes, a partir de `src/data/legal/iso-references.json`)

## Depois de publicar

Um administrador deve abrir **Definições → Frameworks** e carregar em **Sincronizar com a Biblioteca Legal**. A sincronização:

- cria ou atualiza os referenciais, controlos e perguntas, identificados por `source_ref`;
- desativa as perguntas que deixaram de existir, sem as apagar;
- marca o referencial ENISA como descontinuado.

Volta a ser seguro executá-la quantas vezes forem precisas: uma segunda execução não altera nada.
