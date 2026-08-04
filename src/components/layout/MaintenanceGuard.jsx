import React, { useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { isInMaintenanceWindow } from '@/lib/maintenanceUtils';
import { Shield, Wrench, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MaintenanceGuard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [config, setConfig] = useState(null);
  const [tick, setTick] = useState(0);

  // Load the maintenance window config
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const list = await base44.entities.MaintenanceWindow.list();
        if (active) setConfig(list[0] || null);
      } catch {
        if (active) setConfig(null);
      }
    };
    load();
    const unsub = base44.entities.MaintenanceWindow.subscribe((event) => {
      if (event.type === 'create') setConfig(event.data);
      else if (event.type === 'update') setConfig(event.data);
      else if (event.type === 'delete') setConfig(null);
    });
    return () => { active = false; if (typeof unsub === 'function') unsub(); };
  }, []);

  // Re-evaluate every minute
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // Block only when: config exists, window is active now, and user is NOT an admin
  const blocked = useMemo(() => {
    // touch tick so the memo recomputes on the interval
    void tick;
    if (!config || user?.role === 'admin') return false;
    return isInMaintenanceWindow(config, new Date());
  }, [config, user?.role, tick]);

  if (blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sidebar p-6">
        <div className="w-full max-w-lg text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sidebar-accent">
            <Wrench className="w-8 h-8 text-sidebar-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-sidebar-foreground">
              {t('maintenance_title') || 'Em Manutenção'}
            </h1>
            <p className="text-sidebar-foreground/70 text-sm leading-relaxed">
              {config?.message || t('maintenance_default_message') || 'A plataforma encontra-se temporariamente indisponível para operações de suporte e manutenção. Por favor tente novamente mais tarde.'}
            </p>
          </div>
          {config?.start_time && config?.end_time && (
            <div className="inline-flex items-center gap-2 text-xs text-sidebar-foreground/50 border border-sidebar-border rounded-full px-3 py-1.5">
              <Clock className="w-3.5 h-3.5" />
              {t('maintenance_window_label') || 'Janela'}: {config.start_time} – {config.end_time}
            </div>
          )}
          <p className="text-xs text-sidebar-foreground/30 flex items-center justify-center gap-1.5">
            <Shield className="w-3 h-3" />
            {t('maintenance_admin_note') || 'Administradores mantêm acesso durante a manutenção.'}
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t('maintenance_retry') || 'Tentar novamente'}
          </Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}