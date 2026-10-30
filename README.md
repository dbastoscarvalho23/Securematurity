# AnkoraOne

**[AnkoraOne: a infraestrutura inteligente de governação, risco e conformidade](https://neora.pt/servico-ankoraone.html)**

Plataforma de conformidade em cibersegurança (RJC/NIS2, ISO/IEC 27001, DORA, TISAX, RGPD) construída com Vite + React 18 sobre o backend do Base44.

- Produção: <https://app.ankoraone.com> — app nativa **AnkoraOne_DC_Repo** no Base44 (id `6adf8df867faaf60a171efa5`).
- Documentação: [`docs/README.md`](docs/README.md) (arquitetura, publicação, domínio, email, IA, repositório documental, legal, onboarding).

## Desenvolvimento local

1. Clonar este repositório e instalar dependências: `npm install` (Node 22).
2. Criar `.env.local` com:

```
VITE_BASE44_APP_ID=6adf8df867faaf60a171efa5
VITE_BASE44_APP_BASE_URL=https://ankora-one-dc-repo-a171efa5.base44.app
```

3. `npm run dev` (só frontend, contra o backend publicado) ou `base44 dev` (backend local, ver `AGENTS.md`).

A entrada é feita com Google, Microsoft ou email e palavra-passe; a app só abre a utilizadores convidados. Publicação: [`docs/deploy-base44.md`](docs/deploy-base44.md).

## Rotas

| Rota | Página | Descrição |
|---|---|---|
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Login/Register/… | Autenticação (público) |
| `/` | Dashboard | Painel principal (autenticado) |
| `/customers` | Customers | Gestão de clientes |
| `/assessments`, `/assessments/:id` | Assessments / AssessmentDetail | Avaliações de conformidade |
| `/recommendations` | Recommendations | Recomendações |
| `/reports`, `/email-report` | Reports / EmailReport | Relatórios |
| `/tasks`, `/task-analytics` | Tasks / TaskAnalytics | Tarefas e análise |
| `/risk-assessment` | RiskAssessment | Gestão de risco |
| `/security-documents` | SecurityDocuments | Documentos de segurança (ver abaixo) |
| `/document-audit-trail` | DocumentAuditTrail | Auditoria de documentos |
| `/action-plan` | ActionPlan | Plano de ação |
| `/evidence` | EvidenceOverview | Evidências (ver abaixo) |
| `/compliance-metrics` | ComplianceMetrics | Métricas de conformidade (ver abaixo) |
| `/compliance-journey` | ComplianceJourney | Jornada de conformidade (RJC 2026) |
| `/supply-chain`, `/suppliers` | SupplyChain / Suppliers | Cadeia de abastecimento |
| `/ropa` | RoPA | Registo de atividades de tratamento |
| `/incidents` | IncidentManagement | Gestão de incidentes (prazos NIS2) |
| `/dsr` | DSRManagement | Pedidos de titulares |
| `/vulnerabilities` | VulnerabilityManagement | Vulnerabilidades |
| `/training` | Training | Formação |
| `/legal-library` | LegalLibrary | Biblioteca legal (dados oficiais) |
| `/framework-guide` | FrameworkGuide | Guia de frameworks (agente IA) |
| `/question-bank` | QuestionBank | BD de perguntas |
| `/settings` | Settings | Configurações |
| `/backoffice` (+`customers`, `users`, `frameworks`, `audit`) | Backoffice | Área admin (`/admin` redireciona) |

Todas as rotas autenticadas passam por `RouteGuard` (papéis por rota); visitantes não autenticados caem em `/login`.

## Módulos principais

### SecurityDocuments — `/security-documents` (`src/pages/SecurityDocuments.jsx`)

- Documentos de segurança organizados em 4 níveis: Políticas, Normas, Procedimentos, Playbooks (`LEVEL_CONFIGS`).
- Fluxo de ciclo de vida: rascunho → revisão → aprovação, com `PendingReviewsPanel` (aprovações pendentes), `ApprovalDialog` e `StatusBadge`; histórico de versões em `VersionHistoryDialog`.
- `NominationsPanel` — nomeações e cargos de governação (RSI/CISO, mandatos, estatutos), filtrado pelo cliente efetivo.
- Para platform admin, o seletor de clientes usa a sentinela `'all'` ("Todos os clientes" — Radix Select não aceita `null`); para utilizador de cliente, o filtro é o próprio tenant.
- Pesquisa de texto, contadores por nível, auditoria via `writeAuditLog`.
- Componentes em `src/components/documents/` (dialogs, painéis, gráficos e tabelas de auditoria).

### Evidence — `/evidence` (`src/pages/EvidenceOverview.jsx`)

- Resumo de lacunas de conformidade por cliente (`ComplianceGapsSummary`, `CustomerGapCard`): documentos em falta, revisões, rascunhos e prazos próximos (30 dias).
- KPIs: total de ficheiros de evidência, avaliações com evidências, frameworks cobertos.
- Agrupamento de ficheiros por avaliação com pesquisa por ficheiro/domínio/nota e filtros por avaliação, framework e domínio; descarregamento em lote ("Descarregar Todos").
- Evidências vêm das respostas de avaliação (anexos + notas); estado de carregamento via `LoadingState`/`EmptyState`.

### ComplianceMetrics — `/compliance-metrics` (`src/pages/ComplianceMetrics.jsx`)

- KPIs agregados: incidentes abertos, vulnerabilidades abertas (SLA), pedidos de titulares (DSR) abertos, registos RoPA ativos.
- Conformidade de notificação de incidentes NIS2: pré-alerta 24h, notificação completa 72h, relatório final 1 mês — cálculo de atrasos via `incidentDeadlines()`/`overdueIncidentPhases()` em `src/lib/complianceUtils.js`.
- Gráficos Recharts: incidentes por estado e vulnerabilidades por gravidade.
- Todos os rótulos passam por chaves de tradução (PT-PT, `useLanguage`).

## Estrutura do projeto

- `src/pages/` — páginas (32 rotas em `App.jsx`); `src/pages/backoffice/` — shell admin.
- `src/components/` — componentes da app + primitivas shadcn/ui (`src/components/ui/`).
- `base44/entities/` — definições de entidades (JSONC); `base44/functions/` — funções backend; `base44/workflows/` — automações agendadas; `base44/connectors/`, `base44/agents/`, `base44/shared/`.
- `src/lib/` — contexto de auth, i18n, utilitários de conformidade, mapeamentos de frameworks.
- `src/data/legal/` — biblioteca legal oficial (ver `docs/legal/README.md`; regeneração em `tools/legal/`).

## Testes

Vitest + jsdom + Testing Library (`vitest.config.js`, backend simulado — corre sem rede):

```bash
npx vitest run
```

Nota: 6 testes de `RouteGuard` estão desatualizados face às regras de navegação de outubro de 2026 e precisam de revisão.

Documentação do Base44: <https://docs.base44.com>

## Servidor próprio (em desenvolvimento)

O ramo `feat/self-hosting` tem um backend próprio (Node.js + PostgreSQL) com a mesma API da Base44, para correr a app fora da plataforma. Instalação, migração dos dados e limitações: [`docs/self-hosting.md`](docs/self-hosting.md).
