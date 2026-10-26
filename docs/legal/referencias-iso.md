# Fontes de referência ISO/IEC 27001 e 42001

Registo gerado por `tools/legal/build_iso_refs_doc.py` a partir de `src/data/legal/iso-references.json` (2026-10-26). Não editar à mão.

Estes documentos foram fornecidos para conferir os guias ISO da Biblioteca Legal. **Nenhum está alojado** neste repositório nem na aplicação: as normas e os guias de terceiros são protegidos por direitos de autor. Ficam registados o título, o autor, a versão da norma que tratam, a impressão digital (SHA-256) do ficheiro recebido e o que se encontrou em cada um.

## Resultado

- **ISO/IEC 27001:2022**: cláusulas 4 a 10 e os 93 controlos do Anexo A conferidos com o texto oficial (EN ISO/IEC 27001:2023). Numeração completa, sem falhas nem excedentes. Corrigido o título de A.8.34; acrescentada a nota das alterações climáticas em 4.2 (emenda 1:2024); assinalada a informação documentada obrigatória.
- **ISO/IEC 42001:2023**: guia novo (`src/data/legal/iso42001.json`), com cláusulas 4 a 10 (incluindo a avaliação de impacto em 6.1.4 e 8.4), os 38 controlos do Anexo A (A.2 a A.10) e o Anexo C, conferidos com o texto oficial. Ligações à 27001 para um sistema integrado; 5 controlos não têm equivalente na 27001.
- **Guias de terceiros**: dois têm erros factuais face aos textos oficiais (integração 42001/27001 e guia DORA); nove tratam edições já substituídas da 27001 (2005 ou 2013); um ficheiro com o nome «ISO42001» é um artigo académico e não a norma.
- **Práticas incorporadas na aplicação**: Declaração de Aplicabilidade com método de implementação; análise de lacunas com sistema de gestão e controlos em separado; filtro de informação documentada obrigatória; uma Declaração de Aplicabilidade por norma num sistema integrado.

## Documentos

### BS ISO/IEC 42001:2023 — Information technology — Artificial intelligence — Management system

- **Autor ou editor:** BSI (texto ISO/IEC) (2023)
- **Tipo:** Texto oficial da norma · **Trata:** ISO/IEC 42001:2023, 1.ª edição (2023-12)
- **Avaliação:** Texto oficial
- **Ficheiro recebido:** `ISO-42001.pdf` · SHA-256 `d50103cc0af6d2322c60753ab4a6d9cc54594bc78163481322bf80ee2f75a896` · não alojado
- Estrutura conferida: cláusulas 4 a 10 (com 6.1.4 e 8.4, avaliação de impacto), 38 controlos do Anexo A em 9 domínios (A.2 a A.10) e Anexo C (11 objetivos, 7 fontes de risco).
- O Anexo B (orientação de implementação) é normativo.
- Digitalização sem texto pesquisável, com marca de água de formação.
- Documento protegido por direitos de autor: não alojado. A entidade deve adquirir a norma para uso próprio.
- **Uso na plataforma:** Base do guia ISO/IEC 42001 (estrutura e numeração).

### NF EN ISO/IEC 27001 (julho de 2023) — Sécurité de l'information, cybersécurité et protection de la vie privée

- **Autor ou editor:** AFNOR (texto ISO/IEC) (2023)
- **Tipo:** Texto oficial da norma · **Trata:** ISO/IEC 27001:2022 (EN ISO/IEC 27001:2023), em francês
- **Avaliação:** Texto oficial
- **Ficheiro recebido:** `iso27001.pdf` · SHA-256 `d5c59188c44a5a494fc6d5f61079adcd29f807f67fba376b7fadbaed841a79f1` · não alojado
- Cláusulas 4 a 10 e os 93 controlos do Anexo A conferidos com o guia AnkoraOne: numeração completa, sem falhas nem excedentes.
- Não inclui a emenda 1:2024 (alterações climáticas), publicada depois.
- Título do guia corrigido em A.8.34: o controlo trata da proteção dos sistemas durante testes de auditoria.
- Documento protegido por direitos de autor, com proibição expressa de reprodução e difusão: não alojado.
- **Uso na plataforma:** Validação da estrutura e da numeração da ISO/IEC 27001.

### ISO/IEC 27001 Implementation Guide (Toolkit versão 12)

