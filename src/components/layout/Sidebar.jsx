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
  Lightbulb,
  ScrollText,
  Shield,
  BookOpen,
  ListTodo,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/AuthContext';

const adminNavGroups = [
  {
    label: 'Main',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/customers', label: 'Customers', icon: Building2 },
      { path: '/assessments', label: 'Assessments', icon: ClipboardCheck },
      { path: '/tasks', label: 'Tasks', icon: ListTodo },
      { path: '/reports', label: 'Reports', icon: BarChart3 },
    ]
  },
  {
    label: 'Tools',
    items: [
      { path: '/action-plan', label: 'Action Plan', icon: Target },
      { path: '/question-bank', label: 'Question Bank', icon: BookOpen },
      { path: '/recommendations', label: 'Recommendations', icon: Lightbulb },
    ]
  },
  {
    label: 'System',
    items: [
      { path: '/admin', label: 'Admin', icon: ShieldCheck },
      { path: '/audit-log', label: 'Audit Log', icon: ScrollText },
      { path: '/settings', label: 'Settings', icon: Settings },
    ]
  }
];

const customerAdminNavGroups = [
  {
    label: 'Main',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/assessments', label: 'Assessments', icon: ClipboardCheck },
      { path: '/tasks', label: 'Tasks', icon: ListTodo },
      { path: '/reports', label: 'Reports', icon: BarChart3 },
    ]
  },
  {
    label: 'Tools',
    items: [
      { path: '/recommendations', label: 'Recommendations', icon: Lightbulb },
    ]
  },
  {
    label: 'System',
    items: [
      { path: '/settings', label: 'Settings', icon: Settings },
    ]
  }
];

const userNavGroups = [
  {
    label: 'Main',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/assessments', label: 'My Assessments', icon: ClipboardCheck },
      { path: '/tasks', label: 'Tasks', icon: ListTodo },
      { path: '/reports', label: 'Reports', icon: BarChart3 },
    ]
  },
  {
    label: 'System',
    items: [
      { path: '/settings', label: 'Settings', icon: Settings },
    ]
  }
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const { user } = useAuth();
  const role = user?.role;
  const navGroups =
    role === 'admin' ? adminNavGroups :
    role === 'customer_admin' ? customerAdminNavGroups :
    userNavGroups;

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
            <div key={group.label}>
              {!collapsed && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
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
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                  if (collapsed) {
                    return (
                      <Tooltip key={item.path}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
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