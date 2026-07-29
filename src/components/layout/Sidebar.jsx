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
  Shield,
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
  Gauge
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const isCustomerAdmin = user?.role === 'customer_admin';

  const isUser = user?.role === 'user';
  const hasCustomer = !!user?.customer_id;

  // "Principal" nav items — visible to all roles (user needs customer assigned)
  const mainNavItems = [
    { path: '/', labelKey: 'nav_dashboard', icon: LayoutDashboard },
    // Customers list only for admin
    ...(isAdmin ? [{ path: '/customers', labelKey: 'nav_customers', icon: Building2 }] : []),
    { path: '/compliance-journey', labelKey: 'nav_compliance_journey', icon: MapPin },
    { path: '/assessments', labelKey: 'nav_assessments', icon: ClipboardCheck },
    { path: '/evidence', labelKey: 'nav_evidence', icon: Paperclip },
    { path: '/tasks', labelKey: 'nav_tasks', icon: ListTodo },
    { path: '/task-analytics', labelKey: 'nav_task_analytics', icon: TrendingUp },
    { path: '/risk-assessment', labelKey: 'nav_risk_assessment', icon: TriangleAlert },
    { path: '/security-documents', labelKey: 'nav_documents', icon: FolderLock },
    { path: '/document-audit-trail', labelKey: 'nav_doc_audit_trail', icon: Activity },
    { path: '/reports', labelKey: 'nav_reports', icon: BarChart3 },
  ];

  // For plain 'user' with no customer, only show dashboard
  const visibleMainItems = (isUser && !hasCustomer)
    ? mainNavItems.filter(i => i.path === '/')
    : mainNavItems;

  const toolsNavItems = [
    { path: '/action-plan', labelKey: 'nav_action_plan', icon: Target },
    { path: '/question-bank', labelKey: 'nav_question_bank', icon: BookOpen },
  ];

  const systemItems = [
    ...(isAdmin ? [
      { path: '/admin', labelKey: 'nav_admin', icon: ShieldCheck },
      { path: '/audit-log', labelKey: 'nav_audit_log', icon: ScrollText },
      { path: '/email-report', labelKey: 'nav_email_report', icon: MailCheck },
    ] : []),
    ...(isCustomerAdmin ? [
      { path: '/email-report', labelKey: 'nav_email_report', icon: MailCheck },
    ] : []),
    { path: '/settings', labelKey: 'nav_settings', icon: Settings },
    { path: '/ropa', labelKey: 'nav_ropa', icon: Database },
    { path: '/incidents', labelKey: 'nav_incidents', icon: Siren },
    { path: '/dsr', labelKey: 'nav_dsr', icon: Users },
    { path: '/vulnerabilities', labelKey: 'nav_vulnerabilities', icon: Bug },
    { path: '/compliance-metrics', labelKey: 'nav_compliance_metrics', icon: Gauge },
  ];

  const supplyChainItems = [
    { path: '/supply-chain', labelKey: 'nav_supply_chain', icon: Truck },
    { path: '/suppliers', labelKey: 'nav_suppliers', icon: Building2 },
  ];

  const navGroups = [
    { labelKey: 'nav_main', items: visibleMainItems },
    ...(isAdmin ? [{ labelKey: 'nav_tools', items: toolsNavItems }] : []),
    { labelKey: 'nav_supply_chain_group', items: supplyChainItems },
    { labelKey: 'nav_system', items: systemItems },
  ];

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground z-40 flex flex-col transition-all duration-300 border-r border-sidebar-border",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border flex-shrink-0">
          <Shield className="w-7 h-7 text-primary flex-shrink-0" />
          {!collapsed && (
            <div className="ml-3 overflow-hidden">
              <span className="font-bold text-base tracking-tight block leading-tight">CyberMaturity</span>
              <span className="text-xs text-sidebar-foreground/40 block">Security Platform</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-4">
          {navGroups.map((group) => (
            <div key={group.labelKey}>
              {!collapsed && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
                  {t(group.labelKey)}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const label = t(item.labelKey);
                  const isActive = item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.path);
                  const link = (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      )}
                    >
                      <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "opacity-100" : "opacity-70")} />
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
          className="h-10 flex items-center justify-center border-t border-sidebar-border text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors flex-shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>
    </TooltipProvider>
  );
}