- **Autor ou editor:** CertiKit (s.d.)
- **Tipo:** Guia · **Trata:** ISO/IEC 27001:2022
- **Avaliação:** Atual
- **Ficheiro recebido:** `IS0-IEC-27001-Implementation-Guide.pdf` · SHA-256 `de18e3c0132f129d888bbcf588bc1fdd2eee2be3ffe0b8a98926d9804fa5bcef` · não alojado
- Refere a edição de 2022 e os controlos novos (informação sobre ameaças, serviços de nuvem, ocultação de dados, filtragem web, programação segura).
- Sem divergências com a estrutura do guia AnkoraOne.
- **Uso na plataforma:** Confirmação da estrutura e da sequência de implementação.

### ISO27001 Checklist

- **Autor ou editor:** Wojciech Ciemski (2023)
- **Tipo:** Lista de verificação · **Trata:** ISO/IEC 27001:2022
- **Avaliação:** Atual
- **Ficheiro recebido:** `ISO27001-Checklist.pdf` · SHA-256 `956761caca93f9ed879e91af39628b8265003373dfc79d9ce40fa20c6e1c803a` · não alojado
- Perguntas por controlo com três estados (implementado, parcialmente implementado, não iniciado), equivalentes aos estados da plataforma.
- **Uso na plataforma:** Confirmação dos estados de acompanhamento.

### Template ISO 42001 — Statement of Applicability

- **Autor ou editor:** CSDmed (2024)
- **Tipo:** Modelo · **Trata:** ISO/IEC 42001:2023, Anexo A
- **Avaliação:** Atual
- **Ficheiro recebido:** `Template-ISO42001-Statement-of-Applicability-00.xlsx` · SHA-256 `71b5bfc20ebfbcd9543c8cbb132f55ad12022dc8b394635dd6f732a63484d849` · não alojado
- Colunas: controlo, tema, aplicável (A ou N/A), justificação, método de implementação e estado (não implementado, em curso, contínuo, concluído).
- Reproduz o texto dos controlos da norma; esse texto não foi copiado para a plataforma.
- **Uso na plataforma:** Campos da Declaração de Aplicabilidade: acrescentado o método de implementação.

### ISO 42001 Guide / Checklist

- **Autor ou editor:** Rhymetec (2024)
- **Tipo:** Guia · **Trata:** ISO/IEC 42001:2023
- **Avaliação:** Atual, com reservas
- **Ficheiro recebido:** `ISO-42001-Guide-Checklist.pdf` · SHA-256 `83f97623e1cecc65db1722d789391d27a08b0983731cc0ba70197522875aec77` · não alojado
- Descreve fases de implementação e certificação; não lista nem descreve controlos.
- Apresenta a recertificação a cada 3 anos como exigência da ISO/IEC 42001: o ciclo de certificação resulta das regras de acreditação, não da norma.
- **Uso na plataforma:** Contexto do processo de certificação.

### Secure Controls Framework (SCF) 2025.2.2

- **Autor ou editor:** SCF Council (2025)
- **Tipo:** Matriz de correspondências · **Trata:** Correspondências com ISO/IEC 27001 (2013 e 2022), 27002, 42001, NIS2, DORA e AI Act
- **Avaliação:** Uso limitado
- **Ficheiro recebido:** `secure-controls-framework-scf-2025-2-2.xlsx` · SHA-256 `7103270fa223e1ca2d31056fba1e073369a3655dc025aeb78e7e08d7b97680a2` · não alojado
- A coluna da ISO/IEC 27001:2022 mistura cláusulas e controlos do Anexo A com a mesma numeração (por exemplo 5.1), por isso não serve para ligar controlo a controlo.
- Confirma as correspondências ao nível das cláusulas (estrutura harmonizada).
- Conteúdo sob a licença do SCF: não redistribuído.
- **Uso na plataforma:** Confirmação das correspondências entre cláusulas da 42001 e da 27001.

### A Guide to DORA Compliance and Third-Party Risk Management

- **Autor ou editor:** Panorays (2024)
- **Tipo:** Guia · **Trata:** DORA — Regulamento (UE) 2022/2554
- **Avaliação:** Erros detetados
- **Ficheiro recebido:** `2024-DORA-Guide.pdf` · SHA-256 `82f012fd7117fb2b92d365cac1fe1c3df7d95895c42a44c085867caa86026d8c` · não alojado
- Descreve o DORA como focado na proteção de dados e na privacidade: o DORA trata da resiliência operacional digital do setor financeiro; a proteção de dados é o RGPD.
- Data de aplicação (17 de janeiro de 2025) correta.
- Não é fonte oficial: a Biblioteca Legal já tem o texto oficial do DORA e das normas técnicas.
- **Uso na plataforma:** Não usado.

