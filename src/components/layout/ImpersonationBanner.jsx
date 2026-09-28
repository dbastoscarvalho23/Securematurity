import React from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';

/**
 * Impersonation Banner — shown when an admin is impersonating a real user
 * via adminImpersonateUser (different from role simulation).
 * Detects impersonation via the user object's `impersonating` flag.
 */
export default function ImpersonationBanner() {
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();

  // Check if currently impersonating
  const isImpersonating = !!user?.impersonating || !!user?.is_impersonating;
  if (!isImpersonating) return null;

  const impersonatedName = user?.impersonating?.display_name || user?.impersonating?.email || user?.email || '';
  const impersonatedRole = user?.impersonating?.role || user?.role || '';

  const stopImpersonation = async () => {
    try {
      await import('@/api/base44Client').then(({ base44 }) => base44.auth.stopImpersonating());
      await refreshUser();
    } catch (e) {
      // Fallback: reload
      window.location.reload();
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-chart-3/10 border-b border-chart-3/30 text-sm">
      <div className="flex items-center gap-2 text-chart-3">
        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
        <span>
          {t('impersonation_banner_text')
            .replace('{name}', impersonatedName)
            .replace('{role}', impersonatedRole)}
        </span>
        <span className="hidden sm:inline text-xs opacity-70">
          {t('impersonation_warning')}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={stopImpersonation}
        className="h-7 gap-1.5 border-chart-3/40 text-chart-3 hover:bg-chart-3/10"
      >
        <X className="w-3.5 h-3.5" />
        {t('impersonation_stop')}
      </Button>
    </div>
  );
}
