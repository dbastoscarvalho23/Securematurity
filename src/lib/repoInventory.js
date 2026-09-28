/**
 * Inventário derivado do repositório — entidades, funções, workflows, código
 * partilhado, conectores e agente de IA.
 *
 * É a metade derivada da documentação técnica: os ficheiros do repositório são
 * lidos no build (Vite `import.meta.glob` com `?raw`) e o contrato de cada peça é
 * extraído do próprio código — as entidades dão os campos e as relações, as
 * funções dão o resumo do seu cabeçalho de documentação, as ações que aceitam (o
 * selector multiplexado), os campos de entrada e as chaves de resposta, e os
 * workflows dão o gatilho e a função que chamam.
 *
 * Porque é derivado, não pode divergir do código: uma entidade, uma função ou um
 * workflow novo aparece aqui sem edição manual. O que NÃO é derivável (o que cada
 * peça faz, porque existe) é narrativa curada em `devDocsData.js` e é combinado
 * com este inventário por `docsModel.js`. Nada aqui é conteúdo editorial.
 */

const entityModules = import.meta.glob('/base44/entities/*.jsonc', {
  query: '?raw',
  eager: true,
  import: 'default',
});
const functionModules = import.meta.glob('/base44/functions/*/entry.ts', {
  query: '?raw',
  eager: true,
  import: 'default',
});
const workflowModules = import.meta.glob('/base44/workflows/*.jsonc', {
  query: '?raw',
  eager: true,
  import: 'default',
});
const agentModules = import.meta.glob('/base44/agents/*.jsonc', {
  query: '?raw',
  eager: true,
  import: 'default',
});
const connectorModules = import.meta.glob('/base44/connectors/*.jsonc', {
  query: '?raw',
  eager: true,
  import: 'default',
});
/** Só as chaves interessam (nome do ficheiro) — o código não é inlinado. */
const sharedModules = import.meta.glob('/base44/shared/*.ts');

const baseName = (path) => path.split('/').pop().replace(/\.(jsonc|ts)$/, '');
const dirName = (path) => path.split('/').slice(-2)[0];

/** JSONC → JSON: comentários de linha e de bloco e vírgulas finais. */
function stripJsonc(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1')
    .replace(/,\s*([}\]])/g, '$1');
}

function parseJsonc(text, fallback = null) {
  try {
    return JSON.parse(stripJsonc(text));
  } catch {
    return fallback;
  }
}

