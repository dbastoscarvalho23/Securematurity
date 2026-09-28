import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar, { PAGE_TITLE_KEYS } from './TopBar';
import { useLanguage } from '@/lib/LanguageContext';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { t } = useLanguage();

  // Close the mobile drawer whenever the route changes
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const pageTitleKey = Object.entries(PAGE_TITLE_KEYS).find(([path]) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  )?.[1];
  const pageTitle = pageTitleKey ? t(pageTitleKey) : 'AnkoraOne';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar onMenuClick={() => setMobileOpen(true)} />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <div className={cn("flex-1 flex flex-col transition-all duration-300 min-h-0", collapsed ? "md:ml-16" : "md:ml-60")}>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <h1 className="text-xl font-semibold tracking-tight text-foreground mb-4">{pageTitle}</h1>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}