import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  ClipboardCheck,
  BarChart3,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  ScrollText,
  BookOpen,
  ListTodo,
  Target,
  TrendingUp,
  FolderLock,
  Activity,
  TriangleAlert,
  Paperclip,
  MapPin,
  MailCheck,
  Truck,
  Database,
  Siren,
  Users,
  Bug,
  Gauge,
  GraduationCap,
  Bot,
  Scale,
  Boxes,
  Lightbulb
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AnkoraLogo from '@/components/layout/AnkoraLogo';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useLicense, hasModule, moduleForPath } from '@/lib/licensing';

export default function Sidebar({ collapsed, onToggle, mobileOpen = false, onCloseMobile }) {
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const isCustomerAdmin = user?.role === 'customer_admin';

  const isUser = user?.role === 'user';
  const hasCustomer = !!user?.customer_id;

  // Grupos do Figma «Executive Dashboard»: Visão geral → Avaliar e comprovar → Melhorar e gerir → Governar → Analisar.
  const overviewItems = [
    { path: '/', labelKey: 'nav_dashboard', icon: LayoutDashboard },
    ...(isAdmin ? [{ path: '/customers', labelKey: 'nav_customers', icon: Building2 }] : []),
  ];
  const assessItems = [
    { path: '/compliance-journey', labelKey: 'nav_compliance_journey', icon: MapPin },
    { path: '/assessments', labelKey: 'nav_assessments', icon: ClipboardCheck },
    { path: '/evidence', labelKey: 'nav_evidence', icon: Paperclip },
    { path: '/legal-library', labelKey: 'nav_legal_library', icon: Scale },
    ...(isCustomerAdmin ? [{ path: '/framework-guide', labelKey: 'nav_framework_guide', icon: Bot }] : []),
    // Inventário de ativos e ferramentas: informação «reservada» (art. 32.º) — só administradores
    ...((isAdmin || isCustomerAdmin) ? [{ path: '/assets', labelKey: 'nav_assets_tools', icon: Boxes }] : []),
  ];
  const improveItems = [
    // Incidentes, vulnerabilidades e plano de ação: administrador do cliente (o admin tem-nos em «Desenvolvimento»/«Ferramentas»).
    ...(isCustomerAdmin ? [
      { path: '/action-plan', labelKey: 'nav_action_plan', icon: Target },
      { path: '/recommendations', labelKey: 'page_recommendations', icon: Lightbulb },
    ] : []),
    { path: '/tasks', labelKey: 'nav_tasks', icon: ListTodo },
    { path: '/task-analytics', labelKey: 'nav_task_analytics', icon: TrendingUp },
    { path: '/risk-assessment', labelKey: 'nav_risk_assessment', icon: TriangleAlert },
    ...(isCustomerAdmin ? [
      { path: '/incidents', labelKey: 'nav_incidents', icon: Siren },
      { path: '/vulnerabilities', labelKey: 'nav_vulnerabilities', icon: Bug },
    ] : []),
  ];
  const governItems = [
    { path: '/security-documents', labelKey: 'nav_documents', icon: FolderLock },
    { path: '/document-audit-trail', labelKey: 'nav_doc_audit_trail', icon: Activity },
    { path: '/supply-chain', labelKey: 'nav_supply_chain', icon: Truck },
    { path: '/suppliers', labelKey: 'nav_suppliers', icon: Building2 },
  ];
  const analyseItems = [
    { path: '/reports', labelKey: 'nav_reports', icon: BarChart3 },
  ];

  // Utilizador sem cliente atribuído: só o painel
  const noCustomer = isUser && !hasCustomer;
  const onlyIfCustomer = (items) => (noCustomer ? [] : items);

  const toolsNavItems = [
    { path: '/action-plan', labelKey: 'nav_action_plan', icon: Target },
    { path: '/question-bank', labelKey: 'nav_question_bank', icon: BookOpen },
  ];

  const systemItems = [
    ...(isAdmin ? [
      { path: '/backoffice', labelKey: 'nav_backoffice', icon: ShieldCheck },
      { path: '/audit-log', labelKey: 'nav_audit_log', icon: ScrollText },
      { path: '/email-report', labelKey: 'nav_email_report', icon: MailCheck },
    ] : []),
    ...(isCustomerAdmin ? [
      { path: '/email-report', labelKey: 'nav_email_report', icon: MailCheck },
    ] : []),
    { path: '/settings', labelKey: 'nav_settings', icon: Settings },
  ];

  const developmentItems = [
    { path: '/ropa', labelKey: 'nav_ropa', icon: Database },
    { path: '/dsr', labelKey: 'nav_dsr', icon: Users },
    { path: '/vulnerabilities', labelKey: 'nav_vulnerabilities', icon: Bug },
    { path: '/incidents', labelKey: 'nav_incidents', icon: Siren },
    { path: '/compliance-metrics', labelKey: 'nav_compliance_metrics', icon: Gauge },
    { path: '/training', labelKey: 'nav_training', icon: GraduationCap },
    { path: '/framework-guide', labelKey: 'nav_framework_guide', icon: Bot },
  ];

  const { data: license } = useLicense();
  const licensed = (items) => items.filter((i) => hasModule(license, user, moduleForPath(i.path)));

  const navGroups = [
    { labelKey: 'nav_grp_overview', items: licensed(overviewItems) },
    { labelKey: 'nav_grp_assess', items: licensed(onlyIfCustomer(assessItems)) },
    { labelKey: 'nav_grp_improve', items: licensed(onlyIfCustomer(improveItems)) },
    { labelKey: 'nav_grp_govern', items: licensed(onlyIfCustomer(governItems)) },
    { labelKey: 'nav_grp_analyse', items: licensed(onlyIfCustomer(analyseItems)) },
    ...(isAdmin ? [{ labelKey: 'nav_tools', items: toolsNavItems }] : []),
    { labelKey: 'nav_system', items: licensed(systemItems) },
    ...(isAdmin ? [{ labelKey: 'nav_development', items: developmentItems }] : []),
  ].filter((g) => g.items.length > 0);

  return (
    <TooltipProvider delayDuration={0}>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground z-50 flex flex-col transition-all duration-300 border-r border-sidebar-border w-64",
          collapsed ? "md:w-16" : "md:w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Marca */}
        <div className={cn("flex items-center flex-shrink-0 pt-6 pb-2", collapsed ? "md:px-3 px-4" : "px-4")}>
          <Link to="/" onClick={onCloseMobile} className="flex h-14 items-center text-sidebar-foreground" aria-label="AnkoraOne">
            <AnkoraLogo compact={collapsed} className={collapsed ? "h-[30px]" : "h-[35px]"} />
          </Link>
        </div>

        {/* Navegação */}
        <nav className={cn("flex-1 pb-4 overflow-y-auto space-y-3", collapsed ? "md:px-2 px-4" : "px-4")}>
          {navGroups.map((group) => (
            <div key={group.labelKey} className="space-y-1">
              {!collapsed && (
                <p className="h-7 px-1 text-[10px] font-semibold uppercase leading-[14px] tracking-wide text-sidebar-muted">
                  {t(group.labelKey)}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const label = t(item.labelKey);
                  const isActive = item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.path);
                  const link = (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onCloseMobile}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        "flex h-10 items-center gap-2 rounded-lg px-3 text-xs leading-[18px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                        collapsed && "md:justify-center md:px-0",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                          : "bg-sidebar-accent text-sidebar-accent-foreground font-medium hover:bg-sidebar-border"
                      )}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </Link>
                  );
                  if (collapsed) {
                    return (
                      <Tooltip key={item.path}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{label}</TooltipContent>
                      </Tooltip>
                    );
                  }
                  return link;
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          className="hidden md:flex h-10 items-center justify-center border-t border-sidebar-border text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors flex-shrink-0"
          aria-label={collapsed ? t('x_sidebar_expand') : t('x_sidebar_collapse')}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>
    </TooltipProvider>
  );
}