/** Primeiro parágrafo do cabeçalho de documentação de um ficheiro. */
function leadingDoc(source) {
  const block = source.match(/\/\*\*([\s\S]*?)\*\//);
  if (!block) return '';
  const lines = block[1].split('\n').map((line) => line.replace(/^\s*\*?\s?/, '').trim());
  const paragraph = [];
  for (const line of lines) {
    if (!line) {
      if (paragraph.length) break;
      continue;
    }
    if (line.startsWith('@')) break;
    paragraph.push(line);
  }
  const text = paragraph.join(' ').replace(/\s+/g, ' ').trim();
  return text.length > 280 ? `${text.slice(0, 277)}…` : text;
}

/** Selector multiplexado: comparações com literais (`action === "x"`). */
function actionsOf(source) {
  const found = new Set();
  for (const match of source.matchAll(/action\s*===\s*["'`]([a-z0-9_]+)["'`]/g)) found.add(match[1]);
  for (const match of source.matchAll(/case\s+["'`]([a-z0-9_]+)["'`]\s*:/g)) found.add(match[1]);
  return [...found];
}

/** Campos de entrada: a desestruturação do corpo do pedido. */
function inputsOf(source) {
  const found = new Set();
  for (const match of source.matchAll(
    /(?:const|let)\s*\{([\s\S]{0,700}?)\}\s*=\s*(?:await\s+)?(?:body|payload|data)\b/g,
  )) {
    match[1]
      .split(',')
      .map((part) => part.trim().split(':')[0].split('=')[0].replace(/^\.\.\./, '').trim())
      .filter((key) => /^[A-Za-z_$][\w$]*$/.test(key))
      .forEach((key) => found.add(key));
  }
  return [...found];
}

/** Chaves de topo de um literal de objeto que começa em `start`. */
function topLevelKeys(source, start) {
  const keys = [];
  let depth = 0;
  let segment = '';
  let quote = null;
  const push = () => {
    const key = segment.split(':')[0].trim().replace(/^\.\.\./, '');
    if (/^[A-Za-z_$][\w$]*$/.test(key)) keys.push(key);
  };
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === '\\') i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      if (depth === 1) quote = char;
      continue;
    }
    if (char === '{' || char === '[' || char === '(') {
      if (depth === 0) {
        depth = 1;
        segment = '';
        continue;
      }
      depth += 1;
      continue;
    }
    if (char === '}' || char === ']' || char === ')') {
      depth -= 1;
      if (depth === 0) {
        push();
        return keys;
      }
      continue;
    }
    if (depth === 1) {
      if (char === ',') {
        push();
        segment = '';
        continue;
      }
      segment += char;
    }
  }
  return keys;
}

/** Saídas: as chaves de topo de todas as respostas `Response.json({ … })`. */
function outputsOf(source) {
  const found = new Set();
  for (const match of source.matchAll(/Response\.json\(\s*\{/g)) {
    topLevelKeys(source, match.index + match[0].length - 1).forEach((key) => found.add(key));
  }
  return [...found];
}

const pascal = (snake) =>
  snake
    .split('_')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');

// ─── Entidades ──────────────────────────────────────────────────

const ENTITY_NAMES = Object.keys(entityModules).map((path) => baseName(path));
const entityNameSet = new Set(ENTITY_NAMES);

export const ENTITY_INVENTORY = Object.entries(entityModules)
  .map(([path, source]) => {
    const schema = parseJsonc(source, {});
    const required = schema.required || [];
    const fields = Object.entries(schema.properties || {}).map(([name, definition]) => {
      const refMatch = String(name).match(/^(.*?)_ids?$/);
      const ref = refMatch ? pascal(refMatch[1]) : null;
      return {
        name,
        type: Array.isArray(definition.type) ? definition.type.join(' | ') : definition.type || 'any',
        required: required.includes(name),
        enumCount: Array.isArray(definition.enum) ? definition.enum.length : 0,
        // Relação: campo cujo nome aponta para uma entidade que existe.
        relation: ref && entityNameSet.has(ref) ? ref : null,
        unresolvedRef: ref && !entityNameSet.has(ref) ? ref : null,
      };
    });
    return {
      name: schema.name || baseName(path),
      file: `${baseName(path)}.jsonc`,
      fields,
      fieldCount: fields.length,
      requiredCount: fields.filter((field) => field.required).length,
      relations: fields.filter((field) => field.relation).map((field) => ({ field: field.name, target: field.relation })),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// ─── Funções de backend ─────────────────────────────────────────

export const FUNCTION_INVENTORY = Object.entries(functionModules)
  .map(([path, source]) => ({
    name: dirName(path),
    summary: leadingDoc(source),
    actions: actionsOf(source),
    inputs: inputsOf(source),
    outputs: outputsOf(source),
    lines: source.split('\n').length,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// ─── Workflows ──────────────────────────────────────────────────

export const WORKFLOW_INVENTORY = Object.entries(workflowModules)
  .map(([path, source]) => {
    const schema = parseJsonc(source, {});
    const config = schema.trigger?.config || {};
    const calls = [
      ...new Set(
        [...source.matchAll(/"function_name"\s*:\s*"([A-Za-z0-9_]+)"/g)].map((match) => match[1]),
      ),
    ];
    return {
      name: schema.name || baseName(path),
      trigger: config.trigger_type || '—',
      cron: config.cron_expression || null,
      events: config.events || [],
      calls,
      description: schema.description || '',
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// ─── Código partilhado, conectores e agente ─────────────────────

export const SHARED_INVENTORY = Object.keys(sharedModules)
  .map((path) => baseName(path))
  .sort();

export const CONNECTOR_INVENTORY = Object.entries(connectorModules)
  .map(([path, source]) => {
    const schema = parseJsonc(source, {});
    return { name: baseName(path), type: schema.type || baseName(path), scopes: schema.scopes || [] };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export const AGENT_INVENTORY = Object.entries(agentModules)
  .map(([path, source]) => {
    const schema = parseJsonc(source, {});
    return {
      name: baseName(path),
      description: schema.description || '',
      tools: (schema.tool_configs || []).map((tool) => ({
        entity: tool.entity_name,
        operations: tool.allowed_operations || [],
      })),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

/** Números do inventário (usados nos totais da documentação). */
export const INVENTORY_TOTALS = {
  entities: ENTITY_INVENTORY.length,
  relations: ENTITY_INVENTORY.reduce((total, entity) => total + entity.relations.length, 0),
  fields: ENTITY_INVENTORY.reduce((total, entity) => total + entity.fieldCount, 0),
  functions: FUNCTION_INVENTORY.length,
  multiplexedFunctions: FUNCTION_INVENTORY.filter((fn) => fn.actions.length > 0).length,
  workflows: WORKFLOW_INVENTORY.length,
  shared: SHARED_INVENTORY.length,
  connectors: CONNECTOR_INVENTORY.length,
  agents: AGENT_INVENTORY.length,
};

/** Uma entidade do inventário pelo nome. */
export function entityFromInventory(name) {
  return ENTITY_INVENTORY.find((entity) => entity.name === name) || null;
}
