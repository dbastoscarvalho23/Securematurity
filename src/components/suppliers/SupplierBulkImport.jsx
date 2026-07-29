import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Upload, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';

const HEADERS = ['name', 'nif', 'contact_email', 'contact_phone', 'website', 'notes', 'status'];

function buildTemplate() {
  const rows = [
    HEADERS,
    ['Acme Security Ltd', 'PT500123456', 'contact@acmesecurity.pt', '+351210000000', 'https://acmesecurity.pt', 'Managed SOC provider', 'active'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 28 }, { wch: 18 }, { wch: 28 }, { wch: 32 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
  return wb;
}

function tr(t, key, vars) {
  let s = t(key);
  if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.replace(`{${k}}`, v); });
  return s;
}

export default function SupplierBulkImport({ isAdmin, customerId, onDone }) {
  const { t } = useLanguage();
  const inputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const handleDownload = () => {
    const wb = buildTemplate();
    XLSX.writeFile(wb, 'suppliers_template.xlsx');
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!json.length) {
        toast.error(tr(t, 'suppliers_import_error', { error: 'empty file' }));
        return;
      }
      const records = [];
      const invalid = [];
      json.forEach((row, idx) => {
        const rec = {
          name: String(row.name ?? '').trim(),
          nif: String(row.nif ?? '').trim(),
          contact_email: String(row.contact_email ?? '').trim(),
          contact_phone: String(row.contact_phone ?? '').trim(),
          website: String(row.website ?? '').trim(),
          notes: String(row.notes ?? '').trim(),
          status: String(row.status ?? 'active').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active',
        };
        if (!rec.name || !rec.nif || !rec.contact_email || !rec.contact_phone) {
          invalid.push(idx + 2);
          return;
        }
        if (!isAdmin && customerId) rec.customer_id = customerId;
        records.push(rec);
      });
      if (records.length === 0) {
        toast.error(tr(t, 'suppliers_import_error', { error: `rows ${invalid.join(', ') || 'all'} missing required fields` }));
        return;
      }
      const created = await base44.entities.Supplier.bulkCreate(records);
      if (invalid.length) {
        toast.warning(tr(t, 'suppliers_import_partial', { ok: created.length, fail: invalid.length }));
      } else {
        toast.success(tr(t, 'suppliers_import_success', { count: created.length }));
      }
      onDone?.();
    } catch (err) {
      toast.error(tr(t, 'suppliers_import_error', { error: err?.message || 'error' }));
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <Button variant="outline" onClick={handleDownload} className="gap-2">
        <Download className="w-4 h-4" /> {t('suppliers_download_template')}
      </Button>
      <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={importing} className="gap-2">
        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {t('suppliers_bulk_import')}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleImport}
      />
    </>
  );
}