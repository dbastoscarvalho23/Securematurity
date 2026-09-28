# Matriz de migração — Securematurity (Core NIS2)

Documento de trabalho da migração funcional AnkoraOne → Securematurity.
Fase 1 do pedido: **inventário e matriz de diferenças**, com versões de referência.
As fases seguintes são registadas na secção 6 à medida que avançam.

---

## 1. Fontes e limitações de acesso

| Fonte | Estado | Nota |
|---|---|---|
| Prompt do pedido (decisões explícitas) | **Disponível** | Precedência máxima (nível 1) |
| Product & Strategy Hub (Notion) | **Não acessível** | `app.notion.com` devolve ecrã de autenticação; o sandbox não tem sessão Notion |
| Roadmap (Notion) | **Não acessível** | idem |
| User Stories MVP (Notion) | **Não acessível** | idem |
| Personas e Licenciamento (Notion) | **Não acessível** | idem |
| AnkoraOne (app `6a7dd3d9b6d28b77a65c0b59`) | **Não inspecionável** | A partir deste sandbox só é possível ler o repositório da app de destino; não é possível ler código, entidades, funções nem comportamentos da app de origem |
| Securematurity (branch `migration-ankoraone-update`) | **Disponível** | Commit de referência `36e7cf4` |

**Consequência para a precedência (secção 3 do pedido):** os níveis 2, 3 e 4 da ordem de
precedência **não são observáveis** a partir daqui. Este documento não afirma ter comparado
código com a AnkoraOne nem validado comportamentos na origem. A comparação é feita entre:

- as **decisões explícitas do prompt** (nível 1), e
- o **estado real desta branch** (nível 5), lido do código.

As diferenças que o próprio prompt descreve na secção 13 são tratadas como **hipóteses a
revalidar** contra o código desta branch — que é o que a secção 7 faz.

---

## 2. Versões de referência

| Item | Valor |
|---|---|
| Repositório | `dbastoscarvalho23/Securematurity` |
| Branch | `migration-ankoraone-update` |
| Commit (início da Fase 1) | `36e7cf4` — "Fix Audit Log permission check and rendering" |
| App ID | `6ab5373e7f8f586c80cb9ed8` (identificador indicado no pedido) |
| App ID em `base44/.app.jsonc` | `69ca8d95ddfd46a45ba76ea6` (ponteiro de desenvolvimento local, fora do git) |
| Frontend | Vite + React 18, Node 22 (imagem `node:22-slim`), porta 3000 → 5173 |
| Backend local | `base44 dev` (Deno, base de dados em memória) |

---

## 3. Inventário do estado atual (observado)

| Área | Contagem | Ficheiro |
|---|---|---|
| Entidades | 46 | `base44/entities/*.jsonc` |
| Funções backend | 26 | `base44/functions/*/entry.ts` |
| Utilitários partilhados | 4 | `base44/shared/` |
| Workflows | 8 | `base44/workflows/` |
| Páginas | 41 | `src/pages/` |
| Módulos RBAC centralizados | 1 | `src/lib/rbac.js` (9 papéis, matriz `CAPABILITIES`, `ROUTE_RESOURCE`) |
| Módulos de licenciamento | 1 | `src/lib/licenseModules.js` (9 códigos de módulo) |
| Guard de rota | 1 | `src/components/layout/RouteGuard.jsx` (RBAC + licença) |

Os nove papéis exigidos na secção 7 do pedido **já existem** e mapeiam 1:1:

`master_admin` (Administrador AnkoraOne), `workspace_admin` (Administrador do Parceiro),
`consultant`, `customer_admin`, `grc_analyst` (Gestor/Analista GRC), `control_owner`
(Responsável de Controlo), `employee` (Colaborador), `executive` (Direção), `auditor`.

---

## 4. Matriz requisito → implementação atual → diferença

Estado: ✅ cumpre · 🟡 parcial · ❌ em falta/violação.

