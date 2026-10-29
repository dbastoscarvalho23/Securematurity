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

// O RouteGuard também verifica a licença do cliente (LicensedRoute), que usa a língua e a API.
let mockLicense = null;
vi.mock('@/lib/LanguageContext', () => ({ useLanguage: () => ({ t: (key) => key }) }));
vi.mock('@/lib/licensing', async (importOriginal) => ({
  ...(await importOriginal()),
  useLicense: () => ({ data: mockLicense }),
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
    const blocked = ['/admin', '/audit-log', '/customers', '/question-bank', '/ropa', '/incidents', '/dsr', '/vulnerabilities', '/compliance-metrics', '/training'];
    for (const path of blocked) {
      const { unmount } = renderAt(path);
      expect(screen.getByText('REDIRECTED_HOME')).toBeTruthy();
      unmount();
    }
  });

  it('user without customer: only "/" allowed, everything else redirects to "/"', () => {
    mockUseAuth.mockReturnValue({ user: makeUser('user', null) });
    const { unmount } = renderAt('/');
    expect(screen.getByText('ALLOWED_CHILD')).toBeTruthy();
    unmount();
    for (const path of ['/evidence', '/compliance-metrics', '/assessments', '/settings']) {
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