### ISO 42001 and ISO 27001 Integration — Running One System, Not Two (SCC-PG-025)

- **Autor ou editor:** Synergy Compliance Consulting (s.d.)
- **Tipo:** Guia · **Trata:** ISO/IEC 42001:2023 e ISO/IEC 27001:2022
- **Avaliação:** Erros detetados
- **Ficheiro recebido:** `ISO-42001-and-ISO-27001integration.pdf` · SHA-256 `1a72f9bedd6a7823ab76435595ed77a458eb65df84c8a817b6c8aad587186da0` · não alojado
- Afirma que o Anexo B da ISO/IEC 42001 não é normativo: no texto oficial é normativo.
- Associa «data resources» ao controlo A.4.6; no texto oficial é o A.4.3 (o A.4.6 trata dos recursos humanos).
- Correto: estrutura harmonizada comum, avaliação de impacto (6.1.4) sem equivalente na 27001, 93 contra 38 controlos e uma Declaração de Aplicabilidade por norma.
- **Uso na plataforma:** Prática de sistema integrado: ligações 42001 → 27001, auditoria e revisão pela gestão únicas, Declarações de Aplicabilidade separadas.

### Checking List — Security according to ISO 27001

- **Autor ou editor:** Tower Semiconductor (2010)
- **Tipo:** Lista de verificação · **Trata:** ISO/IEC 27001:2005
- **Avaliação:** Desatualizado
- **Ficheiro recebido:** `ISO27001.pdf` · SHA-256 `b97da8c15e5671fa0b1f3781371d7c9ef6ef5c0b9423e3bf8d643d54f7de83e2` · não alojado
- Edição de 2005, substituída em 2013 e em 2022.
- **Uso na plataforma:** Não usado.

### Cyber Resilience — Cyber security and business resilience

- **Autor ou editor:** IT Governance (2015)
- **Tipo:** Guia · **Trata:** ISO/IEC 27001:2013 e 22301
- **Avaliação:** Desatualizado
- **Ficheiro recebido:** `Cyber-Resilience.pdf` · SHA-256 `791eebc335d9293be8b67ecf4a6379a936313588b0af8ca16d0db5f0e3050d04` · não alojado
- Texto de enquadramento de 2015 que refere a edição de 2013.
- **Uso na plataforma:** Não usado.

### ISO 27001 Gap Analysis — Sample client report

- **Autor ou editor:** IT Governance (2020)
- **Tipo:** Relatório de exemplo · **Trata:** ISO/IEC 27001:2013
- **Avaliação:** Desatualizado
- **Ficheiro recebido:** `ISO27001-gap-analysis-sample-report-Mar-20.pdf` · SHA-256 `694f35aa2aba3da9b71c4d462a32c032adbcda6fabb234a2e39747b407e8b539` · não alojado
- Edição de 2013 (114 controlos).
- Método: sistema de gestão e controlos avaliados em separado, cada requisito conforme, parcialmente conforme, não conforme ou não necessário — prática retomada na análise de lacunas.
- **Uso na plataforma:** Método da análise de lacunas.

### ISO27001 Audit Questionnaire

- **Autor ou editor:** Paladion Networks (s.d.)
- **Tipo:** Lista de verificação · **Trata:** ISO/IEC 27001:2013 (A.5 a A.18)
- **Avaliação:** Desatualizado
- **Ficheiro recebido:** `ISO27001-Checklist.pdf` · SHA-256 `f7814a3e9d86464a72ebcb956408145b87fce358d3daa286cac607fddb3e11be` · não alojado
- Estrutura da edição de 2013 (114 controlos); não corresponde à edição de 2022.
- Documento marcado para uso interno do autor.
- **Uso na plataforma:** Não usado.

### ISO27001 Risk Assessment (questionário)

- **Autor ou editor:** Autor não identificado (2021)
- **Tipo:** Lista de verificação · **Trata:** ISO/IEC 27001:2013 (A.5 a A.18)
- **Avaliação:** Desatualizado
- **Ficheiro recebido:** `ISO27001-Risk-Assessment.pdf` · SHA-256 `203e0a3ba9c904222779a4907df52c51bea41d690a753cbc75fd991bba469ef2` · não alojado
- Estrutura da edição de 2013.
- Respostas sim/não com observações; não segue um método de avaliação de riscos da cláusula 6.1.2.
- **Uso na plataforma:** Não usado.