| # | Requisito (prompt) | Implementação atual | Diferença | Estado | Fase |
|---|---|---|---|---|---|
| 4.1 | Exatamente 3 tiers de cliente, cumulativos | `TIER_MODULES` e catálogo semeiam **4**: `core`, `professional`, `advanced`, `partner` (`src/lib/licenseModules.js:122`, `base44/shared/licenseGuard.ts:8`, `seedLicenseData`, `migrateExistingLicenses`, enum `LicenseTier.code`) | Existe um 4.º tier comercial "Partner" | 🟡 | 4 |
| 4.2 | Módulo completo por tier; sem capacidades "básicas/avançadas" por tier | Módulos são completos; o gating é por módulo, não por capacidade | — | ✅ | — |
| 4.3 | `privacy` (RoPA/DSR) fora do lançamento | `privacy` está incluído em `advanced` (e em `partner`) nos mesmos 5 ficheiros | Capacidade fora da tabela integra a oferta | ❌ | 4 |
| 4.4 | Core é a oferta ativa; Profissional/Avançado preparados mas não oferecidos | `is_active: true` nos 4 tiers; nada distingue "preparado" de "oferecido" | Falta marcador de disponibilidade comercial | ❌ | 4 |
| 4.5 | Sem preços, pagamentos, faturação, seats/IA como diferenciação | Não há billing; `seat_limit` e `monthly_usage_count` existem como limites técnicos | Adequado, com nota de que `assertModule` bloqueia acima de 1000 usos mensais (`licenseGuard.ts`) | 🟡 | 8 |
| 6 | Contexto ativo (org/tenant/papel/módulo/ação); troca de tenant limpa caches | Autorização assente em `user.customer_id` + arrays desnormalizados; não há selector de contexto de tenant | Troca de tenant sem separação de caches/pesquisas | ❌ | 3 |
| 7 | Matriz central de papéis aplicada na UI **e no servidor** | `src/lib/rbac.js` é central e usado por `RouteGuard`/`Sidebar`; o servidor **não** usa a mesma matriz | Matriz só no cliente | 🟡 | 3 |
| 7 | Admins de plataforma/parceiro sem acesso operacional automático | `CAPABILITIES` usa tiers `T_*` só de tenant e `can()` não faz curto-circuito de `master_admin` | Alinhado | ✅ | — |
| 8 | Onboarding limitado a configuração de conta/utilizadores | `create_onboarding` cria a atribuição **pendente** (sem `approved_by` automático) e `accept_onboarding` **não** escreve `delegated_*_customer_ids`; `resolve` passou a devolver apenas delegações | Corrigido na Fase 3 (secção 9) | ✅ | 3 |
| 8 | Delegação com motivo, módulos, nível, início/expiração, solicitante/aprovador | `request_delegation` exige motivo e `expires_at` (futuro, ≤ 365 dias); `approved_by` registado na aprovação; `list`/`resolve` expiram automaticamente o que passou do prazo e retiram o acesso | Corrigido na Fase 3 (secção 9) | ✅ | 3 |
| 8 | Consultor não aprova nem prolonga o próprio acesso | `approve/reject/revoke_delegation` exigem `master_admin` ou `customer_admin` **do próprio cliente** (o `workspace_admin` deixou de poder aprovar); o requerente não pode aprovar o seu próprio pedido | Corrigido na Fase 3 (secção 9) | ✅ | 3 |
| 8 | Sem break-glass/suporte autoaprovado no MVP | `breakGlassAccess` **removido** (função, botão, diálogo, banner e wrappers de frontend); `breakglass` saiu do enum de `assignment_type`; `breakglass_customer_ids` fica reservado e sem escrita | Retirado do MVP na Fase 3 (secção 9) | ✅ | 3 |
| 9 | Não usar arrays de clientes no utilizador como única fonte | Os 12 RLS operacionais continuam assentes em `delegated_*_customer_ids`, mas `User` passou a ter RLS de escrita reservado ao serviço/`master_admin` (as mutações de utilizador passam por `adminUpdateUser`), e o prazo é aplicado na leitura (`list`/`resolve`) | Parcial: a fronteira continua a ser arrays, já não escrevíveis pelo cliente | 🟡 | 3 |
| 9 | Acesso direto às entidades não contorna as funções | `AuditLog.create` no cliente (`src/lib/auditLog.js`) grava `user_email` fornecido pelo chamador | Frontend pode falsificar o ator | ❌ | 8 |
| 10 | Avaliações: resultados calculados no servidor; conclusão validada | Sem função `completeAssessment`; não há cálculo de resultados no servidor | Conclusão apenas no cliente | ❌ | 6 |
| 10 | Lacunas → ações com responsável, prazo, prioridade, estado, evidência | `Recommendation`, `Task`, `MitigationTask`, `ActionPlan` existem; ligação lacuna→requisito não é explícita | Rastreabilidade parcial | 🟡 | 6 |
| 10 | Documentos/evidências com versões, revisão, aprovação, hashes | `SecurityDocument`, `DocumentVersion`, `NominationDocument`, `PolicyAttestation`, `storeFileToCloud` | Revisão/aprovação por evidência a confirmar | 🟡 | 7 |
| 10 | Pacote de auditoria (índice, âmbito, versões, controlos, evidências, decisões) | Existem relatórios (`generateMonthlyAnnualReport`, `EmailReport`, `StrategicReport`); não existe pacote de auditoria | Funcionalidade em falta | ❌ | 7 |
| 11 | Conteúdos persistidos com estado editorial; sem mocks | `src/lib/knowledgeBaseMockData.js` alimenta a Base de Conhecimento; **não existe entidade** de artigo | Base de Conhecimento é mock; falta `transitionArticleStatus` | ❌ | 7 |
| 5 | Apenas NIS2 nos novos percursos; preservar histórico | `frameworkConstants.js` mapeia `NIS2: 'NIS2 / DL 125/2025'`; `LicenseStandard` semeia NIS2, RJCS, ISO27001 | Identificadores NIS2/RJCS sem versão nem mapeamento justificado | 🟡 | 2 |
| 13 | Workspace: `ancestor_ids` (destino) ≠ `ancestor_workspace_ids` (origem); tipos diferentes | Destino: `ancestor_ids` (antecessores, sem o próprio), tipos `root|organization|division|subsidiary|department` | Semântica por documentar; sem validação de ciclos/órfãos | 🟡 | 2 |
| 13 | Funções equivalentes a `manageWorkspace`, `writeAuditLog`, `getSubtreeKpis`, `snapshotAccessImpact`, `completeAssessment`, `transitionArticleStatus` | Existem `manageAssignment`, `getWorkspaceTree`, `resolveWorkspaceAccess`, `migrateExistingWorkspaces`; **as outras não existem** | 6 capacidades em falta | ❌ | 2–7 |
| 12 | Página Licenciamento não pode ser só o aviso "Módulo Não Licenciado" | `src/pages/Licensing.jsx` é a página real (catálogo dos 3 tiers, catálogo de módulos, subscrições por cliente, normas); o aviso passou para `src/pages/LicenseUnavailable.jsx` (rota `/license-unavailable`), que é o novo destino do redirect do `RouteGuard` | — | ✅ | 5 |
| 12 | Estados de carregamento/vazio/erro, validação, sem botões sem efeito | Parcial, por página | Auditoria por ecrã em falta | 🟡 | 5 |
| 14 | Auditoria produzida no servidor com ator real | `writeAccessAuditLog`/`writeLicenseAuditLog` gravam no servidor; mas o cliente também pode criar `AuditLog` | Caminho de escrita no cliente a fechar | ❌ | 8 |
| 14 | Persistência real; preview em memória não prova prontidão | Backend local é **em memória** e reinicia a cada arranque; um único utilizador semeado | Não é prova de prontidão comercial | ❌ | 8 |
| 15 | Jornada Core completável sem IA | Existe agente `framework_guide` e `AI_PROVIDER`/chaves configuradas | IA não pode ser condição do Core | 🟡 | 6 |

