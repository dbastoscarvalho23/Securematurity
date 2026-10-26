import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sparkles, Loader2, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { writeAuditLog } from '@/lib/auditLog';
import { AI_PURPOSES, AI_ENGINES, defaultAiPurposes, useAiSettings } from '@/lib/ai';

// Administração da plataforma: motor de IA e pontos onde o assistente está ativo (registo único AiSettings).
// O servidor (base44/shared/llm.ts) lê o mesmo registo em cada pedido; aqui só se escolhe e guarda.
export default function AiSettingsPanel() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: config, isLoading, error } = useAiSettings();

  const [engine, setEngine] = useState('claude');
  const [enabled, setEnabled] = useState(defaultAiPurposes);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEngine(config?.provider || 'claude');
    setEnabled(Array.isArray(config?.enabled_purposes) ? config.enabled_purposes : defaultAiPurposes());
  }, [config?.id, config?.provider, config?.enabled_purposes]);

  const toggle = (key, on) => setEnabled((prev) => (on ? Array.from(new Set([...prev, key])) : prev.filter((k) => k !== key)));

  const save = async () => {
    setSaving(true);
    try {
      // Só se guardam chaves conhecidas, pela ordem da lista.
      const purposes = AI_PURPOSES.map((p) => p.key).filter((k) => enabled.includes(k));
      const payload = { provider: engine, enabled_purposes: purposes, updated_by_email: user?.email || '' };
      if (config?.id) await base44.entities.AiSettings.update(config.id, payload);
      else await base44.entities.AiSettings.create(payload);
      await writeAuditLog({
        action: 'settings_changed',
        entity_type: 'AiSettings',
        entity_id: config?.id,
        details: `Assistente de IA: motor ${engine}; pontos ativos: ${purposes.join(', ') || '(nenhum)'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      toast.success(t('ai_settings_saved'));
    } catch (err) {
      toast.error(err?.message || t('ai_settings_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4" />{t('ai_settings_title')}</CardTitle>
        <CardDescription>{t('ai_settings_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <p className="text-sm text-destructive">{t('ai_settings_load_error')}: {error.message}</p>
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-sm font-medium">{t('ai_settings_engine')}</p>
              <RadioGroup value={engine} onValueChange={setEngine} className="gap-2">
                {AI_ENGINES.map((id) => (
                  <Label key={id} htmlFor={`ai-engine-${id}`} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer font-normal">
                    <RadioGroupItem value={id} id={`ai-engine-${id}`} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{t(`ai_engine_${id}`)}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">{t(`ai_engine_${id}_desc`)}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium">{t('ai_settings_points')}</p>
                <Button type="button" variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setEnabled(defaultAiPurposes())}>
                  <RotateCcw className="w-3.5 h-3.5" />{t('ai_settings_restore')}
                </Button>
              </div>
              {!config && <p className="text-xs text-muted-foreground">{t('ai_settings_defaults_note')}</p>}
              {AI_PURPOSES.map((p) => (
                <div key={p.key} className="flex items-start justify-between gap-4 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{t(`ai_purpose_${p.key}`)}</span>
                      <Badge variant="outline" className="text-[10px]">{t(p.default ? 'ai_settings_default_on' : 'ai_settings_default_off')}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{t(`ai_purpose_${p.key}_desc`)}</p>
                  </div>
                  <Switch checked={enabled.includes(p.key)} onCheckedChange={(on) => toggle(p.key, on)} aria-label={t(`ai_purpose_${p.key}`)} />
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{t('common_save')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
