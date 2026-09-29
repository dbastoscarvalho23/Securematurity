# Base de conhecimento — plano de melhoria (Layer 1: repositório legal)

Documento de trabalho. Objetivo: transformar a base de conhecimento num **repositório
normativo versionado** da aplicação — a fonte de verdade legal de cada framework — antes de
acrescentar layers de conteúdo mais especializado.

---

## 1. Diagnóstico do estado atual (lido do código)

| Peça | O que existe hoje | Limitação face ao pedido |
|---|---|---|
| `KnowledgeArticle` | Artigos persistidos com `slug`, `section` (`platform`/`compliance`), `status` (draft→in_review→published→archived), `version`, `published_at`, workflow editorial em `base44/shared/contentUtils.ts` + `transitionArticleStatus` | É **prosa editorial**, não repositório. A informação legal está diluída no `body` de artigos como `cp-nis2-overview` |
| `base44/functions/seedKnowledgeBase` | 20 artigos (8 `platform`, 12 `compliance`), idempotente por `slug` | Sem metadados legais estruturados, sem fonte oficial, sem versão normativa |
| `Framework` | `code`, `name`, `version` (texto), `description`, `status`, `reference_url`, `document_url`, `document_name` | **Um** documento por framework, sem histórico nem versionamento; sem entidade competente, missão, áreas, obrigações, coimas |
| `kbFrameworks.js` / `frameworkConstants.js` / `frameworkSeed.js` | Três listas de frameworks parcialmente divergentes: 5 em `KB_FRAMEWORKS` (falta QNRC, ENISA), 7 em `FRAMEWORK_NAMES`, 6 em `DEFAULT_FRAMEWORKS` | Não há catálogo único de frameworks |
| `LicenseStandard` | `code`, `name`, `description`, `is_active` | Catálogo comercial, não normativo |
| `FrameworkControl`, `Question` | Conteúdo de avaliação (controlos e perguntas) | Não ligados a um documento legal concreto |
| `/knowledge-base` | Catálogo + detalhe `:slug` + aba editorial | Só o layer editorial; não há vista de repositório legal |

**Conclusão:** falta a camada de *fundação* — o documento legal, a sua versão e a ficha
caracterizadora do framework. Sem ela, os layers seguintes ficam a apoiar-se em prosa.

---

## 2. Princípio estruturante

A KB passa a ser **por layers**, com o layer 1 como raiz de que os restantes dependem:

```
Layer 1  REPOSITÓRIO LEGAL ......... documentos oficiais versionados + ficha "at a glance"   ← este plano
Layer 2  REQUISITOS ................ controlos/perguntas mapeados ao artigo do documento
Layer 3  GUIAS DE IMPLEMENTAÇÃO ..... boas práticas, mapeamentos cruzados, templates
Layer 4  CONTEÚDO EDITORIAL ......... KnowledgeArticle (já existe)
Layer 5  APOIO ...................... FAQ, formação, agente de IA (já existe)
```

Regra de dependência: **nada no layer 2+ cita uma norma sem apontar para a versão do layer 1**
(`framework_code` + `version_id`). É isso que torna o histórico auditável.

---

## 3. Modelo de dados proposto (Layer 1)

Três entidades novas, uma extensão e uma ligação.

### 3.1 `LegalDocumentVersion` — o documento oficial, versionado (entidade nova)

Uma linha por **edição** de um documento; nunca se edita, acrescenta-se.

| Campo | Notas |
|---|---|
| `framework_code` | NIS2, GDPR, ISO27001, NIST_CSF, CIS_V8, QNRC, ENISA |
| `version_label` | `DL 125/2025`, `2022 (rev. 2024)`, `v8.0` |
| `version_type` | `original` \| `transposicao` \| `consolidada` \| `emenda` \| `norma_tecnica` |
| `status` | `current` \| `superseded` \| `draft` \| `withdrawn` |
| `supersedes_id` | liga à versão anterior (cadeia de substituição) |
| `effective_from` / `effective_to` | vigência (permite datas futuras) |
| `document_title`, `legal_reference` | ex. «Decreto-Lei n.º 125/2025», «Diretiva (UE) 2022/2555» |
| `issuing_authority` | entidade emissora (liga a `CompetentAuthority`) |
| `official_url` | **link na plataforma da entidade competente** (ELI/Diário da República, EUR-Lex CELEX, ISO, NIST, CIS, CNCS) |
| `mirror_url` / `attachment` | cópia arquivada (só quando a licença o permitir — ver §7) |
| `language`, `page_count`, `content_hash` | SHA-256 da cópia arquivada, reutilizando `src/lib/fileHash.js` |
| `verified_at` / `verified_by` | última verificação do link e da versão oficial |
| `review_due_at`, `change_note` | ciclo de revisão e nota do que mudou |

