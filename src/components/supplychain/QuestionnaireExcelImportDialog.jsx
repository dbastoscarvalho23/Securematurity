import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download, ChevronRight, ArrowLeft, X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';

const Q_FIELDS = [
  { key: 'title',          labelKey: 'sc_form_title',            required: true },
  { key: 'supplier_name',  labelKey: 'sc_form_supplier_name',   required: false },
  { key: 'supplier_email', labelKey: 'sc_form_supplier_email',  required: false },
  { key: 'areas',          labelKey: 'sc_form_coverage_areas',  required: false },
  { key: 'status',         labelKey: 'sc_form_status',          required: false },
  { key: 'due_date',       labelKey: 'sc_form_due_date',       required: false },
  { key: 'notes',          labelKey: 'sc_form_notes',           required: false },
  { key: 'customer_name',  labelKey: 'common_customer',        required: false },
];

const STATUS_VALUES = ['draft', 'sent', 'in_progress', 'completed', 'archived'];

const STATUS_MAP = {
  'draft': 'draft', 'rascunho': 'draft',
  'sent': 'sent', 'enviado': 'sent',
  'in_progress': 'in_progress', 'in progress': 'in_progress', 'em curso': 'in_progress', 'em andamento': 'in_progress',
  'completed': 'completed', 'completo': 'completed', 'concluído': 'completed', 'concluido': 'completed',
  'archived': 'archived', 'arquivado': 'archived',
};

const AUTO_HINTS = {
  title:          ['title', 'titulo', 'questionnaire', 'questionário', 'name', 'nome'],
  supplier_name:  ['supplier name', 'supplier', 'supplier_name', 'fornecedor', 'vendor', 'supplier_name'],
  supplier_email: ['supplier email', 'email', 'supplier_email', 'fornecedor email', 'contact email', 'contacto'],
  areas:          ['areas', 'area', 'coverage', 'coverage areas', 'áreas', 'cobertura', 'domains', 'domínios'],
  status:         ['status', 'estado', 'state'],
  due_date:       ['due date', 'due_date', 'deadline', 'prazo', 'data limite', 'data'],
  notes:          ['notes', 'notas', 'description', 'descricao', 'descrição', 'obs'],
  customer_name:  ['customer', 'customer name', 'cliente', 'organization', 'organização'],
};

function normalizeHeader(h) { return String(h || '').toLowerCase().trim(); }

function autoDetectMapping(allSheetData) {
  const mapping = {};
  for (const [field, hints] of Object.entries(AUTO_HINTS)) {
    for (const [sheetName, { headers }] of Object.entries(allSheetData)) {
      const match = headers.find(h => hints.includes(normalizeHeader(h)));
      if (match) { mapping[field] = { sheet: sheetName, col: match }; break; }
    }
  }
  return mapping;
}

function parseExcelDate(raw) {
  if (!raw) return '';
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw);
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  return String(raw).trim();
}

function buildFromMapping(sheetData, enabledSheets, mapping) {
  const titleSrc = mapping.title;
  if (!titleSrc) return [];
  const primarySheet = titleSrc.sheet;
  const { rows: primaryRows = [], headers: primaryHeaders = [] } = sheetData[primarySheet] || {};

  const getVal = (rows, headers, col, rowIdx) => {
    const idx = headers.indexOf(col);
    return idx >= 0 && rows[rowIdx] ? rows[rowIdx][idx] : '';
  };

  const out = [];
  for (let i = 1; i < primaryRows.length; i++) {
    const title = String(getVal(primaryRows, primaryHeaders, titleSrc.col, i) || '').trim();
    if (!title) continue;
    const getField = (field) => {
      const src = mapping[field];
      if (!src || !src.sheet || !src.col) return '';
      const { rows = [], headers = [] } = sheetData[src.sheet] || {};
      return rows[i] !== undefined ? getVal(rows, headers, src.col, i) : '';
    };
    const rawStatus = String(getField('status') || '').toLowerCase().trim();
    const rawAreas = String(getField('areas') || '').trim();
    out.push({
      title,
      supplier_name:  String(getField('supplier_name')  || '').trim(),
      supplier_email: String(getField('supplier_email') || '').trim(),
      areas:          rawAreas ? rawAreas.split(/[,;\n]/).map(s => s.trim()).filter(Boolean) : [],
      status:         STATUS_MAP[rawStatus] || 'draft',
      due_date:       parseExcelDate(getField('due_date')),
      notes:          String(getField('notes') || '').trim(),
      customer_name:  String(getField('customer_name') || '').trim(),
    });
  }
  return out;
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Title', 'Supplier Name', 'Supplier Email', 'Areas', 'Status', 'Due Date', 'Notes', 'Customer Name'],
    ['Cloud Vendor Security Review 2025', 'Acme Security Ltd', 'contact@acmesecurity.pt', 'Access Control, Data Protection', 'draft', '2025-09-30', 'Annual vendor assessment', 'Acme Corp'],
    ['SOC Provider Assessment', 'SOCGuard', 'soc@socguard.pt', 'Incident Response, Governance', 'sent', '2025-08-15', '', ''],
  ]);
  ws['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 26 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 26 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questionnaires');
  XLSX.writeFile(wb, 'supplier_questionnaires_template.xlsx');
}

function UploadStep({ onFile, t }) {
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
        <p className="text-sm font-medium">{t('sc_import_drop_here')}</p>
        <p className="text-xs text-muted-foreground mt-1">{t('sc_import_file_types')}</p>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => onFile(e.target.files[0])} />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{t('sc_import_no_file')}</span>
        <button onClick={downloadTemplate} className="flex items-center gap-1 text-primary hover:underline font-medium">
          <Download className="w-3 h-3" /> {t('sc_import_download_template')}
        </button>
      </div>
    </div>
  );
}

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

