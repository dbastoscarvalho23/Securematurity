import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Check, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import EvidenceUploader from '@/components/assessments/EvidenceUploader';
import CrossMappingSuggestions from '@/components/assessments/CrossMappingSuggestions';
import { useLanguage } from '@/lib/LanguageContext';

const MATURITY_LEVELS = [
  { level: 0, labelKey: 'maturity_non_existent', color: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20' },
  { level: 1, labelKey: 'maturity_initial', color: 'bg-chart-4/10 text-chart-4 border-chart-4/20 hover:bg-chart-4/20' },
  { level: 2, labelKey: 'maturity_developing', color: 'bg-chart-3/10 text-chart-3 border-chart-3/20 hover:bg-chart-3/20' },
  { level: 3, labelKey: 'maturity_defined', color: 'bg-chart-1/10 text-chart-1 border-chart-1/20 hover:bg-chart-1/20' },
  { level: 4, labelKey: 'maturity_managed', color: 'bg-chart-2/10 text-chart-2 border-chart-2/20 hover:bg-chart-2/20' },
  { level: 5, labelKey: 'maturity_optimized', color: 'bg-accent/10 text-accent border-accent/20 hover:bg-accent/20' },
];

export default function QuestionCard({ question, index, response, onSave, language = 'en', currentFramework, allQuestions = [], responseMap = {} }) {
  const { t } = useLanguage();
  const [notes, setNotes] = useState(response?.evidence_notes || '');
  const [showNotes, setShowNotes] = useState(!!response?.evidence_notes);
  const selectedLevel = response?.maturity_level;

  const handleSelect = (level) => {
    onSave({ maturity_level: level, evidence_notes: notes, target_level: response?.target_level || 4, attachments: response?.attachments || [] });
  };

  const handleNotesBlur = () => {
    if (selectedLevel != null) {
      onSave({ maturity_level: selectedLevel, evidence_notes: notes, target_level: response?.target_level || 4, attachments: response?.attachments || [] });
    }
  };

  const handleAttachmentsChange = (attachments) => {
    onSave({ maturity_level: selectedLevel ?? 0, evidence_notes: notes, target_level: response?.target_level || 4, attachments });
  };

  return (
    <Card className={cn("transition-all", selectedLevel != null ? "border-l-2 border-l-primary" : "")}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-xs font-mono text-muted-foreground mt-0.5 flex-shrink-0">
            {index}.
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium leading-relaxed">
              {language === 'pt' && question.question_text_pt ? question.question_text_pt : question.question_text}
            </p>
            {question.control_id && (
              <Badge variant="outline" className="text-xs mt-2 font-mono">{question.control_id}</Badge>
            )}
          </div>
          {question.guidance && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  {language === 'pt' && question.guidance_pt ? question.guidance_pt : question.guidance}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {selectedLevel != null && (
            <Check className="w-4 h-4 text-accent flex-shrink-0" />
          )}
        </div>

        {/* Maturity Level Selection */}
        <div className="flex flex-wrap gap-2 mb-3">
          {MATURITY_LEVELS.map(ml => (
            <button
              key={ml.level}
              onClick={() => handleSelect(ml.level)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                selectedLevel === ml.level
                  ? cn(ml.color, "ring-2 ring-offset-1 ring-primary/30")
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
              )}
            >
              {ml.level} — {t(ml.labelKey)}
            </button>
          ))}
        </div>

        {/* Evidence Notes */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showNotes ? t('question_hide_notes') : t('question_add_evidence')}
          </button>
        </div>
        {showNotes && (
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder={t('question_evidence_ph')}
            className="mt-2 text-sm"
            rows={2}
          />
        )}

        {/* File Attachments */}
        <EvidenceUploader
          attachments={response?.attachments || []}
          onAttachmentsChange={handleAttachmentsChange}
        />

        {/* Cross-framework mapping suggestions */}
        <CrossMappingSuggestions
          question={question}
          currentFramework={currentFramework}
          allQuestions={allQuestions}
          responseMap={responseMap}
          onApplySuggestion={(level, notes, attachments) => {
            setNotes(notes);
            setShowNotes(!!notes);
            onSave({ maturity_level: level, evidence_notes: notes, target_level: response?.target_level || 4, attachments });
          }}
        />
      </CardContent>
    </Card>
  );
}