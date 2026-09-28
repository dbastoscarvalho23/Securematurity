import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MODULE_META } from '@/lib/licenseModules';

/**
 * Aviso de módulo/licença indisponível.
 *
 * É o destino do redirect do RouteGuard quando um módulo não está licenciado.
 * Está separado de /licensing (a página de administração de licenciamento)
 * para que o aviso seja um ecrã informativo acessível a qualquer papel.
 */
export default function LicenseUnavailable() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const reason = location.state?.reason;
  const moduleCode = location.state?.module;
  const moduleName = moduleCode ? (MODULE_META[moduleCode]?.name || moduleCode) : null;

  const titleKey = reason === 'license_usage_limit_exceeded'
    ? 'license_usage_limit_exceeded'
    : reason === 'license_not_active'
      ? 'license_not_active'
      : 'license_module_not_licensed';

  const descKey = reason === 'license_usage_limit_exceeded'
    ? 'license_usage_limit_exceeded_desc'
    : reason === 'license_not_active'
      ? 'license_not_active_desc'
      : 'license_module_not_licensed_desc';

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{t(titleKey)}</CardTitle>
              {moduleName && (
                <p className="text-sm text-muted-foreground mt-1">{moduleName}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t(descKey)}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4" />
              {t('common_back')}
            </Button>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate('/')}>
              <LayoutDashboard className="w-4 h-4" />
              {t('nav_dashboard')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
