# AnkoraOne — Documentação Técnica da Aplicação

> Documento gerado a partir do código em 29 de outubro de 2026.
> Plataforma de maturidade e conformidade em cibersegurança: RJC / NIS2 (Reg. 756/2026), ISO/IEC 27001, ISO/IEC 42001, DORA, TISAX, RGPD.

---

## 1. Identificação

| Campo | Valor |
|---|---|
| Aplicação | AnkoraOne_DC_Repo (Base44) |
| Domínio | https://app.ankoraone.com |
| Stack | React 18 + Vite + Tailwind + shadcn/ui; backend Base44 (entidades, funções Deno, workflows) |
| Idioma | Português (PT-PT) e inglês, interface bilingue |
| Dimensão | ~62 000 linhas de código em `src/` e `base44/` |
| Entidades | 54 (mais `User`, nativa) |
| Funções backend | 27 |
| Workflows | 9 (agendados e por evento) |
| Testes | 16 ficheiros, 164 testes |

---

## 2. Arquitetura

```
Utilizadores (admin · customer_admin · user)
        │
        ▼
Frontend React/Vite (SPA no Base44, domínio app.ankoraone.com)
        │  token do utilizador
        ▼
App Base44
 ├── Autenticação (email, Google, Microsoft)
 ├── 54 entidades com RLS por cliente (customer_id) e por papel
 ├── 27 funções Deno (service role, validam papel/cliente/módulo)
 ├── 9 workflows (agendados + eventos de entidade)
 └── Segredos (API keys, chaves de assinatura)
        │
        ├──► Repositório documental privado (Base44 · Google Drive · OneDrive · WebDAV)
        ├──► NVD / CISA KEV (vulnerabilidades)
        ├──► Claude (Anthropic) ou LLM do Base44 (IA)
        └──► Resend (email da plataforma)
```

### Camadas

| Camada | Local | Notas |
|---|---|---|
| Frontend | `src/` | React 18 + Vite, tema tokenizado (claro/escuro), `RouteGuard` por papel e por módulo licenciado |
| Entidades | `base44/entities/*.jsonc` | RLS por `customer_id` e por papel; campos sensíveis com RLS de escrita |
| Funções | `base44/functions/*/entry.ts` | Deno; validam papel e cliente antes de ler/gravar com *service role* |
| Código partilhado | `base44/shared/` | 23 módulos (`mail`, `llm`, `storage`, `license`, `http`, `audit`, `recipients`, …) |
| Workflows | `base44/workflows/*.jsonc` | Chamam funções com a sessão do proprietário (sem segredos nos argumentos) |
| Dados legais | `src/data/legal/` | Só fontes oficiais (RJC, NIS2, DORA, ISO 27001/42001, TISAX, CIS) |

---

## 3. Papéis e modelo de acesso

| Papel | Âmbito |
|---|---|
| `admin` | Plataforma. Acesso total, backoffice, biblioteca de perguntas, auditoria, gestão de clientes e utilizadores. |
| `customer_admin` | Administrador de um cliente. Todos os módulos do seu cliente (incidentes, vulnerabilidades, ativos, plano de ação, recomendações), sem backoffice nem auditoria global. |
| `user` (com cliente) | Painel, jornada, avaliações, evidências, tarefas, riscos, documentos, repositório, cadeia de fornecimento, relatórios. |
| `user` (sem cliente) | Apenas painel e definições pessoais. |

Regras aplicadas em três níveis:

1. **Frontend** — `src/components/layout/RouteGuard.jsx` (papel) + `LicensedRoute` (módulo na licença efetiva) + `Sidebar` (navegação filtrada).
2. **RLS** — regras por entidade em `base44/entities/*.jsonc`, quase sempre `customer_id == user.data.customer_id`.
3. **Funções** — validação explícita de papel, cliente e módulo antes de qualquer operação com *service role*.

---

## 4. Páginas e rotas

### Autenticação (públicas)
| Rota | Página |
|---|---|
| `/login` | Início de sessão (email, Google, Microsoft) |
| `/register` | Registo com verificação OTP |
| `/forgot-password` | Pedido de reposição |
| `/reset-password` | Nova palavra-passe por token |

