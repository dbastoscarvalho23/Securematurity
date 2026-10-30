/**
 * Inventário de ativos: campos, importação (Excel/CSV) e exportação da lista do art. 32.º do
 * Regulamento do CNCS n.º 756/2026. Os cabeçalhos aceites são os do modelo
 * public/templates/AnkoraOne_Modelo_Inventario_Ativos_e_Ferramentas.xlsx (com ou sem « *»).
 */

export const ASSET_TYPES = { physical: 'Equipamento físico', software: 'Software ou aplicação', network: 'Rede ou fluxo de comunicação', supplier_service: 'Serviço de fornecedor', data: 'Dados ou informação', service: 'Serviço ou operação', facility: 'Instalação física' };
export const CRITICALITY = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' };
export const LIFECYCLE = { planned: 'Planeado', production: 'Em produção', retiring: 'Em descontinuação', retired: 'Abatido' };

// header (normalizado) → campo
export const COLUMNS = [
  ['ID do ativo', 'asset_code', true],
  ['Nome do ativo', 'name', true],
  ['Tipo de ativo', 'asset_type', true],
  ['Serviço suportado', 'service', true],
  ['Descrição', 'description'],
  ['Fabricante', 'manufacturer'],
  ['Modelo / Versão', 'model_version'],
  ['Sistema operativo', 'operating_system'],
  ['Software do servidor aplicacional', 'app_server_software'],
  ['Localização', 'location'],
  ['Responsável (proprietário)', 'owner', true],
  ['Fornecedor', 'supplier'],
  ['Acessível publicamente pela Internet', 'internet_exposed', true],
  ['Endereço IP', 'ip_address'],
  ['FQDN', 'fqdn'],
  ['Dependências (IDs de outros ativos)', 'dependencies'],
  ['Confidencialidade', 'confidentiality', true],
  ['Integridade', 'integrity', true],
  ['Autenticidade', 'authenticity', true],
  ['Disponibilidade', 'availability', true],
  ['Criticidade', 'criticality', true],
  ['RTO (horas)', 'rto_hours'],
  ['RPO (horas)', 'rpo_hours'],
  ['Fase do ciclo de vida', 'lifecycle', true],
  ['Fim de suporte do fabricante', 'end_of_support'],
  ['Sujeito a registo de eventos', 'logging_required'],
  ['Data da última revisão', 'last_review', true],
  ['Observações', 'notes'],
];

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const HEADER_MAP = Object.fromEntries(COLUMNS.map(([h, f]) => [norm(h), f]));
const LABEL = Object.fromEntries(COLUMNS.map(([h, f]) => [f, h]));
const validYmd = (s) => { const d = new Date(`${s}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; };
const reverse = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [norm(v), k]));
const TYPE_IN = { ...reverse(ASSET_TYPES), ...Object.fromEntries(Object.keys(ASSET_TYPES).map((k) => [k, k])) };
const CRIT_IN = { ...reverse(CRITICALITY), ...Object.fromEntries(Object.keys(CRITICALITY).map((k) => [k, k])) };
const LIFE_IN = { ...reverse(LIFECYCLE), ...Object.fromEntries(Object.keys(LIFECYCLE).map((k) => [k, k])) };

const yesNo = (v) => {
  const n = norm(v);
  if (['sim', 'yes', 's', 'y', 'true', '1', 'x'].includes(n)) return true;
  if (['nao', 'no', 'n', 'false', '0', ''].includes(n)) return false;
  return null;
};
const scale = (v) => {
  const m = String(v ?? '').match(/[1-4]/);
  return m ? Number(m[0]) : null;
};
const toDate = (v) => {
  if (v == null || v === '') return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // A SheetJS cria as datas à meia-noite local; usar as componentes locais evita recuar um dia.
    const p = (n) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  if (typeof v === 'number') { // série do Excel
    const d = new Date(Math.round((v - 25569) * 86400000));
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return validYmd(s.slice(0, 10)) ? s.slice(0, 10) : null;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  const out = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
  return out && validYmd(out) ? out : null;
};
const num = (v) => (v === '' || v == null ? null : Number.isFinite(Number(String(v).replace(',', '.'))) ? Number(String(v).replace(',', '.')) : NaN);
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/\d{1,2})?$/;
const IPV6 = /^[0-9a-f:]+(\/\d{1,3})?$/i;
const FQDN = /^(?=.{1,253}$)([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/i;

/**
 * Lê um ficheiro .xlsx/.xls/.ods/.csv no browser. Devolve { assets, tools }: as linhas (matriz) da folha
 * «Ativos» (ou da primeira folha) e, se existir, da folha «Ferramentas».
 */
export async function readWorkbook(file) {
  const mod = await import('@/lib/xlsx');
  const XLSX = mod.read ? mod : mod.default;
  const isText = /\.(csv|tsv|txt)$/i.test(file.name || '');
  const wb = isText
    ? XLSX.read((await file.text()).replace(/^\uFEFF/, ''), { type: 'string', cellDates: true, raw: false })
    : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, raw: false });
  const rowsOf = (name) => (name ? XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true }) : []);
  const find = (n) => wb.SheetNames.find((x) => norm(x) === n);
  return { assets: rowsOf(find('ativos') || wb.SheetNames[0]), tools: rowsOf(find('ferramentas')) };
}

/** Validação do formulário de um ativo (mesmas regras da importação). */
export function checkAsset(d, otherCodes = new Set()) {
  const errors = [];
  for (const [h, f, req] of COLUMNS) {
    const v = d[f];
    if (req && (v === undefined || v === null || v === '' || (f === 'internet_exposed' && typeof v !== 'boolean'))) errors.push(`Obrigatório: ${h}`);
  }
  if (d.asset_code && otherCodes.has(d.asset_code)) errors.push('Já existe um ativo com este ID');
  if (d.ip_address && !d.ip_address.split(/[;,\s]+/).filter(Boolean).every((ip) => IPV4.test(ip) || IPV6.test(ip))) errors.push('Endereço IP inválido');
  if (d.fqdn && !d.fqdn.split(/[;,\s]+/).filter(Boolean).every((h) => FQDN.test(h))) errors.push('FQDN inválido');
  for (const f of ['rto_hours', 'rpo_hours']) if (d[f] != null && d[f] !== '' && !(Number(d[f]) >= 0)) errors.push(`${LABEL[f]}: número inválido`);
  const warnings = d.internet_exposed && !d.ip_address && !d.fqdn ? ['Ativo acessível pela Internet sem IP nem FQDN (art. 32.º, n.º 1, al. f) e g))'] : [];
  return { errors, warnings };
}

/**
 * Converte as linhas lidas em ativos validados.
 * Devolve { items: [{ row, data, errors, warnings }], unknownHeaders, missingHeaders }.
 */
export function parseAssetRows(rows, existingCodes = new Set()) {
  if (!rows.length) return { items: [], unknownHeaders: [], missingHeaders: COLUMNS.filter((c) => c[2]).map((c) => c[0]) };
  const header = rows[0].map((h) => String(h ?? ''));
  const fields = header.map((h) => HEADER_MAP[norm(h)] || null);
  const unknownHeaders = header.filter((h, i) => h && !fields[i]);
  const missingHeaders = COLUMNS.filter(([, f, req]) => req && !fields.includes(f)).map(([h]) => h);

  const items = [];
  const codesInFile = new Map();
  rows.slice(1).forEach((r, idx) => {
    const rowNo = idx + 2;
    const raw = {};
    fields.forEach((f, i) => { if (f) raw[f] = r[i]; });
    if (Object.values(raw).every((v) => v === '' || v == null)) return; // linha vazia
    if (norm(raw.notes).startsWith('linha de exemplo')) return; // linha de exemplo do modelo
    if (/^(reg\.|reg exec|qnrcs)/.test(norm(raw.asset_code))) return; // linha da base legal do modelo
    const errors = [];
    const warnings = [];
    const d = {};
    const text = (f, max = 500) => { const v = raw[f]; if (v !== undefined && v !== '' && v != null) d[f] = String(v).trim().slice(0, max); };
    ['asset_code', 'name', 'service', 'description', 'manufacturer', 'model_version', 'operating_system', 'app_server_software', 'location', 'owner', 'supplier', 'ip_address', 'fqdn', 'notes'].forEach((f) => text(f, f === 'description' || f === 'notes' ? 2000 : 300));
    if (raw.asset_type !== undefined && raw.asset_type !== '') { d.asset_type = TYPE_IN[norm(raw.asset_type)]; if (!d.asset_type) errors.push(`Tipo de ativo desconhecido: «${raw.asset_type}»`); }
    if (raw.criticality !== undefined && raw.criticality !== '') { d.criticality = CRIT_IN[norm(raw.criticality)]; if (!d.criticality) errors.push(`Criticidade desconhecida: «${raw.criticality}»`); }
    if (raw.lifecycle !== undefined && raw.lifecycle !== '') { d.lifecycle = LIFE_IN[norm(raw.lifecycle)]; if (!d.lifecycle) errors.push(`Fase do ciclo de vida desconhecida: «${raw.lifecycle}»`); }
    for (const f of ['internet_exposed', 'logging_required']) {
      if (raw[f] !== undefined && raw[f] !== '') { const b = yesNo(raw[f]); if (b === null) errors.push(`Valor Sim/Não inválido em ${f === 'internet_exposed' ? 'Acessível pela Internet' : 'Registo de eventos'}`); else d[f] = b; }
    }
    for (const f of ['confidentiality', 'integrity', 'authenticity', 'availability']) {
      if (raw[f] !== undefined && raw[f] !== '') { const s = scale(raw[f]); if (!s) errors.push(`${LABEL[f]}: escala de 1 a 4 inválida`); else d[f] = s; }
    }
    for (const f of ['rto_hours', 'rpo_hours']) {
      const n = num(raw[f]); if (Number.isNaN(n) || (n != null && n < 0)) errors.push(`${LABEL[f]}: número inválido`); else if (n != null) d[f] = n;
    }
    for (const f of ['end_of_support', 'last_review']) {
      if (raw[f] !== undefined && raw[f] !== '') { const v = toDate(raw[f]); if (v === null) errors.push(`${LABEL[f]}: data inválida (use AAAA-MM-DD)`); else d[f] = v; }
    }
    if (raw.dependencies) d.dependencies = String(raw.dependencies).split(/[;,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 100);

    for (const [h, f, req] of COLUMNS) if (req && (raw[f] === undefined || raw[f] === '' || raw[f] == null)) errors.push(`Obrigatório: ${h}`);
    if (d.internet_exposed) {
      if (!d.ip_address && !d.fqdn) warnings.push('Ativo acessível pela Internet sem IP nem FQDN (art. 32.º, n.º 1, al. f) e g))');
    }
    if (d.ip_address && !d.ip_address.split(/[;,\s]+/).filter(Boolean).every((ip) => IPV4.test(ip) || IPV6.test(ip))) errors.push('Endereço IP inválido');
    if (d.fqdn && !d.fqdn.split(/[;,\s]+/).filter(Boolean).every((h) => FQDN.test(h))) errors.push('FQDN inválido');
    if (d.asset_code) {
      if (codesInFile.has(d.asset_code)) errors.push(`ID repetido no ficheiro (linha ${codesInFile.get(d.asset_code)})`);
      else codesInFile.set(d.asset_code, rowNo);
    }
    items.push({ row: rowNo, data: d, errors, warnings, update: existingCodes.has(d.asset_code) });
  });

  // dependências para ativos inexistentes
  const known = new Set([...existingCodes, ...codesInFile.keys()]);
  for (const it of items) {
    const missing = (it.data.dependencies || []).filter((c) => !known.has(c));
    if (missing.length) it.warnings.push(`Dependências desconhecidas: ${missing.join(', ')}`);
  }
  return { items, unknownHeaders, missingHeaders };
}

/** Campos alterados entre duas versões de um ativo (para o histórico). */
export function diffAsset(before, after) {
  const out = {};
  for (const [, f] of COLUMNS) {
    const a = before?.[f] ?? '';
    const b = after?.[f] ?? '';
    if (JSON.stringify(a) !== JSON.stringify(b)) out[f] = [a, b];
  }
  return out;
}

/** Linhas da lista do art. 32.º (ativos diretamente acessíveis pela Internet). */
export function article32Rows(assets) {
  const header = ['a) Serviço suportado', 'b) Nome do equipamento / software', 'c) Modelo / Versão', 'd) Sistema operativo', 'e) Software do servidor aplicacional', 'f) Endereço IP', 'g) FQDN', 'h) Fabricante', 'i) Dependências', 'ID do ativo'];
  const byCode = Object.fromEntries(assets.map((a) => [a.asset_code, a]));
  const rows = assets.filter((a) => a.internet_exposed && a.lifecycle !== 'retired').map((a) => [
    a.service || '', a.name || '', a.model_version || '', a.operating_system || '', a.app_server_software || '',
    a.ip_address || '', a.fqdn || '', a.manufacturer || '',
    (a.dependencies || []).map((c) => (byCode[c] ? `${c} (${byCode[c].name})` : c)).join('; '),
    a.asset_code || '',
  ]);
  return [header, ...rows];
}

export async function downloadXlsx(fileName, sheetName, aoa, note) {
  const mod = await import('@/lib/xlsx');
  const XLSX = mod.utils ? mod : mod.default;
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(note ? [[note], [], ...aoa] : aoa);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, fileName);
}

// ---- Ferramentas (folha «Ferramentas» do modelo) ----
const TOOL_COLUMNS = [
  ['Categoria', 'category', true],
  ['Produto / ferramenta', 'product', true],
  ['Fabricante', 'vendor'],
  ['Versão', 'version'],
  ['Ativos abrangidos (IDs)', 'asset_codes'],
  ['Evidência apresentada', 'evidence_desc'],
  ['Nome do ficheiro de evidência', 'evidence_file'],
  ['Data da evidência', 'evidence_date'],
  ['Responsável', 'owner'],
  ['Observações', 'notes'],
];
const TOOL_HEADER_MAP = Object.fromEntries(TOOL_COLUMNS.map(([h, f]) => [norm(h), f]));

/** Converte as linhas da folha de ferramentas; catalog = TOOL_CATALOG (categoria pelo nome PT/EN ou id). */
export function parseToolRows(rows, catalog, knownAssetCodes = new Set()) {
  if (!rows.length) return { items: [], missingHeaders: ['Categoria', 'Produto / ferramenta'] };
  const fields = rows[0].map((h) => TOOL_HEADER_MAP[norm(h)] || null);
  const missingHeaders = TOOL_COLUMNS.filter(([, f, req]) => req && !fields.includes(f)).map(([h]) => h);
  const byName = {};
  for (const c of catalog) { byName[norm(c.pt)] = c; byName[norm(c.en)] = c; byName[c.id] = c; }
  const items = [];
  rows.slice(1).forEach((r, idx) => {
    const raw = {};
    fields.forEach((f, i) => { if (f) raw[f] = r[i]; });
    if (Object.values(raw).every((v) => v === '' || v == null)) return;
    if (norm(raw.notes).startsWith('linha de exemplo')) return;
    const errors = []; const warnings = [];
    const cat = byName[norm(raw.category)];
    if (!cat) errors.push(`Categoria fora do catálogo: «${raw.category}»`);
    const product = String(raw.product ?? '').trim().slice(0, 200);
    if (!product) errors.push('Obrigatório: Produto / ferramenta');
    const asset_codes = String(raw.asset_codes ?? '').split(/[;,\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 200);
    const unknown = asset_codes.filter((c) => !knownAssetCodes.has(c));
    if (unknown.length) warnings.push(`Ativos desconhecidos: ${unknown.join(', ')}`);
    const extra = [raw.evidence_desc, raw.evidence_file, toDate(raw.evidence_date)].filter(Boolean).join(' · ');
    if (extra) warnings.push('O ficheiro de evidência indicado tem de ser anexado na ferramenta (a folha só refere o nome)');
    const notes = [String(raw.notes ?? '').trim(), extra ? `Evidência indicada na importação: ${extra}` : ''].filter(Boolean).join('\n').slice(0, 2000);
    items.push({
      row: idx + 2, errors, warnings,
      data: cat ? {
        category: cat.id, product, vendor: String(raw.vendor ?? '').trim().slice(0, 200), version: String(raw.version ?? '').trim().slice(0, 100),
        asset_codes, nis2_letters: cat.nis2, regexec_points: cat.regexec, qnrcs_controls: cat.qnrcs,
        owner: String(raw.owner ?? '').trim().slice(0, 200), notes, status: 'active',
      } : null,
    });
  });
  return { items, missingHeaders };
}

/** Inventário completo no formato do modelo (cabeçalhos iguais, para reimportar). */
export function inventoryRows(assets) {
  const header = COLUMNS.map(([h, , req]) => (req ? `${h} *` : h));
  const val = (a, f) => {
    const v = a[f];
    if (v == null) return '';
    if (f === 'asset_type') return ASSET_TYPES[v] || v;
    if (f === 'criticality') return CRITICALITY[v] || v;
    if (f === 'lifecycle') return LIFECYCLE[v] || v;
    if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
    if (Array.isArray(v)) return v.join('; ');
    return v;
  };
  return [header, ...assets.map((a) => COLUMNS.map(([, f]) => val(a, f)))];
}