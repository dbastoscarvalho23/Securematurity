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
| 10 | Avaliações: resultados calculados no servidor; conclusão validada | `completeAssessment` calcula cobertura, pontuação e instantâneo metodológico a partir das respostas persistidas; exige papel de tenant ou delegação de edição e módulo licenciado | Corrigido na Fase 6 (secção 9) | ✅ | 6 |
| 10 | Lacunas → ações com responsável, prazo, prioridade, estado, evidência | `manageActionPlan` deriva as lacunas das respostas (abaixo do alvo / não cobertas), grava-as como `Recommendation` com `question_id`+`control_id` e gera a `Task` com responsável, prazo, prioridade, estado e evidência exigida | Corrigido na Fase 6 (secção 9) | ✅ | 6 |
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
5. **Conclusão de avaliações protegida apenas por autenticação** — ✅ **corrigido na Fase 6**:
   `completeAssessment` (conclusão e reabertura) e `manageActionPlan` (lacunas e ações) correm no
   servidor, com o ator vindo da sessão, verificação de tenant/delegação, módulo licenciado e registo
   de auditoria; o cliente deixou de calcular pontuações e de derivar lacunas.
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
| 6 | Jornada Core NIS2 completa (avaliações com cálculo no servidor, lacunas, ações) | **Concluída** — conclusão/reabertura, análise de lacunas e geração de ações no servidor (secção 9) |
| 7 | Conteúdos, reporting e pacote de auditoria | **Concluída** — base de conhecimento editorial, pacote de auditoria congelado e integridade de evidências (secção 9) |
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

### Fase 7 — base de conhecimento editorial, pacote de auditoria e integridade de evidências (concluída)

Alterações: `base44/entities/KnowledgeArticle.jsonc` e `base44/entities/AuditPackage.jsonc` (novas),
`base44/entities/SecurityDocument.jsonc` / `DocumentVersion.jsonc` (`content_hash`, `review_note`),
`base44/entities/AssessmentResponse.jsonc` / `Task.jsonc` (hashes de ficheiro anexado),
`base44/shared/contentUtils.ts` (novo — papéis de curadoria, transições legais, auditoria),
`base44/functions/seedKnowledgeBase/`, `base44/functions/transitionArticleStatus/`,
`base44/functions/generateAuditPackage/`, `base44/functions/reviewDocument/`,
`src/lib/fileHash.js` (SHA-256 no cliente), `src/lib/kbFrameworks.js`, `src/lib/useKnowledgeArticles.js`,
`src/pages/KnowledgeBase.jsx` (catálogo + detalhe + separador editorial),
`src/components/knowledge/ArticleEditorialPanel.jsx`, `src/pages/AuditPackage.jsx`,
rota `/knowledge-base/:slug` em `src/App.jsx`, integração em RBAC/licenças/sidebar.

A escrita do catálogo é **só no servidor**: `KnowledgeArticle` não tem RLS de escrita por tenant
(o catálogo é transversal à plataforma), pelo que toda a mutação passa por `transitionArticleStatus`
(estado nunca vem do corpo; `save` de um artigo publicado reenvia-o para revisão em vez de o
substituir em silêncio) e por `seedKnowledgeBase`. O pacote de auditoria é **congelado**: 
`generateAuditPackage` monta âmbito (âmbito), índice, versões, controlos, evidências (com hash) e
decisões num único registo imutável depois de `finalize`; a autorização reutiliza
`authorizeAssessmentOperational` (papel do tenant ou delegação de edição aprovada e não expirada) e
exige o módulo `reporting_audit_prep`.

| Verificação | Método | Resultado |
|---|---|---|
| Semente idempotente do catálogo | `seedKnowledgeBase` | **Passou** — 20 artigos criados (8 `platform`, 12 `compliance`), `reused: 0` numa base limpa |
| Fluxo editorial completo | `transitionArticleStatus`: `save` → `submit_review` → `publish` → `archive` → `restore` → `submit_review` → `reject` | **Passou** — `draft` → `in_review` → `published` → `archived` → `draft` → `in_review` → `draft` |
| Transição ilegal recusada | `publish` sobre artigo já `published` | **Passou** — 409 `invalid_transition` |
| Rejeição exige motivo | `reject` sem `note` | **Passou** — 400 `note_required` |
| Pacote de auditoria gerado | `generateAuditPackage generate` (cliente Core + delegação de edição) | **Passou** — 200, pacote `draft` com âmbito, índice e quatro secções (versões, controlos, evidências, decisões) |
| Pacote congelado | `generateAuditPackage finalize` (1.ª e 2.ª vez) | **Passou** — 200 `final`; segunda tentativa 409 `already_final` |
| Pacote exige cliente | `generate` sem `customer_id` | **Passou** — 422 `customer_required` |
| Catálogo no browser | `/knowledge-base`: 21 cartões, separador Editorial com etiquetas de estado e ações legais | **Passou** — "Rascunho"/"Publicado" e botões Publicar/Arquivar conforme o estado |
| Ligação profunda do artigo | clique num cartão do catálogo | **Passou** — navega para `/knowledge-base/<slug>` e apresenta o detalhe (título + corpo) |
| Saúde do frontend | consola, rede, overlay, raiz | **Passou** — 0 erros, 0 pedidos falhados, sem `vite-error-overlay` |