### Visão geral
| Rota | Página | Descrição |
|---|---|---|
| `/` | Dashboard | Painel executivo: pontuações por framework, maturidade, exposição a risco, tarefas, atividade recente |
| `/customers` | Customers | Gestão de clientes (admin) |

### Avaliar e comprovar
| Rota | Página | Descrição |
|---|---|---|
| `/compliance-journey` | ComplianceJourney | Jornada de conformidade (RJC 2026, medidas mínimas, guias ISO) |
| `/assessments` | Assessments | Avaliações de maturidade por framework e período |
| `/assessments/:id` | AssessmentDetail | Preenchimento, resultados e recomendações da avaliação |
| `/evidence` | EvidenceOverview | Registo de evidências e lacunas de conformidade |
| `/legal-library` | LegalLibrary | Biblioteca legal: RJC, NIS2, DORA, ISO 27001/42001, TISAX, CIS |
| `/framework-guide` | FrameworkGuide | Guia normativo assistido por agente de IA |
| `/assets` | AssetsTools | Inventário de ativos e ferramentas (art. 32.º), CVEs |

### Melhorar e gerir
| Rota | Página | Descrição |
|---|---|---|
| `/action-plan` | ActionPlan | Plano de ação consolidado |
| `/recommendations` | Recommendations | Recomendações (IA) por avaliação |
| `/tasks` | Tasks | Tarefas: lista, quadro, calendário, comentários, anexos |
| `/task-analytics` | TaskAnalytics | Métricas de execução de tarefas |
| `/risk-assessment` | RiskAssessment | Riscos, matriz, histórico, tarefas de mitigação, risco residual |
| `/incidents` | IncidentManagement | Incidentes e plano de resposta |
| `/vulnerabilities` | VulnerabilityManagement | Vulnerabilidades e remediação |

### Governar
| Rota | Página | Descrição |
|---|---|---|
| `/security-documents` | SecurityDocuments | Documentos de segurança: versões, aprovação, nomeações |
| `/repository` | Repository | Repositório documental por cliente (indexação e triagem) |
| `/document-audit-trail` | DocumentAuditTrail | Trilho de auditoria documental |
| `/supply-chain` | SupplyChain | Questionários a fornecedores, respostas, avaliação |
| `/suppliers` | Suppliers | Registo de fornecedores e tiers |

### Analisar
| Rota | Página | Descrição |
|---|---|---|
| `/reports` | Reports | Relatórios, exportação PDF, relatório anual |
| `/email-report` | EmailReport | Reenvio/envio de relatórios por email |

### Administração
| Rota | Página | Descrição |
|---|---|---|
| `/backoffice` | BackofficeOverview | Visão geral de plataforma |
| `/backoffice/customers` | Customers | Clientes |
| `/backoffice/users` | UserManagementPanel | Utilizadores, papéis e convites |
| `/backoffice/frameworks` | FrameworksPanel | Frameworks e controlos |
| `/backoffice/licensing` | LicensingPanel | Catálogo, bundles, subscrições, certificados |
| `/backoffice/audit` | AuditLog | Auditoria |
| `/audit-log` | AuditLog | Auditoria (atalho) |
| `/question-bank` | QuestionBank | Banco de perguntas por framework |
| `/settings` | Settings | Definições: IA, email, armazenamento, licenças, manutenção, lembretes |

### Módulos de desenvolvimento (admin)
`/ropa` (Registo de atividades de tratamento), `/dsr` (Pedidos de titulares de dados), `/compliance-metrics`, `/training` (formação e formandos), `/vulnerabilities`, `/incidents`, `/framework-guide`.

Ecrã auxiliar: `OAuthConsent` (consentimento de ligações OAuth), fora do router principal.

---

## 5. Modelo de dados (54 entidades)

### Cliente e plataforma
`Customer` · `Component` · `InvitedUser` · `Notification` · `AuditLog` · `MaintenanceWindow` · `ReminderSettings` · `StorageSettings` · `StorageConnection` · `StoredFile` · `AiSettings` · `AiDraft`

