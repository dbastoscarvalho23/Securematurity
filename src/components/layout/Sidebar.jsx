import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, ClipboardCheck, BarChart3, ShieldCheck,
  Settings, ChevronLeft, ChevronRight, ScrollText, BookOpen,
  ListTodo, Target, TrendingUp, FolderLock, Activity, TriangleAlert,
  Paperclip, MapPin, MailCheck, Truck, Database, Siren, Users, Bug,
  Gauge, GraduationCap, Bot, Network, UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { getNavGroups } from '@/lib/rbac';


const ICON_MAP = {
  LayoutDashboard, Building2, ClipboardCheck, BarChart3, ShieldCheck,
  Settings, ScrollText, BookOpen, ListTodo, Target, TrendingUp,
  FolderLock, Activity, TriangleAlert, Paperclip, MapPin, MailCheck,
  Truck, Database, Siren, Users, Bug, Gauge, GraduationCap, Bot, Network, UserCog,
};

export default function Sidebar({ collapsed, onToggle, mobileOpen = false, onCloseMobile }) {
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();

  const role = user?.role;
  const hasCustomer = !!user?.customer_id;

  // Single source of truth: get nav groups from RBAC system
  const navGroups = getNavGroups(role, hasCustomer);

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
          "fixed left-0 top-14 h-[calc(100vh-3.5rem)] bg-sidebar text-sidebar-foreground z-50 flex flex-col transition-all duration-300 border-r border-sidebar-border w-64",
          collapsed ? "md:w-16" : "md:w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
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
                  const Icon = ICON_MAP[item.icon] || LayoutDashboard;
                  const link = (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onCloseMobile}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      )}
                    >
                      <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "opacity-100" : "opacity-70")} />
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
          className="hidden md:flex h-10 items-center justify-center border-t border-sidebar-border text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors flex-shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>
    </TooltipProvider>
  );
}
