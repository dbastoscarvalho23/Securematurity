# Backoffice — Arquitectura e Padrões

Área admin-only (`/backoffice`) construída como shell com sub-navegação e painéis modulares.
Este README documenta a estrutura dos módulos, a lógica de permissões do `manageUser` e o
passo-a-passo para acrescentar novos painéis seguindo o padrão actual.

## 1. Estrutura dos módulos

```
src/
├── pages/backoffice/
│   ├── README.md                    ← este ficheiro
│   ├── BackofficeLayout.jsx         ← shell admin-only + sub-navegação (TABS) + <Outlet />
│   └── BackofficeOverview.jsx       ← Visão geral: KPIs + gráficos + drill-downs paginados
└── components/backoffice/
    ├── UserManagementPanel.jsx      ← gestão de utilizadores (convite, edição, eliminação)
    └── FrameworksPanel.jsx          ← Biblioteca Legal + frameworks de conformidade
```

### Rotas (App.jsx)

Todas as rotas do backoffice estão dentro de `<BackofficeLayout />` e protegidas por
`RouteGuard` (acesso admin-only, espelhado na configuração da Sidebar):

```jsx
<Route path="/backoffice" element={<RouteGuard path="/backoffice"><BackofficeLayout /></RouteGuard>}>
  <Route index element={<BackofficeOverview />} />
  <Route path="customers" element={...} />
  <Route path="users" element={<UserManagementPanel />} />
  <Route path="frameworks" element={<FrameworksPanel />} />
  <Route path="audit" element={...} />
</Route>
```

- `/admin` existe apenas como redirecção para `/backoffice` (compatibilidade de links antigos).
- `BackofficeLayout` revalida a role a renderizar (`user?.role !== 'admin'` → `EmptyState`),
  além da proteção do `RouteGuard` — defesa em profundidade.

### Convenções partilhadas

- **Autenticação/idioma**: `useAuth()` (role do utilizador) e `useLanguage()` (`t(key)`).
  Todos os textos passam por chaves de tradução em `src/lib/translations.js` (UI/backoffice)
  e nos ficheiros de domínio `src/lib/translations-*.js`.
- **UI**: primitivas shadcn (`Card`, `Table`, `Dialog`, `Select`, `Button`, …), componentes
  partilhados (`PageHeader`, `StatCard`, `StatusBadge`, `EmptyState`), ícones `lucide-react`.
- **Dados**: `@tanstack/react-query` (`useQuery` para leitura; chaves `queryKey` incluem a página/filtro).

## 2. Lógica de permissões do `manageUser`

`base44/functions/manageUser/entry.ts` é o **único ponto de mutação** da entidade `User`
(`update`/`delete`). Chamadas directas ao SDK (`base44.entities.User.update/delete`) são
proibidas no frontend — a RLS da plataforma nega-as e o controlo de papéis vive aqui.

### Contrato

```js
// Atualização
const res = await base44.functions.invoke('manageUser', { action: 'update', userId, data });
// data aceita: full_name, customer_id, customer_name, display_name (whitelist) e role (admin only)

// Eliminação
const res = await base44.functions.invoke('manageUser', { action: 'delete', userId });
```

Respostas: `{ success: true, roleError? }`, ou `{ error }` com 400/403/404/500.

### Matriz de permissões

| Verificação (por ordem) | `admin` | `customer_admin` |
|---|---|---|
| Autenticação (`auth.me`) + role | obrigatória: falha com **403** se não for `admin` nem `customer_admin` | idem |
| Alvo existe (`asServiceRole.User.get`) | **404** se não existir | idem |
| Alvo no próprio tenant (`customer_id`) | sem restrição | **403** se `targetUser.customer_id !== currentUser.customer_id` |
| Eliminação | qualquer conta | **403** a menos que `targetUser.role === 'user'` |
| Campos de perfil (`ALLOWED_UPDATE_FIELDS`: `customer_id`, `customer_name`, `display_name`) + `full_name` → `display_name` | sim | sim (unicamente estes campos) |
| Alteração de role (`NON_PLATFORM_ROLES = ['user','customer_admin']`, além de `admin`) | sim; role inválida → **400**; erro na gravação é devolvido em `roleError` | **nunca** (`restData` esvaziado; a plataforma bloqueia também do lado da entidade) |

Pontos-chave:

- A leitura do alvo usa `asServiceRole` **depois** de validar a role do chamador — nunca o inverso.
- `roleError` permite devolver sucesso parcial (perfil gravado, role falhou) sem reportar sucesso absoluto.
- Leitura de utilizadores (não mutação) segue sempre por `listUsers`
  (`base44/functions/listUsers/entry.ts`): aceita `{ page, pageSize }` e devolve
  `{ users, total }`; chamadas sem paginação mantêm compatibilidade. Admin lista tudo,
  `customer_admin` filtra pelo próprio tenant — 403 se tentar contornar.

## 3. Como acrescentar um novo painel

1. **Criar o componente** (como os existentes):
   - Componente reutilizável (aparece no backoffice **e** noutros ecrãs, como Settings) →
     `src/components/backoffice/<Nome>Panel.jsx`.
   - Página exclusiva da sub-navegação → `src/pages/backoffice/<Nome>.jsx`.

2. **Registar a tab** em `BackofficeLayout.jsx` (array `TABS`):
   ```js
   { to: '/backoffice/reports', labelKey: 'backoffice_tab_reports' },
   ```

3. **Registar a rota** em `App.jsx`, dentro de `<BackofficeLayout />`:
   ```jsx
   <Route path="reports" element={<ReportsPanel />} />
   ```
   Os módulos do backoffice são lazy (`React.lazy`) em `App.jsx`, envolvidos em
   `LazySection` (`ErrorBoundary` + `Suspense`); novos painéis devem seguir o mesmo padrão.

4. **Espelhar o acesso**: adicionar o caminho a `RouteGuard` e à configuração da `Sidebar`
   — as duas listas devem manter-se sincronizadas.

5. **Traduções**: acrescentar a chave `backoffice_tab_*` (e as chaves internas do painel)
   nos dois dicionários de `src/lib/translations.js` (chave inglesa e portuguesa).

6. **Dados — regras obrigatórias**:
   - **Leituras** de `User` → sempre `base44.functions.invoke('listUsers', ...)`;
     qualquer outra entidade grande → `filter(query, sort, limit, skip)` server-side.
   - **Mutações** de `User` → sempre `base44.functions.invoke('manageUser', ...)`.
   - Nunca chamar `User.list()`/`User.update()`/`User.delete()` directamente no frontend (RLS nega).

7. **Listas paginadas** (padrão dos drill-downs em `BackofficeOverview.jsx`):
   ```js
   const DRILL_DOWN_PAGE_SIZE = 25;
   const [page, setPage] = useState(0);
   const { data: pageData, isLoading } = useQuery({
     queryKey: ['backoffice-<entidade>-page', page],
     queryFn: async () => {
       const res = await base44.functions.invoke('listUsers', { page, pageSize: DRILL_DOWN_PAGE_SIZE });
       return res;
     },
   });
   const total = pageData?.total || 0;
   const totalPages = Math.max(1, Math.ceil(total / DRILL_DOWN_PAGE_SIZE));
   ```
   - Renderizar os controlos com `PageControls` (mesmo ficheiro).
   - Pesquisa do cliente aplica-se **dentro da página carregada** (padrão actual).
   - Janelas de detalhe usam `DrillDownDialog` (mesmo ficheiro).

8. **Verificar**: `npm run build` dentro do container (deve sair exit 0), lint sem erros
   nos ficheiros novos e o painel a renderizar em `/backoffice/<rota>` no preview.