---

## 5. Defeitos identificados no destino (a corrigir, não a copiar)

Confirmados por leitura de código nesta branch — correspondem à lista "não copiar sem correção"
da secção 13 do pedido. Os defeitos 1–4 e 6 foram fechados na Fase 3 (evidências na secção 9);
o defeito 5 fica para a Fase 6.

1. **Onboarding com acesso operacional** — ✅ **corrigido na Fase 3**: `create_onboarding` já não
   aprova automaticamente e `accept_onboarding` não escreve os arrays de acesso operacional.
2. **Delegações sem prazo nem âmbito verificados** — ✅ **corrigido na Fase 3**.
3. **Aprovação por administrador de parceiro** — ✅ **corrigido na Fase 3**.
4. **Suporte autoaprovado** — ✅ **retirado do MVP na Fase 3**.
5. **Conclusão de avaliações protegida apenas por autenticação** — em falta: não existe função de
   conclusão; o `AuditLog` tem `assessment_completed` mas a escrita é do cliente. **(Fase 6.)**
6. **Regras que permitem modificar diretamente autorizações críticas** — ✅ **corrigido na Fase 3**:
   `User` passou a ter RLS de escrita (`create`/`update`/`delete` reservados a `master_admin`/serviço),
   pelo que os arrays `delegated_*_customer_ids` deixaram de ser alteráveis por um cliente com
   `role: admin`; a gestão de utilizadores passa pela função `adminUpdateUser` (service role, com as
   regras reaplicadas em código e registo de auditoria).

