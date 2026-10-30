import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RouteGuard from '@/components/layout/RouteGuard';

// Mock the auth context — role matrix supplied per test, no injected session.
const mockUseAuth = vi.fn();
vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

<<<<<<< HEAD
// O RouteGuard também verifica a licença do cliente (LicensedRoute), que usa a língua e a API.
let mockLicense = null;
vi.mock('@/lib/LanguageContext', () => ({ useLanguage: () => ({ t: (key) => key }) }));
vi.mock('@/lib/licensing', async (importOriginal) => ({
  ...(await importOriginal()),
  useLicense: () => ({ data: mockLicense }),
=======
// O âmbito destes testes é a matriz de papéis: a licença não limita (hasModule real com licença nula) e a
// tradução devolve a própria chave, sem provedores nem chamadas de rede.
vi.mock('@/lib/licensing', async (importOriginal) => ({
  ...(await importOriginal()),
  useLicense: () => ({ data: null }),
}));
vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: (key) => key }),
>>>>>>> origin/main
}));

const renderAt = (path, children = <div>ALLOWED_CHILD</div>) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={<RouteGuard path={path}>{children}</RouteGuard>} />
        <Route path="*" element={<div>REDIRECTED_HOME</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('RouteGuard — role matrix', () => {
  const makeUser = (role, customer_id) => ({ id: 'u1', role, customer_id });

  it('admin: full access everywhere', () => {
    mockUseAuth.mockReturnValue({ user: makeUser('admin', null) });
    for (const path of ['/admin', '/compliance-metrics', '/customers', '/', '/evidence']) {
      const { unmount } = renderAt(path);
      expect(screen.getByText('ALLOWED_CHILD')).toBeTruthy();
      unmount();
    }
  });

  it('customer_admin: allowed on customer-scoped routes', () => {
    mockUseAuth.mockReturnValue({ user: makeUser('customer_admin', 'c1') });
    for (const path of ['/', '/evidence', '/compliance-journey', '/settings']) {
      const { unmount } = renderAt(path);
      expect(screen.getByText('ALLOWED_CHILD')).toBeTruthy();
      unmount();
    }
  });

  it('customer_admin: blocked from admin-only routes', () => {
    mockUseAuth.mockReturnValue({ user: makeUser('customer_admin', 'c1') });
<<<<<<< HEAD
    const blocked = ['/admin', '/backoffice', '/backoffice/customers', '/backoffice/users', '/backoffice/audit', '/audit-log', '/customers', '/question-bank', '/ropa', '/dsr', '/compliance-metrics', '/training'];
=======
    const blocked = ['/admin', '/backoffice', '/backoffice/users', '/audit-log', '/customers', '/question-bank', '/ropa', '/dsr', '/compliance-metrics', '/training'];
>>>>>>> origin/main
    for (const path of blocked) {
      const { unmount } = renderAt(path);
      expect(screen.getByText('REDIRECTED_HOME')).toBeTruthy();
      unmount();
    }
  });

<<<<<<< HEAD
  it('customer_admin: incidentes e vulnerabilidades dependem só da licença', () => {
=======
  it('customer_admin: allowed on incidents and vulnerabilities', () => {
>>>>>>> origin/main
    mockUseAuth.mockReturnValue({ user: makeUser('customer_admin', 'c1') });
    for (const path of ['/incidents', '/vulnerabilities']) {
      const { unmount } = renderAt(path);
      expect(screen.getByText('ALLOWED_CHILD')).toBeTruthy();
      unmount();
    }
  });

  it('user without customer: only "/" and "/settings" allowed, everything else redirects to "/"', () => {
    mockUseAuth.mockReturnValue({ user: makeUser('user', null) });
    for (const path of ['/', '/settings']) {
      const { unmount } = renderAt(path);
      expect(screen.getByText('ALLOWED_CHILD')).toBeTruthy();
      unmount();
    }
    for (const path of ['/evidence', '/compliance-metrics', '/assessments', '/tasks']) {
      const { unmount } = renderAt(path);
      expect(screen.getByText('REDIRECTED_HOME')).toBeTruthy();
      unmount();
    }
  });

  it('user with customer: principal routes + settings allowed', () => {
    mockUseAuth.mockReturnValue({ user: makeUser('user', 'c1') });
    for (const path of ['/', '/evidence', '/compliance-journey', '/assessments', '/tasks', '/risk-assessment', '/settings']) {
      const { unmount } = renderAt(path);
      expect(screen.getByText('ALLOWED_CHILD')).toBeTruthy();
      unmount();
    }
  });

  it('user with customer: non-principal routes redirect to "/"', () => {
    mockUseAuth.mockReturnValue({ user: makeUser('user', 'c1') });
    for (const path of ['/admin', '/audit-log', '/customers', '/question-bank', '/ropa', '/incidents']) {
      const { unmount } = renderAt(path);
      expect(screen.getByText('REDIRECTED_HOME')).toBeTruthy();
      unmount();
    }
  });

  it('unauthenticated (no user): treated as lowest-privilege "user" — private routes redirect to "/"', () => {
    // RouteGuard itself assumes an authenticated user; without one, role is
    // undefined → falls through to the "user" branch. /metrics has no route
    // in the router, so anything unexpected still never renders admin content.
    mockUseAuth.mockReturnValue({ user: null });
    const { unmount } = renderAt('/evidence');
    expect(screen.getByText('REDIRECTED_HOME')).toBeTruthy();
    unmount();
  });
<<<<<<< HEAD

  it('módulo fora da licença: mostra o bloqueio em vez da página', () => {
    mockUseAuth.mockReturnValue({ user: makeUser('customer_admin', 'c1') });
    mockLicense = { state: 'active', effective: true, modules: [] };
    try {
      renderAt('/evidence');
      expect(screen.queryByText('ALLOWED_CHILD')).toBeNull();
      expect(screen.getByText('lic_blocked_title')).toBeTruthy();
    } finally {
      mockLicense = null;
    }
  });
});
=======
});
>>>>>>> origin/main
