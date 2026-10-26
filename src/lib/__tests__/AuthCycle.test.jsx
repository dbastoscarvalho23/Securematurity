import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key) => (key === 'unreg_title' ? 'User not registered' : key),
  }),
}));

// Auth cycle test: the AuthProvider resolves the session through the Base44
// SDK client. Mock the client so a signed-out visitor rejects with 401 and a
// signed-in visitor resolves to a user record — no network involved.
const meMock = vi.fn();
const invokeMock = vi.fn();
let hasTokenValue = true;

vi.mock('@/api/base44Client', () => ({
  base44: {
    auth: {
      // Com token guardado o AuthProvider consulta a sessão (o caso real de quem inicia sessão).
      hasToken: () => hasTokenValue,
      me: (...args) => meMock(...args),
      logout: vi.fn(),
      loginViaEmailPassword: vi.fn(),
      register: vi.fn(),
      verifyOtp: vi.fn(),
    },
    functions: { invoke: (...args) => invokeMock(...args) },
  },
}));

afterEach(() => {
  hasTokenValue = true;
  meMock.mockReset();
  invokeMock.mockReset();
  // AuthContext fire-and-forgets `logUserLogin` after a successful me(); the
  // mock must resolve (not return undefined) so the .catch() chain stays valid.
  invokeMock.mockResolvedValue({ ok: true });
});

const UnauthRedirect = () => <Navigate to="/login" replace />;
const Login = () => <div>Login page</div>;
const Dashboard = () => {
  const { user } = useAuth();
  return <div>Dashboard for {user.name}</div>;
};

const renderApp = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute unauthenticatedElement={<UnauthRedirect />} />}>
            <Route path="/" element={<Dashboard />} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );

describe('Auth cycle (AuthProvider + ProtectedRoute)', () => {
  it('redirects a signed-out visitor (401) to /login', async () => {
    meMock.mockRejectedValue(
      Object.assign(new Error('[Base44 SDK Error] Authentication required'), { status: 401 })
    );
    renderApp();
    await waitFor(() => expect(screen.getByText('Login page')).toBeTruthy());
    expect(screen.queryByText(/Dashboard for/)).toBeNull();
  });

  it('does not probe the session for a visitor with no stored token', async () => {
    hasTokenValue = false;
    window.localStorage.clear();
    renderApp();
    await waitFor(() => expect(screen.getByText('Login page')).toBeTruthy());
    expect(meMock).not.toHaveBeenCalled();
  });

  it('keeps a signed-in user on the protected page', async () => {
    meMock.mockResolvedValue({ name: 'Daniel Carvalho', role: 'admin', customer_id: null });
    renderApp();
    await waitFor(() => expect(screen.getByText(/Dashboard for Daniel Carvalho/)).toBeTruthy());
    expect(screen.queryByText('Login page')).toBeNull();
  });

  it('shows the not-registered screen for a 403 user_not_registered session', async () => {
    meMock.mockRejectedValue(
      Object.assign(new Error('User not registered'), {
        status: 403,
        data: { extra_data: { reason: 'user_not_registered' } },
      })
    );
    renderApp();
    await waitFor(() => expect(screen.getByText('User not registered')).toBeTruthy());
    expect(screen.queryByText('Login page')).toBeNull();
  });
});
