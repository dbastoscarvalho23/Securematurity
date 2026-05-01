import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download, ChevronRight, ArrowLeft, X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_FIELDS = [
  { key: 'risk_id',         label: 'Risk ID',         required: false },
  { key: 'title',           label: 'Title',           required: true  },
  { key: 'description',     label: 'Description',     required: false },
  { key: 'category',        label: 'Category',        required: false },
  { key: 'impact',          label: 'Impact (1–5)',     required: false },
  { key: 'likelihood',      label: 'Likelihood (1–5)', required: false },
  { key: 'status',          label: 'Status',          required: false },
  { key: 'owner_email',     label: 'Owner Email',     required: false },
  { key: 'due_date',        label: 'Due Date',        required: false },
  { key: 'treatment_notes', label: 'Treatment Notes', required: false },
  { key: 'customer_name',   label: 'Customer Name',   required: false },
];

const CATEGORIES = [
  { value: 'access_control',   label: 'Access Control' },
  { value: 'data_protection',  label: 'Data Protection' },
  { value: 'network_security', label: 'Network Security' },
  { value: 'physical_security',label: 'Physical Security' },
  { value: 'third_party',      label: 'Third Party' },
  { value: 'compliance',       label: 'Compliance' },
  { value: 'operational',      label: 'Operational' },
  { value: 'other',            label: 'Other' },
];

const CATEGORY_MAP = {
  'access control': 'access_control', 'access_control': 'access_control', 'controlo de acesso': 'access_control', 'access': 'access_control',
  'data protection': 'data_protection', 'data_protection': 'data_protection', 'proteção de dados': 'data_protection', 'data': 'data_protection',
  'network security': 'network_security', 'network_security': 'network_security', 'segurança de rede': 'network_security', 'network': 'network_security',
  'physical security': 'physical_security', 'physical_security': 'physical_security', 'segurança física': 'physical_security', 'physical': 'physical_security',
  'third party': 'third_party', 'third_party': 'third_party', 'terceiros': 'third_party', 'supplier': 'third_party', 'vendor': 'third_party',
  'compliance': 'compliance', 'conformidade': 'compliance', 'regulatory': 'compliance',
  'operational': 'operational', 'operacional': 'operational', 'operations': 'operational',
  'other': 'other', 'outro': 'other', 'outros': 'other', 'general': 'other',
};

const STATUS_MAP = {
  'open': 'open', 'aberto': 'open',
  'in treatment': 'in_treatment', 'in_treatment': 'in_treatment', 'em tratamento': 'in_treatment',
  'accepted': 'accepted', 'aceite': 'accepted',
  'closed': 'closed', 'fechado': 'closed',
};

const AUTO_HINTS = {
  risk_id:         ['risk id', 'risk_id', 'id', 'risk number', 'ref', 'reference'],
  title:           ['title', 'risk', 'risk title', 'name', 'risk name', 'titulo', 'risco'],
  description:     ['description', 'desc', 'details', 'descricao', 'descrição'],
  category:        ['category', 'categoria', 'type', 'tipo'],
  impact:          ['impact', 'impacto', 'impact score', 'imp'],
  likelihood:      ['likelihood', 'probabilidade', 'probability', 'prob', 'likelihood score', 'like'],
  status:          ['status', 'estado', 'state'],
  owner_email:     ['owner', 'owner email', 'email', 'responsavel', 'responsável', 'owner_email'],
  due_date:        ['due date', 'due_date', 'deadline', 'prazo', 'data'],
  treatment_notes: ['treatment', 'treatment notes', 'notes', 'notas', 'mitigacao', 'mitigação', 'mitigation'],
  customer_name:   ['customer', 'customer name', 'cliente', 'organization'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeHeader(h) { return String(h || '').toLowerCase().trim(); }

function autoDetectMapping(allSheetData) {
  // Returns { fieldKey: { sheet, col } } using hints across all sheets
  const mapping = {};
  for (const [field, hints] of Object.entries(AUTO_HINTS)) {
    for (const [sheetName, { headers }] of Object.entries(allSheetData)) {
      const match = headers.find(h => hints.includes(normalizeHeader(h)));
      if (match) { mapping[field] = { sheet: sheetName, col: match }; break; }
    }
  }
  return mapping;
}

function parseNumber(val, min = 1, max = 5) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return 3;
  return Math.min(max, Math.max(min, n));
}

function parseExcelDate(raw) {
  if (!raw) return '';
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw);
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  return String(raw).trim();
}