### Frameworks, perguntas e avaliações
`Framework` · `FrameworkControl` · `Question` · `Assessment` · `AssessmentResponse` · `Recommendation` · `ComplianceChecklist`

### Riscos e tarefas
`RiskItem` · `RiskHistory` · `MitigationTask` · `Task` · `Comment`

### Documentos e evidências
`SecurityDocument` · `DocumentVersion` · `NominationDocument` · `DocumentIntake` · `Evidence`

### Ativos e vulnerabilidades
`Asset` · `AssetHistory` · `Vulnerability` · `CveWatch` · `CveAlert`

### Cadeia de fornecimento
`Supplier` · `SupplierQuestionnaire` · `SupplierQuestion`

### Proteção de dados (RGPD)
`DataProcessingActivity` (RoPA) · `DataSubjectRequest` (DSR) · `Incident`

### Formação
`Training` · `TrainingUser` · `TrainingEnrollment` · `TrainingReport`

### Licenciamento
`LicenseTier` · `LicenseModule` · `LicenseStandard` · `LicenseEntitlement` · `TenantSubscription` · `TenantModule` · `TenantStandard` · `LicenseCertificate` · `LicenseUsageRecord` · `LicenseChangeLog`

---

## 6. Funções backend (27)

| Função | Responsabilidade |
|---|---|
| `aiAssist` | Pedidos de IA da interface, com chave por ponto de chamada, quota, limite de ritmo e validação de ficheiros |
| `aiDraft` | Rascunhos de documentos com fontes oficiais |
| `aiQuestionnaire` | Geração de perguntas de questionários a fornecedores |
| `assets` | Inventário de ativos e ferramentas: importação, validação e exportação CNCS |
| `createNotifications` | Notificações in-app |
| `cveMonitor` | Vigilância de CVE por fabricante/ativo (NVD + CISA KEV) |
| `dataRetentionPurge` | Purga por prazos de conservação |
| `documentIntake` | Receção, extração e classificação de documentos |
| `documentNotifications` | Avisos de revisão e aprovação documental |
| `documentReviewReminders` | Lembretes de revisão documental (agendado) |
| `documents` | Gravação, aprovação com assinatura, versionamento e reposição |
| `evidence` | Evidências: carregamento e abertura com URL assinado |
| `files` | Repositório privado: carregar, abrir, listar, mover |
| `generateMonthlyAnnualReport` | Relatório mensal/anual em PDF |
| `getStorageProviders` | Estado das ligações Google Drive e OneDrive |
| `licensing` | Catálogo, subscrições, licenças efetivas e certificados Ed25519 |
| `listUsers` | Listagem de utilizadores com âmbito por cliente |
| `logUserLogin` | Registo de sessões em `AuditLog` |
| `manageUser` | Criação/edição de utilizadores, papéis, cliente e convites |
| `riskDueDateReminders` | Lembretes de datas-limite de riscos (agendado) |
| `riskNotifications` | Avisos de atribuição e mudança de estado de riscos |
| `searchDocuments` | Pesquisa em documentos com IA |
| `sendEmail` | Envio de email pelo remetente AnkoraOne, com destinatários autorizados e limite por hora |
| `storageConnection` | Configuração do repositório do cliente (Base44, Drive, OneDrive, WebDAV) |
| `storeFileToCloud` | Desativada (legado: criava partilhas públicas) |
| `taskNotifications` | Avisos de atribuição e mudança de estado de tarefas |
| `updateCustomerStorage` | Alteração do repositório atribuído a um cliente |

### Código partilhado (`base44/shared/`)
`http.ts` (auth, JSON, acesso a registos) · `audit.ts` · `mail.ts` (Resend/Base44) · `recipients.ts` (destinatários autorizados por nível de confiança) · `reminderSettings.ts` · `rateLimit.ts` · `llm.ts` · `aiTemplates.ts` · `license.ts` · `licenseCatalog.ts` · `storage.ts` · `storedFile.ts` · `fileCheck.ts` · `textExtract.ts` · `classify.ts` · `classifyCatalog.ts` · `legalPack.ts` · `questionnaire.ts` · `riskLevel.ts` · `evidenceMeta.ts` · `exposedAssets.ts` · `sanitizeHtml.ts` · `escapeHtml.ts` · `webdavXml.ts`

