import * as XLSX from 'xlsx';

/**
 * Importação de bases de perguntas — leitura do ficheiro no browser.
 *
 * Este módulo só sabe transformar um ficheiro carregado no pacote normalizado
 * que o backend espera (`{ framework, controls, questions }`): não decide nada
 * sobre o catálogo, não escreve e não classifica. A validação, a marcação de
 * duplicados/semelhantes e a publicação vivem em `manageQuestionImport`
 * (`base44/shared/questionImport.ts`), que é a fonte de verdade — o browser só
 * faz o mapeamento de colunas e a apresentação.
 *
 * `FIELD_ALIASES` é o espelho de `base44/shared/questionImport.ts`: o Deno não
 * importa deste módulo, pelo que acrescentar um cabeçalho aceite obriga a mexer
 * nos dois.
 */

/** Campos de pergunta oferecidos no mapeamento de colunas. */
export const IMPORT_FIELDS = [
  { key: 'framework_code', labelKey: 'qfd_framework', required: true },
  { key: 'control_id', labelKey: 'qfd_control_id', required: false },
  { key: 'domain', labelKey: 'qfd_domain_en', required: true },
  { key: 'domain_pt', labelKey: 'qfd_domain_pt', required: false },
  { key: 'question_text', labelKey: 'qfd_question_en', required: true },
  { key: 'question_text_pt', labelKey: 'qfd_question_pt', required: false },
  { key: 'guidance', labelKey: 'qfd_guidance_en', required: false },
  { key: 'guidance_pt', labelKey: 'qfd_guidance_pt', required: false },
  { key: 'answer_type', labelKey: 'qimp_field_answer_type', required: false },
  { key: 'weight', labelKey: 'qfd_weight', required: false },
  { key: 'order_index', labelKey: 'qfd_order_index', required: false },
];

export const FIELD_ALIASES = {
  framework_code: ['framework_code', 'framework', 'framework code', 'fw', 'standard', 'norma', 'quadro', 'referencial'],
  control_id: ['control_id', 'control', 'control id', 'controlo', 'id de controlo', 'requirement', 'requisito', 'ref', 'reference'],
  domain: ['domain', 'dominio', 'domínio', 'domain_en', 'categoria', 'category', 'area', 'área'],
  domain_pt: ['domain_pt', 'dominio_pt', 'domínio_pt', 'domain pt', 'dominio pt'],
  question_text: ['question_text', 'question', 'questions', 'pergunta', 'perguntas', 'questao', 'questão', 'texto', 'texto da pergunta'],
  question_text_pt: ['question_text_pt', 'question_pt', 'question pt', 'pergunta_pt', 'perguntas_pt', 'questao_pt', 'questão_pt'],
  guidance: ['guidance', 'help', 'hint', 'orientacao', 'orientação'],
  guidance_pt: ['guidance_pt', 'orientacao_pt', 'orientação_pt'],
  answer_type: ['answer_type', 'answer', 'tipo de resposta', 'answer type'],
  weight: ['weight', 'peso', 'ponderação', 'ponderacao'],
  order_index: ['order_index', 'order', 'ordem', 'index', 'índice', 'indice', 'posicao', 'posição'],
};

/** Estados possíveis de uma linha, com o token de tema de cada um. */
export const IMPORT_STATE_META = {
  valid: { labelKey: 'qimp_state_valid', className: 'bg-status-success/10 text-status-success border-status-success/20' },
  warning: { labelKey: 'qimp_state_warning', className: 'bg-status-warning/10 text-status-warning border-status-warning/20' },
  duplicate: { labelKey: 'qimp_state_duplicate', className: 'bg-status-info/10 text-status-info border-status-info/20' },
  error: { labelKey: 'qimp_state_error', className: 'bg-status-danger/10 text-status-danger border-status-danger/20' },
  applied: { labelKey: 'qimp_state_applied', className: 'bg-chart-2/10 text-chart-2 border-chart-2/20' },
};

export const IMPORT_STATE_ORDER = ['valid', 'warning', 'duplicate', 'error', 'applied'];

/** Tipos de item do lote. */
export const IMPORT_TYPE_KEYS = {
  framework: 'qimp_type_framework',
  control: 'qimp_type_control',
  question: 'qimp_type_question',
};

/** Chave de tradução de cada código de validação devolvido pelo servidor. */
export const ISSUE_KEYS = {
  missing_framework_code: 'qimp_issue_missing_framework_code',
  missing_domain: 'qimp_issue_missing_domain',
  missing_question_text: 'qimp_issue_missing_question_text',
  invalid_weight: 'qimp_issue_invalid_weight',
  invalid_answer_type: 'qimp_issue_invalid_answer_type',
  unknown_framework: 'qimp_issue_unknown_framework',
  unknown_control: 'qimp_issue_unknown_control',
  missing_pt: 'qimp_issue_missing_pt',
  missing_guidance: 'qimp_issue_missing_guidance',
  similar_existing: 'qimp_issue_similar_existing',
  duplicate_in_batch: 'qimp_issue_duplicate_in_batch',
  identical_existing: 'qimp_issue_identical_existing',
  updates_existing: 'qimp_issue_updates_existing',
  missing_control_id: 'qimp_issue_missing_control_id',
  missing_control_title: 'qimp_issue_missing_control_title',
  missing_maturity_levels: 'qimp_issue_missing_maturity_levels',
  missing_framework_name: 'qimp_issue_missing_framework_name',
  invalid_framework_status: 'qimp_issue_invalid_framework_status',
};

