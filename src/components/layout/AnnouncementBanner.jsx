import React, { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Info, TriangleAlert, Wrench, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Faixa de anúncios da plataforma (FB8).
 *
 * O âmbito (global / tier / cliente) e a janela de exibição são resolvidos no
 * servidor por `manageAnnouncements` (`active`); a faixa só mostra o que a
 * função devolveu. Dispensar é local à sessão do browser — não é preferência de
 * conta nem leitura de notificação.
 */

const DISMISS_KEY = 'ankora_announcements_dismissed';

const SEVERITY_STYLE = {
  info: { icon: Info, className: 'bg-chart-1/10 border-chart-1/30 text-chart-1', key: 'ann_severity_info' },
  warning: { icon: TriangleAlert, className: 'bg-chart-3/10 border-chart-3/30 text-chart-3', key: 'ann_severity_warning' },
  maintenance: { icon: Wrench, className: 'bg-chart-4/10 border-chart-4/30 text-chart-4', key: 'ann_severity_maintenance' },
};

function readDismissed() {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function AnnouncementBanner() {
  const { t, language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [dismissed, setDismissed] = useState(readDismissed);

  const { data: announcements = [] } = useQuery({
    queryKey: ['platform-announcements-active'],
    queryFn: async () => {
      const result = await base44.functions.invoke('manageAnnouncements', { action: 'active' });
      const payload = result?.data || result;
      return payload?.announcements || [];
    },
    // Sem sessão iniciada não há audiência a resolver — `active` responderia 401,
    // pelo que a faixa não chega a pedir nada antes de haver utilizador.
    enabled: isAuthenticated,
    refetchInterval: 300000,
    staleTime: 30000,
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify(dismissed));
    } catch {
      // sessão sem storage — a faixa volta a aparecer, sem quebrar nada
    }
  }, [dismissed]);

  const dismiss = useCallback((id) => setDismissed((current) => [...new Set([...current, id])]), []);

  const visible = announcements.filter((announcement) => !dismissed.includes(announcement.id));
  if (visible.length === 0) return null;

  const dateFormatter = new Intl.DateTimeFormat(language === 'pt' ? 'pt-PT' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const formatDate = (value) => (value ? dateFormatter.format(new Date(value)) : null);
  const windowLabel = (announcement) => {
    const start = formatDate(announcement.starts_at);
    const end = formatDate(announcement.ends_at) || t('ann_window_open');
    if (!start && !end) return null;
    return `${start || '—'} → ${end}`;
  };

  return (
    <div className="flex flex-col">
      {visible.map((announcement) => {
        const style = SEVERITY_STYLE[announcement.severity] || SEVERITY_STYLE.info;
        const Icon = style.icon;
        const window = windowLabel(announcement);
        return (
          <div
            key={announcement.id}
            className={cn('flex items-start justify-between gap-3 border-b px-4 py-2 text-sm', style.className)}
          >
            <div className="flex items-start gap-2 min-w-0">
              <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">
                  <span className="mr-2 text-xs uppercase tracking-wide opacity-70">{t(style.key)}</span>
                  {announcement.title}
                </p>
                <p className="text-sm opacity-90">{announcement.message}</p>
                {window && <p className="mt-0.5 text-xs opacity-70">{window}</p>}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 flex-shrink-0 p-0"
              onClick={() => dismiss(announcement.id)}
              aria-label={t('ann_banner_dismiss')}
              title={t('ann_banner_dismiss')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