// mapping: { fieldKey: { sheet, col } }
// sheetData: { sheetName: { headers, rows } }
function buildRisksFromMapping(sheetData, enabledSheets, mapping) {
  // Group fields by source sheet
  const bySheet = {};
  for (const [field, src] of Object.entries(mapping)) {
    if (!src || !src.sheet || !src.col) continue;
    if (!bySheet[src.sheet]) bySheet[src.sheet] = {};
    bySheet[src.sheet][field] = src.col;
  }

  // We need a "primary" sheet (the one that has `title`) to drive row count
  const titleSrc = mapping.title;
  if (!titleSrc) return [];

  const primarySheet = titleSrc.sheet;
  const { rows: primaryRows = [], headers: primaryHeaders = [] } = sheetData[primarySheet] || {};

  const getVal = (rows, headers, col, rowIdx) => {
    const idx = headers.indexOf(col);
    return idx >= 0 && rows[rowIdx] ? rows[rowIdx][idx] : '';
  };

  const risks = [];
  for (let i = 1; i < primaryRows.length; i++) {
    const title = String(getVal(primaryRows, primaryHeaders, titleSrc.col, i) || '').trim();
    if (!title) continue;

    const getField = (field) => {
      const src = mapping[field];
      if (!src || !src.sheet || !src.col) return '';
      const { rows = [], headers = [] } = sheetData[src.sheet] || {};
      return rows[i] !== undefined ? getVal(rows, headers, src.col, i) : '';
    };

    const rawCategory = String(getField('category') || '').trim();
    const rawStatus   = String(getField('status')   || '').toLowerCase().trim();

    risks.push({
      risk_id:         String(getField('risk_id')         || '').trim(),
      title,
      description:     String(getField('description')     || '').trim(),
      category:        CATEGORY_MAP[rawCategory.toLowerCase()] || rawCategory,
      rawCategory:     rawCategory, // keep original cell value for display
      impact:          parseNumber(getField('impact')),
      likelihood:      parseNumber(getField('likelihood')),
      status:          STATUS_MAP[rawStatus] || 'open',
      owner_email:     String(getField('owner_email')     || '').trim(),
      due_date:        parseExcelDate(getField('due_date')),
      treatment_notes: String(getField('treatment_notes') || '').trim(),
      customer_name:   String(getField('customer_name')   || '').trim(),
      linked_document_ids: [],
    });
  }
  return risks;
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Risk ID', 'Title', 'Description', 'Category', 'Impact', 'Likelihood', 'Status', 'Owner Email', 'Due Date', 'Treatment Notes', 'Customer Name'],
    ['RISK-001', 'Weak Password Policy', 'Users allowed to set short passwords without MFA', 'access_control', 4, 4, 'open', 'security@company.com', '2025-06-30', 'Enforce MFA and password complexity', 'Acme Corp'],
    ['RISK-002', 'Unpatched Servers', 'Several servers running outdated OS versions', 'network_security', 5, 3, 'in_treatment', 'ops@company.com', '2025-05-15', 'Patch management process', ''],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Risks');
  XLSX.writeFile(wb, 'risk_matrix_template.xlsx');
}

// ─── Step 1: Upload ────────────────────────────────────────────────────────────

function UploadStep({ onFile }) {
  const inputRef = useRef();
  const handleDrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); };
  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
      >
        <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">Drop your Excel file here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">.xlsx or .xls</p>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => onFile(e.target.files[0])} />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Don't have a file yet?</span>
        <button onClick={downloadTemplate} className="flex items-center gap-1 text-primary hover:underline font-medium">
          <Download className="w-3 h-3" /> Download template
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Drag & Drop Mapping ───────────────────────────────────────────────

function ColumnChip({ col, sheet, preview, dragging, onDragStart }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs cursor-grab select-none transition-all',
        dragging ? 'opacity-40' : 'bg-card border-border hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm'
      )}
      title={`Sheet: ${sheet}\nSample: ${preview}`}
    >
      <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0">
        <span className="font-medium truncate block max-w-[110px]">{col}</span>
        {preview && <span className="text-muted-foreground truncate block max-w-[110px]">{preview}</span>}
      </div>
      <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-auto flex-shrink-0">{sheet}</Badge>
    </div>
  );
}

function DropZone({ field, mapped, onDrop, onClear, sheetData }) {
  const [over, setOver] = useState(false);

  // Get preview value from first data row
  let preview = '';
  if (mapped) {
    const { rows = [], headers = [] } = sheetData[mapped.sheet] || {};
    const idx = headers.indexOf(mapped.col);
    if (rows[1] && idx >= 0) preview = String(rows[1][idx] || '').trim().slice(0, 30);
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); onDrop(field.key); }}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all min-h-[42px]',
        over ? 'border-primary bg-primary/10 scale-[1.01]' : mapped ? 'border-border bg-muted/30' : 'border-dashed border-border bg-card'
      )}
    >
      <div className="w-32 flex-shrink-0">
        <span className="text-xs font-medium">{field.label}</span>
        {field.required && <span className="text-destructive ml-0.5 text-xs">*</span>}
      </div>
      <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      {mapped ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs flex-1 min-w-0">
            <span className="font-medium text-primary truncate">{mapped.col}</span>
            <Badge variant="secondary" className="text-[9px] px-1 py-0 flex-shrink-0">{mapped.sheet}</Badge>
            {preview && <span className="text-muted-foreground truncate flex-shrink-0 hidden sm:block">· {preview}</span>}
          </div>
          <button onClick={onClear} className="text-muted-foreground hover:text-destructive flex-shrink-0 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground italic">
          {over ? '↓ Drop here' : 'drag a column here'}
        </span>
      )}
    </div>
  );
}

