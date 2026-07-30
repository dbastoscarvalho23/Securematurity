import React from 'react';
import { Shield, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';

export default function Landing() {
  const { t } = useLanguage();
  const features = [
    t('landing_feature_1'),
    t('landing_feature_2'),
    t('landing_feature_3'),
    t('landing_feature_4'),
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <Shield className="w-9 h-9 text-primary" />
          <div>
            <p className="text-sidebar-foreground font-bold text-xl tracking-tight">AnkoraOne</p>
            <p className="text-sidebar-foreground/40 text-xs">{t('landing_tagline')}</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-sidebar-foreground leading-tight">
              {t('landing_hero_title')}
            </h1>
            <p className="mt-4 text-sidebar-foreground/60 text-base leading-relaxed">
              {t('landing_hero_desc')}
            </p>
          </div>

          <ul className="space-y-3">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-sidebar-foreground/70">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-sidebar-foreground/30">{t('landing_copyright')}</p>
      </div>

      {/* Right Panel - Login */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 justify-center">
            <Shield className="w-8 h-8 text-primary" />
            <p className="text-foreground font-bold text-xl">AnkoraOne</p>
          </div>

          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold text-foreground">{t('landing_welcome')}</h2>
            <p className="text-muted-foreground text-sm">{t('landing_signin_desc')}</p>
          </div>

          <div className="space-y-4">
            <Button
              className="w-full h-11 text-base font-medium"
              onClick={() => base44.auth.redirectToLogin(window.location.href)}
            >
              {t('landing_signin')}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t('landing_access_note_1')}<br />
              {t('landing_access_note_2')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}