### 3.2 `FrameworkProfile` — a ficha «at a glance» (entidade nova)

Uma linha por framework, ligada ao catálogo:

| Campo | Conteúdo |
|---|---|
| `framework_code`, `display_name`, `acronym` | identificação |
| `competent_authority_code(s)` | entidade competente / supervisor / auditor (→ `CompetentAuthority`) |
| `mission` | para que existe a norma, numa frase |
| `scope_areas[]` | áreas de incidência (ex. governança, gestão de risco, continuidade, cadeia de abastecimento) |
| `objectives[]` | objetivos declarados |
| `applicability` | quem está abrangido (setores, limiares de dimensão, exceções) |
| `obligations[]` | obrigações nucleares, com prazo quando aplicável (ex. 24 h / 72 h / 1 mês) |
| `penalties` | regime sancionatório, incluindo coimas máximas e responsabilidade da direção |
| `certifiability` | certificável / atestável / autorregulação, e por quem (IPAC, auditor acreditado, CNCS) |
| `related_frameworks[]`, `references[]` | mapeamentos e bibliografia |
| `review_cycle_months`, `verified_at`, `verified_by` | governação da própria ficha |

### 3.3 `CompetentAuthority` — entidade competente (entidade nova)

`code`, `name`, `country` (`PT`/`EU`/`INT`), `role` (`regulador` | `supervisor` | `auditor` |
`organismo_normalizador` | `acreditacao`), `website_url`, `legal_basis`, `contact`,
`enforcement_register_url` (registo público de sanções), `frameworks[]`, `notes`.

Serve os dois usos ao mesmo tempo: alimenta a ficha «at a glance» e é a origem dos links.

### 3.4 `Framework` (extensão, sem rutura)

Manter os campos atuais para não quebrar `FrameworkGuide`/agente/`Question`. Acrescentar
`profile_id` e `catalogue_key`, e passar `reference_url`/`document_url` a ser **derivados**
da versão `current` do repositório.

### 3.5 Ligação com o layer editorial

`KnowledgeArticle` ganha `legal_refs[]` (`{ framework_code, version_id, document_id }`), para
que um artigo «NIS2 — reporte de incidentes» mostre a que artigo do diploma se refere.

### 3.6 Catálogo único de frameworks

Hoje há três listas divergentes. Consolidar num só par de ficheiros espelhados, no padrão já
usado para licenciamento (`base44/shared/licenseGuard.ts` ↔ `src/lib/licenseModules.js`):
`base44/shared/frameworkCatalogue.ts` (backend/seed) e `src/lib/frameworkCatalogue.js`
(frontend). `kbFrameworks.js`, `frameworkConstants.js` e `frameworkSeed.js` passam a ler dele.

---

## 4. Escrita, versionamento e governação

- **Escrita só por função backend** (padrão da casa: o cliente nunca escreve entidades
  diretamente). Nova função `manageLegalRepository` com *selector* `action`:
  `upsert_profile` · `add_version` · `supersede_version` · `verify` · `withdraw` · `archive`.
- **Imutabilidade:** `add_version` cria sempre uma linha nova; a anterior passa a
  `superseded` com `effective_to` preenchido. Nenhum caminho atualiza o texto de uma versão
  publicada — só metadados de verificação (`verified_at`, `verified_by`, `review_due_at`).
- **Auditoria:** cada ação grava `AuditLog` com o ator real (mesmo padrão de
  `transitionArticleStatus`).
- **RLS:** leitura para todos os autenticados; escrita `master_admin` (com `grc_analyst` como
  revisor de conteúdo, alinhado com `CONTENT_ROLES` em `contentUtils.ts`).
- **Frescura:** aviso quando `review_due_at` expira ou quando `verified_at` passa o ciclo —
  a ficha mostra sempre «verificado em …».

---

## 5. Interface (`/knowledge-base`)