function MappingStep({ sheets, sheetData, mapping, onDrop, onClear }) {
  const [activeSheet, setActiveSheet] = useState(0);
  const [dragging, setDragging] = useState(null); // { sheet, col }

  const sheetName = sheets[activeSheet];
  const headers = sheetData[sheetName]?.headers || [];
  const rows = sheetData[sheetName]?.rows || [];

  const handleDragStart = (sheet, col) => {
    setDragging({ sheet, col });
  };

  const handleDrop = (fieldKey) => {
    if (dragging) { onDrop(fieldKey, dragging); setDragging(null); }
  };

  // Get first data row as preview
  const getPreview = (col) => {
    const idx = headers.indexOf(col);
    if (rows[1] && idx >= 0) return String(rows[1][idx] || '').trim().slice(0, 20);
    return '';
  };

  return (
    <div className="flex gap-4 h-[420px]">
      {/* Left: column browser */}
      <div className="w-52 flex-shrink-0 flex flex-col border rounded-lg overflow-hidden">
        {/* Sheet tabs */}
        <div className="flex flex-wrap gap-0.5 p-1.5 bg-muted/40 border-b">
          {sheets.map((name, idx) => (
            <button
              key={name}
              onClick={() => setActiveSheet(idx)}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                activeSheet === idx ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {name}
            </button>
          ))}
        </div>
        {/* Column chips */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-1 mb-1">Columns</p>
          {headers.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No columns found</p>
          )}
          {headers.map(col => (
            <ColumnChip
              key={col}
              col={col}
              sheet={sheetName}
              preview={getPreview(col)}
              dragging={dragging?.sheet === sheetName && dragging?.col === col}
              onDragStart={() => handleDragStart(sheetName, col)}
            />
          ))}
        </div>
      </div>

      {/* Right: drop targets */}
      <div className="flex-1 overflow-y-auto">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">
          Risk Fields — drag columns from the left onto each field
        </p>
        <div className="space-y-1.5">
          {RISK_FIELDS.map(field => (
            <DropZone
              key={field.key}
              field={field}
              mapped={mapping[field.key]}
              onDrop={handleDrop}
              onClear={() => onClear(field.key)}
              sheetData={sheetData}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Preview ───────────────────────────────────────────────────────────

function ScoreBadge({ score }) {
  return (
    <Badge variant="outline" className={cn('text-[10px] border',
      score >= 16 ? 'bg-destructive/10 text-destructive border-destructive/20' :
      score >= 9  ? 'bg-chart-4/10 text-chart-4 border-chart-4/20' :
      score >= 4  ? 'bg-chart-3/10 text-chart-3 border-chart-3/20' :
                    'bg-chart-2/10 text-chart-2 border-chart-2/20'
    )}>
      {score}
    </Badge>
  );
}

function PreviewStep({ sheetData, enabledSheets, mapping, overrides, onOverride }) {
  const risks = buildRisksFromMapping(sheetData, enabledSheets, mapping);
  const unmappedCount = risks.filter(r => !r.category).length;

  return (
    <div className="space-y-3">
      {unmappedCount > 0 && (
        <div className="flex items-center gap-2 p-2.5 bg-chart-3/10 border border-chart-3/20 rounded-lg text-xs text-chart-3">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {unmappedCount} row{unmappedCount !== 1 ? 's have' : ' has'} no recognized category — set them inline below.
        </div>
      )}
      {risks.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-40" />
          No valid rows found. Make sure the "Title" field is mapped.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  {['Title', 'Category', 'Impact', 'Likelihood', 'Score', 'Status', 'Owner'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {risks.map((r, i) => {
                  const effectiveCategory = overrides[i] ?? r.category;
                  const score = r.impact * r.likelihood;
                  const missingCategory = !effectiveCategory;
                  const isKnown = CATEGORIES.find(c => c.value === effectiveCategory);
                  return (
                    <tr key={i} className={cn('border-t', missingCategory ? 'bg-chart-3/5' : 'hover:bg-muted/30')}>
                      <td className="px-3 py-2 max-w-[180px] truncate font-medium">{r.title}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          {isKnown || missingCategory ? (
                            <select
                              value={effectiveCategory || ''}
                              onChange={e => onOverride(i, e.target.value)}
                              className={cn(
                                'text-xs rounded border px-1.5 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring',
                                missingCategory ? 'border-chart-3/50 text-chart-3' : 'border-border text-foreground'
                              )}
                            >
                              <option value="">— select —</option>
                              {CATEGORIES.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs px-1.5 py-1 rounded border border-border bg-muted/30">{effectiveCategory}</span>
                          )}
                          {missingCategory && r.rawCategory && (
                            <span className="text-[10px] text-muted-foreground italic">from Excel: "{r.rawCategory}"</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">{r.impact}</td>
                      <td className="px-3 py-2 text-center">{r.likelihood}</td>
                      <td className="px-3 py-2 text-center"><ScoreBadge score={score} /></td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.status?.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2 max-w-[130px] truncate text-muted-foreground">{r.owner_email || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 bg-muted/30 border-t flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
            {risks.length} risk{risks.length !== 1 ? 's' : ''} ready to import
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const STEPS = ['Upload', 'Map Fields', 'Preview & Import'];

export default function RiskExcelImportDialog({ open, onOpenChange, onImport }) {
  const [step, setStep]           = useState(0);
  const [fileName, setFileName]   = useState('');
  const [sheets, setSheets]       = useState([]);
  const [sheetData, setSheetData] = useState({});
  const [enabledSheets, setEnabled] = useState([]);
  const [mapping, setMapping]         = useState({}); // { fieldKey: { sheet, col } }
  const [categoryOverrides, setOverrides] = useState({}); // { rowIndex: categoryValue }
  const [importing, setImporting]     = useState(false);

  const reset = () => { setStep(0); setFileName(''); setSheets([]); setSheetData({}); setEnabled([]); setMapping({}); setOverrides({}); };
  const handleClose = () => { reset(); onOpenChange(false); };

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const names = wb.SheetNames;
      const data = {};
      names.forEach(name => {
        const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
        const headers = rawRows.length > 0 ? rawRows[0].map(h => String(h || '').trim()).filter(Boolean) : [];
        data[name] = { headers, rows: rawRows };
      });
      setSheets(names);
      setSheetData(data);
      setEnabled(names);
      setMapping(autoDetectMapping(data));
      setStep(1);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (fieldKey, src) => {
    setMapping(prev => ({ ...prev, [fieldKey]: src }));
  };

  const handleClear = (fieldKey) => {
    setMapping(prev => { const n = { ...prev }; delete n[fieldKey]; return n; });
  };

  const canProceed = !!mapping.title;
  const risks = step === 2 ? buildRisksFromMapping(sheetData, enabledSheets, mapping).map((r, i) => ({ ...r, category: categoryOverrides[i] ?? r.category })) : [];

  const handleImport = async () => {
    setImporting(true);
    const allRisks = buildRisksFromMapping(sheetData, enabledSheets, mapping).map((r, i) => ({
      ...r,
      category: categoryOverrides[i] ?? r.category,
    }));
    await onImport(allRisks);
    setImporting(false);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Import Risks from Excel
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-0 text-xs flex-shrink-0">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={cn(
                'px-3 py-1 rounded-full font-medium transition-colors',
                step === i ? 'bg-primary text-primary-foreground' :
                step > i  ? 'text-accent font-semibold' : 'text-muted-foreground'
              )}>
                {i + 1}. {s}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </React.Fragment>
          ))}
        </div>

        {/* File info bar */}
        {fileName && (
          <div className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-lg text-xs flex-shrink-0">
            <FileSpreadsheet className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="flex-1 truncate font-medium">{fileName}</span>
            <span className="text-muted-foreground">{sheets.length} sheet{sheets.length !== 1 ? 's' : ''}</span>
            <button onClick={reset} className="text-muted-foreground hover:text-foreground">Change</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          {step === 0 && <UploadStep onFile={handleFile} />}
          {step === 1 && (
            <MappingStep
              sheets={sheets}
              sheetData={sheetData}
              mapping={mapping}
              onDrop={handleDrop}
              onClear={handleClear}
            />
          )}
          {step === 2 && (
            <PreviewStep
              sheetData={sheetData}
              enabledSheets={enabledSheets}
              mapping={mapping}
              overrides={categoryOverrides}
              onOverride={(i, val) => setOverrides(prev => ({ ...prev, [i]: val }))}
            />
          )}
        </div>

        <DialogFooter className="border-t pt-4 flex items-center gap-2 flex-shrink-0">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="gap-1 mr-auto">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {step < 2 && (
            <Button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !canProceed}>
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          )}
          {step === 2 && (
            <Button onClick={handleImport} disabled={risks.length === 0 || importing} className="gap-2">
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              Import {risks.length > 0 ? `${risks.length} Risk${risks.length !== 1 ? 's' : ''}` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}