Preservar (não copiar da origem, mas manter aqui): armazenamento cloud
(`storeFileToCloud`, `getStorageProviders`, `updateCustomerStorage`, `StorageSettings`).

---

## 6. Sequência de execução e estado

| Fase | Conteúdo | Estado |
|---|---|---|
| 1 | Inventário e matriz de diferenças com versões de referência | **Concluída** (este documento) |
| 2 | Modelo de dados e migrações compatíveis (Workspace canónico, NIS2/versão, funções em falta) | Não iniciada |
| 3 | Autorização, isolamento, onboarding e delegação (fechar defeitos 1–4, 6) | **Concluída** — ver evidências na secção 9 |
| 4 | Catálogo de 3 tiers e ativação comercial só do Core | **Concluída** — ver evidências na secção 9 |
| 5 | Administração consolidada (página Licenciamento real; aviso separado) | **Concluída** — ver evidências na secção 9 |
| 6 | Jornada Core NIS2 completa (avaliações com cálculo no servidor, lacunas, ações) | Não iniciada |
| 7 | Conteúdos, reporting e pacote de auditoria | Não iniciada |
| 8 | Testes de segurança, regressão, persistência e operação | Não iniciada |

---

## 7. Revalidação das diferenças conhecidas (secção 13 do pedido)

| Diferença alegada no pedido | Resultado da revalidação nesta branch |
|---|---|
| Licenciamento incompleto no destino | **Confirmada.** Catálogo existe, mas com 4 tiers e `privacy` incluído; nenhuma página de licenciamento funcional. |
| Organização ainda sem a experiência consolidada da origem | **Parcialmente confirmada.** `/organization` existe (182 linhas); a consolidação completa (árvore, tenants, matriz de permissões) não está implementada. |
| Modelos de Workspace incompatíveis | **Confirmada.** `ancestor_ids` vs `ancestor_workspace_ids`; tipos `root|organization|division|subsidiary|department` vs `partner|group`. Sem renomeação cega aplicada. |
| Campos de catálogo e subscrição diferentes | **Confirmada.** `LicenseTier`/`LicenseModule` usam `display_order`/`modules`; `TenantSubscription` não tem `organization_size`, `limit_overrides`, `contractual_exceptions`, `suspended_reason`. |
| Base de Conhecimento baseada em mocks | **Confirmada.** `src/lib/knowledgeBaseMockData.js`; não existe entidade de artigo. |
| Funções e entidades recentes ausentes | **Confirmada.** `manageWorkspace`, `writeAuditLog`, `getSubtreeKpis`, `snapshotAccessImpact`, `completeAssessment`, `transitionArticleStatus` não existem. |
| Coexistência de páginas administrativas antigas | **Confirmada.** `/admin`, `/workspaces`, `/user-assignments`, `/settings`, `/licensing` coexistem com `/organization`, `/configuration`, `/system-status`. |
| Diferenças entre RBAC, rotas e gating de módulos | **Confirmada.** `rbac.js` (RBAC) e `licenseModules.js` (módulos) mantêm mapas de rota separados; a matriz RBAC não é aplicada no servidor. |

---

## 8. Validações pendentes e limitações declaradas

- **Fontes Notion e app de origem não lidas** (secção 1). Nenhuma afirmação deste documento
  pressupõe comparação com a AnkoraOne.
- **Ambiente de testes do pedido (secção 17) não existe ainda**: o backend local é em memória,
  semeia **um único utilizador** (`victor.pereira@dcabconsulting.com`, papel `admin`) e as
  entidades `User` create/delete são ignoradas localmente. Os testes 1–23 da secção 17 exigem
  ambiente persistente com ≥2 tenants, ≥2 parceiros e 8 identidades distintas — **não podem ser
  executados neste ambiente** e não são declarados como aprovados.
- **Persistência real** (testes 18, 19) fica dependente de configuração de base de dados de
  produção; não é demonstrável no preview em memória.