### ISO27001:2013 Compliance Status Assessment Toolkit

- **Autor ou editor:** Halkyn Consulting (2014)
- **Tipo:** Lista de verificação · **Trata:** ISO/IEC 27001:2013
- **Avaliação:** Desatualizado
- **Ficheiro recebido:** `ISO27001-2013-ComplianceChecklist.pdf` · SHA-256 `a6b5d56a867e0de8db56dda9f3e4dfd3570fa5e17b78330155aba023d2c4f17b` · não alojado
- Edição de 2013 (114 controlos).
- Percentagem de conformidade por secção: prática retomada na análise de lacunas.
- **Uso na plataforma:** Prática de resumo por secção.

### ISO27001:2013 Compliance Status Assessment Toolkit (folha de cálculo)

- **Autor ou editor:** Halkyn Consulting (2014)
- **Tipo:** Lista de verificação · **Trata:** ISO/IEC 27001:2013
- **Avaliação:** Desatualizado
- **Ficheiro recebido:** `ISO27001-2013-ComplianceChecklist.xls` · SHA-256 `0099dba3a9f2dcccb1ff0cb4b44196d3ea198f1f8b44d26be61fc10d081c8083` · não alojado
- Mesmo conteúdo do PDF da Halkyn Consulting.
- **Uso na plataforma:** Ver o PDF correspondente.

### Introduction to ISO27001: Scope, Implementation & Application

- **Autor ou editor:** Autor não identificado (2017)
- **Tipo:** Guia · **Trata:** ISO 27001 (genérico)
- **Avaliação:** Desatualizado
- **Ficheiro recebido:** `ISO27001.pdf` · SHA-256 `20d8b6324f384b1443c4f0dd0beb45ec2eaf74b2015f44a60998f65b42e8a074` · não alojado
- Introdução genérica anterior à edição de 2022.
- **Uso na plataforma:** Não usado.

### List of ISO27001 Templates

- **Autor ou editor:** iso27001templates.com (2014)
- **Tipo:** Modelo · **Trata:** ISO/IEC 27001:2013
- **Avaliação:** Desatualizado
- **Ficheiro recebido:** `List-of-ISO27001-Templates-Iso27001templates.pdf` · SHA-256 `d353b1a1f576f0aebe034df73be99b3ef3e9d79f90292c78fe381188efdf5375` · não alojado
- Lista comercial de modelos para a edição de 2013.
- **Uso na plataforma:** Não usado (a lista de informação documentada segue a edição de 2022).

### Model Reporting for Certifiable AI: A Proposal from Merging EU Regulation into AI Development (arXiv:2307.11525)

- **Autor ou editor:** Brajovic et al., Fraunhofer IPA (2023)
- **Tipo:** Artigo · **Trata:** Relatórios de modelos de IA e proposta de AI Act
- **Avaliação:** Fora de âmbito
- **Ficheiro recebido:** `ISO42001.pdf` · SHA-256 `da57ed64aade46101ac877635e75278dd60adc56c0c53ed22e0a09b38c85e8cb` · não alojado
- Não é a norma ISO/IEC 42001, apesar do nome do ficheiro.
- Refere a proposta do AI Act de 2023 (por exemplo art. 28.º-B), não o texto final (Regulamento (UE) 2024/1689).
- **Uso na plataforma:** Não usado.

### The Emerging Role of ISO 42001 Certification in Fostering the Deployment of Responsible Generative AI Healthcare Solutions

- **Autor ou editor:** Thiers e Harned (converGen AI, Stanford AIMI) (2024)
- **Tipo:** Artigo · **Trata:** ISO/IEC 42001:2023 aplicada à saúde
- **Avaliação:** Fora de âmbito
- **Ficheiro recebido:** `ISO-42001-Certification-of-Healthcare-AI-Management-Systems.pdf` · SHA-256 `283e6b8e206d75a3c7320d6a1144777a480126f0d1fd84d7775402f76c79acd5` · não alojado
- Artigo de opinião sobre a certificação na saúde; não acrescenta requisitos.
- **Uso na plataforma:** Não usado.
