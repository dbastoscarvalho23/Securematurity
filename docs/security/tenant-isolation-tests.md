# Testes de isolamento entre clientes (tenants)

Correr no ambiente de testes (app **Securematurity**) depois de cada alteração às regras de acesso, e sempre antes de levar alterações à produção. Os testes usam a consola do browser, com sessão iniciada na app, através do SDK já carregado (`base44`).

## Preparação

1. Criar dois clientes de teste: **Cliente A** e **Cliente B**. Anotar os respetivos ids.
2. Convidar:
   - `a-admin@…` como customer_admin do A;
   - `a-user@…` como user do A;
   - `b-user@…` como user do B.
3. Iniciar sessão uma vez com cada conta, para os convites serem ativados.
4. Com `b-user`, criar um risco, uma tarefa e um incidente no Cliente B.

## Testes (resultado esperado entre parênteses)

| # | Com a conta | Ação na consola | Esperado |
|---|---|---|---|
| T1 | a-user | `await base44.auth.updateMe({ customer_id: '<id do B>' })` e depois `(await base44.auth.me()).customer_id` | Recusado ou ignorado: o `customer_id` continua o do A. |
| T2 | a-user | `await base44.auth.updateMe({ role: 'admin' })` e depois `(await base44.auth.me()).role` | Recusado ou ignorado: o papel continua `user`. |
| T2b | a-user | `await base44.auth.updateMe({ customer_name: 'B' })` | Recusado ou ignorado. |
| T2c | a-user | `await base44.auth.updateMe({ display_name: 'Teste', language: 'pt' })` | Aceite (não pode haver regressão). |
| T3 | a-user | `await base44.entities.User.update('<id próprio>', { customer_id: '<id do B>' })` | Recusado ou ignorado. |
| T4 | a-user | `await base44.entities.RiskItem.filter({ customer_id: '<id do B>' })` | Lista vazia. |
| T5 | a-admin | `await base44.entities.InvitedUser.filter({})` | Só convites do Cliente A. |
| T6 | a-admin | `await base44.entities.InvitedUser.update('<convite do A>', { customer_id: '<id do B>' })` | Recusado: só o admin da plataforma altera convites. |
| T6b | admin da plataforma + a-admin | O admin cria um convite no A; o a-admin tenta passá-lo para o B (T6); o convidado faz o primeiro login | O convite não é movido. Se alguma vez for, o login regista `invite_rejected` ou junta o utilizador ao A, nunca ao B. |
| T6c | admin da plataforma | Convidar um novo administrador em Backoffice → Utilizadores | Convite enviado sem erro. |
| T7 | a-user | `await base44.entities.Notification.create({ user_email: 'b-user@…', title: 'x', message: 'x' })` | Recusado. |
| T7b | a-user | `await base44.entities.Notification.update('<notificação própria>', { user_email: 'b-user@…', title: 'x' })` | Recusado ou ignorado; marcar como lida (`is_read: true`) continua a funcionar. |
| T8 | a-user | `await base44.entities.RiskItem.update('<risco do A>', { customer_id: '<id do B>' })` | Deve ser recusado. Se for aceite, abrir correção (item R05 do roadmap). |
| T9 | customer_admin sem cliente (o admin retira-lhe o cliente) | `await base44.functions.invoke('listUsers', {})` e `await base44.functions.invoke('manageUser', { action: 'delete', userId: '<utilizador sem cliente>' })` | 403 em ambos. |

## Resultado

Registar a data, quem testou e o resultado de cada teste no roadmap do relatório «Securematurity — Arquitetura e Auditoria».
