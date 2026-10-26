# Publicação no Base44

A app **Securematurity** no Base44 (id `6ab5373e7f8f586c80cb9ed8`) está ligada a este repositório. Por ser uma app importada do GitHub, o Base44 protege sempre o ramo principal e o botão **Publish** não está disponível.

## Frontend — automático

O workflow `.github/workflows/deploy-base44.yml` corre em cada alteração ao `main` (também pode ser lançado à mão em **Actions → Publicar no Base44 → Run workflow**). Faz o seguinte:

1. instala as dependências (`npm ci`);
2. compila a app (`npm run build`), com `VITE_BASE44_APP_ID` definido;
3. empacota a pasta `dist`;
4. envia-a para `POST https://app.base44.com/api/apps/{app_id}/deploy-dist`, que a publica.

Não corre quando só mudam `docs/`, `tools/` ou ficheiros `.md`.

Requer o segredo `BASE44_API_KEY` (token pessoal com acesso total, ou chave de workspace com a permissão `apps:deploy`).

Tudo o que entra no `main` é publicado logo para os utilizadores. Integre no `main` apenas por pull request revisto.

## Entidades, funções e agente — não são automáticos

O `deploy-dist` só substitui o site. Alterações em `base44/entities`, `base44/functions` ou `base44/agents` têm de ser aplicadas no Base44 de uma destas formas:

- **Fusão de um ramo na app:** criar um ramo no Base44 a partir do `main`, incluir os ficheiros alterados e fundi-lo. A fusão aplica as entidades e as funções ao ramo principal protegido.
- **CLI, no computador:** `npx base44 login`, `npx base44 link` (escolher Securematurity) e `npx base44 deploy -y`. Se o CLI recusar as entidades por o ramo principal estar protegido, use a fusão de ramo e depois `npx base44 functions deploy`.

## Depois de alterar dados de referência

Quando `src/data/legal/` muda, um administrador deve correr **Backoffice → Frameworks → Sincronizar com a Biblioteca Legal**.
