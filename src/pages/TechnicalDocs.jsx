import React from 'react';
import {
  AlertTriangle, Boxes, Database, Download, FileCode, Layers, Network, ShieldCheck, Users, Workflow,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import PageHeader from '@/components/shared/PageHeader';
import CapabilityMatrix from '@/components/docs/CapabilityMatrix';
import ControlCascade from '@/components/docs/ControlCascade';
import DocsSection from '@/components/docs/DocsSection';
import ModuleMap from '@/components/docs/ModuleMap';
import TenancyDiagram from '@/components/docs/TenancyDiagram';
import { useLanguage } from '@/lib/LanguageContext';
import {
  DATA_MODEL,
  DEV_GUIDE,
  DOCS_META,
  FEATURE_AREAS,
  LICENSE_CATALOG,
  SECURITY_MODEL,
  STACK,
} from '@/lib/devDocsData';
import {
  RBAC_ONLY_ROUTES,
  RESOURCES,
  ROLE_NOTES_BY_CODE,
  ROLES,
  TIER_ACCENTS,
  TIER_LABELS,
  buildAreaMap,
  buildDocsTotals,
  buildTierLayers,
  rgba,
  visibleResourceCount,
} from '@/lib/docsModel';
import { exportTechnicalDocsPdf } from '@/lib/exportTechnicalDocsPdf';

/**
 * Documentação técnica interna (arquitetura, papéis, módulos e funcionalidades).
 *
 * Página de leitura: conteúdo estático somado a leituras em memória do RBAC e do
 * catálogo de módulos — nenhuma chamada a entidades nem a funções de backend.
 * O mesmo modelo alimenta a exportação PDF (`src/lib/exportTechnicalDocsPdf.js`).
 */

const SECTIONS = [
  { id: 'visao-geral', label: 'Visão geral', icon: Layers },
  { id: 'multitenancy', label: 'Multitenancy', icon: Network },
  { id: 'papeis', label: 'Papéis', icon: Users },
  { id: 'capacidades', label: 'Capacidades', icon: ShieldCheck },
  { id: 'modulos', label: 'Módulos', icon: Boxes },
  { id: 'areas', label: 'Áreas funcionais', icon: Workflow },
  { id: 'seguranca', label: 'Segurança', icon: ShieldCheck },
  { id: 'dados', label: 'Modelo de dados', icon: Database },
  { id: 'dev', label: 'Desenvolvimento', icon: FileCode },
];

const SCOPE_ACCENTS = {
  Plataforma: [20, 30, 60],
  Parceiro: [37, 99, 235],
  Cliente: [13, 148, 136],
  Externo: [202, 138, 4],
};

const totals = buildDocsTotals();

const SUMMARY_TILES = [
  { label: 'Papéis', value: totals.roles, detail: 'conjunto canónico', accent: SCOPE_ACCENTS.Parceiro },
  { label: 'Módulos', value: totals.modules, detail: `${totals.offeredModules} em oferta`, accent: [8, 145, 178] },
  { label: 'Tiers comerciais', value: totals.tiers, detail: 'cumulativos', accent: SCOPE_ACCENTS.Externo },
  { label: 'Áreas funcionais', value: totals.areas, detail: 'com gating próprio', accent: [124, 58, 237] },
  { label: 'Entidades', value: totals.entities, detail: 'com RLS declarada', accent: [219, 39, 119] },
  { label: 'Funções backend', value: totals.functions, detail: 'Deno / TypeScript', accent: [234, 88, 12] },
];

function SummaryTile({ tile }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{ backgroundColor: rgba(tile.accent, 0.06), borderColor: rgba(tile.accent, 0.25) }}
    >
      <p className="text-2xl font-bold leading-none" style={{ color: rgba(tile.accent) }}>
        {tile.value}
      </p>
      <p className="mt-1 text-xs font-medium">{tile.label}</p>
      <p className="text-[11px] text-muted-foreground">{tile.detail}</p>
    </div>
  );
}

