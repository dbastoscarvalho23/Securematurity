/**
 * Modelo derivado da documentação técnica interna.
 *
 * Junta o RBAC (`src/lib/rbac.js`), o catálogo de módulos (`src/lib/licenseModules.js`)
 * e o conteúdo narrativo (`src/lib/devDocsData.js`) num único modelo. A página
 * /documentacao-tecnica, os seus componentes visuais e o exportador PDF leem todos
 * daqui, para que a documentação não possa divergir do código que aplica as regras.
 *
 * Nada neste ficheiro é conteúdo editorial: é tudo derivado do código ou agregado
 * a partir do conteúdo narrativo.
 */

import { ALL_ROLES, CAPABILITIES, CAPABILITY_TIERS, resourceForRoute } from './rbac';
import {
  COMMERCIALLY_AVAILABLE_TIERS,
  LEGACY_TIER_ALIASES,
  MODULE_META,
  ROUTE_MODULE,
  TIER_MODULES,
  moduleForRoute,
} from './licenseModules';
import {
  API_MODEL,
  DATA_MODEL,
  DATA_MODEL_NOTES,
  FEATURE_AREAS,
  FUNCTION_NOTES,
  ROLE_NOTES,
  SERVICE_MODEL,
} from './devDocsData';
import {
  AGENT_INVENTORY,
  CONNECTOR_INVENTORY,
  ENTITY_INVENTORY,
  FUNCTION_INVENTORY,
  INVENTORY_TOTALS,
  SHARED_INVENTORY,
  WORKFLOW_INVENTORY,
} from './repoInventory';

export const TIER_ORDER = ['core', 'professional', 'advanced'];

export const TIER_LABELS = {
  core: 'Core',
  professional: 'Profissional',
  advanced: 'Avançado',
};

/**
 * Paleta única da documentação — usada na UI (inline style) e no PDF (jsPDF),
 * para que o ecrã e o documento descarregado coincidam.
 */
export const TIER_ACCENTS = {
  core: [13, 148, 136],
  professional: [37, 99, 235],
  advanced: [202, 138, 4],
};

export const MODULE_ACCENTS = {
  nis2_journey: [37, 99, 235],
  assessments_action_plan: [13, 148, 136],
  documents_evidence: [124, 58, 237],
  reporting_audit_prep: [8, 145, 178],
  risk_management: [234, 88, 12],
  incident_management: [220, 38, 38],
  supplier_management: [219, 39, 119],
  knowledge_guidance: [22, 163, 74],
  privacy: [100, 116, 139],
};

export const ACTION_ACCENTS = {
  view: [37, 99, 235],
  create: [22, 163, 74],
  edit: [202, 138, 4],
  delete: [220, 38, 38],
  export: [124, 58, 237],
  approve: [13, 148, 136],
};

const NEUTRAL = [148, 163, 184];

