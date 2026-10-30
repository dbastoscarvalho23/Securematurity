# Proposta — Acesso delegado com aprovação e prazo

Estado: **proposta, à espera de decisão** (30/10/2026). Nada disto está implementado.
Origem: modelo de delegações da app «AnkoraOne Plataforma GRC» (Victor Pereira), `base44/shared/delegation.ts` e `accessUtils.ts`, lido sem alterações.

## Problema

Hoje há três papéis: `admin` (administrador da plataforma, vê todos os clientes), `customer_admin` e `user` (um só cliente cada). Um consultor da Neora que acompanhe clientes tem de ser `admin`, e passa a ver **todos** os clientes, sem prazo, sem justificação e sem que o cliente o tenha autorizado.

Para um cliente NIS2 que regista na plataforma as suas lacunas de segurança, a pergunta «quem da Neora vê os meus dados, desde quando e quem autorizou?» precisa de uma resposta verificável.

## Proposta

1. **Atribuição** (`UserCustomerAssignment`): uma pessoa, uma organização, um nível, um prazo e uma justificação.
   - Níveis: `viewer` (lê), `contributor` (lê e escreve conteúdo) e `admin` (também gere os acessos dessa organização).
   - Tipos: `delegation` (consultor ou auditor, até 365 dias) e `external` (só leitura, até 30 dias).
   - Estados: `requested`, `active`, `rejected`, `revoked` e `expired`. Uma atribuição fora do prazo deixa de valer quando é lida, sem esperar por uma tarefa periódica.
2. **Quem decide é a organização.** O administrador do cliente (ou alguém com delegação de nível `admin` nessa organização) concede, revoga e altera. A Neora pede e acompanha, e ninguém decide o próprio acesso. Cada decisão fica na trilha de auditoria encadeada.
3. **Papel novo `consultant`**, sem acesso global. Chega aos clientes só pelas atribuições vivas. O papel `admin` fica para uma ou duas pessoas que operam a plataforma.
4. **Regras de acesso.** O servidor deriva das atribuições vivas três listas no perfil do utilizador: `delegated_view_customer_ids`, `delegated_edit_customer_ids` e `delegated_admin_customer_ids`. Só o servidor as escreve, como já acontece com `role` e `customer_id`. As regras das 45 entidades com `customer_id` ganham uma condição `$in` por lista: leitura com as três, escrita com `edit` e `admin`, eliminação só com `admin`. As regras são geradas por script e conferidas por um teste, para nenhuma entidade ficar esquecida.
5. **Funções.** Um único verificador de acesso por cliente e nível substitui as comparações diretas com `user.customer_id` nas funções.
6. **Interface.** Um seletor de «cliente ativo» para quem tem mais do que um cliente, usado nos cerca de 48 pontos que hoje leem `user.customer_id`. Mais uma página de acessos para o administrador do cliente: pedidos, aprovações, prazos e revogações.
7. **Expiração.** Um workflow diário volta a derivar as listas, como segunda linha de defesa.

## Diferenças em relação à app do Victor

- O modelo de parceiros e carteiras (9 papéis) fica para a revenda (fase 4 do plano executivo).
- As decisões de acesso vão para a trilha encadeada por SHA-256.
- A validação das escritas usa o padrão CASL e Zod do Victor só nas funções novas, para já.

## Testes antes de publicar

- Testes unitários do verificador de acesso: níveis, prazos, estados e «não se decide o próprio acesso».
- Testes ponta a ponta no servidor próprio, que aplica as mesmas regras, incluindo `$in`:
  - o consultor sem atribuição não vê nada;
  - com `viewer`, lê mas não escreve;
  - com prazo terminado, perde o acesso;
  - a revogação tem efeito imediato.
- Teste que confirma que todas as entidades com `customer_id` têm as condições delegadas e nenhuma outra mudou.

## Esforço e riscos

- Cerca de 2 semanas.
- **Risco principal:** um erro nas regras de 45 entidades abre dados entre clientes. Mitigação: regras geradas por script, testes de isolamento no servidor próprio e revisão independente antes de publicar.
- **Transição:** os consultores atuais com papel `admin` passam a `consultant` com atribuições aprovadas pelos clientes. A conversão é feita só depois de as atribuições estarem ativas.

## Decisões pedidas

1. Quem concede o acesso: o administrador do cliente (proposto) ou a administração da plataforma?
2. Os consultores da Neora deixam de ser administradores da plataforma e passam ao papel `consultant`?
3. Os prazos máximos (365 dias para delegação e 30 para acesso externo) servem?
