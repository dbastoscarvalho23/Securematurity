import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar, { PAGE_TITLE_KEYS } from './TopBar';
import ImpersonationBanner from './ImpersonationBanner';
import SimulationBanner from './SimulationBanner';
import AnnouncementBanner from './AnnouncementBanner';
import { RoleSimulationProvider, useIsSimulating, useEffectiveRole } from '@/lib/RoleSimulationContext';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ContextualHelpDrawer from '@/components/knowledge/ContextualHelpDrawer';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import ErrorState from '@/components/shared/ErrorState';
import { can, resourceForRoute } from '@/lib/rbac';

/**
 * Bloqueio de escrita na simulação de papel (FC4).
 *
 * A decisão passa pela matriz de capacidades — `can(effectiveRole, ação, recurso)`
 * — em vez da heurística de texto sozinha: a ação é inferida do rótulo (ou do
 * atributo explícito `data-capability`) e o recurso vem da rota atual. Só é
 * bloqueada a operação que o papel simulado não pode executar; navegação
 * (ligações, menu lateral) nunca é bloqueada, e a submissão de formulário por
 * teclado é intercetada.
 *
 * Continua a ser uma guarda de interface: a simulação é visual e não substitui a
 * autorização do servidor.
 */
const WRITE_ACTIONS = [
  { action: 'delete', words: ['apagar', 'eliminar', 'remover', 'revogar', 'delete', 'remove', 'revoke'] },
  { action: 'approve', words: ['aprovar', 'approve', 'publicar', 'publish'] },
  { action: 'create', words: ['novo', 'nova', 'criar', 'adicionar', 'convidar', 'carregar', 'enviar', 'importar', 'gerar', 'new', 'create', 'add', 'invite', 'upload', 'send', 'submit', 'import', 'generate'] },
  { action: 'edit', words: ['editar', 'guardar', 'atualizar', 'finalizar', 'save', 'edit', 'update', 'finalize'] },
];
const WRITE_ICONS = ['plus', 'pencil', 'pen', 'trash', 'save', 'file-up', 'fileupload'];

function inferAction(el) {
  const explicit = el.getAttribute('data-capability');
  if (explicit) return explicit;

  const text = (el.textContent || '').toLowerCase().trim();
  for (const { action, words } of WRITE_ACTIONS) {
    if (words.some((w) => text.includes(w))) return action;
  }

  const svg = el.querySelector('svg');
  if (svg) {
    const className = svg.getAttribute('class') || '';
    const dataIcon = svg.getAttribute('data-lucide') || '';
    if (WRITE_ICONS.some((ic) => className.includes(ic) || dataIcon.includes(ic))) return 'edit';
  }
  return null;
}

function isNavigation(el) {
  return el.tagName === 'A' || !!el.closest('nav, a[href], [data-allow-simulation]');
}

function WriteBlocker({ children }) {
  const isSimulating = useIsSimulating();
  const effectiveRole = useEffectiveRole();
  const { t } = useLanguage();
  const location = useLocation();

  useEffect(() => {
    if (!isSimulating) return;

    const resource = resourceForRoute(location.pathname);

    const block = (e, el) => {
      if (!el || isNavigation(el)) return;
      const action = inferAction(el);
      if (!action) return;
      // Sem recurso identificado não se decide por capacidade — não se bloqueia
      // por engano (era o defeito da heurística anterior).
      if (!resource) return;
      if (can(effectiveRole, action, resource)) return;

      e.preventDefault();
      e.stopPropagation();
      toast.warning(t('simulation_write_blocked_capability'));
    };

    const clickHandler = (e) => {
      const el = e.target.closest('button, [role="button"], input[type="submit"]');
      block(e, el);
    };
    const submitHandler = (e) => block(e, e.target);

    document.addEventListener('click', clickHandler, true);
    document.addEventListener('submit', submitHandler, true);
    return () => {
      document.removeEventListener('click', clickHandler, true);
      document.removeEventListener('submit', submitHandler, true);
    };
  }, [isSimulating, effectiveRole, location.pathname, t]);

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
          <AnnouncementBanner />
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {/* Título da página: fonte única é o TopBar (barra de contexto). A página
                começa directamente no seu conteúdo, com a mesma distância ao topo (FC1). */}
            {/* Fronteira de erro do layout (FA4): uma página que rebente mostra um
                painel de erro e mantém navegação e cabeçalho utilizáveis. A chave por
                rota reinicia a fronteira ao mudar de página. */}
            <ErrorBoundary
              key={location.pathname}
              fallback={({ reset }) => (
                <ErrorState
                  title={t('error_page_title')}
                  description={t('error_page_desc')}
                  onRetry={reset}
                />
              )}
            >
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <ContextualHelpDrawer />
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
