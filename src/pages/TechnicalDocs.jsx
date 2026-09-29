import React from 'react';
import { Badge } from '@/components/ui/badge';
import ApiStructureSection from '@/components/docs/ApiStructureSection';
import CapabilityMatrix from '@/components/docs/CapabilityMatrix';
import ControlCascade from '@/components/docs/ControlCascade';
import DataModelSection from '@/components/docs/DataModelSection';
import DocsSection from '@/components/docs/DocsSection';
import ModuleMap from '@/components/docs/ModuleMap';
import ServiceArchitectureSection from '@/components/docs/ServiceArchitectureSection';
import TenancyDiagram from '@/components/docs/TenancyDiagram';
import { useLanguage } from '@/lib/LanguageContext';
import {
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
import '@/components/docs/papelDourado.css';

/**
 * Documentação técnica interna (arquitetura, papéis, módulos e funcionalidades).
 *
 * Página de leitura: conteúdo estático somado a leituras em memória do RBAC e do
 * catálogo de módulos — nenhuma chamada a entidades nem a funções de backend.
 * O mesmo modelo alimenta a exportação PDF (`src/lib/exportTechnicalDocsPdf.js`).
 *
 * A apresentação é a folha «Papel Dourado» (`papelDourado.css`): cabeçalho com
 * imagem, números de topo, índice fixo e onze capítulos. Só a apresentação muda —
 * todos os dados continuam a vir do modelo acima.
 */

/** Logótipo da folha (biblioteca de recursos da app) — a folha não usa imagens. */
const PAPER_ASSETS = {
  logo: 'https://media.base44.com/images/public/6ab5373e7f8f586c80cb9ed8/ef04d314c_a1-logo-light.svg',
};

const SECTIONS = [
  { id: 'visao-geral', label: 'Visão geral' },
  { id: 'multitenancy', label: 'Multitenancy' },
  { id: 'papeis', label: 'Papéis' },
  { id: 'capacidades', label: 'Capacidades' },
  { id: 'modulos', label: 'Módulos' },
  { id: 'areas', label: 'Áreas funcionais' },
  { id: 'seguranca', label: 'Segurança' },
  { id: 'dados', label: 'Modelo de dados' },
  { id: 'servicos', label: 'Arquitetura de serviços' },
  { id: 'api', label: 'Estrutura da API' },
  { id: 'dev', label: 'Desenvolvimento' },
];

const SCOPE_ACCENTS = {
  Plataforma: [20, 30, 60],
  Parceiro: [37, 99, 235],
  Cliente: [13, 148, 136],
  Externo: [202, 138, 4],
};

const totals = buildDocsTotals();

const TOTALS = [
  { label: 'Papéis', value: totals.roles, detail: 'conjunto canónico' },
  { label: 'Módulos', value: totals.modules, detail: `${totals.offeredModules} em oferta` },
  { label: 'Tiers comerciais', value: totals.tiers, detail: 'cumulativos' },
  { label: 'Áreas funcionais', value: totals.areas, detail: 'com gating próprio' },
  { label: 'Entidades', value: totals.entities, detail: 'com RLS declarada' },
  { label: 'Funções backend', value: totals.functions, detail: 'Deno / TypeScript' },
];

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
  const downloadPdf = () => exportTechnicalDocsPdf({ t });

  return (
    <div className="docs-paper">
      <header className="mast">
        <img className="logo" src={PAPER_ASSETS.logo} alt="" />
        <div>
          <div className="eyebrow">Documento interno de engenharia</div>
          <p className="notice">{DOCS_META.scope}</p>
          {/* O título da página é o da barra de contexto (TopBar, h1); aqui é o
              cabeçalho da folha, com a mesma forma mas sem duplicar o h1 (FC1). */}
          <h2 className="title">Documentação técnica</h2>
          <p className="description">
            Arquitetura da plataforma, papéis, módulos, áreas funcionais e modelo de dados — o mesmo
            conteúdo do PDF descarregável.
          </p>
          <button type="button" className="button" onClick={downloadPdf}>
            Descarregar PDF
          </button>
        </div>
      </header>

      <div className="totals">
        {TOTALS.map((item) => (
          <div key={item.label} className="total">
            <div className="number">{item.value}</div>
            <div className="label">{item.label}</div>
            <div className="detail">{item.detail}</div>
          </div>
        ))}
      </div>

      <nav className="nav">
        {SECTIONS.map((section, index) => (
          <a key={section.id} href={`#${section.id}`} className="chip">
            {`${String(index + 1).padStart(2, '0')} ${section.label}`}
          </a>
        ))}
        <button type="button" className="button small-button" onClick={downloadPdf}>
          Descarregar PDF
        </button>
      </nav>

      {/* Coluna de leitura. Não é um <main>: a página já vive dentro do <main> do AppLayout. */}
      <div className="reading">
        {/* 01 — Visão geral e arquitetura */}
        <DocsSection
          id="visao-geral"
          index={1}
          title="Visão geral e arquitetura"
          description="Stack, camadas de controlo de acesso e o papel de cada uma."
        >
          <div className="meta">
            <div className="meta-item">
              <div className="meta-label">Aplicação</div>
              <div className="meta-value">{DOCS_META.app}</div>
            </div>
            <div className="meta-item">
              <div className="meta-label">App ID</div>
              <div className="meta-value code">{DOCS_META.appId}</div>
            </div>
            <div className="meta-item">
              <div className="meta-label">Branch</div>
              <div className="meta-value code">{DOCS_META.branch}</div>
            </div>
          </div>
          <p style={{ marginTop: 14 }}>{DOCS_META.audience}</p>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {STACK.map((row) => (
              <div key={row.label} className="rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</p>
                <p className="mt-1 text-sm">{row.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <ControlCascade />
          </div>
        </DocsSection>

        {/* 02 — Multitenancy e delegação */}
        <DocsSection
          id="multitenancy"
          index={2}
          title="Multitenancy e delegação"
          description="Como os dados são isolados e como se concede acesso a quem está fora do tenant."
        >
          <div className="line-art mb-5">
            <span />
            <span />
            <span />
            <span />
          </div>
          <TenancyDiagram />
        </DocsSection>

        {/* 03 — Papéis */}
        <DocsSection
          id="papeis"
          index={3}
          title="Papéis"
          description="Conjunto canónico de 9 papéis. As grafias legadas (admin, user, partner_admin) são normalizadas para estes."
        >
          <RoleGrid t={t} />
        </DocsSection>

        {/* 04 — Matriz de capacidades */}
        <DocsSection
          id="capacidades"
          index={4}
          title="Matriz de capacidades"
          description="Gerada em runtime a partir de CAPABILITIES (src/lib/rbac.js) — é a mesma matriz que o RouteGuard aplica."
        >
          <CapabilityMatrix t={t} />
        </DocsSection>

        {/* 05 — Módulos e licenciamento */}
        <DocsSection
          id="modulos"
          index={5}
          title="Módulos e licenciamento"
          description="Três tiers comerciais cumulativos e nove módulos, mapeados rota a rota. O gating é fail-closed."
        >
          <ModuleMap />

          <div className="space-y-2">
            <p>Rotas sem gating de módulo (só RBAC)</p>
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
            <p>Catálogo comercial: onde vive e como se altera</p>
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

        {/* 06 — Áreas funcionais */}
        <DocsSection
          id="areas"
          index={6}
          title="Áreas funcionais"
          description={`${FEATURE_AREAS.length} áreas alinhadas com os grupos do sidebar, com o módulo que licencia cada rota.`}
        >
          <AreaList />
        </DocsSection>

        {/* 07 — Modelo de segurança */}
        <DocsSection
          id="seguranca"
          index={7}
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

        {/* 08 — Modelo de dados */}
        <DocsSection
          id="dados"
          index={8}
          title="Modelo de dados"
          description={`${totals.entities} entidades e ${totals.entityRelations} relações declaradas — campos-chave lidos do esquema de cada entidade.`}
        >
          <DataModelSection />
        </DocsSection>

        {/* 09 — Arquitetura de serviços */}
        <DocsSection
          id="servicos"
          index={9}
          title="Tech stack e arquitetura de serviços"
          description={`${STACK.length} camadas de stack, ${totals.workflows} automações agendadas, ${totals.sharedModules} módulos partilhados, ${totals.connectors} integrações e o agente de IA.`}
        >
          <ServiceArchitectureSection />
        </DocsSection>

        {/* 10 — Estrutura da API */}
        <DocsSection
          id="api"
          index={10}
          title="Estrutura da API"
          description={`${totals.gatedRoutes + totals.rbacOnlyRoutes} rotas do frontend e ${totals.functions} funções de backend com entradas e saídas, extraídas do código.`}
        >
          <ApiStructureSection />
        </DocsSection>

        {/* 11 — Guia de desenvolvimento */}
        <DocsSection
          id="dev"
          index={11}
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
            <p>Particularidades do ambiente local</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
              {DEV_GUIDE.quirks.map((quirk) => (
                <li key={quirk}>{quirk}</li>
              ))}
            </ul>
          </div>
        </DocsSection>
      </div>
    </div>
  );
}
