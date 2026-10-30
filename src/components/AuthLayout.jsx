import React from "react";
import AnkoraLogo from "@/components/layout/AnkoraLogo";
import { useLanguage } from "@/lib/LanguageContext";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-3">
            <AnkoraLogo className="h-11" />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground mb-8 max-w-xs mx-auto">
            <span className="font-semibold text-primary">AnkoraOne:</span> {t('x_brand_slogan')}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-xl shadow-sm border border-border p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}