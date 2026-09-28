import React from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MODULE_META } from '@/lib/licenseModules';

export default function Licensing() {
  const location = useLocation();
  const { t } = useLanguage();
  const reason = location.state?.reason;
  const moduleCode = location.state?.module;
  const moduleName = moduleCode ? (MODULE_META[moduleCode]?.name || moduleCode) : null;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('license_module_not_licensed')}</CardTitle>
              {moduleName && (
                <p className="text-sm text-muted-foreground mt-1">{moduleName}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {reason === 'license_not_active'
              ? t('license_not_active_desc')
              : t('license_module_not_licensed_desc')}
          </p>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4" />
            {t('common_back') || 'Back'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
