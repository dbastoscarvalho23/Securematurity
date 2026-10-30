# Acesso delegado

Decidido a 30/10/2026: o cliente concede o acesso, os consultores têm o papel `consultant`, e os prazos máximos são 365 dias (delegação) e 30 dias (externo, só leitura). Desenho adaptado da app «AnkoraOne Plataforma GRC» (Victor Pereira).

## Modelo

- **Papel `consultant`**: sem acesso global. Chega aos clientes só por atribuições ativas e dentro do prazo. Pode ter um cliente próprio (por exemplo, a Neora), onde é membro.
- **Atribuição** (`UserCustomerAssignment`): pessoa, cliente, tipo, nível, prazo, justificação e decisão. Só o servidor escreve (função `access`).
  - Tipos: `delegation` (até 365 dias) e `external` (só leitura, até 30 dias).
  - Níveis: `viewer` (lê), `contributor` (lê e escreve conteúdo) e `admin` (também administra o cliente e decide os acessos).
  - Estados: `requested`, `active`, `rejected`, `revoked` e `expired`.
- **Quem decide**: a administração do cliente (o `customer_admin` próprio, ou um consultor com delegação de nível `admin` nesse cliente). A plataforma pede e acompanha, e não decide. Ninguém decide o próprio acesso. Revogar pode o cliente, a plataforma e a própria pessoa.
- **Listas no perfil**: `delegated_view_customer_ids`, `delegated_edit_customer_ids` e `delegated_admin_customer_ids`, derivadas das atribuições ativas. Só o servidor as escreve (regra de campo `service_only`). Voltam a derivar-se a cada decisão, no início de sessão e de hora a hora (workflow «Access Delegation Sync»).

## Onde é aplicado

- **Regras das entidades**: `tools/rls/delegation.mjs` acrescenta, a cada alternativa que dá acesso pelo cliente do próprio utilizador, as alternativas delegadas equivalentes:
  - a regra do administrador do cliente passa a aceitar também o nível `admin`;
  - a leitura por qualquer membro passa a aceitar os três níveis;
  - a escrita por qualquer membro passa a aceitar `contributor` e `admin`.

  As leituras abertas ao papel `user` abrem-se também a `consultant`. O CI confirma que todas as entidades estão atualizadas (`node tools/rls/delegation.mjs --check`).
- **Funções**: `base44/shared/http.ts` dá a cada utilizador um papel efetivo por cliente (`customerRole`: platform, admin, member, viewer) e decide o cliente de cada pedido (`resolveCustomer`).
  - **Aceitam acesso delegado:** evidências, ficheiros, documentos, classificação, IA, ativos, CVE, licença, pesquisa, email, lista de colegas e notificações.
  - **Continuam só do cliente próprio:** gestão de utilizadores e configuração do armazenamento. Um consultor recebe 403.
  - **Revisão de evidências:** além da plataforma, um consultor com nível `admin` no cliente.
- **Interface**:
  - O consultor escolhe o cliente ativo no topo da página. As páginas veem esse cliente em `user.customer_id`, e o papel equivalente ao nível: `admin` passa a `customer_admin`; os outros níveis passam a `user`, com a indicação «Só leitura» no nível `viewer`.
  - As chamadas às funções levam o cliente ativo quando não indicam outro.
  - O servidor decide sempre com a sessão real.
  - **Definições → Acessos:** o cliente aprova, rejeita, revoga e concede; a plataforma pede e revoga; o consultor vê os seus acessos e pode renunciar.

## Testes

- `src/lib/__tests__/delegation.test.js`: papéis efetivos, pedido, decisão, revogação, derivação e gerador de regras.
- `src/lib/__tests__/activeCustomer.test.js`: utilizador efetivo e cliente ativo.
- Servidor próprio (`server/test/api.test.js`), testes ponta a ponta de isolamento:
  - sem atribuição, um consultor não vê nada;
  - um `viewer` lê mas não escreve;
  - um acesso expirado ou revogado deixa de valer;
  - a plataforma não aprova, e ninguém aprova o próprio acesso.

## Transição

Os consultores atuais da Neora com papel `admin` passam a `consultant` depois de os clientes aprovarem as respetivas atribuições.