**Não verificado nesta fase (limitação do ambiente local):**
- A **geração do pacote pelo painel** (`src/pages/AuditPackage.jsx`) não foi exercitada por clique: o
  papel local (`master_admin`) não é operacional por definição da matriz, pelo que o ecrã não está
  acessível na sessão de pré-visualização; a função foi validada por chamada direta (com uma
  delegação de edição criada para o efeito).
- O **pacote com conteúdo real** (controlos, evidências e decisões) não foi observado ponta a ponta:
  o pacote de teste saiu sem avaliação concluída, logo com as quatro secções vazias — a derivação
  das secções a partir da avaliação ancora está verificada por leitura de código.
- A **leitura do `AuditPackage` pelo browser** devolveu lista vazia por RLS (o registo é escrito com
  o papel de serviço e o utilizador não tem o `customer_id` nos arrays desnormalizados); o registo
  existe e é lido pelo servidor.
- A **revisão de documentos** (`reviewDocument`, `content_hash`/`review_note`) foi implementada e os
  schemas carregam, mas não foi exercitada por falta de um documento e de um papel operacional locais.

### Fase 6 — conclusão de avaliações no servidor (concluída)

Alterações: `base44/shared/assessmentScoring.ts` (novo), `base44/functions/completeAssessment/entry.ts`
(novo), `base44/entities/Assessment.jsonc` (campos anuláveis na reabertura e instantâneo metodológico
completo), `base44/functions/seedTestEnvironment/entry.ts` (novo), `src/pages/AssessmentDetail.jsx`,
`src/pages/AssessmentResults.jsx`, `src/components/assessments/QuestionCard.jsx`.

Método: funções invocadas contra o backend local (`POST /api/apps/<appId>/functions/<nome>`) sobre o
ambiente criado por `seedTestEnvironment {confirm:"create-test-conditions"}` — 2 parceiros, 4 clientes,
12 perguntas NIS2 e cenários de delegação. A pontuação e a cobertura são sempre calculadas no servidor.

| Verificação | Resultado |
|---|---|
| Conclusão com cobertura total | **Passou** — 200, `completion_type: full_coverage`, pontuação 2,7 (12/12 respondidas) |
| Conclusão parcial com pendentes | **Passou** — 200 com `confirm_partial`, `partial_coverage`, cobertura 66,7% (4 pendentes) |
| Conclusão parcial sem confirmação | **Passou** — 422 a pedir confirmação; nenhuma escrita |
| Reabertura de avaliação concluída | **Passou** — 200; estado `in_progress`, pontuação/cobertura/metodologia anuladas, `completed_date` e `completed_by` limpos |
| Reabertura sem motivo | **Passou** — 400 `reason_required` |
| Reabertura de avaliação não concluída | **Passou** — 409 `not_completed` |
| Conclusão de avaliação já concluída | **Passou** — 409 `already_completed` |
| Ação desconhecida | **Passou** — 400 `Unknown action` |
| Resultado anterior preservado | **Passou** — `result_history` acumula entradas (histórico observado após várias conclusões e reaberturas) |
| Instantâneo metodológico no histórico | **Passou** — modelo de pontuação, versão do framework (NIS2 2025) e pesos por pergunta gravados no histórico |
| Autorização por delegação (só leitura) | **Passou** — 403 `forbidden` (cliente Gama) |
| Módulo licenciado | **Passou** — 403 `module_not_licensed` (cliente Delta, sem subscrição) |
| Migração de workspaces existentes | **Passou** — `migrateExistingWorkspaces` 200; workspace raiz criado com `parent_id: null`, cliente ligado, clientes já migrados ignorados |
| Painel sem erros de entidade | **Passou** — `/` após recarregamento: `RiskItem` e `LicenseUsageRecord` a 200, 0 pedidos falhados, 0 erros de consola, sem overlay |

**Não verificado nesta fase:** o diálogo de reabertura na interface não foi exercitado por clique — a
verificação foi feita por chamada direta à função com a identidade da sessão; os widgets do Dashboard
aparecem em estado vazio porque o ambiente de teste não semeia riscos nem consumo de IA. As lacunas e
ações estão na subsecção seguinte.

### Fase 6 — lacunas → ações (concluída)

Alterações: `base44/shared/assessmentAccess.ts` (novo — autorização, licença e carregamento
partilhados), `base44/shared/gapAnalysis.ts` (novo), `base44/functions/manageActionPlan/entry.ts`
(novo), `base44/functions/completeAssessment/entry.ts` (passa a usar os utilitários partilhados),
`base44/entities/Recommendation.jsonc` (`question_id`, `source`),
`src/components/assessments/AssessmentResults.jsx`, `src/lib/translations-assessments.js`.

