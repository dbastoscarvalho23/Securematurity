# Modelos de registo para auditoria

Registos que comprovam como a plataforma é alterada, quem acede aos dados dos clientes, onde ficam as credenciais
técnicas, o que se decide e como se migram os dados. Complementam o que a própria app regista (trilha de auditoria
encadeada, aprovações em Definições › Acessos) e o que fica no GitHub (PR, testes obrigatórios no ramo `main`).

| Código | Modelo | Quando se preenche |
|---|---|---|
| AO-REG-01 | `AO-REG-01-Registo-de-alteracao-e-publicacao.docx` | Em cada publicação em produção |
| AO-REG-02 | `AO-REG-02-Autorizacao-de-acesso-delegado.docx` | Quando um cliente autoriza um consultor ou auditor; na revogação |
| AO-REG-03 | `AO-REG-03-Registo-de-credencial-tecnica.docx` | Na entrega, rotação ou revogação de uma chave de API, conta de alojamento ou acesso a consola |
| AO-REG-04 | `AO-REG-04-Ata-e-registo-de-decisoes.docx` | Nas reuniões de decisão (direção, Victor, clientes-piloto) |
| AO-REG-05 | `AO-REG-05-Registo-de-ensaio-e-migracao-de-dados.docx` | Em cada ensaio de migração e na migração definitiva de cada cliente |

Regras:

- os registos preenchidos guardam-se fora do repositório (podem ter dados de clientes);
- o AO-REG-03 nunca contém o valor de uma credencial, só onde está guardada e quem lhe pode aceder;
- a numeração é `<código>-AAAA-NNN`, sequencial por ano; as decisões das atas são `D-AAAA-NNN`.

## Regenerar

```bash
cd docs/governanca/modelos/fonte
node modelos.js   # → docs/governanca/modelos/*.docx
```

Cores e tipografia seguem a app e os documentos de onboarding: azul-escuro `#070A13`, dourado `#CFA04A`,
verde-azulado `#26A699`, Calibri. A marca de água (`fonte/marca-agua.png`) é o símbolo A1 do logótipo, a 9 % de
opacidade.