function RoleGrid({ t }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {ROLES.map((role) => {
        const note = ROLE_NOTES_BY_CODE.get(role) || {};
        const accent = SCOPE_ACCENTS[note.scope] || SCOPE_ACCENTS.Cliente;
        const visible = visibleResourceCount(role);
        const pct = Math.round((visible / RESOURCES.length) * 100);
        return (
          <div
            key={role}
            className="flex flex-col gap-2 rounded-xl border p-3"
            style={{ borderColor: rgba(accent, 0.25), backgroundColor: rgba(accent, 0.04) }}
          >
            <div className="flex items-center justify-between gap-2">
              <Badge className="text-xs" style={{ backgroundColor: rgba(accent), color: 'hsl(var(--destructive-foreground))' }}>
                {t(`role_${role}`) || role}
              </Badge>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {note.scope}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{note.summary}</p>
            <div className="mt-auto space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: rgba(accent) }} />
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">
                {role} · {visible}/{RESOURCES.length} recursos com leitura
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AreaList() {
  return (
    <div className="space-y-3">
      {buildAreaMap().map((area) => (
        <div key={area.area} className="rounded-xl border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{area.area}</p>
            {area.requiredTier ? (
              <Badge
                variant="outline"
                className="text-[10px] font-normal"
                style={{ borderColor: rgba(TIER_ACCENTS[area.requiredTier], 0.4), color: rgba(TIER_ACCENTS[area.requiredTier]) }}
              >
                Tier mínimo: {TIER_LABELS[area.requiredTier]}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                Transversal
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{area.description}</p>
          <div className="mt-2 space-y-1.5">
            {area.items.map((item) => (
              <div key={item.route} className="flex flex-col gap-1 border-t pt-1.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="text-sm sm:w-56 sm:shrink-0">{item.name}</span>
                <code className="font-mono text-[11px] text-muted-foreground sm:w-52 sm:shrink-0">{item.route}</code>
                <span className="flex flex-1 flex-wrap items-center gap-2">
                  {item.module ? (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                      style={{ borderColor: rgba(item.accent, 0.4), backgroundColor: rgba(item.accent, 0.12), color: rgba(item.accent) }}
                    >
                      {item.moduleName}
                    </span>
                  ) : (
                    <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                      sem gating (só RBAC)
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{item.summary}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TechnicalDocs() {
  const { t } = useLanguage();
  const tierLayers = buildTierLayers();

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-chart-4/20 bg-chart-4/10 p-4 text-chart-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-chart-4" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Documento interno de engenharia</p>
          <p className="text-sm">{DOCS_META.scope}</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="h-1.5 w-full" style={{ backgroundColor: rgba(SCOPE_ACCENTS.Parceiro) }} />
        <CardContent className="space-y-5 pt-6">
          <PageHeader
            title="Documentação técnica"
            description="Arquitetura da plataforma, papéis, módulos, áreas funcionais e modelo de dados — o mesmo conteúdo do PDF descarregável."
            actions={
              <Button onClick={() => exportTechnicalDocsPdf({ t })}>
                <Download className="mr-2 h-4 w-4" />
                Descarregar PDF
              </Button>
            }
          />

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {SUMMARY_TILES.map((tile) => (
              <SummaryTile key={tile.label} tile={tile} />
            ))}
          </div>

          <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Aplicação', DOCS_META.app],
              ['App ID', DOCS_META.appId],
              ['Branch', DOCS_META.branch],
              ['Público', DOCS_META.audience],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted/50 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <nav className="sticky top-2 z-10 flex flex-wrap gap-2 rounded-xl border bg-card/95 p-2 backdrop-blur">
        {SECTIONS.map((section, index) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <span className="font-mono text-[10px] font-semibold">{index + 1}</span>
            {section.label}
          </a>
        ))}
      </nav>

      {/* 1 — Visão geral e arquitetura */}
      <DocsSection
        id="visao-geral"
        index={1}
        icon={Layers}
        accent={[37, 99, 235]}
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
        <ControlCascade />
      </DocsSection>

      {/* 2 — Multitenancy e delegação */}
      <DocsSection
        id="multitenancy"
        index={2}
        icon={Network}
        accent={[124, 58, 237]}
        title="Multitenancy e delegação"
        description="Como os dados são isolados e como se concede acesso a quem está fora do tenant."
      >
        <TenancyDiagram />
      </DocsSection>

      {/* 3 — Papéis */}
      <DocsSection
        id="papeis"
        index={3}
        icon={Users}
        accent={[13, 148, 136]}
        title="Papéis"
        description="Conjunto canónico de 9 papéis. As grafias legadas (admin, user, partner_admin) são normalizadas para estes."
      >
        <RoleGrid t={t} />
      </DocsSection>

      {/* 4 — Matriz de capacidades */}
      <DocsSection
        id="capacidades"
        index={4}
        icon={ShieldCheck}
        accent={[202, 138, 4]}
        title="Matriz de capacidades"
        description="Gerada em runtime a partir de CAPABILITIES (src/lib/rbac.js) — é a mesma matriz que o RouteGuard aplica."
      >
        <CapabilityMatrix t={t} />
      </DocsSection>

      {/* 5 — Módulos e licenciamento */}
      <DocsSection
        id="modulos"
        index={5}
        icon={Boxes}
        accent={[8, 145, 178]}
        title="Módulos e licenciamento"
        description="Três tiers comerciais cumulativos e nove módulos, mapeados rota a rota. O gating é fail-closed."
      >
        <ModuleMap />

        <div className="space-y-2">
          <p className="text-sm font-medium">Rotas sem gating de módulo (só RBAC)</p>
          <div className="flex flex-wrap gap-1">
            {RBAC_ONLY_ROUTES.map((route) => (
              <code key={route} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {route}
              </code>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {tierLayers.map((layer) => (
            <p key={layer.tier} className="text-xs text-muted-foreground">
              <span className="font-semibold" style={{ color: rgba(layer.accent) }}>
                {layer.label}
              </span>{' '}
              — {layer.modules.length} módulos
              {layer.added.length > 0 && ` (acrescenta ${layer.added.length})`}
              {layer.available ? ' · comercializável' : ' · não vendido'}
            </p>
          ))}
        </div>

        {/* FB7 — o catálogo é curado em código; as entidades são o espelho semeado. */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Catálogo comercial: onde vive e como se altera</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {LICENSE_CATALOG.map((block) => (
              <div key={block.title} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{block.title}</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </DocsSection>

      {/* 6 — Áreas funcionais */}
      <DocsSection
        id="areas"
        index={6}
        icon={Workflow}
        accent={[219, 39, 119]}
        title="Áreas funcionais"
        description={`${FEATURE_AREAS.length} áreas alinhadas com os grupos do sidebar, com o módulo que licencia cada rota.`}
      >
        <AreaList />
      </DocsSection>

      {/* 7 — Modelo de segurança */}
      <DocsSection
        id="seguranca"
        index={7}
        icon={ShieldCheck}
        accent={[20, 30, 60]}
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
      </DocsSection>

      {/* 8 — Modelo de dados */}
      <DocsSection
        id="dados"
        index={8}
        icon={Database}
        accent={[148, 163, 184]}
        title="Modelo de dados"
        description={`${totals.entities} entidades, ${totals.functions} funções de backend, workflows e utilitários partilhados.`}
      >
        <div>
          <p className="mb-2 text-sm font-medium">Entidades</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {DATA_MODEL.entities.map((group) => (
              <div key={group.group} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{group.group}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {group.items.map((entity) => (
                    <Badge key={entity} variant="outline" className="font-mono text-[10px] font-normal">
                      {entity}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Funções de backend</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {DATA_MODEL.functions.map((group) => (
              <div key={group.group} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{group.group}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {group.items.map((fn) => (
                    <Badge key={fn} variant="secondary" className="font-mono text-[10px] font-normal">
                      {fn}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium">Workflows agendados</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {DATA_MODEL.workflows.map((workflow) => (
                <li key={workflow}>{workflow}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium">Utilitários partilhados</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {DATA_MODEL.shared.map((item) => (
                <li key={item.name}>
                  <code className="font-mono text-xs">{item.name}</code> — {item.note}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">Integrações</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {DATA_MODEL.integrations.map((item) => (
              <li key={item.name}>
                <span className="text-foreground">{item.name}</span> — {item.note}
              </li>
            ))}
          </ul>
        </div>
      </DocsSection>

      {/* 9 — Guia de desenvolvimento */}
      <DocsSection
        id="dev"
        index={9}
        icon={FileCode}
        accent={[234, 88, 12]}
        title="Guia de desenvolvimento"
        description="Comandos e particularidades do ambiente local."
      >
        <div className="space-y-2">
          {DEV_GUIDE.commands.map((command) => (
            <div key={command.label} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{command.label}</p>
              <pre className="mt-1 overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-xs">{command.command}</pre>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Particularidades do ambiente local</p>
          <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            {DEV_GUIDE.quirks.map((quirk) => (
              <li key={quirk}>{quirk}</li>
            ))}
          </ul>
        </div>
      </DocsSection>
    </div>
  );
}