/** `rgba()` a partir de um triplo RGB da paleta acima. */
export function rgba(triple, alpha = 1) {
  const [r, g, b] = triple || NEUTRAL;
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const moduleAccent = (code) => MODULE_ACCENTS[code] || NEUTRAL;

// ─── Capacidades e recursos ─────────────────────────────────────

export const ACTION_COLUMNS = [
  { key: 'view', letter: 'V', label: 'Ver' },
  { key: 'create', letter: 'C', label: 'Criar' },
  { key: 'edit', letter: 'E', label: 'Editar' },
  { key: 'delete', letter: 'D', label: 'Eliminar' },
  { key: 'export', letter: 'X', label: 'Exportar' },
  { key: 'approve', letter: 'A', label: 'Aprovar' },
];

export const ROLES = ALL_ROLES;

export const RESOURCES = Object.keys(CAPABILITIES);

/** Rótulos legíveis dos recursos (derivados das áreas funcionais, sem duplicar a lista). */
export const RESOURCE_LABELS = FEATURE_AREAS.reduce(
  (acc, area) => {
    area.items.forEach((item) => {
      acc[item.resource] = item.name;
    });
    return acc;
  },
  { recommendations: 'Recomendações' }
);

export const resourceLabel = (resource) => RESOURCE_LABELS[resource] || resource.replace(/_/g, ' ');

export const CAPABILITY_TIER_ENTRIES = Object.entries(CAPABILITY_TIERS);

/** Ações que um papel pode executar num recurso (para colorir a matriz). */
export function capabilityActions(resource, role) {
  const caps = CAPABILITIES[resource] || {};
  return ACTION_COLUMNS.filter((action) => (caps[action.key] || []).includes(role));
}

export function capabilityLetters(resource, role) {
  const letters = capabilityActions(resource, role).map((a) => a.letter).join('');
  return letters || '–';
}

/** Nº de recursos com leitura concedida a um papel. */
export function visibleResourceCount(role) {
  return RESOURCES.filter((resource) => (CAPABILITIES[resource].view || []).includes(role)).length;
}

export const ROLE_NOTES_BY_CODE = new Map(ROLE_NOTES.map((note) => [note.code, note]));

export const roleNote = (code) => ROLE_NOTES_BY_CODE.get(code) || null;

// ─── Módulos, tiers e rotas ─────────────────────────────────────

export const MODULES = Object.keys(MODULE_META);

export const COMMERCIAL_TIERS = COMMERCIALLY_AVAILABLE_TIERS;

export const LEGACY_ALIASES = Object.entries(LEGACY_TIER_ALIASES);

/** Tiers comerciais que incluem um módulo (lista vazia = fora da oferta). */
export function moduleTiers(code) {
  return TIER_ORDER.filter((tier) => (TIER_MODULES[tier] || []).includes(code));
}

/** Rotas cujo gating de licença aponta para este módulo. */
export function moduleRoutes(code) {
  return Object.entries(ROUTE_MODULE)
    .filter(([, module]) => module === code)
    .map(([route]) => route);
}

/** Rotas sem gating de módulo (só RBAC). */
export const RBAC_ONLY_ROUTES = Object.entries(ROUTE_MODULE)
  .filter(([, module]) => !module)
  .map(([route]) => route);

/** Índice rota → item de área funcional (nome, resumo, área e recurso). */
const ROUTE_ITEMS = new Map();
FEATURE_AREAS.forEach((area) => {
  area.items.forEach((item) => {
    ROUTE_ITEMS.set(item.route, { ...item, area: area.area });
  });
});

export const routeItem = (route) => ROUTE_ITEMS.get(route) || null;

/** Escada cumulativa de tiers (o que cada um herda e o que acrescenta). */
export function buildTierLayers() {
  return TIER_ORDER.map((tier, index) => {
    const modules = TIER_MODULES[tier] || [];
    const previous = index > 0 ? TIER_MODULES[TIER_ORDER[index - 1]] || [] : [];
    return {
      tier,
      label: TIER_LABELS[tier],
      accent: TIER_ACCENTS[tier],
      available: COMMERCIALLY_AVAILABLE_TIERS.includes(tier),
      modules,
      inherited: previous,
      added: modules.filter((code) => !previous.includes(code)),
    };
  });
}

/** Cartões de módulo: tiers, rotas gated e áreas funcionais onde aparece. */
export function buildModuleCards() {
  return MODULES.map((code) => {
    const routes = moduleRoutes(code);
    const items = routes.map(routeItem).filter(Boolean);
    return {
      code,
      name: MODULE_META[code].name,
      description: MODULE_META[code].description,
      accent: moduleAccent(code),
      tiers: moduleTiers(code),
      inOffering: moduleTiers(code).length > 0,
      routes,
      items,
      areas: [...new Set(items.map((item) => item.area))],
    };
  });
}

/**
 * Mapa de áreas funcionais → módulo de cada rota.
 * `requiredTier` é o tier mais baixo que inclui todos os módulos da área
 * (null quando a área não depende de nenhum módulo).
 */
export function buildAreaMap() {
  return FEATURE_AREAS.map((area) => {
    const items = area.items.map((item) => {
      const code = moduleForRoute(item.route);
      return {
        ...item,
        area: area.area,
        module: code,
        moduleName: code ? MODULE_META[code].name : null,
        accent: code ? moduleAccent(code) : NEUTRAL,
      };
    });
    const modules = [...new Set(items.map((item) => item.module).filter(Boolean))];
    const requiredTier = modules.length
      ? TIER_ORDER.find((tier) => modules.every((code) => (TIER_MODULES[tier] || []).includes(code))) || null
      : null;
    return {
      area: area.area,
      description: area.description,
      items,
      modules,
      moduleCards: modules.map((code) => ({ code, name: MODULE_META[code].name, accent: moduleAccent(code) })),
      requiredTier,
      requiresModule: modules.length > 0,
    };
  });
}

/** Rota → módulo (para tabelas). */
export function buildRouteRows() {
  return Object.entries(ROUTE_MODULE).map(([route, code]) => ({
    route,
    module: code,
    moduleName: code ? MODULE_META[code].name : null,
    accent: code ? moduleAccent(code) : NEUTRAL,
    item: routeItem(route),
    gated: Boolean(code),
  }));
}

/** Números de topo do documento. */
export function buildDocsTotals() {
  return {
    roles: ALL_ROLES.length,
    modules: MODULES.length,
    offeredModules: MODULES.filter((code) => moduleTiers(code).length > 0).length,
    tiers: TIER_ORDER.length,
    areas: FEATURE_AREAS.length,
    gatedRoutes: Object.values(ROUTE_MODULE).filter(Boolean).length,
    rbacOnlyRoutes: RBAC_ONLY_ROUTES.length,
    // Entidades e funções vêm do inventário do repositório, não do agrupamento
    // editorial: o número não pode ficar curto por o grupo não ter sido revisto.
    entities: INVENTORY_TOTALS.entities,
    entityRelations: INVENTORY_TOTALS.relations,
    entityFields: INVENTORY_TOTALS.fields,
    functions: INVENTORY_TOTALS.functions,
    multiplexedFunctions: INVENTORY_TOTALS.multiplexedFunctions,
    workflows: INVENTORY_TOTALS.workflows,
    sharedModules: INVENTORY_TOTALS.shared,
    connectors: INVENTORY_TOTALS.connectors,
    agents: INVENTORY_TOTALS.agents,
  };
}

// ─── Modelo de dados (derivado + agrupamento curado) ────────────

/**
 * Campos-chave de uma entidade: as relações e os obrigatórios, até `limit`.
 * O resto é contado, não listado — o esquema completo não cabe num documento.
 */
export function entityKeyFields(entity, limit = 8) {
  const relations = entity.fields.filter((field) => field.relation);
  const required = entity.fields.filter((field) => field.required && !field.relation);
  const keyFields = [...relations, ...required].slice(0, limit);
  return { keyFields, omittedFields: entity.fieldCount - keyFields.length };
}

/**
 * Modelo de dados pronto a renderizar: o agrupamento editorial por domínio, com
 * cada entidade confrontada com o inventário derivado — e a lista das entidades
 * que existem no repositório e ainda não têm grupo.
 */
export function buildDataModel() {
  const byName = new Map(ENTITY_INVENTORY.map((entity) => [entity.name, entity]));
  const grouped = new Set(DATA_MODEL.entities.flatMap((group) => group.items));

  return {
    notes: DATA_MODEL_NOTES,
    groups: DATA_MODEL.entities.map((group) => ({
      group: group.group,
      entities: group.items.map((name) => {
        const entity = byName.get(name);
        if (!entity) return { name, missing: true };
        return { ...entity, ...entityKeyFields(entity) };
      }),
    })),
    unclassified: ENTITY_INVENTORY.filter((entity) => !grouped.has(entity.name)).map(
      (entity) => entity.name,
    ),
  };
}

// ─── Arquitetura de serviços (derivada + narrativa curada) ──────

const SHARED_NOTES = new Map((DATA_MODEL.shared || []).map((item) => [item.name, item.note]));

/** Arquitetura de serviços: narrativa curada + inventário do repositório. */
export function buildServiceArchitecture() {
  return {
    model: SERVICE_MODEL,
    workflows: WORKFLOW_INVENTORY,
    shared: SHARED_INVENTORY.map((name) => ({ name, note: SHARED_NOTES.get(name) || '' })),
    connectors: CONNECTOR_INVENTORY,
    agents: AGENT_INVENTORY,
  };
}

// ─── Estrutura da API (derivada + narrativa curada) ─────────────

/**
 * Estrutura da API: as rotas do frontend (recurso de capacidade e módulo que as
 * licencia, lidos de rbac.js e licenseModules.js) e as funções de backend com o
 * contrato extraído do código — resumo, ações, entradas e saídas.
 */
export function buildApiStructure() {
  const routes = Object.keys(ROUTE_MODULE).map((route) => {
    const code = ROUTE_MODULE[route];
    const item = routeItem(route);
    return {
      route,
      name: item ? item.name : null,
      summary: item ? item.summary : null,
      resource: resourceForRoute(route),
      resourceLabel: resourceForRoute(route) ? resourceLabel(resourceForRoute(route)) : null,
      module: code,
      moduleName: code ? MODULE_META[code].name : null,
    };
  });

  const byName = new Map(FUNCTION_INVENTORY.map((fn) => [fn.name, fn]));
  const withNote = (fn) => ({
    ...fn,
    note: fn.summary || FUNCTION_NOTES[fn.name] || '',
    noteIsCurated: !fn.summary && Boolean(FUNCTION_NOTES[fn.name]),
  });

  return {
    model: API_MODEL,
    routes,
    groups: DATA_MODEL.functions.map((group) => ({
      group: group.group,
      items: group.items.map((name) => {
        const fn = byName.get(name);
        return fn ? withNote(fn) : { name, missing: true };
      }),
    })),
    unclassified: FUNCTION_INVENTORY.filter(
      (fn) => !DATA_MODEL.functions.some((group) => group.items.includes(fn.name)),
    ).map(withNote),
  };
}
