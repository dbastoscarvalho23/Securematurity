import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const HINTS = {
  full_name: ['name', 'full name', 'nome', 'nome completo', 'colaborador', 'utilizador', 'trabalhador'],
  position: ['position', 'role', 'cargo', 'função', 'funcao', 'title', 'categoria'],
  department: ['department', 'direção', 'direcao', 'direction', 'área', 'area', 'divisão', 'divisao', 'serviço', 'servico'],
  email: ['email', 'e-mail', 'mail'],
  phone: ['phone', 'telefone', 'tel', 'contacto', 'contact', 'telemovel', 'telemóvel'],
  notes: ['notes', 'notas', 'observações', 'observations'],
};

const normalizeHeader = (h) => String(h || '').toLowerCase().trim();

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Name', 'Position', 'Department', 'Email', 'Phone', 'Notes'],
    ['Ana Silva', 'Técnica de TI', 'Direção de Sistemas', 'ana.silva@empresa.pt', '+351210000000', 'Responsável pela rede'],
    ['João Costa', 'Gestor de Segurança', 'Direção de Segurança', 'joao.costa@empresa.pt', '+351220000000', 'DPO adjunto'],
  ]);
  ws['!cols'] = [{ wch: 24 }, { wch: 24 }, { wch: 28 }, { wch: 30 }, { wch: 18 }, { wch: 32 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Roster');
  XLSX.writeFile(wb, 'training_roster_template.xlsx');
}

export default function TrainingUserExcelImportDialog({ open, onOpenChange, onImport }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const inputRef = useRef();

  const reset = () => { setRows([]); setFileName(''); };

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (raw.length < 2) { setRows([]); return; }
      const headers = raw[0].map(normalizeHeader);
      const map = {};
      Object.entries(HINTS).forEach(([k, hs]) => {
        const idx = headers.findIndex(h => hs.includes(normalizeHeader(h)));
        if (idx >= 0) map[k] = idx;
      });
      const parsed = raw.slice(1).map(r => ({
        full_name: String(r[map.full_name] ?? '').trim(),
        position: String(r[map.position] ?? '').trim(),
        department: String(r[map.department] ?? '').trim(),
        email: String(r[map.email] ?? '').trim(),
        phone: String(r[map.phone] ?? '').trim(),
        notes: String(r[map.notes] ?? '').trim(),
        status: 'active',
      })).filter(r => r.full_name && r.email);
      setRows(parsed);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      await onImport(rows);
      reset();
      onOpenChange(false);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => { reset(); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            {t('training_import_dialog_title')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {!fileName && (
            <div
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">{t('training_import_drop_here')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('training_import_file_types')}</p>
              <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleFile(e.target.files[0])} />
            </div>
          )}

          {fileName && (
            <div className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-lg text-xs">
              <FileSpreadsheet className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="flex-1 truncate font-medium">{fileName}</span>
              <button onClick={reset} className="text-muted-foreground hover:text-foreground">{t('training_import_change')}</button>
            </div>
          )}

          {fileName && rows.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-chart-3/10 border border-chart-3/20 rounded-lg text-xs text-chart-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {t('training_import_no_valid')}
            </div>
          )}

          {rows.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('training_form_name')}</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('training_col_position')}</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('training_col_department')}</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('training_form_email')}</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('training_form_phone')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2 truncate font-medium max-w-[160px]">{r.full_name}</td>
                        <td className="px-3 py-2 truncate max-w-[120px]">{r.position || '—'}</td>
                        <td className="px-3 py-2 truncate max-w-[120px]">{r.department || '—'}</td>
                        <td className="px-3 py-2 truncate max-w-[160px]">{r.email}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.phone || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 bg-muted/30 border-t flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                {rows.length} {t('training_import_ready')}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t('training_import_no_file')}</span>
            <button onClick={downloadTemplate} className="flex items-center gap-1 text-primary hover:underline font-medium">
              <Download className="w-3 h-3" /> {t('training_import_download_template')}
            </button>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={handleClose}>{t('common_cancel')}</Button>
          <Button onClick={handleImport} disabled={rows.length === 0 || importing} className="gap-2">
            {importing && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('training_import_btn')} {rows.length > 0 ? `${rows.length}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { downloadTemplate };