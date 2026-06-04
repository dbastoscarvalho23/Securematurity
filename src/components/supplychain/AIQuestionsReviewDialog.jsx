import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCheck, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function AIQuestionsReviewDialog({ open, questions, onConfirm, onClose }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(() => new Set(questions.map((_, i) => i)));

  // Reset selection when questions change
  React.useEffect(() => {
    setSelected(new Set(questions.map((_, i) => i)));
  }, [questions]);

  const toggle = (i) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(questions.map((_, i) => i)));
  const deselectAll = () => setSelected(new Set());

  const handleConfirm = () => {
    const accepted = questions.filter((_, i) => selected.has(i));
    onConfirm(accepted);
  };

  const answerTypeBadge = (type) => {
    const map = { yes_no: 'Yes/No', scale_1_5: 'Scale 1–5', text: 'Text', multiple_choice: 'Multiple' };
    return map[type] || type;
  };

  const grouped = questions.reduce((acc, q, i) => {
    if (!acc[q.area]) acc[q.area] = [];
    acc[q.area].push({ ...q, _idx: i });
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            {t('sc_review_title')}
            <Badge variant="secondary">{questions.length} {t('sc_review_generated')}</Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t('sc_review_desc')}
          </p>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b bg-muted/30">
          <span className="text-sm text-muted-foreground">{selected.size} {t('sc_review_of')} {questions.length} {t('sc_review_selected')}</span>
          <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs gap-1">
            <CheckCheck className="w-3 h-3" />{t('sc_review_select_all')}
          </Button>
          <Button variant="ghost" size="sm" onClick={deselectAll} className="h-7 text-xs gap-1">
            <X className="w-3 h-3" />{t('sc_review_deselect_all')}
          </Button>
        </div>

        {/* Questions list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {Object.entries(grouped).map(([area, areaQuestions]) => (
            <div key={area}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{area}</h4>
              <div className="space-y-2">
                {areaQuestions.map(q => (
                  <div
                    key={q._idx}
                    onClick={() => toggle(q._idx)}
                    className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selected.has(q._idx)
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-card opacity-60 hover:opacity-80'
                    }`}
                  >
                    <div className="pt-0.5">
                      <Checkbox
                        checked={selected.has(q._idx)}
                        onCheckedChange={() => toggle(q._idx)}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{q.question_text}</p>
                      {q.question_text_pt && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{q.question_text_pt}</p>
                      )}
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs">{answerTypeBadge(q.answer_type)}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>{t('common_cancel')}</Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0}>
            {t('sc_review_add')} {selected.size}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}