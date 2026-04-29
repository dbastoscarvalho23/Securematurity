import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

// Map flexible column names to our fields
const COL_MAP = {
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

const CATEGORY_MAP = {
  'access control': 'access_control',
  'access_control': 'access_control',
  'data protection': 'data_protection',
  'data_protection': 'data_protection',
  'network security': 'network_security',
  'network_security': 'network_security',
  'physical security': 'physical_security',
  'physical_security': 'physical_security',
  'third party': 'third_party',
  'third_party': 'third_party',
  'compliance': 'compliance',
  'operational': 'operational',
  'other': 'other',
};

const STATUS_MAP = {
  'open': 'open',
  'aberto': 'open',
  'in treatment': 'in_treatment',
  'in_treatment': 'in_treatment',
  'em tratamento': 'in_treatment',
  'accepted': 'accepted',
  'aceite': 'accepted',
  'closed': 'closed',
  'fechado': 'closed',
};

function normalizeHeader(h) {
  return String(h || '').toLowerCase().trim();
}

function findColumn(headers, candidates) {
  for (const candidate of candidates) {
    const idx = headers.findIndex(h => normalizeHeader(h) === candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseNumber(val, min = 1, max = 5) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return 3;
  return Math.min(max, Math.max(min, n));
}

function parseSheet(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const colIdx = {};
  for (const [field, candidates] of Object.entries(COL_MAP)) {
    colIdx[field] = findColumn(headers, candidates);
  }

  const risks = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const title = colIdx.title >= 0 ? String(row[colIdx.title] || '').trim() : '';
    if (!title) continue;

    const impact = colIdx.impact >= 0 ? parseNumber(row[colIdx.impact]) : 3;
    const likelihood = colIdx.likelihood >= 0 ? parseNumber(row[colIdx.likelihood]) : 3;

    const rawCategory = colIdx.category >= 0 ? String(row[colIdx.category] || '').toLowerCase().trim() : '';
    const category = CATEGORY_MAP[rawCategory] || 'other';

    const rawStatus = colIdx.status >= 0 ? String(row[colIdx.status] || '').toLowerCase().trim() : '';
    const status = STATUS_MAP[rawStatus] || 'open';

    let due_date = '';
    if (colIdx.due_date >= 0 && row[colIdx.due_date]) {
      const raw = row[colIdx.due_date];
      // Excel serial date
      if (typeof raw === 'number') {
        const d = XLSX.SSF.parse_date_code(raw);
        due_date = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      } else {
        due_date = String(raw).trim();
      }
    }

    risks.push({
      title,
      description: colIdx.description >= 0 ? String(row[colIdx.description] || '').trim() : '',
      category,
      impact,
      likelihood,
      status,
      owner_email: colIdx.owner_email >= 0 ? String(row[colIdx.owner_email] || '').trim() : '',
      due_date,
      treatment_notes: colIdx.treatment_notes >= 0 ? String(row[colIdx.treatment_notes] || '').trim() : '',
      customer_name: colIdx.customer_name >= 0 ? String(row[colIdx.customer_name] || '').trim() : '',
      linked_document_ids: [],
    });
  }
  return risks;
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Title', 'Description', 'Category', 'Impact', 'Likelihood', 'Status', 'Owner Email', 'Due Date', 'Treatment Notes', 'Customer Name'],
    ['Weak Password Policy', 'Users allowed to set short passwords without MFA', 'access_control', 4, 4, 'open', 'security@company.com', '2025-06-30', 'Enforce MFA and password complexity', 'Acme Corp'],
    ['Unpatched Servers', 'Several servers running outdated OS versions', 'network_security', 5, 3, 'in_treatment', 'ops@company.com', '2025-05-15', 'Patch management process being implemented', ''],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Risks');
  XLSX.writeFile(wb, 'risk_matrix_template.xlsx');
}

export default function RiskExcelImportDialog({ open, onOpenChange, onImport }) {
  const [parsed, setParsed] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [allSheetRisks, setAllSheetRisks] = useState({});
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const inputRef = useRef();

  const handleFile = (file) => {
    setError('');
    setParsed([]);
    setSheets([]);
    setAllSheetRisks({});
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const sheetNames = wb.SheetNames;
      setSheets(sheetNames);

      const bySheet = {};
      sheetNames.forEach(name => {
        bySheet[name] = parseSheet(wb.Sheets[name]);
      });
      setAllSheetRisks(bySheet);
      setActiveSheet(0);
      setParsed(bySheet[sheetNames[0]] || []);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const switchSheet = (idx) => {
    setActiveSheet(idx);
    setParsed(allSheetRisks[sheets[idx]] || []);
  };

  const totalCount = Object.values(allSheetRisks).reduce((acc, r) => acc + r.length, 0);

  const handleImport = async () => {
    const allRisks = Object.values(allSheetRisks).flat();
    if (allRisks.length === 0) return;
    setImporting(true);
    await onImport(allRisks);
    setImporting(false);
    setParsed([]);
    setSheets([]);
    setAllSheetRisks({});
    setFileName('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setParsed([]);
    setSheets([]);
    setAllSheetRisks({});
    setFileName('');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Import Risks from Excel
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Drop zone */}
          {!fileName && (
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Drop your Excel file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx or .xls · All sheets will be imported</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>
          )}

          {/* Template download */}
          {!fileName && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Don't have a file yet?</span>
              <button onClick={downloadTemplate} className="flex items-center gap-1 text-primary hover:underline font-medium">
                <Download className="w-3 h-3" /> Download template
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {fileName && (
            <>
              {/* File info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {sheets.length} sheet{sheets.length !== 1 ? 's' : ''} · {totalCount} risk{totalCount !== 1 ? 's' : ''} detected
                  </p>
                </div>
                <button
                  onClick={() => { setFileName(''); setParsed([]); setSheets([]); setAllSheetRisks({}); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Change file
                </button>
              </div>

              {/* Sheet tabs */}
              {sheets.length > 1 && (
                <div className="flex gap-1 flex-wrap">
                  {sheets.map((name, idx) => (
                    <button
                      key={name}
                      onClick={() => switchSheet(idx)}
                      className={cn(
                        'px-3 py-1 rounded-md text-xs font-medium border transition-colors',
                        activeSheet === idx
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {name} ({allSheetRisks[name]?.length || 0})
                    </button>
                  ))}
                </div>
              )}

              {/* Column mapping legend */}
              <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                <p className="font-medium text-foreground mb-1">Detected fields in "{sheets[activeSheet]}":</p>
                <p>Columns are auto-mapped by name (supports English & Portuguese headers).</p>
              </div>

              {/* Preview table */}
              {parsed.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  No valid rows found in this sheet. Make sure there is a header row and at least a "Title" column.
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
                        {parsed.map((r, i) => {
                          const score = r.impact * r.likelihood;
                          return (
                            <tr key={i} className="border-t hover:bg-muted/30">
                              <td className="px-3 py-2 max-w-[180px] truncate font-medium">{r.title}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{r.category?.replace(/_/g, ' ')}</td>
                              <td className="px-3 py-2 text-center">{r.impact}</td>
                              <td className="px-3 py-2 text-center">{r.likelihood}</td>
                              <td className="px-3 py-2 text-center">
                                <Badge variant="outline" className={cn('text-[10px] border', 
                                  score >= 16 ? 'bg-destructive/10 text-destructive border-destructive/20' :
                                  score >= 9 ? 'bg-chart-4/10 text-chart-4 border-chart-4/20' :
                                  score >= 4 ? 'bg-chart-3/10 text-chart-3 border-chart-3/20' :
                                  'bg-chart-2/10 text-chart-2 border-chart-2/20'
                                )}>
                                  {score}
                                </Badge>
                              </td>
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
                    {parsed.length} risks ready to import from this sheet
                    {sheets.length > 1 && ` · ${totalCount} total across all sheets`}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleImport}
            disabled={totalCount === 0 || importing}
            className="gap-2"
          >
            {importing && <Loader2 className="w-4 h-4 animate-spin" />}
            Import {totalCount > 0 ? `${totalCount} Risk${totalCount !== 1 ? 's' : ''}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}