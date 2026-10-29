# Repositório documental

Cada cliente (tenant) tem um repositório documental onde ficam todos os seus ficheiros: documentos de segurança,
nomeações, evidências, anexos de avaliações e tarefas, relatórios de formação e o relatório de enquadramento.
O repositório escolhe-se ao criar ou editar o cliente e todos os ficheiros seguem a mesma estrutura de pastas.

## Onde se configura

- **Ficha do cliente** (administrador da plataforma, `/customers`): secção «Repositório documental».
- **Definições → Armazenamento** (administrador do cliente): o mesmo componente, só para o próprio cliente.

As duas vias gravam pela função `updateCustomerStorage`, que valida a localização no servidor. A entidade `Customer`
continua a ser escrita diretamente só pelo administrador da plataforma; os campos do repositório nunca são gravados
diretamente pelo browser.

## Repositórios disponíveis

| Repositório | Onde ficam os ficheiros | Ligação |
|---|---|---|
| Repositório privado da plataforma (`base44`) | Armazenamento privado da plataforma | Sempre disponível |
| Google Drive (`google_drive`) | `<localização>/<pasta>` na conta Google da empresa | Uma ligação para toda a plataforma |
| OneDrive (`one_drive`) | `<localização>/<pasta>` na conta Microsoft da empresa | Uma ligação para toda a plataforma |
| NAS/Nextcloud por WebDAV (`webdav`) | `<pasta base>/<localização>/<pasta>` no NAS do cliente | Uma ligação por cliente |

- O administrador da plataforma pode desativar repositórios em Definições → Armazenamento (`StorageSettings`).
- Google Drive e OneDrive: a ficha mostra se a ligação existe e qual a conta ligada. Sem ligação, os ficheiros novos
  ficam no repositório privado da plataforma até a ligação ser autorizada (a ficha avisa).
- NAS/Nextcloud: URL HTTPS, utilizador, palavra-passe e pasta base. A palavra-passe é cifrada (AES-GCM, segredo
  `STORAGE_ENCRYPTION_KEY`) e nunca volta ao browser. Ao criar um cliente, a ligação é gravada e testada logo a seguir
  à criação; se o teste falhar, o cliente fica no repositório anterior e aparece um aviso. Só o administrador da
  plataforma configura e testa a ligação; o administrador do cliente vê o estado. Sem ligação testada com sucesso,
  `updateCustomerStorage` recusa o NAS.
- FTP não é suportado: envia credenciais e ficheiros sem cifra.

## Localização

Campo `Customer.storage_root`: pastas separadas por «/», por exemplo `AnkoraOne/Neora Consulting`.

- Vazio = localização por omissão, `AnkoraOne/<nome do cliente>-<últimos 6 caracteres do id>` (a mesma de sempre).
- Regras (iguais no servidor, `normalizeStorageRoot` em `base44/shared/storage.ts`, e no browser,
  `src/lib/repository.js`): cada pasta passa por `safeName` depois de retirados os acentos; não são aceites pastas
  vazias (`//`), `.` nem `..`; no máximo 6 pastas e 200 caracteres.
- Dois clientes não podem ter a mesma localização (comparação sem maiúsculas/minúsculas), porque o Google Drive e o
  OneDrive são uma só conta para toda a plataforma.
- Um valor inválido gravado diretamente na entidade é ignorado e usa-se a localização por omissão.
- No repositório privado da plataforma não há pastas reais: a localização não se aplica e a pasta fica registada no
  campo `folder` de cada ficheiro.

`Customer.storage_configured_at` regista a última alteração do repositório ou da localização.

## Estrutura de pastas

A mesma para todos os clientes (`REPOSITORY_FOLDERS` em `base44/shared/storage.ts`, com cópia em
`src/lib/repository.js`; o teste `src/lib/__tests__/repository.test.js` confirma que são iguais).

| Pasta | O que lá fica |
|---|---|
| 00 Por classificar | Documentos carregados para classificação, antes de serem indexados como evidência |
| 01 Enquadramento | Relatório de enquadramento (assistente de qualificação RJC) |
| 02 Documentos de segurança | Documentos de segurança, versões de documentos, nomeações |
| 03 Evidências | Evidências ligadas a medidas, controlos, perguntas, jornada, tarefas, vulnerabilidades |
| 04 Avaliações | Anexos de respostas a avaliações |
| 05 Riscos | Anexos de riscos |
| 06 Incidentes | Evidências ligadas a incidentes |
| 07 Fornecedores | Evidências ligadas a fornecedores |
| 08 Ativos (restrito) | Evidências de ativos e componentes (só administradores) |
| 09 Formação | Relatórios de formação por utilizador (restrito) |
| 10 Relatórios | Relatórios gerados (restrito) |
| 11 Rascunhos de IA aprovados | Rascunhos de IA aprovados (exportações futuras; os registos aprovados aparecem aqui na vista) |
| 99 Outros | Anexos de tarefas e comentários, documentos de referenciais, outros |

