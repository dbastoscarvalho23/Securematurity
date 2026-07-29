import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, FolderKanban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/lib/LanguageContext';

/**
 * Collapsible aggregator group for compliance/development menus.
 * Renders a parent row that expands/collapses to reveal nested nav items.
 */
export default function DevelopmentNavGroup({ items, collapsed }) {
  const location = useLocation();
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);

  // Auto-expand when a child route is active
  const hasActiveChild = items.some(item =>
    item.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.path)
  );

  const isExpanded = !collapsed && (open || hasActiveChild);

  const groupLabel = t('nav_development');

  return (
    <div>
      {!collapsed && (
        <button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          className={cn(
            "flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
            hasActiveChild
              ? "text-sidebar-foreground"
              : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          )}
        >
          <FolderKanban className="w-4 h-4 flex-shrink-0 opacity-70" />
          <span className="truncate flex-1 text-left">{groupLabel}</span>
          <ChevronDown
            className={cn(
              "w-4 h-4 flex-shrink-0 opacity-60 transition-transform duration-200",
              isExpanded ? "" : "-rotate-90"
            )}
          />
        </button>
      )}

      {isExpanded && (
        <div className="mt-0.5 ml-3 pl-3 border-l border-sidebar-border space-y-0.5">
          {items.map((item) => {
            const label = t(item.labelKey);
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            const link = (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "opacity-100" : "opacity-70")} />
                <span className="truncate">{label}</span>
              </Link>
            );
            return link;
          })}
        </div>
      )}

      {collapsed && items.map((item) => {
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
          </Link>
        );
        return (
          <Tooltip key={item.path}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}