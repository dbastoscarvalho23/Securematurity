import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';

export default function Register() {
  const { t } = useLanguage();
  const { checkAppState } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('details');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password || !confirm) {
      setError(t('register_err_fields'));
      return;
    }
    if (password.length < 8) {
      setError(t('register_err_weak_password'));
      return;
    }
    if (password !== confirm) {
      setError(t('register_err_password_mismatch'));
      return;
    }
    setLoading(true);
    try {
      await base44.auth.register({ email: email.trim(), password });
      setStep('otp');
    } catch (err) {
      setError(err?.message || t('register_err_email'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    if (!otp.trim()) {
      setError(t('register_err_otp'));
      return;
    }
    setLoading(true);
    try {
      await base44.auth.verifyOtp({ email: email.trim(), otpCode: otp.trim() });
      await base44.auth.loginViaEmailPassword(email.trim(), password);
      await checkAppState();
      navigate('/');
    } catch (err) {
      setError(err?.message || t('register_err_otp'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel (branding) */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <Shield className="w-9 h-9 text-primary" />
          <div>
            <p className="text-sidebar-foreground font-bold text-xl tracking-tight">AnkoraOne</p>
            <p className="text-sidebar-foreground/40 text-xs">{t('landing_tagline')}</p>
          </div>
        </div>
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-sidebar-foreground leading-tight">
            {t('register_title')}
          </h1>
          <p className="text-sidebar-foreground/60 text-base leading-relaxed">
            {t('register_subtitle')}
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/30">{t('landing_copyright')}</p>
      </div>

      {/* Right Panel - Register form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex lg:hidden items-center gap-3 justify-center">
            <Shield className="w-8 h-8 text-primary" />
            <p className="text-foreground font-bold text-xl">AnkoraOne</p>
          </div>

          {step === 'details' ? (
            <>
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold text-foreground">{t('register_title')}</h2>
                <p className="text-muted-foreground text-sm">{t('register_subtitle')}</p>
              </div>
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email">{t('register_email')}</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-pass">{t('register_password')}</Label>
                  <Input
                    id="reg-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-confirm">{t('register_confirm_password')}</Label>
                  <Input
                    id="reg-confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('register_button')}
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold text-foreground">{t('register_otp_label')}</h2>
                <p className="text-muted-foreground text-sm">{t('register_otp_prompt')}</p>
              </div>
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-otp">{t('register_otp_label')}</Label>
                  <Input
                    id="reg-otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    autoFocus
                    inputMode="numeric"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('register_otp_button')}
                </Button>
              </form>
            </>
          )}

          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('register_back')}
          </button>
        </div>
      </div>
    </div>
  );
}