Ficheiros da função `files` (`StoredFile.context` → pasta, `CONTEXT_FOLDER`): `qualification` → 01;
`security_document`, `document_version`, `nomination` → 02; `assessment` → 04; `risk` → 05; `incident` → 06;
`supplier` → 07; `asset` → 08; `training` → 09; `report` → 10; `ai_draft` → 11; `intake` → 00 (só a função
`documentIntake`; a função `files` não aceita este contexto); `task`, `comment`, `framework`, `other` → 99.

Evidências (função `evidence`, `evidenceFolderKey`): ligadas a ativo ou componente, ou restritas → 08; relatório de
enquadramento (`folder: 'framing'`) → 01; ligadas a incidente → 06; ligadas a fornecedor → 07; restantes → 03.

## Cliente de cada ficheiro

Todos os ficheiros gravados no servidor passam por `putFile` com o cliente **do registo** a que pertencem, nunca o
de quem carrega:

- Função `files` (`resolveFileTenant` em `base44/shared/storedFile.ts`): com `context_id`, o cliente é o do registo
  (documento, nomeação, tarefa, avaliação, utilizador de formação, risco, incidente, fornecedor, ativo, rascunho).
  Um utilizador de outro cliente recebe 403; o administrador da plataforma que indique um cliente diferente do registo
  recebe 409. Sem registo: o administrador usa o cliente que indicar (vazio = armazenamento da plataforma); os
  restantes, o seu.
- Função `evidence`: o cliente do utilizador; o administrador indica o cliente ou este sai dos registos ligados. O
  cliente do próprio administrador nunca é usado por omissão.
- Relatório mensal (`generateMonthlyAnnualReport`): junta dados de todos os clientes, por isso fica no armazenamento
  da plataforma, pasta 10, só para administradores.

## O que acontece ao mudar de repositório ou de localização

- Os ficheiros já guardados ficam onde estão. Cada registo guarda a referência absoluta (id no Google Drive/OneDrive,
  caminho completo no NAS, URI no armazenamento da plataforma) e continua a abrir.
- Só os ficheiros novos vão para o novo repositório ou localização. A ficha avisa antes de gravar.
- Nada é copiado nem movido automaticamente.
- A vista «Repositório documental» mostra quantos ficheiros há em cada repositório, para se ver o que ficou nos
  anteriores.

## Vista «Repositório documental» (`/repository`)

Menu «Governar», depois de Documentos; módulo da licença `documents_evidence`. Disponível para administrador da
plataforma (escolhe o cliente), administrador do cliente e utilizador.

- Junta `StoredFile`, `Evidence` (versões atuais; as substituídas aparecem a pedido), anexos antigos de documentos e
  nomeações e rascunhos de IA aprovados, agrupados pelas 13 pastas. Os documentos de «00 Por classificar» já
  indexados aparecem só como evidência (o mesmo ficheiro), não duas vezes.
- Pesquisa e filtros por pasta, tipo e período. Mostra ficheiro, registo, quem carregou, data, tamanho, repositório e
  localização.
- Cartão do topo: repositório em uso, localização, conta ligada e ficheiros por repositório.
- Área «Por classificar» (administradores), descrita abaixo.

## Por classificar (função `documentIntake`, entidade `DocumentIntake`)

Dado um documento do cliente, a plataforma propõe o que é, avalia-o e indica as medidas, tarefas da jornada ou
controlos a que se liga; uma pessoa confirma. Só o administrador da plataforma e o administrador do cliente.

1. **Carregar** (vários ficheiros de uma vez, até 8 MB cada): o ficheiro é verificado como nas evidências (tipo pelos
   primeiros bytes, SHA-256) e guardado de forma privada em «00 Por classificar» (`StoredFile`, contexto `intake`).
   Um ficheiro com o mesmo SHA-256 já carregado e não rejeitado não é guardado outra vez.
2. **Pré-seleção, sem IA** (`base44/shared/classify.ts`): texto extraído no servidor (`base44/shared/textExtract.ts`:
   texto, CSV, JSON, XML, Markdown, DOCX, XLSX, PPTX, ODT/ODS/ODP; PDF e imagens sem texto local, conta só o nome do
   ficheiro) e comparado com os candidatos do cliente — medidas aplicáveis (nível de conformidade ou grupo do Anexo IV;
   sem qualificação, todos os controlos do QNRCS no nível mínimo), tarefas da jornada RJC_2026 (ligadas aos registos
   `ComplianceChecklist` do cliente por secção e ordem), itens ISO/IEC 27001 (se o cliente tem o referencial
   `ISO27001` ou já começou o guia) e os níveis de documento L1 a L4. Pontuação: minúsculas, sem acentos nem palavras
   vazias, raiz simples das palavras, peso por campo (título 3, verificação/evidência 2, texto 1,5) e pela raridade
   do termo; o código citado no documento (ex.: «PR.FC-1», «A.5.15») soma 3. Ficam os 20 melhores.
