import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';

afterEach(cleanup);

// Mock the auth context — no session is injected; each test supplies the
// exact auth state it exercises.
const mockUseAuth = vi.fn();
vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Same wiring as App.jsx: unauthenticatedElement is a real <Navigate to="/login">
const renderAt = (path, unauthEl = <Navigate to="/login" replace />) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN_PAGE</div>} />
        <Route element={<ProtectedRoute unauthenticatedElement={unauthEl} />}>
          <Route path={path} element={<div>PROTECTED_CHILD</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

const STUB = { type: 'stub', source: 'test' };

describe('ProtectedRoute', () => {
  it('redirects unauthenticated visitors (no session, no user) to /login', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoadingAuth: false, authError: null, user: null });
    renderAt('/metrics');
    expect(screen.getByText('LOGIN_PAGE')).toBeTruthy();
    expect(screen.queryByText('PROTECTED_CHILD')).toBeNull();
  });

  it('renders unauthenticatedElement on authError', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoadingAuth: false, authError: STUB, user: null });
    renderAt('/evidence', <div>UNAUTH_BLOCKED</div>);
    expect(screen.getByText('UNAUTH_BLOCKED')).toBeTruthy();
    expect(screen.queryByText('PROTECTED_CHILD')).toBeNull();
  });

  it('renders the loading fallback while auth is loading (no child rendered)', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoadingAuth: true, authError: null, user: null });
    renderAt('/compliance-metrics');
    expect(screen.queryByText('PROTECTED_CHILD')).toBeNull();
    expect(screen.queryByText('LOGIN_PAGE')).toBeNull();
    expect(screen.queryByText('UNAUTH_BLOCKED')).toBeNull();
  });

  it('renders the protected child when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoadingAuth: false,
      authError: null,
      user: { id: 'u1', role: 'admin', customer_id: 'c1' },
    });
    renderAt('/metrics');
    expect(screen.getByText('PROTECTED_CHILD')).toBeTruthy();
    expect(screen.queryByText('LOGIN_PAGE')).toBeNull();
  });

  it('blocks private routes it wraps: /evidence and /compliance-metrics are gated the same way', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoadingAuth: false, authError: null, user: null });
    for (const path of ['/evidence', '/compliance-metrics']) {
      const { unmount } = renderAt(path);
      expect(screen.getByText('LOGIN_PAGE')).toBeTruthy();
      unmount();
    }
  });
});
