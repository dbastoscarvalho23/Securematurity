import React from 'react';
import {
  AlertTriangle, Boxes, Database, FileCode, Layers, Network, ScrollText, ShieldCheck, Users, Workflow,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/shared/PageHeader';
import { useLanguage } from '@/lib/LanguageContext';
import { cn } from '@/lib/utils';
import { ALL_ROLES, CAPABILITIES, CAPABILITY_TIERS } from '@/lib/rbac';
import {
  COMMERCIALLY_AVAILABLE_TIERS,
  LEGACY_TIER_ALIASES,
  MODULE_META,
  ROUTE_MODULE,
  TIER_MODULES,
} from '@/lib/licenseModules';
import {
  DATA_MODEL,
  DELEGATION_FLOW,
  DEV_GUIDE,
  DOCS_META,
  FEATURE_AREAS,
  LAYERS,
  ROLE_NOTES,
  SECURITY_MODEL,
  STACK,
  TENANCY_MODELS,
} from '@/lib/devDocsData';

/**
 * Documentação técnica interna (arquitetura, papéis, módulos e funcionalidades).
 *
 * Página de leitura: conteúdo estático somado a leituras em memória do RBAC e do
 * catálogo de módulos — nenhuma chamada a entidades nem a funções de backend.
 */

const ACTIONS = [
  { key: 'view', letter: 'V', label: 'Ver' },
  { key: 'create', letter: 'C', label: 'Criar' },
  { key: 'edit', letter: 'E', label: 'Editar' },
  { key: 'delete', letter: 'D', label: 'Eliminar' },
  { key: 'export', letter: 'X', label: 'Exportar' },
  { key: 'approve', letter: 'A', label: 'Aprovar' },
];

const TIER_ORDER = ['core', 'professional', 'advanced'];

const EXTRA_RESOURCE_LABELS = { recommendations: 'Recomendações' };

// Rótulos dos recursos derivados das áreas funcionais (evita duplicar a lista).
const RESOURCE_LABELS = FEATURE_AREAS.reduce((acc, area) => {
  area.items.forEach((item) => {
    acc[item.resource] = item.name;
  });
  return acc;
}, { ...EXTRA_RESOURCE_LABELS });

const SECTIONS = [
  { id: 'visao-geral', label: 'Visão geral e arquitetura' },
  { id: 'multitenancy', label: 'Multitenancy e delegação' },
  { id: 'papeis', label: 'Papéis' },
  { id: 'capacidades', label: 'Matriz de capacidades' },
  { id: 'modulos', label: 'Módulos e licenciamento' },
  { id: 'areas', label: 'Áreas funcionais' },
  { id: 'seguranca', label: 'Modelo de segurança' },
  { id: 'dados', label: 'Modelo de dados' },
  { id: 'dev', label: 'Guia de desenvolvimento' },
];

function Section({ id, icon: Icon, title, description, children }) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function RoleChips({ roles }) {
  const { t } = useLanguage();
  if (!roles || !roles.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <Badge key={r} variant="secondary" className="text-[10px] font-normal">
          {t(`role_${r}`) || r}
        </Badge>
      ))}
    </div>
  );
}

