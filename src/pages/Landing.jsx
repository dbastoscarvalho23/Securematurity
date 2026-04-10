import React from 'react';
import { Shield, CheckCircle2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

const features = [
  'Multi-framework cybersecurity assessments (NIS2, ISO 27001, NIST CSF, CIS v8, QNRC, GDPR)',
  'AI-generated recommendations and action plans',
  'Real-time maturity scoring and trend analysis',
  'Evidence management and audit trail',
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <Shield className="w-9 h-9 text-primary" />
          <div>
            <p className="text-sidebar-foreground font-bold text-xl tracking-tight">CyberMaturity</p>
            <p className="text-sidebar-foreground/40 text-xs">Security Assessment Platform</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-sidebar-foreground leading-tight">
              Manage your cybersecurity maturity with confidence
            </h1>
            <p className="mt-4 text-sidebar-foreground/60 text-base leading-relaxed">
              A comprehensive platform for conducting compliance assessments, tracking remediation and generating actionable insights.
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

        <p className="text-xs text-sidebar-foreground/30">© 2026 CyberMaturity Platform. All rights reserved.</p>
      </div>

      {/* Right Panel - Login */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 justify-center">
            <Shield className="w-8 h-8 text-primary" />
            <p className="text-foreground font-bold text-xl">CyberMaturity</p>
          </div>

          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="text-muted-foreground text-sm">Sign in to access your security dashboard</p>
          </div>

          <div className="space-y-4">
            <Button
              className="w-full h-11 text-base font-medium"
              onClick={() => base44.auth.redirectToLogin(window.location.href)}
            >
              Sign In
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Access is restricted to invited users only.<br />
              Contact your administrator to request access.
            </p>
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70 pt-2 border-t">
              <Globe className="w-3.5 h-3.5" />
              <span>Detected timezone: <span className="font-medium text-muted-foreground">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}