- **MFA para contas privilegiadas** (secção 9): depende de configuração da plataforma; fica
  registado como pendência verificável.

---

## 9. Evidências de execução

### Fase 4 — catálogo de três tiers (concluída)

Alterações: `src/lib/licenseModules.js`, `base44/shared/licenseGuard.ts`,
`base44/entities/LicenseTier.jsonc`, `base44/functions/seedLicenseData/entry.ts`,
`base44/functions/migrateExistingLicenses/entry.ts`.

| Verificação | Método | Resultado |
|---|---|---|
| Compilação do frontend | `vite build` no contentor | **Passou** (sem erros; só aviso de `browserslist`) |
| Backend recarrega o schema | reinício do serviço + logs | **Passou** — 46 entidades e 26 funções carregadas, incluindo `licensetier` |
| Três tiers, sem `partner` | `seedLicenseData` → `GET /entities/LicenseTier` | **Passou** — `tiers_created: 3`, códigos `core`, `professional`, `advanced` |
| Disponibilidade comercial | mesmo pedido | **Passou** — `commercially_available`: `core=true`, `professional=false`, `advanced=false` |
| `privacy` fora da oferta | `GET /entities/LicenseTier` e `/entities/LicenseModule` | **Passou** — nenhum tier inclui `privacy`; módulo com `tier_code: "outside_offering"`, `is_active: false` |
| Módulos cumulativos | `getEffectiveLicense` por subscrição | **Passou** — core 4, professional 6, advanced 8 módulos |
| Alias legado `partner` | subscrição com `tier_code: "partner"` | **Passou** — resolve para o conjunto avançado (8 módulos), sem `privacy` |
| 9 módulos no catálogo | `seedLicenseData` | **Passou** — `modules_created: 9` |

Método de invocação local (para repetir): `POST /api/apps/<appId>/functions/<nome>` com os
cabeçalhos `Base44-App-Id` e `Authorization: Bearer <token de localStorage.base44_access_token>`.

**Não verificado nesta fase:** não há testes de interface nesta fase.

### Fase 5 — página de licenciamento real e aviso separado (concluída)

Alterações: `src/pages/Licensing.jsx` (reescrita), `src/pages/LicenseUnavailable.jsx` (nova),
`src/components/layout/RouteGuard.jsx`, `src/App.jsx`, `src/lib/rbac.js`,
`src/lib/licenseModules.js`, `src/components/layout/TopBar.jsx`, `src/lib/translations-license.js`.

Separação de responsabilidades: `/licensing` passa a ser a página de administração do
licenciamento (só papéis com a capacidade `licensing`: `master_admin`, `workspace_admin`);
o aviso de módulo não licenciado passa a ser uma rota própria (`/license-unavailable`),
mapeada para o recurso `dashboard` (`rbac.js`), pelo que qualquer papel autenticado a alcança,
e sem gating de módulo (`licenseModules.js`).

| Verificação | Método | Resultado |
|---|---|---|
| `/licensing` com dados reais | preview: `seedLicenseData` + navegação | **Passou** — 4 indicadores, catálogo dos 3 tiers, tabela de módulos (Privacidade "Fora da oferta"), normas (NIS2, RJCS, ISO 27001) |
| Apenas o Core em venda | cartões do catálogo | **Passou** — Core "Disponível"; Profissional e Avançado "Preparado, não comercializado" |
| Subscrições por cliente | tabela `TenantSubscription` | **Passou** — 1 subscrição local; `tier_code: "partner"` (legado) apresenta-se como "Avançado", via `LEGACY_TIER_ALIASES` |
| Aviso acessível a qualquer papel | navegação para `/license-unavailable` | **Passou** — cartão "Módulo Não Licenciado" (não é *Page Not Found*) |
| Ação do aviso | clique em "Painel" | **Passou** — navega para `/` |
| Saúde do frontend após as alterações | consola, rede, overlay, raiz | **Passou** — 0 pedidos falhados, sem `vite-error-overlay`, raiz renderizada; só o ruído conhecido do websocket do SDK |

**Não verificado nesta fase:** o redirect do `RouteGuard` para `/license-unavailable` não foi
exercitado ponta a ponta porque o ambiente local tem um único utilizador (`master_admin`), para
quem a verificação de módulo é dispensada; o destino foi validado por leitura de código e por
navegação direta. Não há testes de RBAC por papel nesta fase.

