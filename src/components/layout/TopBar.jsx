import React, { useState, useEffect } from 'react';
import { User, LogOut, Settings, Building2, Loader2, Clock, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';

const PAGE_TITLE_KEYS = {
  '/': 'page_dashboard',
  '/customers': 'page_customers',
  '/assessments': 'page_assessments',
  '/question-bank': 'page_question_bank',
  '/recommendations': 'page_recommendations',
  '/tasks': 'page_tasks',
  '/task-analytics': 'page_task_analytics',
  '/action-plan': 'page_action_plan',
  '/reports': 'page_reports',
  '/admin': 'page_admin',
  '/audit-log': 'page_audit_log',
  '/settings': 'page_settings',
  '/risk-assessment': 'page_risk_assessment',
  '/security-documents': 'page_security_documents',
  '/document-audit-trail': 'page_document_audit_trail',
  '/compliance-journey': 'page_compliance_journey',
  '/evidence': 'page_evidence',
  '/email-report': 'page_email_report',
};

export default function TopBar() {
  const { user, refreshUser } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedLang, setSelectedLang] = useState(language);
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const [saving, setSaving] = useState(false);

  const pageTitleKey = Object.entries(PAGE_TITLE_KEYS).find(([path]) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  )?.[1];
  const pageTitle = pageTitleKey ? t(pageTitleKey) : 'CyberMaturity';

  const displayName = user?.display_name || user?.full_name || user?.email || 'User';
  const initials = displayName
    ? displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdmin = user?.role === 'admin';
  const roleLabel = {
    admin: t('role_admin'),
    customer_admin: t('role_customer_admin'),
    user: t('role_user'),
  }[user?.role] || t('role_user');
  const customerName = user?.customer_name;

  const openProfile = () => {
    setName(user?.display_name || user?.full_name || user?.email || '');
    setSelectedLang(language);
    setSelectedTheme(theme);
    setProfileOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.auth.updateMe({ display_name: name, language: selectedLang, theme: selectedTheme });
      setLanguage(selectedLang);
      setTheme(selectedTheme);
      await refreshUser();
      toast.success(t('profile_updated'));
      setProfileOpen(false);
    } catch (err) {
      toast.error(err?.message || t('profile_update_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">{pageTitle}</h2>
        </div>

        <div className="flex items-center gap-3">
          <GlobalSearch />
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2.5 text-sm font-medium h-9 px-3">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  {initials}
                </div>
                <div className="hidden md:flex flex-col items-start leading-tight">
                  <span className="text-sm font-medium">{displayName}</span>
                  {!isAdmin && customerName && (
                    <span className="text-xs text-muted-foreground">{customerName}</span>
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  <p className="text-xs text-primary font-medium">{roleLabel}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground font-mono">
                      {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  </div>
                  {!isAdmin && customerName && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground truncate">{customerName}</p>
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="text-sm text-muted-foreground flex-1">{t('profile_language')}</span>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    const next = language === 'en' ? 'pt' : 'en';
                    setLanguage(next);
                    base44.auth.updateMe({ language: next });
                  }}
                  className="flex items-center bg-muted rounded-full h-6 w-[3.25rem] relative border border-border overflow-hidden"
                >
                  <span className={`absolute inset-y-0.5 w-[calc(50%-1px)] rounded-full bg-primary transition-all duration-200 ${language === 'en' ? 'left-0.5' : 'left-[calc(50%+1px)]'}`} />
                  <span className={`relative z-10 w-1/2 text-center text-[10px] font-bold transition-colors duration-200 ${language === 'en' ? 'text-primary-foreground' : 'text-muted-foreground'}`}>EN</span>
                  <span className={`relative z-10 w-1/2 text-center text-[10px] font-bold transition-colors duration-200 ${language === 'pt' ? 'text-primary-foreground' : 'text-muted-foreground'}`}>PT</span>
                </button>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="text-sm text-muted-foreground flex-1">{t('profile_theme')}</span>
                <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5 border border-border">
                  {[
                    { value: 'light', icon: Sun },
                    { value: 'system', icon: Monitor },
                    { value: 'dark', icon: Moon },
                  ].map(({ value, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={e => { e.stopPropagation(); setTheme(value); base44.auth.updateMe({ theme: value }); }}
                      className={`p-1 rounded transition-colors ${theme === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <Icon className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openProfile}>
                <User className="w-4 h-4 mr-2" />
                {t('my_profile')}
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings className="w-4 h-4 mr-2" />
                    {t('settings')}
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => base44.auth.logout()}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t('sign_out')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('profile_title')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>{t('profile_full_name')}</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('profile_full_name_placeholder')}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('profile_email')}</Label>
              <Input value={user?.email || ''} disabled className="bg-muted/50 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('profile_role')}</Label>
              <Input value={roleLabel} disabled className="bg-muted/50 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('profile_language')}</Label>
              <Select value={selectedLang} onValueChange={setSelectedLang}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">🇬🇧 EN — English (International)</SelectItem>
                  <SelectItem value="pt">🇵🇹 PT — Português (Portugal)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('profile_theme')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'light', icon: Sun, label: t('profile_theme_light') },
                  { value: 'system', icon: Monitor, label: t('profile_theme_system') },
                  { value: 'dark', icon: Moon, label: t('profile_theme_dark') },
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedTheme(value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors text-sm font-medium ${
                      selectedTheme === value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('profile_local_time')}</Label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-muted/50">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-mono text-muted-foreground">
                  {currentTime.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
            {!isAdmin && customerName && (
              <div className="space-y-1.5">
                <Label>{t('profile_customer')}</Label>
                <Input value={customerName} disabled className="bg-muted/50 text-muted-foreground" />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProfileOpen(false)}>{t('profile_cancel')}</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {t('profile_save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}