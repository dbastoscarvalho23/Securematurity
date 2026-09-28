import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar, { PAGE_TITLE_KEYS } from './TopBar';
import ImpersonationBanner from './ImpersonationBanner';
import SimulationBanner from './SimulationBanner';
import { RoleSimulationProvider, useIsSimulating } from '@/lib/RoleSimulationContext';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Write blocker — intercepts mutation buttons during role simulation
const WRITE_BUTTON_TEXTS = ['novo', 'editar', 'apagar', 'guardar', 'eliminar', 'criar', 'atualizar', 'save', 'delete', 'edit', 'new', 'create', 'update', 'send', 'submit', 'upload', 'import', 'approve', 'reject'];
const WRITE_BUTTON_ICONS = ['plus', 'pencil', 'pen', 'trash', 'send', 'upload', 'file-up', 'fileupload'];

function WriteBlocker({ children }) {
  const isSimulating = useIsSimulating();
  const { t } = useLanguage();

  useEffect(() => {
    if (!isSimulating) return;

    const handler = (e) => {
      const target = e.target.closest('button, [role="button"]');
      if (!target) return;

      const text = (target.textContent || '').toLowerCase().trim();
      const hasWriteText = WRITE_BUTTON_TEXTS.some(w => text.includes(w));

      // Check for lucide write icons by svg class name
      const svg = target.querySelector('svg');
      let hasWriteIcon = false;
      if (svg) {
        const className = svg.getAttribute('class') || '';
        const dataIcon = svg.getAttribute('data-lucide') || '';
        hasWriteIcon = WRITE_BUTTON_ICONS.some(ic =>
          className.includes(ic) || dataIcon.includes(ic)
        );
      }

      if (hasWriteText || hasWriteIcon) {
        e.preventDefault();
        e.stopPropagation();
        toast.warning(t('simulation_write_blocked'));
      }
    };

    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [isSimulating, t]);

  return children;
}

function LayoutContent() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const pageTitleKey = Object.entries(PAGE_TITLE_KEYS).find(([path]) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  )?.[1];
  const pageTitle = pageTitleKey ? t(pageTitleKey) : 'AnkoraOne';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        onMenuClick={() => setMobileOpen(true)}
        pageTitle={pageTitle}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <div className={cn(
          "flex-1 flex flex-col min-h-[calc(100vh-4rem)] transition-all duration-300",
          collapsed ? "md:ml-16" : "md:ml-60"
        )}>
          <ImpersonationBanner />
          <SimulationBanner />
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <h1 className="text-xl font-heading font-semibold tracking-tight text-foreground mb-4">{pageTitle}</h1>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout() {
  return (
    <RoleSimulationProvider>
      <WriteBlocker>
        <LayoutContent />
      </WriteBlocker>
    </RoleSimulationProvider>
  );
}
