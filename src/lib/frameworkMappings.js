/**
 * Correspondências entre referenciais — APENAS fontes oficiais.
 *
 * Fonte das ligações (src/data/legal/mappings.json):
 *  - Regulamento n.º 756/2026, Anexo I: campo «Referências» de cada controlo do QNRCS
 *    (ISO/IEC 27001:2022, ISO/IEC 27002:2022, NIST CSF 2.0, NIST SP 800-53 Rev. 5, CIS CSC v8.1, CyFun 2025);
 *  - ENX Association, «Fulfilment of NIS2 through VDA ISA 6» (julho de 2025): NIS2 ↔ VDA ISA 6;
 *  - Regulamento de Execução (UE) 2024/2690, Anexo: cada secção indica a alínea do art. 21.º, n.º 2, da NIS2.
 *
 * O QNRCS funciona como eixo: duas normas ficam relacionadas quando o mesmo controlo do QNRCS as cita
 * (relação indireta, sempre identificada com o controlo do QNRCS que a sustenta).
 *
 * Substitui a tabela manual anterior, que usava identificadores inventados (ex.: "NIS2-GOV-01").
 */
import mappings from '@/data/legal/mappings.json';

// Código do referencial na aplicação  ↔  código usado no grafo oficial
const APP_TO_GRAPH = {
  QNRC: 'QNRC',
  ISO27001: 'ISO27002',      // perguntas ISO 27001 da aplicação usam os controlos do Anexo A (A.n.m)
  NIST_CSF: 'NIST_CSF2',
  CIS_V8: 'CIS',
  NIS2: 'NIS2',
  TISAX_ISA6: 'ISA6',
  EU_2024_2690: 'EU_2024_2690',
};
const GRAPH_TO_APP = Object.fromEntries(Object.entries(APP_TO_GRAPH).map(([a, g]) => [g, a]));

const toGraphId = (appFw, id) => {
  if (appFw === 'ISO27001') return String(id).replace(/^A\./, '');
  if (appFw === 'CIS_V8') return String(id).replace(/^CIS-(\d+)(\..*)?$/, 'CIS-$1');
  return id;
};
const toAppId = (graphFw, id) => (graphFw === 'ISO27002' ? `A.${id}` : id);

const SOURCE_LABEL = {
  reg756: 'QNRCS (Reg. 756/2026, Anexo I)',
  enx_nis2_isa6: 'ENX — NIS2 através do VDA ISA 6',
  regexec2690: 'Reg. Exec. (UE) 2024/2690, Anexo',
};

// Índice de adjacência
const adj = new Map();
const add = (from, to, edge) => {
  const k = `${from[0]}::${from[1]}`;
  if (!adj.has(k)) adj.set(k, []);
  adj.get(k).push({ node: to, edge });
};
for (const e of mappings.edges) {
  add(e.a, e.b, e);
  add(e.b, e.a, e);
}

/** Vizinhos diretos de um nó do grafo oficial. */
export function officialNeighbours(graphFw, id) {
  return adj.get(`${graphFw}::${id}`) || [];
}

/**
 * Correspondências para uma pergunta de avaliação (interface usada por CrossMappingSuggestions).
 * Devolve { group, peers: [{ framework, id, via?, source }] } ou null.
 */
export function getCrossMappings(framework, controlId) {
  if (!framework || !controlId) return null;
  const gfw = APP_TO_GRAPH[framework];
  if (!gfw) return null;
  const gid = toGraphId(framework, controlId);
  const peers = new Map();
  const push = (node, source, via) => {
    const appFw = GRAPH_TO_APP[node[0]];
    if (!appFw) return;
    const appId = toAppId(node[0], node[1]);
    if (appFw === framework && appId === controlId) return;
    const key = `${appFw}::${appId}`;
    if (!peers.has(key)) peers.set(key, { framework: appFw, id: appId, via, source: SOURCE_LABEL[source] || source });
  };
  for (const { node, edge } of officialNeighbours(gfw, gid)) {
    push(node, edge.s);
    // segundo salto através do QNRCS (ou de uma referência NIS2), sempre identificado
    if (node[0] === 'QNRC' || node[0] === 'NIS2') {
      for (const n2 of officialNeighbours(node[0], node[1])) push(n2.node, n2.edge.s, `${node[0] === 'QNRC' ? 'QNRCS' : 'NIS2'} ${node[1]}`);
    }
  }
  if (peers.size === 0) return null;
  const list = [...peers.values()];
  return { group: [...new Set(list.map((p) => p.source))].join(' · '), peers: list };
}

export { mappings as officialMappings };
