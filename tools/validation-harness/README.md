# Harness de validação multi-identidade

Validação executável do RBAC, do âmbito por tenant e do licenciamento, contra o
backend do alvo em curso. Corre dentro do contentor:

```
docker compose -f docker-compose.base44.yml exec -T web node tools/validation-harness/run.mjs
# ou, da raiz do repo:
npm run validate:harness
```

Opções: `--suite=api` (funções de backend, uma identidade por caso), `--suite=ui`
(a camada de decisão do frontend, com o código real de `src/lib`) ou
`--suite=all` (por omissão); `--target=local|cloud` escolhe o alvo. Termina com
código não-zero se algum caso falhar — e com `2` quando não é possível começar.

## Alvo local (por omissão)

O backend é o `base44 dev`: funções em Deno e entidades numa base **em memória**,
que se perde a cada reinício. A identidade de cada caso não é criada na base de
dados — vai no cabeçalho `x-base44-dev-actor` e o backend só o honra com
`BASE44_DEV_IDENTITY=1`, variável que o `.base44/dev-entrypoint.sh` define apenas
neste alvo. O cliente pede a isenção de limitação de ritmo (`x-base44-rate-limit:
off`) porque corre centenas de chamadas do mesmo ator.

O `RLS1` continua a ser o único caso **não verificável** aqui: a RLS das entidades
é avaliada sobre a sessão autenticada (uma só) e um tenant que exista apenas em
`delegated_edit_customer_ids` fica oculto na leitura. Isso exige backend real.

## Alvo cloud (backend real)

**Só corre com o interruptor explícito `--target=cloud`** — escreve num backend
que persiste. Não há injecção de identidade: cada caso identifica-se com o token
da conta correspondente e a limitação de ritmo é a real (`write` 60/min,
`write_sensitive` 20/min **por ator**). Um `429` é limite atingido, não defeito: o
caso é reportado como não verificável, nunca como aprovação.

```
docker compose -f docker-compose.base44.yml exec -T web \
  node tools/validation-harness/run.mjs --target=cloud
```

Os tokens vivem num ficheiro **fora do repositório** (nunca em git, nunca em
chat). Por omissão `/run/base44/harness-tokens.json`, ou o caminho indicado em
`BASE44_HARNESS_TOKENS`:

```json
{
  "app_id": "<app id>",
  "accounts": {
    "master_admin":      { "email": "…", "token": "…" },
    "workspace_admin":   { "email": "…", "token": "…" },
    "customer_admin":    { "email": "…", "token": "…" },
    "grc_analyst":       { "email": "…", "token": "…" },
    "control_owner":     { "email": "…", "token": "…" },
    "executive":         { "email": "…", "token": "…" },
    "auditor":           { "email": "…", "token": "…" },
    "employee":          { "email": "…", "token": "…" },
    "consultant":        { "email": "…", "token": "…" }
  }
}
```

- `token` é o `base44_access_token` da sessão dessa conta no browser (o login de
  cada conta na aplicação).
- A chave é o **papel**; também se aceita a chave da identidade do harness
  (`workspace_admin_alfa`, `grc_analyst_alfa`, …) quando se quer uma conta
  distinta por identidade. As duas identidades de administrador de parceiro caem
  na mesma conta quando só existe a chave `workspace_admin` — e nesse caso os
  casos de carteira medem o âmbito dessa conta.
- O backend vem de `VITE_BASE44_APP_BASE_URL` (`/run/base44/app.env`); a
  alternativa é `base_url` no ficheiro.
- Alternativa por variáveis de ambiente (para credenciais entregues pela via
  segura, sem ficheiro): `BASE44_HARNESS_TOKEN_<PAPEL>` e, se o email for
  necessário, `BASE44_HARNESS_EMAIL_<PAPEL>`. O ficheiro tem precedência.

A população de dados é a mesma função do alvo local (`seedTestEnvironment`), mas
com a fronteira declarada: exige `validation_tenant` (um NIF do portefólio de
validação) e recusa tocar em qualquer cliente marcado que tenha NIF fora desse
prefixo. A limpeza é `{ action: "cleanup", confirm, validation_tenant }` — remove
o que o seed criou e não cria nada.

## Ordem de preparação (não alterar)

1. `seedLicenseData` — o catálogo de módulos, que `set_module` valida.
2. `seedTestEnvironment` — as condições declaradas (Delta sem subscrição, a
   carteira ligada ao workspace, avaliações concluídas).
3. O contexto comercial, logo a seguir: a reposição mínima de um contrato vivo no
   tenant de verificação.