Mantém-se a rota e a identidade visual (`.kb-scope`); muda a arquitetura da informação:

1. **Landing com dois modos**, conforme o papel:
   - **Repositório legal** (Layer 1, novo, por omissão): grelha de frameworks.
   - **Artigos** (Layer 4, o catálogo atual com abas Catálogo/Editorial).
2. **Cartão de framework**: nome, entidade competente, versão em vigor, data da última
   verificação e aviso quando a revisão está vencida.
3. **Ficha de framework** `/knowledge-base/framework/:code`:
   - bloco **«Em resumo»** com os campos da §3.2 em leitura rápida;
   - **painel de versões** — linha temporal (atual / substituídas / futuras), com link
     oficial, tipo, vigência e nota de alteração;
   - **entidade competente** com ligação ao sítio oficial e ao registo de sanções;
   - **conteúdo relacionado** — artigos editoriais e controlos do layer 2 deste framework.
4. **Modo de edição** (papel de conteúdo): formulário da ficha + formulário de nova versão,
   com pré-visualização da linha temporal.

Conformidade com as regras da casa: o título da página continua a ser o único `h1` (vem do
`TopBar` via `PAGE_TITLE_KEYS`); cores novas entram por `src/lib/palette.js` (nada literal);
strings novas passam por chaves de tradução (`translations-*.js`, PT + EN); rota nova exige
entrada coerente em `PAGE_TITLE_KEYS`, `rbac.js` e `sidebarGroups.js`.

---

## 6. Seed inicial e fontes oficiais

Nova função idempotente `seedLegalRepository` (por `framework_code` + `version_label`),
complementar ao `seedKnowledgeBase` existente. Âmbito proposto:

| Framework | Entidade competente | Fontes oficiais |
|---|---|---|
| NIS2 / DL 125/2025 (RJCS) | CNCS | Diário da República (ELI), EUR-Lex (Diretiva 2022/2555) |
| RGPD / Lei 58/2019 | CNPD | EUR-Lex (Regulamento 2016/679), DRE |
| ISO/IEC 27001:2022 | ISO/IEC · auditor acreditado (IPAC) | iso.org (norma paga) |
| NIST CSF 2.0 | NIST | nist.gov (público) |
| CIS Controls v8 | Center for Internet Security | cisecurity.org (público) |
| QNRC | CNCS | cncs.gov.pt (público) |
| ENISA | ENISA | enisa.europa.eu (público) |

Cada entrada traz a ficha «at a glance» + pelo menos a versão em vigor, com as anteriores
quando existirem.

---

## 7. Decisões a confirmar antes de implementar

1. **Direitos de autor.** ISO/IEC 27001 e CIS Controls **não são de reprodução livre** — o
   repositório guarda *metadados + link oficial*, nunca o texto integral. NIS2/RGPD/NIST/
   QNRC/ENISA são públicos e podem ser arquivados com hash.
2. **Estabilidade dos links.** Os URLs oficiais mudam (reorganizações de sítios), por isso
   `verified_at`/`verified_by` e verificação periódica fazem parte do modelo, não são extra.
3. **Idioma.** Ficha «at a glance» bilingue PT/EN ou só PT?
4. **Âmbito de frameworks.** Só os 5 já usados nos artigos, ou os 7 do catálogo
   (`frameworkConstants.js` inclui QNRC e ENISA)?

---

## 8. Fases propostas

| Fase | Entrega | Critério de aceitação |
|---|---|---|
| **P0** | Catálogo único de frameworks + `CompetentAuthority` + `FrameworkProfile` (entidades e seed) | Ficha existe para os frameworks do âmbito e é legível na app |
| **P1** | `LegalDocumentVersion` + `manageLegalRepository` (versões, imutabilidade, auditoria) | Nova versão substitui a anterior e a linha temporal reflete o histórico |
| **P2** | Interface: landing de repositório + ficha de framework + painel de versões | Percorrer framework → versão → link oficial sem sair da KB |
| **P3** | Ligação `KnowledgeArticle.legal_refs[]` e blocos «conteúdo relacionado» | Artigo editorial mostra a versão normativa a que se refere |
| **P4** | Frescura: alertas de revisão vencida + verificação periódica | Ficha com revisão vencida sinaliza o estado |

Layers 2–5 ficam fora deste plano; serão especificados quando o Layer 1 estiver consolidado.