export default function TechnicalDocs() {
  const { t } = useLanguage();

  const resources = Object.keys(CAPABILITIES);
  const roleNotes = new Map(ROLE_NOTES.map((n) => [n.code, n]));

  const modulesByTier = TIER_ORDER.map((tier) => ({
    tier,
    modules: TIER_MODULES[tier] || [],
    available: COMMERCIALLY_AVAILABLE_TIERS.includes(tier),
  }));

  const moduleTiers = (code) => TIER_ORDER.filter((tier) => (TIER_MODULES[tier] || []).includes(code));

  const routesByModule = Object.entries(
    Object.entries(ROUTE_MODULE).reduce((acc, [route, mod]) => {
      if (!mod) return acc;
      acc[mod] = acc[mod] || [];
      acc[mod].push(route);
      return acc;
    }, {})
  );

  const rbacOnlyRoutes = Object.entries(ROUTE_MODULE)
    .filter(([, mod]) => !mod)
    .map(([route]) => route);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Documento interno de engenharia</p>
          <p className="text-sm">{DOCS_META.scope}</p>
        </div>
      </div>

      <PageHeader
        title="Documentação técnica"
        description="Arquitetura da plataforma, papéis, módulos, áreas funcionais e modelo de dados."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aplicação</p>
          <p className="text-sm">{DOCS_META.app}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">App ID</p>
          <p className="font-mono text-xs">{DOCS_META.appId}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Branch</p>
          <p className="font-mono text-xs">{DOCS_META.branch}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Público</p>
          <p className="text-sm">{DOCS_META.audience}</p>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-2 pt-6">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {s.label}
            </a>
          ))}
        </CardContent>
      </Card>

      {/* 1 — Visão geral e arquitetura */}
      <Section
        id="visao-geral"
        icon={Layers}
        title="Visão geral e arquitetura"
        description="Stack, camadas de controlo de acesso e o papel de cada uma."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {STACK.map((row) => (
            <div key={row.label} className="rounded-lg border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</p>
              <p className="mt-1 text-sm">{row.value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Camadas de controlo (cascata)</p>
          <div className="space-y-3">
            {LAYERS.map((layer) => (
              <div key={layer.order} className="flex items-start gap-3 rounded-lg border p-3">
                <Badge variant="secondary" className="mt-0.5 shrink-0 font-mono">{layer.order}</Badge>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{layer.title}</p>
                  <p className="text-sm text-muted-foreground">{layer.detail}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{layer.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* 2 — Multitenancy e delegação */}
      <Section
        id="multitenancy"
        icon={Network}
        title="Multitenancy e delegação"
        description="Como os dados são isolados e como se concede acesso a quem está fora do tenant."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {TENANCY_MODELS.map((model) => (
            <div key={model.name} className="rounded-lg border p-3">
              <p className="font-mono text-sm font-medium">{model.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{model.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {model.fields.map((f) => (
                  <Badge key={f} variant="outline" className="font-mono text-[10px] font-normal">{f}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Ciclo de delegação</p>
          <ul className="list-disc space-y-1 pl-4 text-sm">
            {DELEGATION_FLOW.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      </Section>

      {/* 3 — Papéis */}
      <Section
        id="papeis"
        icon={Users}
        title="Papéis"
        description="Conjunto canónico de 9 papéis. As grafias legadas (admin, user, partner_admin) são normalizadas para estes."
      >
        <div className="space-y-3">
          {ALL_ROLES.map((role) => {
            const note = roleNotes.get(role);
            const viewCount = resources.filter((r) => (CAPABILITIES[r].view || []).includes(role)).length;
            return (
              <div key={role} className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex items-center gap-2 sm:w-48 sm:shrink-0">
                  <Badge variant="secondary" className="text-xs">{t(`role_${role}`) || role}</Badge>
                  {note && <span className="text-[11px] text-muted-foreground">{note.scope}</span>}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm text-muted-foreground">{note?.summary}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {role} · {viewCount} recursos visíveis
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* 4 — Matriz de capacidades */}
      <Section
        id="capacidades"
        icon={ShieldCheck}
        title="Matriz de capacidades"
        description="Gerada em runtime a partir de CAPABILITIES (src/lib/rbac.js) — é a mesma matriz que o RouteGuard aplica."
      >
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((a) => (
            <Badge key={a.key} variant="outline" className="text-[11px] font-normal">
              <span className="font-mono">{a.letter}</span> = {a.label}
            </Badge>
          ))}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Recurso</TableHead>
                {ALL_ROLES.map((role) => (
                  <TableHead key={role} className="text-center text-[11px]">
                    {t(`role_${role}`) || role}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.map((resource) => (
                <TableRow key={resource}>
                  <TableCell className="text-sm">
                    {RESOURCE_LABELS[resource] || resource.replace(/_/g, ' ')}
                  </TableCell>
                  {ALL_ROLES.map((role) => {
                    const letters = ACTIONS
                      .filter((a) => (CAPABILITIES[resource][a.key] || []).includes(role))
                      .map((a) => a.letter)
                      .join('');
                    return (
                      <TableCell
                        key={role}
                        className={cn('text-center font-mono text-[11px]', !letters && 'text-muted-foreground/40')}
                      >
                        {letters || '–'}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Tiers de capacidade (reutilizados pela matriz)</p>
          <div className="space-y-2">
            {Object.entries(CAPABILITY_TIERS).map(([name, roles]) => (
              <div key={name} className="flex flex-col gap-1 rounded-lg border p-2 sm:flex-row sm:items-center sm:gap-3">
                <code className="w-32 shrink-0 font-mono text-xs text-muted-foreground">{name}</code>
                <RoleChips roles={roles} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Os tiers T_* são exclusivos do tenant: um administrador de plataforma ou de parceiro não aparece em nenhuma
            capacidade de conformidade.
          </p>
        </div>
      </Section>

      {/* 5 — Módulos e licenciamento */}
      <Section
        id="modulos"
        icon={Boxes}
        title="Módulos e licenciamento"
        description="Três tiers comerciais cumulativos e nove módulos. O gating é fail-closed."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {modulesByTier.map(({ tier, modules, available }) => (
            <div key={tier} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium capitalize">{tier}</p>
                {available && (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-[10px] text-emerald-700">
                    comercializável
                  </Badge>
                )}
              </div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {modules.map((m) => (
                  <li key={m}>{MODULE_META[m]?.name || m}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Core ⊂ Profissional ⊂ Avançado. O alias legado
          {Object.entries(LEGACY_TIER_ALIASES).map(([from, to]) => (
            <span key={from}> <code className="font-mono">{from}</code> → <code className="font-mono">{to}</code></span>
          ))}
          {' '}existe apenas para registos antigos.
        </p>

        <div>
          <p className="mb-2 text-sm font-medium">Catálogo de módulos</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Descrição</TableHead>
                <TableHead>Tiers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(MODULE_META).map(([code, meta]) => {
                const tiers = moduleTiers(code);
                return (
                  <TableRow key={code}>
                    <TableCell className="font-mono text-xs">{code}</TableCell>
                    <TableCell className="text-sm">{meta.name}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{meta.description}</TableCell>
                    <TableCell className="text-xs">
                      {tiers.length ? (
                        <div className="flex flex-wrap gap-1">
                          {tiers.map((tier) => (
                            <Badge key={tier} variant="secondary" className="text-[10px] font-normal capitalize">{tier}</Badge>
                          ))}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-normal">fora da oferta</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Rotas gated por módulo</p>
          <div className="space-y-2">
            {routesByModule.map(([mod, routes]) => (
              <div key={mod} className="flex flex-col gap-1 rounded-lg border p-2 sm:flex-row sm:items-start sm:gap-3">
                <code className="w-56 shrink-0 font-mono text-xs text-muted-foreground">{mod}</code>
                <div className="flex flex-wrap gap-1">
                  {routes.map((r) => (
                    <Badge key={r} variant="outline" className="font-mono text-[10px] font-normal">{r}</Badge>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-1 rounded-lg border p-2 sm:flex-row sm:items-start sm:gap-3">
              <code className="w-56 shrink-0 font-mono text-xs text-muted-foreground">sem gating (só RBAC)</code>
              <div className="flex flex-wrap gap-1">
                {rbacOnlyRoutes.map((r) => (
                  <Badge key={r} variant="outline" className="font-mono text-[10px] font-normal">{r}</Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* 6 — Áreas funcionais */}
      <Section
        id="areas"
        icon={Workflow}
        title="Áreas funcionais"
        description="Organização funcional da aplicação, alinhada com os grupos do sidebar."
      >
        <div className="space-y-3">
          {FEATURE_AREAS.map((area) => (
            <div key={area.area} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{area.area}</p>
              <p className="text-sm text-muted-foreground">{area.description}</p>
              <div className="mt-2 space-y-1">
                {area.items.map((item) => (
                  <div key={item.route} className="flex flex-col gap-0.5 border-t pt-1 sm:flex-row sm:items-baseline sm:gap-3">
                    <span className="w-56 shrink-0 text-sm">{item.name}</span>
                    <code className="w-52 shrink-0 font-mono text-[11px] text-muted-foreground">{item.route}</code>
                    <span className="text-sm text-muted-foreground">{item.summary}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 7 — Modelo de segurança */}
      <Section
        id="seguranca"
        icon={ShieldCheck}
        title="Modelo de segurança"
        description="Regras estruturais que sustentam o isolamento, a delegação e a integridade."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {SECURITY_MODEL.map((block) => (
            <div key={block.title} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{block.title}</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* 8 — Modelo de dados */}
      <Section
        id="dados"
        icon={Database}
        title="Modelo de dados"
        description="Entidades, funções de backend, workflows e utilitários partilhados."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {DATA_MODEL.entities.map((group) => (
            <div key={group.group} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{group.group}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {group.items.map((e) => (
                  <Badge key={e} variant="outline" className="font-mono text-[10px] font-normal">{e}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {DATA_MODEL.functions.map((group) => (
            <div key={group.group} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{group.group}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {group.items.map((f) => (
                  <Badge key={f} variant="secondary" className="font-mono text-[10px] font-normal">{f}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ScrollText className="h-4 w-4 text-muted-foreground" /> Workflows
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {DATA_MODEL.workflows.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium">Utilitários partilhados</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {DATA_MODEL.shared.map((s) => (
                <li key={s.name}>
                  <code className="font-mono text-xs">{s.name}</code> — {s.note}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">Integrações</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {DATA_MODEL.integrations.map((i) => (
              <li key={i.name}>
                <span className="text-foreground">{i.name}</span> — {i.note}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* 9 — Guia de desenvolvimento */}
      <Section
        id="dev"
        icon={FileCode}
        title="Guia de desenvolvimento"
        description="Comandos e particularidades do ambiente local."
      >
        <div className="space-y-2">
          {DEV_GUIDE.commands.map((c) => (
            <div key={c.label} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{c.label}</p>
              <pre className="mt-1 overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-xs">{c.command}</pre>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Particularidades do ambiente local</p>
          <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            {DEV_GUIDE.quirks.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      </Section>
    </div>
  );
}
