import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Check, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const MATURITY_LEVELS = [
  { level: 0, label: 'Non-existent', color: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20' },
  { level: 1, label: 'Initial', color: 'bg-chart-4/10 text-chart-4 border-chart-4/20 hover:bg-chart-4/20' },
  { level: 2, label: 'Developing', color: 'bg-chart-3/10 text-chart-3 border-chart-3/20 hover:bg-chart-3/20' },
  { level: 3, label: 'Defined', color: 'bg-chart-1/10 text-chart-1 border-chart-1/20 hover:bg-chart-1/20' },
  { level: 4, label: 'Managed', color: 'bg-chart-2/10 text-chart-2 border-chart-2/20 hover:bg-chart-2/20' },
  { level: 5, label: 'Optimizing', color: 'bg-accent/10 text-accent border-accent/20 hover:bg-accent/20' },
];

export default function QuestionCard({ question, index, response, onSave }) {
  const [notes, setNotes] = useState(response?.evidence_notes || '');
  const [showNotes, setShowNotes] = useState(!!response?.evidence_notes);
  const selectedLevel = response?.maturity_level;

  const handleSelect = (level) => {
    onSave({ maturity_level: level, evidence_notes: notes, target_level: response?.target_level || 4 });
  };

  const handleNotesBlur = () => {
    if (selectedLevel != null) {
      onSave({ maturity_level: selectedLevel, evidence_notes: notes, target_level: response?.target_level || 4 });
    }
  };

  return (
    <Card className={cn("transition-all", selectedLevel != null ? "border-l-2 border-l-primary" : "")}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-xs font-mono text-muted-foreground mt-0.5 flex-shrink-0">
            {index}.
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium leading-relaxed">{question.question_text}</p>
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
                <TooltipContent className="max-w-xs text-xs">{question.guidance}</TooltipContent>
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
              {ml.level} — {ml.label}
            </button>
          ))}
        </div>

        {/* Evidence Notes */}
        <button
          onClick={() => setShowNotes(!showNotes)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showNotes ? 'Hide notes' : '+ Add evidence / notes'}
        </button>
        {showNotes && (
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add evidence, notes, or observations..."
            className="mt-2 text-sm"
            rows={2}
          />
        )}
      </CardContent>
    </Card>
  );
}