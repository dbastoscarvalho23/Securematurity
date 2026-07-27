import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, CheckCircle2, Trash2, ListTodo, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

/**
 * Generic bulk action bar for tables/lists with checkbox selection.
 *
 * Props:
 *  - selectedCount: number of selected items
 *  - statusOptions: array of { value, labelKey } for the status dropdown
 *  - statusLabelKey: translation key for the status dropdown placeholder
 *  - onBulkStatus: (status) => Promise<void>  called when user picks a status and clicks Apply
 *  - onBulkDelete: () => Promise<void>       optional; shows a Delete button when provided
 *  - onBulkConvert: () => Promise<void>      optional; shows a Convert to Tasks button when provided
 *  - onClear: () => void
 *  - isProcessing: boolean
 */
export default function BulkActionBar({
  selectedCount,
  statusOptions = [],
  statusLabelKey = 'bulk_set_status',
  onBulkStatus,
  onBulkDelete,
  onBulkConvert,
  onClear,
  isProcessing = false,
}) {
  const { t } = useLanguage();
  const [status, setStatus] = useState('');

  const handleApply = async () => {
    if (!status || !onBulkStatus) return;
    await onBulkStatus(status);
    setStatus('');
  };

  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="w-4 h-4 text-primary" />
        <span>{selectedCount} {t('bulk_selected')}</span>
      </div>
      <div className="h-4 w-px bg-border" />
      {statusOptions.length > 0 && (
        <>
          <Select value={status} onValueChange={setStatus} disabled={isProcessing}>
            <SelectTrigger className="w-36 h-8">
              <SelectValue placeholder={t(statusLabelKey)} />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{t(opt.labelKey)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8" onClick={handleApply} disabled={!status || isProcessing} >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t('bulk_apply')}
          </Button>
        </>
      )}
      {onBulkConvert && (
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onBulkConvert} disabled={isProcessing}>
          <ListTodo className="w-4 h-4" /> {t('bulk_convert_tasks')}
        </Button>
      )}
      {onBulkDelete && (
        <Button size="sm" variant="destructive" className="h-8 gap-1.5" onClick={onBulkDelete} disabled={isProcessing}>
          <Trash2 className="w-4 h-4" /> {t('bulk_delete_selected')}
        </Button>
      )}
      <Button size="sm" variant="ghost" className="h-8 ml-auto" onClick={onClear} disabled={isProcessing}>
        <X className="w-4 h-4 mr-1" /> {t('bulk_clear')}
      </Button>
    </div>
  );
}