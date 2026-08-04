import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Wrench, Clock, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { writeAuditLog } from '@/lib/auditLog';
import { isInMaintenanceWindow } from '@/lib/maintenanceUtils';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export default function MaintenanceWindowPanel({ isAdmin }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['maintenance-window'],
    queryFn: async () => {
      const list = await base44.entities.MaintenanceWindow.list();
      return list[0] || null;
    },
  });

  const [form, setForm] = useState({
    enabled: false,
    start_time: '22:00',
    end_time: '04:00',
    days_of_week: [],
    message: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        enabled: config.enabled ?? false,
        start_time: config.start_time || '22:00',
        end_time: config.end_time || '04:00',
        days_of_week: config.days_of_week || [],
        message: config.message || '',
      });
    }
  }, [config?.id]);

  const toggleDay = (dayNum) => {
    setForm((p) => ({
      ...p,
      days_of_week: p.days_of_week.includes(dayNum)
        ? p.days_of_week.filter((d) => d !== dayNum)
        : [...p.days_of_week, dayNum],
    }));
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const payload = {
        enabled: form.enabled,
        start_time: form.start_time,
        end_time: form.end_time,
        days_of_week: form.days_of_week,
        message: form.message,
        updated_by_email: user?.email || '',
      };
      if (config?.id) {
        await base44.entities.MaintenanceWindow.update(config.id, payload);
      } else {
        await base44.entities.MaintenanceWindow.create(payload);
      }
      await writeAuditLog({
        action: 'settings_changed',
        entity_type: 'MaintenanceWindow',
        entity_id: config?.id,
        details: `Maintenance window ${form.enabled ? 'enabled' : 'disabled'}: ${form.start_time}–${form.end_time}, days: ${form.days_of_week.length ? form.days_of_week.map((d) => DAY_KEYS[d]).join(', ') : 'every day'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['maintenance-window'] });
      toast.success(t('maintenance_saved') || 'Definições de manutenção guardadas');
    } catch (err) {
      toast.error(err?.message || (t('maintenance_save_error') || 'Erro ao guardar'));
    } finally {
      setSaving(false);
    }
  };

  const currentlyActive = isInMaintenanceWindow(
    { ...form, enabled: true },
    new Date()
  );

  const previewActive = isInMaintenanceWindow(config, new Date());

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t('maintenance_admin_only') || 'Apenas administradores podem configurar a janela de manutenção.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              {t('maintenance_title') || 'Janela de Manutenção'}
            </CardTitle>
            <CardDescription>
              {t('maintenance_desc') || 'Define um período em que a aplicação fica indisponível para operações de suporte e manutenção. Administradores mantêm acesso.'}
            </CardDescription>
          </div>
          <Badge variant={previewActive ? 'default' : 'secondary'} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${previewActive ? 'bg-accent-foreground animate-pulse' : 'bg-muted-foreground'}`} />
            {previewActive ? (t('maintenance_active_now') || 'Ativa agora') : (t('maintenance_inactive_now') || 'Inativa agora')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Enable toggle */}
            <div className="flex items-center justify-between gap-4 py-3 border-b">
              <div>
                <Label className="text-sm font-medium">
                  {t('maintenance_enable') || 'Ativar janela de manutenção'}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('maintenance_enable_desc') || 'Quando ativa, utilizadores não-admin são bloqueados durante a janela definida.'}
                </p>
              </div>
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm((p) => ({ ...p, enabled: v }))} />
            </div>

            {/* Time window */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {t('maintenance_start') || 'Início'}</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {t('maintenance_end') || 'Fim'}</Label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))} />
              </div>
            </div>
            {form.start_time && form.end_time && form.end_time <= form.start_time && (
              <p className="text-xs text-muted-foreground -mt-2">
                {t('maintenance_overnight_hint') || 'Janela noturna (atravessa meia-noite).'}
              </p>
            )}

            {/* Days of week */}
            <div className="space-y-2">
              <Label>{t('maintenance_days') || 'Dias da semana'}</Label>
              <p className="text-xs text-muted-foreground">
                {t('maintenance_days_desc') || 'Selecione os dias em que a janela se aplica. Vazio = todos os dias.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {DAY_KEYS.map((dayKey, idx) => {
                  const active = form.days_of_week.includes(idx);
                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {(t(`day_${dayKey}`) || dayKey.charAt(0).toUpperCase() + dayKey.slice(1, 3))}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <Label>{t('maintenance_message') || 'Mensagem exibida'}</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                placeholder={t('maintenance_message_placeholder') || 'A plataforma encontra-se em manutenção. Volte mais tarde.'}
                rows={3}
              />
            </div>

            {/* Live preview badge */}
            {form.enabled && (
              <div className={`flex items-center gap-2 text-sm p-3 rounded-lg border ${
                currentlyActive
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                  : 'bg-muted text-muted-foreground border-border'
              }`}>
                <span className={`w-2 h-2 rounded-full ${currentlyActive ? 'bg-amber-500 animate-pulse' : 'bg-muted-foreground'}`} />
                {currentlyActive
                  ? (t('maintenance_preview_active') || 'Com a configuração atual, a janela estaria ativa neste momento.')
                  : (t('maintenance_preview_inactive') || 'Com a configuração atual, a janela está inativa neste momento.')}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('maintenance_save') || 'Guardar'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}