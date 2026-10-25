import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/AuthContext';

// RouteGuard behaviour depends entirely on useAuth — mock the context per test.
vi.mock('@/lib/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// UserNotRegisteredError consumes translations; provide a stub language context.
vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key) => (key === 'unreg_title' ? 'User not registered' : key),
  }),
}));

const renderProtected = ({ isAuthenticated, isLoadingAuth = false, authError = null }) => {
  useAuth.mockReturnValue({ isAuthenticated, isLoadingAuth, authError, user: null });
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          element={
            <ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />
          }
        >
          <Route path="/admin" element={<div>Admin content</div>} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/not-registered" element={<div>User not registered</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ProtectedRoute (auth redirect to /login)', () => {
  it('redirects unauthenticated users to /login', () => {
    renderProtected({ isAuthenticated: false });
    expect(screen.getByText('Login page')).toBeTruthy();
    expect(screen.queryByText('Admin content')).toBeNull();
  });

  it('redirects to /login when authentication failed (401 auth_required)', () => {
    renderProtected({
      isAuthenticated: false,
      authError: { type: 'auth_required', message: 'Authentication required' },
    });
    expect(screen.getByText('Login page')).toBeTruthy();
  });

  it('shows the not-registered screen for user_not_registered errors', () => {
    renderProtected({
      isAuthenticated: false,
      authError: { type: 'user_not_registered', message: 'User not registered for this app' },
    });
    expect(screen.getByText('User not registered')).toBeTruthy();
    expect(screen.queryByText('Login page')).toBeNull();
  });

  it('renders the protected content for authenticated users', () => {
    renderProtected({ isAuthenticated: true });
    expect(screen.getByText('Admin content')).toBeTruthy();
  });

  it('renders the loading fallback while auth is being checked', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoadingAuth: true,
      authError: null,
      user: null,
    });
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />}>
          <div>Admin content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    // Default fallback is a spinner — protected content must NOT leak.
    expect(screen.queryByText('Admin content')).toBeNull();
  });
});