function DropZone({ field, mapped, onDrop, onClear, sheetData, t }) {
  const [over, setOver] = useState(false);
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
        <span className="text-xs font-medium">{t(field.labelKey)}</span>
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
        <span className="text-xs text-muted-foreground italic">{t('sc_import_drop_zone')}</span>
      )}
    </div>
  );
}

function MappingStep({ sheets, sheetData, mapping, onDrop, onClear, t }) {
  const [activeSheet, setActiveSheet] = useState(0);
  const [dragging, setDragging] = useState(null);
  const sheetName = sheets[activeSheet];
  const headers = sheetData[sheetName]?.headers || [];
  const rows = sheetData[sheetName]?.rows || [];
  const getPreview = (col) => {
    const idx = headers.indexOf(col);
    if (rows[1] && idx >= 0) return String(rows[1][idx] || '').trim().slice(0, 20);
    return '';
  };
  return (
    <div className="flex gap-4 h-[420px]">
      <div className="w-52 flex-shrink-0 flex flex-col border rounded-lg overflow-hidden">
        <div className="flex flex-wrap gap-0.5 p-1.5 bg-muted/40 border-b">
          {sheets.map((name, idx) => (
            <button key={name} onClick={() => setActiveSheet(idx)}
              className={cn('px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                activeSheet === idx ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
              {name}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-1 mb-1">{t('sc_import_columns')}</p>
          {headers.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">{t('sc_import_no_columns')}</p>}
          {headers.map(col => (
            <ColumnChip key={col} col={col} sheet={sheetName} preview={getPreview(col)}
              dragging={dragging?.sheet === sheetName && dragging?.col === col}
              onDragStart={() => setDragging({ sheet: sheetName, col })} />
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">{t('sc_import_fields_hint')}</p>
        <div className="space-y-1.5">
          {Q_FIELDS.map(field => (
            <DropZone key={field.key} field={field} mapped={mapping[field.key]} onDrop={(k) => { if (dragging) { onDrop(k, dragging); setDragging(null); } }}
              onClear={() => onClear(field.key)} sheetData={sheetData} t={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewStep({ sheetData, enabledSheets, mapping, t }) {
  const items = buildFromMapping(sheetData, enabledSheets, mapping);
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-40" />
          {t('sc_import_no_valid')}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{t('sc_form_title')}</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{t('sc_form_supplier_name')}</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{t('sc_form_coverage_areas')}</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{t('sc_form_status')}</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{t('sc_form_due_date')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 max-w-[200px] truncate font-medium">{r.title}</td>
                    <td className="px-3 py-2 max-w-[140px] truncate">{r.supplier_name || '—'}</td>
                    <td className="px-3 py-2 max-w-[180px] truncate text-muted-foreground">{r.areas.join(', ') || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{t(`sc_status_${r.status}`) || r.status}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.due_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 bg-muted/30 border-t flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
            {items.length} {t('sc_import_ready')}
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuestionnaireExcelImportDialog({ open, onOpenChange, onImport }) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState([]);
  const [sheetData, setSheetData] = useState({});
  const [enabledSheets, setEnabled] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);

  const STEPS = [t('sc_import_step_upload'), t('sc_import_step_map'), t('sc_import_step_preview')];

  const reset = () => { setStep(0); setFileName(''); setSheets([]); setSheetData({}); setEnabled([]); setMapping({}); };
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
      setSheets(names); setSheetData(data); setEnabled(names); setMapping(autoDetectMapping(data)); setStep(1);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (fieldKey, src) => setMapping(prev => ({ ...prev, [fieldKey]: src }));
  const handleClear = (fieldKey) => setMapping(prev => { const n = { ...prev }; delete n[fieldKey]; return n; });

  const canProceed = !!mapping.title;
  const items = step === 2 ? buildFromMapping(sheetData, enabledSheets, mapping) : [];

  const handleImport = async () => {
    setImporting(true);
    const all = buildFromMapping(sheetData, enabledSheets, mapping);
    await onImport(all);
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
            {t('sc_import_dialog_title')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-0 text-xs flex-shrink-0">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={cn('px-3 py-1 rounded-full font-medium transition-colors',
                step === i ? 'bg-primary text-primary-foreground' : step > i ? 'text-accent font-semibold' : 'text-muted-foreground')}>
                {i + 1}. {s}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </React.Fragment>
          ))}
        </div>

        {fileName && (
          <div className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-lg text-xs flex-shrink-0">
            <FileSpreadsheet className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="flex-1 truncate font-medium">{fileName}</span>
            <span className="text-muted-foreground">{sheets.length} {sheets.length !== 1 ? t('common_sheets') || 'sheets' : t('common_sheet') || 'sheet'}</span>
            <button onClick={reset} className="text-muted-foreground hover:text-foreground">{t('sc_import_change')}</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          {step === 0 && <UploadStep onFile={handleFile} t={t} />}
          {step === 1 && <MappingStep sheets={sheets} sheetData={sheetData} mapping={mapping} onDrop={handleDrop} onClear={handleClear} t={t} />}
          {step === 2 && <PreviewStep sheetData={sheetData} enabledSheets={enabledSheets} mapping={mapping} t={t} />}
        </div>

        <DialogFooter className="border-t pt-4 flex items-center gap-2 flex-shrink-0">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="gap-1 mr-auto">
              <ArrowLeft className="w-3.5 h-3.5" /> {t('sc_import_back')}
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>{t('sc_cancel')}</Button>
          {step < 2 && (
            <Button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !canProceed}>
              {t('sc_import_next')} <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          )}
          {step === 2 && (
            <Button onClick={handleImport} disabled={items.length === 0 || importing} className="gap-2">
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('sc_import_btn')} {items.length > 0 ? `${items.length}` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}