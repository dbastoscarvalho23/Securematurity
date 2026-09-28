import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';
import { IMPORT_STATE_META, IMPORT_TYPE_KEYS, ISSUE_KEYS } from '@/lib/questionImport';

/**
 * Tabela de itens de um lote de importação — a mesma grelha serve a
 * pré-visualização (antes de existir rascunho) e a revisão (já em rascunho,
 * com aprovar/excluir/editar). Lê os estados e as chaves de tradução de
 * `src/lib/questionImport.js`, pelo que a cor de cada estado continua a sair de
 * tokens de tema e nunca de um literal.
 */

const SEVERITY_CLASS = {
  error: 'text-status-danger',
  warning: 'text-status-warning',
  duplicate: 'text-status-info',
  info: 'text-muted-foreground',
};

const REVIEW_STATE_META = {
  pending: { labelKey: 'qimp_pending', className: 'text-muted-foreground border-border' },
  approved: { labelKey: 'qimp_approved', className: 'bg-status-success/10 text-status-success border-status-success/20' },
  excluded: { labelKey: 'qimp_excluded', className: 'text-muted-foreground border-border line-through' },
};

/** Campos comparados no diff «antes → depois». */
const DIFF_FIELDS = ['question_text', 'question_text_pt', 'domain', 'domain_pt', 'control_id', 'guidance', 'weight', 'order_index', 'is_active', 'title', 'description', 'name', 'version', 'status'];

function itemTitle(item) {
  if (item.item_type === 'question') return item.question_text || '';
  if (item.item_type === 'control') return item.title || item.control_id || '';
  return `${item.framework_code || ''} — ${item.framework_name || ''}`.trim();
}

function diffRows(item) {
  const before = item.before || {};
  const rows = [];
  for (const field of DIFF_FIELDS) {
    if (before[field] === undefined) continue;
    const after = field === 'name' || field === 'version' || field === 'status' ? undefined : item[field];
    if (after === undefined) continue;
    if (String(before[field] ?? '') === String(after ?? '')) continue;
    rows.push({ field, before: String(before[field] ?? ''), after: String(after ?? '') });
  }
  return rows;
}

export default function QuestionImportItemsTable({
  items,
  reviewing = false,
  canEdit = true,
  onApprove,
  onExclude,
  onEdit,
  emptyLabel,
}) {
  const { t } = useLanguage();

  if (!items || items.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        {emptyLabel || t('common_no_data')}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">{t('qimp_col_row')}</TableHead>
          <TableHead className="w-28">{t('qimp_col_type')}</TableHead>
          <TableHead>{t('qimp_col_item')}</TableHead>
          <TableHead className="w-32">{t('qimp_col_state')}</TableHead>
          <TableHead className="w-64">{t('qimp_col_issues')}</TableHead>
          {reviewing && <TableHead className="w-40">{t('common_actions')}</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(item => {
          const stateMeta = IMPORT_STATE_META[item.state] || IMPORT_STATE_META.valid;
          const reviewMeta = REVIEW_STATE_META[item.review_state] || REVIEW_STATE_META.pending;
          const changes = diffRows(item);
          return (
            <TableRow key={item.id || `${item.item_type}-${item.row_number}`}>
              <TableCell className="text-xs font-mono text-muted-foreground align-top">{item.row_number || '—'}</TableCell>
              <TableCell className="align-top">
                <Badge variant="outline" className="text-xs">
                  {t(IMPORT_TYPE_KEYS[item.item_type] || 'qimp_type_question')}
                </Badge>
              </TableCell>
              <TableCell className="align-top">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {item.framework_code && (
                    <Badge variant="outline" className="text-xs font-mono">{item.framework_code}</Badge>
                  )}
                  {item.control_id && <span className="text-xs font-mono text-muted-foreground">{item.control_id}</span>}
                  {item.domain && <span className="text-xs text-muted-foreground">{item.domain}</span>}
                  {item.item_type === 'question' && (
                    <span className="text-xs text-muted-foreground">
                      {t('qfd_weight')} {item.weight || 1} · {t('qfd_order_index')} {item.order_index ?? 0}
                    </span>
                  )}
                  {item.item_type === 'control' && (item.maturity_levels || []).length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {item.maturity_levels.length} × {t('maturity_level')}
                    </span>
                  )}
                </div>
                <p className="text-sm line-clamp-2">{itemTitle(item)}</p>
                {item.question_text_pt && (
                  <p className="text-xs text-muted-foreground italic mt-0.5 line-clamp-1">{item.question_text_pt}</p>
                )}
                {item.similar_to && (
                  <p className="text-xs text-status-warning mt-1 line-clamp-2">
                    <span className="font-medium">{t('qimp_similar_to')}:</span> {item.similar_to}
                  </p>
                )}
                {changes.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    <p className="text-xs font-medium text-muted-foreground">{t('qimp_diff')}</p>
                    {changes.map(change => (
                      <p key={change.field} className="text-xs text-muted-foreground">
                        <span className="font-mono">{change.field}</span>:{' '}
                        <span className="line-through">{change.before.slice(0, 80)}</span>{' '}
                        <span className="text-foreground">{change.after.slice(0, 80)}</span>
                      </p>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="align-top">
                <Badge variant="outline" className={cn('text-xs', stateMeta.className)}>{t(stateMeta.labelKey)}</Badge>
                {reviewing && (
                  <Badge variant="outline" className={cn('text-xs mt-1 block w-fit', reviewMeta.className)}>
                    {t(reviewMeta.labelKey)}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="align-top">
                {(item.issues || []).length === 0 ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <ul className="space-y-0.5">
                    {item.issues.map((issue, index) => (
                      <li key={`${issue.code}-${index}`} className={cn('text-xs', SEVERITY_CLASS[issue.severity] || SEVERITY_CLASS.info)}>
                        {t(ISSUE_KEYS[issue.code] || 'qimp_error_generic', { detail: issue.detail || '' })}
                      </li>
                    ))}
                  </ul>
                )}
              </TableCell>
              {reviewing && (
                <TableCell className="align-top">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-status-success hover:text-status-success"
                      onClick={() => onApprove?.(item)}
                      disabled={item.state === 'error' || item.review_state === 'approved'}
                      title={t('qimp_approve')}
                      aria-label={t('qimp_approve')}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => onExclude?.(item)}
                      disabled={item.review_state === 'excluded'}
                      title={t('qimp_exclude')}
                      aria-label={t('qimp_exclude')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit?.(item)}
                        title={t('qimp_edit_item')}
                        aria-label={t('qimp_edit_item')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
