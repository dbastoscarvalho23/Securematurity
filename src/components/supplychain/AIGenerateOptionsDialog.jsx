import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles, X, Plus } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const PRESET_AREAS = [
  'Information Security',
  'Data Protection & GDPR',
  'Business Continuity',
  'Access Control',
  'Network Security',
  'Physical Security',
  'Incident Response',
  'Third-Party Management',
  'Vulnerability Management',
  'Compliance & Certifications',
];

export default function AIGenerateOptionsDialog({ open, onClose, onGenerate, preselectedAreas = [] }) {
  const { t } = useLanguage();
  const [count, setCount] = useState(3);
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [customArea, setCustomArea] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedAreas(preselectedAreas.length ? [...preselectedAreas] : [...PRESET_AREAS.slice(0, 4)]);
      setCount(3);
      setCustomArea('');
    }
  }, [open]);

  const toggleArea = (area) => {
    setSelectedAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const addCustomArea = () => {
    const trimmed = customArea.trim();
    if (trimmed && !selectedAreas.includes(trimmed)) {
      setSelectedAreas(prev => [...prev, trimmed]);
    }
    setCustomArea('');
  };

  const handleGenerate = () => {
    onGenerate({ count: Number(count), areas: selectedAreas });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {t('sc_ai_generate')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Number of questions per subject */}
          <div>
            <Label>{t('sc_gen_per_subject')}</Label>
            <p className="text-xs text-muted-foreground mb-2">{t('sc_gen_per_subject_desc')}</p>
            <div className="flex items-center gap-3">
              <Button
                type="button" variant="outline" size="icon" className="h-8 w-8"
                onClick={() => setCount(c => Math.max(1, c - 1))}
              >-</Button>
              <Input
                type="number" min={1} max={10}
                value={count}
                onChange={e => setCount(Math.max(1, Math.min(10, Number(e.target.value))))}
                className="w-16 text-center h-8"
              />
              <Button
                type="button" variant="outline" size="icon" className="h-8 w-8"
                onClick={() => setCount(c => Math.min(10, c + 1))}
              >+</Button>
              <span className="text-sm text-muted-foreground">
                = ~{count * selectedAreas.length} {t('sc_gen_total')}
              </span>
            </div>
          </div>

          {/* Subjects */}
          <div>
            <Label>{t('sc_gen_subjects')}</Label>
            <p className="text-xs text-muted-foreground mb-2">{t('sc_gen_subjects_desc')}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_AREAS.map(area => (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleArea(area)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    selectedAreas.includes(area)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-border hover:border-primary'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
            {/* Custom subjects */}
            {selectedAreas.filter(a => !PRESET_AREAS.includes(a)).map(a => (
              <Badge key={a} variant="secondary" className="mr-1 mb-2 gap-1">
                {a}
                <button onClick={() => toggleArea(a)}><X className="w-3 h-3" /></button>
              </Badge>
            ))}
            <div className="flex gap-2 mt-1">
              <Input
                placeholder={t('sc_gen_custom_placeholder')}
                value={customArea}
                onChange={e => setCustomArea(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomArea())}
                className="flex-1 h-8 text-sm"
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustomArea} className="gap-1">
                <Plus className="w-3 h-3" />{t('sc_add')}
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>{t('common_cancel')}</Button>
            <Button onClick={handleGenerate} disabled={selectedAreas.length === 0} className="gap-2">
              <Sparkles className="w-4 h-4" />
              {t('sc_gen_generate_btn')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}