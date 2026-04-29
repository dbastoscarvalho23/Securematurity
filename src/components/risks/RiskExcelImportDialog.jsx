import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download, ChevronRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_FIELDS = [
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

const CATEGORY_MAP = {
  'access control': 'access_control', 'access_control': 'access_control',
  'data protection': 'data_protection', 'data_protection': 'data_protection',
  'network security': 'network_security', 'network_security': 'network_security',
  'physical security': 'physical_security', 'physical_security': 'physical_security',
  'third party': 'third_party', 'third_party': 'third_party',
  'compliance': 'compliance', 'operational': 'operational', 'other': 'other',
};

const STATUS_MAP = {
  'open': 'open', 'aberto': 'open',
  'in treatment': 'in_treatment', 'in_treatment': 'in_treatment', 'em tratamento': 'in_treatment',
  'accepted': 'accepted', 'aceite': 'accepted',
  'closed': 'closed', 'fechado': 'closed',
};

// Auto-detect best column for a field based on known aliases
const AUTO_HINTS = {
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

function autoDetectMapping(headers) {
  const mapping = {};
  for (const [field, hints] of Object.entries(AUTO_HINTS)) {
    const match = headers.find(h => hints.includes(normalizeHeader(h)));
    mapping[field] = match || '__none__';
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

function applyMappingToSheet(rawRows, headers, mapping) {
  const getVal = (row, colName) => {
    if (!colName || colName === '__none__') return '';
    const idx = headers.indexOf(colName);
    return idx >= 0 ? row[idx] : '';
  };

  const risks = [];
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const title = String(getVal(row, mapping.title) || '').trim();
    if (!title) continue;

    const rawCategory = String(getVal(row, mapping.category) || '').toLowerCase().trim();
    const rawStatus   = String(getVal(row, mapping.status)   || '').toLowerCase().trim();

    risks.push({
      title,
      description:     String(getVal(row, mapping.description)     || '').trim(),
      category:        CATEGORY_MAP[rawCategory] || 'other',
      impact:          parseNumber(getVal(row, mapping.impact)),
      likelihood:      parseNumber(getVal(row, mapping.likelihood)),
      status:          STATUS_MAP[rawStatus] || 'open',
      owner_email:     String(getVal(row, mapping.owner_email)     || '').trim(),
      due_date:        parseExcelDate(getVal(row, mapping.due_date)),
      treatment_notes: String(getVal(row, mapping.treatment_notes) || '').trim(),
      customer_name:   String(getVal(row, mapping.customer_name)   || '').trim(),
      linked_document_ids: [],
    });
  }
  return risks;
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Title', 'Description', 'Category', 'Impact', 'Likelihood', 'Status', 'Owner Email', 'Due Date', 'Treatment Notes', 'Customer Name'],
    ['Weak Password Policy', 'Users allowed to set short passwords without MFA', 'access_control', 4, 4, 'open', 'security@company.com', '2025-06-30', 'Enforce MFA and password complexity', 'Acme Corp'],
    ['Unpatched Servers', 'Several servers running outdated OS versions', 'network_security', 5, 3, 'in_treatment', 'ops@company.com', '2025-05-15', 'Patch management process', ''],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Risks');
  XLSX.writeFile(wb, 'risk_matrix_template.xlsx');
}

// ─── Sub-components ────────────────────────────────────────────────────────────

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

// Step 1 – Upload
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

// Step 2 – Sheet & Field Mapping
function MappingStep({ sheets, sheetData, enabledSheets, onToggleSheet, mappings, onMappingChange, activeSheet, onSwitchSheet }) {
  const sheetName = sheets[activeSheet];
  const headers   = sheetData[sheetName]?.headers || [];
  const mapping   = mappings[sheetName] || {};
  const rawRows   = sheetData[sheetName]?.rows || [];

  return (
    <div className="space-y-4">
      {/* Sheet selector */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sheets to import</p>
        <div className="flex gap-2 flex-wrap">
          {sheets.map((name, idx) => (
            <button
              key={name}
              onClick={() => onSwitchSheet(idx)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                activeSheet === idx ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
              )}
            >
              <input
                type="checkbox"
                checked={enabledSheets.includes(name)}
                onChange={e => { e.stopPropagation(); onToggleSheet(name); }}
                onClick={e => e.stopPropagation()}
                className="w-3 h-3 accent-primary"
              />
              {name}
              <span className="opacity-60">({rawRows.length - 1 > 0 ? rawRows.length - 1 : 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Column mapping for active sheet */}
      {enabledSheets.includes(sheetName) && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Column mapping — <span className="text-foreground normal-case font-medium">{sheetName}</span>
          </p>
          <div className="border rounded-lg overflow-hidden divide-y">
            {RISK_FIELDS.map(field => (
              <div key={field.key} className="flex items-center gap-3 px-3 py-2 bg-card hover:bg-muted/30 transition-colors">
                <div className="w-36 flex-shrink-0">
                  <span className="text-xs font-medium">{field.label}</span>
                  {field.required && <span className="text-destructive ml-0.5">*</span>}
                </div>
                <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <Select
                  value={mapping[field.key] || '__none__'}
                  onValueChange={val => onMappingChange(sheetName, field.key, val)}
                >
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder="— not mapped —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— not mapped —</SelectItem>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Step 3 – Preview
function PreviewStep({ sheets, enabledSheets, sheetData, mappings, activeSheet, onSwitchSheet }) {
  const sheetName = sheets[activeSheet];
  const { rows = [], headers = [] } = sheetData[sheetName] || {};
  const mapping = mappings[sheetName] || {};
  const risks = applyMappingToSheet(rows, headers, mapping);

  const totalRisks = enabledSheets.reduce((acc, name) => {
    const { rows: r = [], headers: h = [] } = sheetData[name] || {};
    return acc + applyMappingToSheet(r, h, mappings[name] || {}).length;
  }, 0);

  return (
    <div className="space-y-3">
      {/* Sheet tabs */}
      {sheets.filter(s => enabledSheets.includes(s)).length > 1 && (
        <div className="flex gap-1 flex-wrap">
          {sheets.filter(s => enabledSheets.includes(s)).map((name, _, arr) => {
            const idx = sheets.indexOf(name);
            return (
              <button
                key={name}
                onClick={() => onSwitchSheet(idx)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium border transition-colors',
                  activeSheet === idx ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      {risks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-40" />
          No valid rows. Make sure "Title" is mapped and rows aren't empty.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-64">
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
                  const score = r.impact * r.likelihood;
                  return (
                    <tr key={i} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 max-w-[180px] truncate font-medium">{r.title}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.category?.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2 text-center">{r.impact}</td>
                      <td className="px-3 py-2 text-center">{r.likelihood}</td>
                      <td className="px-3 py-2 text-center"><ScoreBadge score={score} /></td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.status?.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2 max-w-[140px] truncate text-muted-foreground">{r.owner_email || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 bg-muted/30 border-t flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
            {risks.length} risks in this sheet
            {enabledSheets.length > 1 && ` · ${totalRisks} total across all selected sheets`}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

const STEPS = ['Upload', 'Map Columns', 'Preview & Import'];

export default function RiskExcelImportDialog({ open, onOpenChange, onImport }) {
  const [step, setStep]               = useState(0);
  const [fileName, setFileName]       = useState('');
  const [sheets, setSheets]           = useState([]);
  const [sheetData, setSheetData]     = useState({}); // { sheetName: { headers, rows } }
  const [enabledSheets, setEnabled]   = useState([]);
  const [mappings, setMappings]       = useState({}); // { sheetName: { field: colHeader } }
  const [activeSheet, setActiveSheet] = useState(0);
  const [importing, setImporting]     = useState(false);

  const reset = () => {
    setStep(0); setFileName(''); setSheets([]); setSheetData({});
    setEnabled([]); setMappings({}); setActiveSheet(0);
  };

  const handleClose = () => { reset(); onOpenChange(false); };

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const names = wb.SheetNames;
      const data = {};
      const maps = {};
      names.forEach(name => {
        const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
        const headers = rawRows.length > 0 ? rawRows[0].map(h => String(h || '').trim()).filter(Boolean) : [];
        data[name] = { headers, rows: rawRows };
        maps[name] = autoDetectMapping(headers);
      });
      setSheets(names);
      setSheetData(data);
      setEnabled(names); // all enabled by default
      setMappings(maps);
      setActiveSheet(0);
      setStep(1);
    };
    reader.readAsArrayBuffer(file);
  };

  const toggleSheet = (name) => {
    setEnabled(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]);
  };

  const handleMappingChange = (sheetName, field, col) => {
    setMappings(prev => ({ ...prev, [sheetName]: { ...prev[sheetName], [field]: col } }));
  };

  const canProceedMapping = enabledSheets.some(name => {
    const m = mappings[name] || {};
    return m.title && m.title !== '__none__';
  });

  const getTotalRisks = () => enabledSheets.reduce((acc, name) => {
    const { rows = [], headers = [] } = sheetData[name] || {};
    return acc + applyMappingToSheet(rows, headers, mappings[name] || {}).length;
  }, 0);

  const handleImport = async () => {
    setImporting(true);
    const allRisks = enabledSheets.flatMap(name => {
      const { rows = [], headers = [] } = sheetData[name] || {};
      return applyMappingToSheet(rows, headers, mappings[name] || {});
    });
    await onImport(allRisks);
    setImporting(false);
    reset();
    onOpenChange(false);
  };

  const totalRisks = getTotalRisks();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Import Risks from Excel
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-0 text-xs">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={cn(
                'px-3 py-1 rounded-full font-medium transition-colors',
                step === i ? 'bg-primary text-primary-foreground' :
                step > i  ? 'text-accent font-semibold' : 'text-muted-foreground'
              )}>
                {i + 1}. {s}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>

        {/* File info bar (steps 1+) */}
        {fileName && (
          <div className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-lg text-xs">
            <FileSpreadsheet className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="flex-1 truncate font-medium">{fileName}</span>
            <span className="text-muted-foreground">{sheets.length} sheet{sheets.length !== 1 ? 's' : ''}</span>
            <button onClick={reset} className="text-muted-foreground hover:text-foreground">Change</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {step === 0 && <UploadStep onFile={handleFile} />}
          {step === 1 && (
            <MappingStep
              sheets={sheets}
              sheetData={sheetData}
              enabledSheets={enabledSheets}
              onToggleSheet={toggleSheet}
              mappings={mappings}
              onMappingChange={handleMappingChange}
              activeSheet={activeSheet}
              onSwitchSheet={setActiveSheet}
            />
          )}
          {step === 2 && (
            <PreviewStep
              sheets={sheets}
              enabledSheets={enabledSheets}
              sheetData={sheetData}
              mappings={mappings}
              activeSheet={activeSheet}
              onSwitchSheet={setActiveSheet}
            />
          )}
        </div>

        <DialogFooter className="border-t pt-4 flex items-center gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="gap-1 mr-auto">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {step < 2 && (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && !canProceedMapping}
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          )}
          {step === 2 && (
            <Button onClick={handleImport} disabled={totalRisks === 0 || importing} className="gap-2">
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              Import {totalRisks > 0 ? `${totalRisks} Risk${totalRisks !== 1 ? 's' : ''}` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}