/** Erros de negócio devolvidos pelas funções, com a chave de tradução. */
export const ERROR_KEYS = {
  empty_bundle: 'qimp_error_empty_bundle',
  cannot_approve_error: 'qimp_error_cannot_approve_error',
  no_approved_items: 'qimp_error_no_approved_items',
  errors_approved: 'qimp_error_errors_approved',
  unresolved_framework: 'qimp_error_unresolved_framework',
  batch_already_processed: 'qimp_error_batch_processed',
  batch_not_draft: 'qimp_error_batch_processed',
  batch_not_published: 'qimp_error_batch_not_published',
  empty_file: 'qimp_error_empty_file',
  parse_failed: 'qimp_error_parse',
  missing_file: 'qimp_error_missing_file',
  Forbidden: 'qimp_error_forbidden',
};

export const errorKeyFor = (code) => ERROR_KEYS[code] || 'qimp_error_generic';

export function normalizeHeader(header) {
  return String(header ?? '').toLowerCase().trim();
}

/** Tipo de ficheiro a partir do nome (usado na proveniência e no parsing). */
export function fileTypeOf(fileName) {
  const extension = String(fileName || '').split('.').pop()?.toLowerCase();
  if (extension === 'json') return 'json';
  if (extension === 'csv' || extension === 'txt') return 'csv';
  if (extension === 'xlsx' || extension === 'xls') return 'xlsx';
  if (extension === 'pdf') return 'pdf';
  if (extension === 'docx' || extension === 'doc') return 'docx';
  return 'manual';
}

/** Ficheiros que exigem extração por IA (o browser só os carrega). */
export function needsAiExtraction(fileType) {
  return fileType === 'pdf' || fileType === 'docx';
}

/**
 * Mapeamento automático: para cada campo, a primeira coluna cujo cabeçalho
 * corresponde a um dos apelidos aceites.
 */
export function detectMapping(headers = []) {
  const mapping = {};
  const columns = headers.map(header => ({ header, key: normalizeHeader(header) }));
  for (const field of IMPORT_FIELDS) {
    const aliases = [field.key, ...(FIELD_ALIASES[field.key] || [])].map(normalizeHeader);
    const match = columns.find(column => aliases.includes(column.key));
    if (match) mapping[field.key] = match.header;
  }
  return mapping;
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read_failed'));
    reader.readAsText(file);
  });
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('read_failed'));
    reader.readAsArrayBuffer(file);
  });
}

/** Primeira folha do ficheiro como cabeçalhos + linhas (CSV incluído). */
export async function parseSheet(file) {
  // CSV/TXT são texto: lidos como string o SheetJS respeita o UTF-8 (lidos como
  // bytes assume uma codepage e transforma "ção" em "Ã§Ã£o"). Os ficheiros
  // binários (.xlsx) trazem a codificação dentro do próprio ficheiro.
  const extension = String(file.name || '').split('.').pop()?.toLowerCase();
  const isText = extension === 'csv' || extension === 'txt';
  const source = isText ? await readFileAsText(file) : await readFileAsArrayBuffer(file);
  const workbook = isText ? XLSX.read(source, { type: 'string' }) : XLSX.read(source, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, blankrows: false, defval: '' });
  const [headers = [], ...rows] = matrix;
  return { headers: headers.map(header => String(header ?? '').trim()), rows };
}

/**
 * Constrói as perguntas do pacote a partir das linhas da folha, aplicando o
 * mapeamento escolhido. Os valores viajam como texto: quem valida pesos e
 * enums é o servidor (a mesma regra para todos os formatos de entrada).
 */
export function rowsToQuestions(headers, rows, mapping, defaults = {}) {
  const fields = IMPORT_FIELDS.map(field => field.key).filter(key => mapping[key]);
  const positions = {};
  for (const field of fields) positions[field] = headers.indexOf(mapping[field]);

  const questions = [];
  rows.forEach((row, rowIndex) => {
    const record = {};
    let hasValue = false;
    for (const field of fields) {
      const position = positions[field];
      const raw = position >= 0 ? row[position] : '';
      record[field] = raw === undefined || raw === null ? '' : String(raw).trim();
      if (record[field]) hasValue = true;
    }
    if (!hasValue) return;
    if (!record.framework_code && defaults.frameworkCode) record.framework_code = defaults.frameworkCode;
    record.row_number = rowIndex + 2; // linha 1 é o cabeçalho
    questions.push(record);
  });

  return questions;
}
