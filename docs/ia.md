# Assistente de IA

## Motor

Escolhido pelo administrador da plataforma em **Definições → Aplicação → Assistente de IA** (entidade `AiSettings`). Sem registo, vale o segredo `AI_PROVIDER`.

| Opção | Comportamento |
|---|---|
| Claude, com recurso ao Base44 | Usa o Claude (`ANTHROPIC_API_KEY`, modelo `ANTHROPIC_MODEL` ou `claude-sonnet-5-5`); se falhar, segue pelo LLM do Base44 |
| Só Claude | Usa o Claude; se falhar, devolve erro |
| Só Base44 | Usa o LLM do Base44 |

Código: `base44/shared/llm.ts`.

## Onde está ativo

O assistente só está ativo onde constrói documentos ou trabalha sobre contexto documental. Cada ponto pode ser ligado ou desligado no mesmo painel.

| Ponto | Por omissão | Função |
|---|---|---|
| Rascunhos de documentos, análise de evidências, notificações de incidentes, relatório anual (`documents`) | Ativo | `aiDraft` |
| Classificação de documentos carregados em «Por classificar» (`document_classification`) | Ativo | `documentIntake` |
| Questionários a fornecedores | Ativo | `aiAssist` |
| Extração de respostas de emails de fornecedores | Ativo | `aiAssist` |
| Recomendações ao concluir uma avaliação e por referencial | Ativo | `aiAssist` |
| Escolha de perguntas para avaliações | Desligado | `aiAssist` |
| Lacunas do banco de perguntas | Desligado | `aiAssist` |
| Traduções de perguntas, recomendações e questionários | Desligado | `aiAssist` |

Os pontos desligados são recusados no servidor (403) e os botões ficam escondidos. Os rascunhos já criados continuam visíveis e podem ser aprovados ou descartados.

Pontos novos só ficam ativos por omissão enquanto não houver lista guardada. Se o painel já tiver sido gravado antes de existir a classificação de documentos, o administrador tem de a ligar em Definições → Aplicação → Assistente de IA.

## Classificação de documentos (`documentIntake`)

Detalhe em `docs/repositorio-documental.md` («Por classificar»).

- Antes da IA, a plataforma escolhe até 20 candidatos por comparação de texto (sem IA): medidas aplicáveis ao cliente, tarefas da jornada RJC_2026, itens ISO/IEC 27001 (se o cliente usa a norma) e os níveis de documento L1 a L4. O modelo só recebe os ids e textos curtos desses candidatos.
- DOCX, XLSX, PPTX, ODT/ODS/ODP e texto seguem como texto extraído no servidor (até 60 000 caracteres); PDF e imagens seguem como ficheiro.
- O servidor retira ligações fora dos candidatos, excertos que não aparecem no texto (os de PDF e imagens ficam «por confirmar»), limita a confiança a 0–1 e guarda no máximo 8 ligações.
- Com o motor «Só Base44», PDF e imagens guardados fora do repositório da plataforma não podem ser classificados (o Base44 só recebe ficheiros por URL); a mensagem indica que é preciso o Claude.
- A proposta nunca muda o estado de medidas, tarefas ou controlos. Ao indexar, uma pessoa escolhe as ligações e a evidência é criada «Por rever».

## Regras

- Só textos oficiais da Biblioteca Legal; citações fora das fontes são retiradas e prazos ou artigos não encontrados geram avisos.
- O resultado é sempre um rascunho, aprovado por uma pessoa antes de passar a documento.
- Nunca seguem para o modelo: contactos pessoais, inventário de ativos, evidências restritas, e qualquer pedido que contenha o IP ou o nome de um ativo exposto à Internet (lista do art. 32.º do Reg. 756/2026) é recusado (`base44/shared/exposedAssets.ts`). Na classificação de documentos, PDF e imagens não têm texto local para verificar antes do envio: só o nome é verificado antes e a resposta do modelo é verificada depois (a proposta é descartada se trouxer um destes endereços).
- Cada pedido fica no registo de auditoria (sem o texto do pedido) e conta para a quota mensal `ai` do cliente.
- O browser nunca chama o modelo diretamente: tudo passa pelas funções do servidor.