---

## 7. Workflows (9)

| Workflow | Disparo |
|---|---|
| Notify on Task Changes | Evento em `Task` |
| Notify on Risk Changes | Evento em `RiskItem` |
| Notify on Document Changes | Evento em `SecurityDocument` |
| Document Status Notifications | Evento documental |
| Risk Due Date Reminders | Agendado |
| Document Review Reminders | Agendado |
| CVE Monitor | Agendado |
| Data Retention Purge | Agendado |
| Monthly Annual Report Snapshot | Agendado (mensal) |

---

## 8. Integrações, armazenamento e email

**Armazenamento do repositório documental** — um repositório por cliente: Base44 (privado), Google Drive, OneDrive ou WebDAV. Ficheiros nunca públicos; abertura por URL assinado de curta duração, com registo de auditoria.

**Email** — remetente próprio da AnkoraOne via Resend (recurso: Base44 para convites e reposição de palavra-passe). Modelos do sistema: `UserInvite`, `AccessApproved`, `PasswordReset`, `EmailVerification`. Regras: destinatários validados contra os contactos registados do cliente; contactos externos (fornecedores, formandos) apenas para administradores; limite de envios por hora; HTML limpo para utilizadores de cliente, com rodapé a identificar o autor.

**IA** — `Claude (Anthropic)` ou LLM do Base44, com motor e pontos de chamada ativáveis em Definições → Aplicação. Acesso a ficheiros remotos filtrado (apenas HTTPS público) e limite de pedidos por utilizador.

**Vulnerabilidades** — NVD (limite anónimo) e catálogo CISA KEV.

**Segredos configurados** — `ANTHROPIC_API_KEY`, `AI_PROVIDER`, `RESEND_API_KEY`, `MAIL_PROVIDER`, `MAIL_FROM`, `MAIL_REPLY_TO`, `STORAGE_ENCRYPTION_KEY`, `LICENSE_SIGNING_KEY`, `AUTOMATION_SECRET`.

---

## 9. Segurança

- **Isolamento por cliente** em todas as entidades de negócio, com RLS por `customer_id` e por papel; escrita de campos sensíveis reservada a administradores.
- **Registos nunca confiados ao cliente**: as funções releem o registo por `id` com *service role* e verificam autorização antes de usar o conteúdo (tarefas, riscos, documentos).
- **Anti-relay de email**: destinatários só a partir de contactos registados do cliente; contactos externos exigem administrador; limite por hora; auditoria de todos os envios.
- **Auditoria** (`AuditLog`) de acessos, alterações, exportações, envios e purgas; o autor é sempre o utilizador autenticado.
- **Ficheiros** privados com URL assinado temporário; SSRF mitigado por validação de URL pública HTTPS.
- **Licenciamento** com licença efetiva validada no cliente e no servidor, e certificados assinados com Ed25519.
- **Dependências** — SheetJS 0.20.3 integrada localmente (`src/vendor/xlsx`) para eliminar a versão vulnerável do npm.

---

## 10. Testes e documentação de apoio

Vitest: 16 ficheiros, 164 testes (motores de risco, licenciamento, questionários, sanitização, formatação de datas, `RouteGuard`, ciclo de autenticação, repositório, templates legais, guias ISO, ativos, plano de incidentes).

Documentos existentes em `docs/`: `arquitetura.md`, `ia.md`, `repositorio-documental.md`, `email-dominio.md`, `dominio-proprio.md`, `deploy-base44.md`, `style/pt-pt.md`, `legal/`, `security/`, `modelos/`, `onboarding/`.

---

## 11. Publicação

Aplicação publicada em `app.ankoraone.com` (Cloudflare DNS). O repositório GitHub é sincronizado manualmente. Variáveis e segredos geridos nas Definições da app no Base44.