### Fase 3 — autorização, onboarding e delegação (concluída)

Alterações: `base44/functions/manageAccess/entry.ts` (prazo obrigatório, expiração automática,
autoridade de aprovação, onboarding sem acesso operacional), `base44/functions/adminUpdateUser/entry.ts`
(única via de escrita de `User`, com papéis normalizados e auditoria), `base44/entities/User.jsonc`
(RLS de escrita), `base44/entities/UserCustomerAssignment.jsonc` (`breakglass` removido do enum),
`base44/shared/accessUtils.ts`, remoção de `base44/functions/breakGlassAccess/`, `src/lib/delegation.js`,
`src/pages/ExternalAccess.jsx`, `src/components/customers/CustomerSeatSection.jsx`, `src/lib/translations.js`.

| Verificação | Método | Resultado |
|---|---|---|
| Delegação exige motivo e prazo | `manageAccess request_delegation` sem `expires_at` / com prazo no passado / sem `reason` | **Passou** — 400 com mensagem explícita em cada caso |
| Delegação válida fica pendente e com prazo | pedido com `expires_at` a 7 dias | **Passou** — `status: "pending"`, `expires_at` gravado |
| Autoaprovação bloqueada | `approve_delegation` do próprio pedido | **Passou** — 403 "you cannot approve your own delegation request" |
| Expiração automática | atribuição ativa com `expires_at` no passado + `resolve` | **Passou** — cliente excluído de `customer_ids` e registo marcado `expired` |
| Onboarding sem acesso operacional | `create_onboarding` → `accept_onboarding` → `resolve` | **Passou** — `approved_by` vazio na criação, `onboarding_customer_ids` preenchido, `delegated_view/edit_customer_ids` **não** preenchidos, cliente ausente de `customer_ids` |
| Revogação de onboarding limpa os arrays | `revoke_onboarding` | **Passou** — `onboarding_customer_ids` sem o cliente |
| Escrita de utilizador pela via suportada | `adminUpdateUser` (nome e papel) | **Passou** — 200; papel inválido devolve 400 |
| Break-glass retirado | botão, texto e diálogo em `/external-access`; lista de funções do backend | **Passou** — nenhum vestígio na página, `breakGlassAccess` já não é carregada, 0 pedidos falhados |
| Saúde do frontend após as alterações | consola, rede, overlay, raiz | **Passou** — sem `vite-error-overlay`, raiz renderizada; só o ruído conhecido do websocket do SDK |

**Não verificado nesta fase (limitação do ambiente local):**
- O **RLS de escrita de `User`** não pode ser exercitado: o backend local semeia um único utilizador
  (`role: admin`, que o RLS permite). A regra está declarada e o schema carrega, mas o bloqueio de uma
  escrita de cliente por um papel não-admin não foi observado.
- A **proibição de aprovação por `workspace_admin`** não foi exercitada por não existir localmente
  uma identidade de parceiro; a verificação é por leitura de código.
- O **diálogo de pedido de delegação** para o papel `consultant` (campo "Access until" obrigatório)
  não foi verificado na UI — o limite de verificações de preview da sessão esgotou-se antes.
- O fluxo de **assentos** (`CustomerSeatSection`) passou a invocar `adminUpdateUser`; a função foi
  verificada por chamada direta, mas o clique na UI não foi exercitado (o backend local não cria
  utilizadores, pelo que não há como listar/alterar um utilizador num cliente).
- Ficaram registos de teste ("Teste Fase3/Exp/Onb", 3 clientes + 3 atribuições) na base de dados
  **em memória** local: desaparecem em qualquer reinício ou mudança de schema.

### Descobertas de ambiente registadas

- `getPlatformMetrics` mapeia `knowledge_article` → entidade `KnowledgeArticle`, **que não existe**
  (erro 403/404 no arranque). Corrigir na Fase 7, com a entidade de artigos e o fluxo editorial.
- O Dashboard consulta `IntegrationUsage` e `Risk`, entidades inexistentes (404 na consola).
- `Customer` exige `nif` e `name`; sem eles a escrita devolve 422 com corpo vazio (sem detalhe de validação).
- Ficou um registo de teste ("Probe Catálogo", cliente + subscrição) na base de dados em memória
  local: o limite de verificações da sessão esgotou-se antes da limpeza. Desaparece em qualquer
  reinício ou mudança de schema; não existe fora do ambiente local.