3. **Classificar** (ponto de uso `document_classification`, módulo `ai_assistant`, quota `ai`): o modelo recebe só
   os candidatos e o documento e devolve tipo, nível, tipo de evidência, método, título, resumo, datas, aprovador,
   pasta e até 8 ligações com confiança, excerto literal, avaliação (Cumpre / Cumpre em parte / Não cumpre) e o que
   falta. O servidor valida tudo (ver `docs/ia.md`). Com IP/FQDN de um ativo exposto à Internet no texto, nada é
   enviado e o documento fica com erro.
4. **Rever e indexar**: a pessoa marca as ligações, pode acrescentar outras (pesquisa em todos os candidatos do
   cliente), corrige título, tipo, método, validade e pasta e, se quiser, cria um documento de segurança em rascunho
   com o mesmo ficheiro. A evidência é criada «Por rever» com as mesmas validações da função `evidence`, a apontar para
   o mesmo ficheiro (sem novo carregamento). Medidas e tarefas não mudam de estado. Tarefas da jornada só se ligam se o
   registo `ComplianceChecklist` existir. Sem IA (ponto desligado ou sem licença), indexa-se à mão a partir da
   pré-seleção.
5. **Rejeitar**: fica registado o motivo; o ficheiro continua em «00 Por classificar».

### Em lote

- **Classificar todos**: trata, um de cada vez, os documentos ainda sem proposta («Por classificar» ou «Erro»), do mais
  antigo para o mais recente, até 25 por clique. Cada documento conta como um pedido de IA (limite de 30 por minuto e
  por utilizador, quota mensal `ai`). Para no primeiro limite de ritmo, quota esgotada ou licença, e pode ser parado a
  meio; os erros de um documento (sem texto, ativo exposto) não param os restantes. As propostas continuam a precisar
  de revisão uma a uma.
- **Procurar na pasta** (só com Google Drive, OneDrive ou NAS): lê `<localização>/00 Por classificar` e cria um
  registo por cada ficheiro que a plataforma ainda não conhece (sem `StoredFile` com a mesma referência), até 20 por
  pedido. O ficheiro não é copiado nem movido; é verificado (tipo, 8 MB, SHA-256) como num carregamento e fica marcado
  «Encontrado na pasta do repositório». Ficheiros com o mesmo SHA-256 de um documento já carregado contam como
  duplicados e não voltam a ser lidos. Subpastas e documentos nativos do Google (Docs, Sheets, Slides, sem ficheiro
  binário) ficam de fora: exporte-os como DOCX, XLSX ou PPTX.
- **Qualidade das propostas**: para os documentos indexados que tinham proposta, quantas ligações propostas foram
  mantidas, quantas foram acrescentadas à mão, a taxa por faixa de confiança (alta ≥ 0,8; média 0,5 a 0,8; baixa < 0,5),
  por motor e a mediana do tempo até à decisão. Na revisão, ligações com confiança abaixo de 0,5 ou «Não cumpre» vêm
  desmarcadas, por isso a faixa baixa mede quantas as pessoas acabam por marcar. Não lê texto nem ficheiros.

Pasta depois de indexar: no repositório da plataforma muda o campo `folder` do `StoredFile` e da evidência. No Google
Drive, OneDrive e NAS o ficheiro **não é movido**: continua fisicamente em `<localização>/00 Por classificar`
(`storage_location` guarda esse caminho real) e só muda a pasta registada na plataforma.

Auditoria: `document_intake_uploaded`, `document_intake_scanned`, `document_classified` (sem texto do documento),
`document_classification_refused`, `document_indexed`, `document_intake_rejected`, além de `evidence_created` e
`document_created`.

## Segurança

- Nenhum ficheiro tem link público ou partilha. Abrir passa sempre pelas funções `files` (`open`) e `evidence`
  (`download`), que confirmam o cliente e o papel, devolvem um URL temporário (300 s) ou o conteúdo, e registam o
  acesso na auditoria.
- `storage_ref` não é legível por ninguém no browser (regra de campo `read: false`).
- Itens restritos (ativos, formação, relatórios) só são lidos pelo administrador do cliente e pelo administrador da
  plataforma (regras RLS de `StoredFile` e `Evidence`). Os rascunhos de IA só são lidos pelos administradores.
- Anexos antigos (anteriores aos ficheiros privados) ainda guardam o link público original; aparecem como «Ligação
  antiga» e devem ser carregados de novo para passarem a privados.
- O endereço do NAS é verificado antes de cada pedido (HTTPS, nome DNS com IPs públicos, portas 443/5006/8443, sem
  redirecionamentos).
