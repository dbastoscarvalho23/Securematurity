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
| Questionários a fornecedores | Ativo | `aiAssist` |
| Extração de respostas de emails de fornecedores | Ativo | `aiAssist` |
| Recomendações ao concluir uma avaliação e por referencial | Ativo | `aiAssist` |
| Escolha de perguntas para avaliações | Desligado | `aiAssist` |
| Lacunas do banco de perguntas | Desligado | `aiAssist` |
| Traduções de perguntas, recomendações e questionários | Desligado | `aiAssist` |

Os pontos desligados são recusados no servidor (403) e os botões ficam escondidos. Os rascunhos já criados continuam visíveis e podem ser aprovados ou descartados.

## Regras

- Só textos oficiais da Biblioteca Legal; citações fora das fontes são retiradas e prazos ou artigos não encontrados geram avisos.
- O resultado é sempre um rascunho, aprovado por uma pessoa antes de passar a documento.
- Nunca seguem para o modelo: contactos pessoais, inventário de ativos, evidências restritas, e qualquer pedido que contenha o IP ou o nome de um ativo exposto à Internet (lista do art. 32.º do Reg. 756/2026) é recusado.
- Cada pedido fica no registo de auditoria (sem o texto do pedido) e conta para a quota mensal `ai` do cliente.
- O browser nunca chama o modelo diretamente: tudo passa pelas funções do servidor.