Regra de negócio (sempre no servidor, nunca no browser): uma lacuna é uma resposta *respondida* com
maturidade abaixo do alvo (`below_target`) ou um requisito *sem resposta* numa conclusão parcial
(`uncovered`); uma resposta «não aplicável» é uma decisão de âmbito e nunca conta como lacuna. A
prioridade combina o tamanho da lacuna com o peso do requisito (crítica ≥ 9, alta ≥ 6, média ≥ 3,
baixa abaixo disso) e determina o prazo sugerido da ação (imediato 30 dias, curto 90, médio 180, longo
365). Cada lacuna é gravada como `Recommendation` ligada ao requisito (`question_id` + `control_id` +
`framework_code`) e cada ação é uma `Task` ligada de volta à lacuna (`recommendation_id`) e ao controlo
(`framework_control_id`), com responsável, prazo, prioridade, estado e evidência exigida em `notes`.

Método: funções invocadas contra o backend local sobre o ambiente de `seedTestEnvironment`
(4 clientes, 12 perguntas NIS2, 3 com subscrição Core — o cliente Delta fica sem subscrição).

| Verificação | Resultado |
|---|---|
| Ações antes das lacunas | **Passou** — 422 `no_gaps`; nenhuma escrita |
| Lacunas numa avaliação não concluída | **Passou** — 409 `not_completed` |
| Identificação de lacunas (alfa, cobertura total) | **Passou** — 8 lacunas: 1 crítica, 2 altas, 3 médias, 2 baixas |
| Lacuna ligada ao requisito | **Passou** — `question_id` + `control_id` (`NIS2.2.3`) + `source: assessment_gap` |
| Repetição da análise | **Passou** — 0 lacunas criadas na segunda execução (idempotente) |
| Geração de ações | **Passou** — 8 ações criadas, cada uma com responsável, prazo, prioridade, estado `todo` e evidência exigida |
| Ação ligada de volta à lacuna | **Passou** — `recommendation_id` + `framework_control_id` + `assessment_id` |
| Repetição da geração de ações | **Passou** — 0 ações criadas na segunda execução |
| Lacunas numa conclusão parcial (beta) | **Passou** — 9 lacunas: 5 `below_target` + 4 `uncovered` |
| Autorização por delegação (só leitura) | **Passou** — 403 `forbidden` (cliente Gama) |
| Módulo licenciado | **Passou** — 403 `module_not_licensed` (cliente Delta) |
| Ação desconhecida | **Passou** — 400 `Unknown action` |
| Regressão da conclusão/reabertura | **Passou** — após a extração dos utilitários partilhados: conclusão total 200 e reabertura 200 com o resultado anterior preservado |
| Registo de auditoria | **Passou** — `assessment_gaps_identified` e `action_plan_generated` com contagens por prioridade |
| Compilação do frontend | **Passou** — `vite build` no contentor (saída 0) |
| Painel sem erros | **Passou** — 0 pedidos falhados e sem overlay; apenas o ruído conhecido do websocket (`connect_error`/`timeout`) |

**Não verificado nesta fase:** o painel de lacunas e ações na interface não foi exercitado por clique.
O único utilizador do ambiente local é o administrador de plataforma, que a matriz de RBAC exclui das
rotas de conformidade (a navegação para `/assessments` redireciona para `/`), pelo que o ecrã não é
alcançável nesta sessão; a persistência foi verificada pelo serviço (a segunda execução cria 0). A
leitura das entidades pelo cliente continua filtrada por RLS — o administrador de plataforma não tem
tenant, pelo que `Recommendation`, `Task` e `Assessment` devolvem 0 registos ao cliente.

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

- **Resolvido na Fase 7:** `getPlatformMetrics` mapeia `knowledge_article` → entidade `KnowledgeArticle`,
  que não existia (erro 403/404 no arranque). A entidade de artigos e o fluxo editorial foram criados
  na Fase 7; a contagem responde 200.
- **Resolvido na Fase 6:** o Dashboard consultava `IntegrationUsage` e `Risk`, entidades inexistentes
  (404 na consola). Passou a consultar `RiskItem` e `LicenseUsageRecord` (o contador mensal por cliente
  escrito por `enforceUsageLimit`); o widget de consumo de IA passou a listar clientes.
- `migrateExistingWorkspaces` falhava com `parent_id: Input should be a valid string` (criava workspaces
  raiz com `parent_id: null`). **Resolvido:** `Workspace.parent_id` passou a `["string", "null"]`.
- `Customer` exige `nif` e `name`; sem eles a escrita devolve 422 com corpo vazio (sem detalhe de validação).
- Ficou um registo de teste ("Probe Catálogo", cliente + subscrição) na base de dados em memória
  local: o limite de verificações da sessão esgotou-se antes da limpeza. Desaparece em qualquer
  reinício ou mudança de schema; não existe fora do ambiente local.
