import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RouteGuard from '@/components/layout/RouteGuard';
import { useAuth } from '@/lib/AuthContext';

vi.mock('@/lib/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// O âmbito destes testes é a matriz de papéis: a licença não limita (hasModule real com licença nula) e a
// tradução devolve a própria chave, sem provedores nem chamadas de rede.
vi.mock('@/lib/licensing', async (importOriginal) => ({
  ...(await importOriginal()),
  useLicense: () => ({ data: null }),
}));
vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: (key) => key }),
}));

const Home = () => <div>Home</div>;
const Admin = () => <div>Admin</div>;
const Customers = () => <div>Customers</div>;
const Assessments = () => <div>Assessments</div>;

const renderAt = (initialPath) => {
  useAuth.mockClear();
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<RouteGuard path="/"><Home /></RouteGuard>} />
        <Route path="/admin" element={<RouteGuard path="/admin"><Admin /></RouteGuard>} />
        <Route path="/customers" element={<RouteGuard path="/customers"><Customers /></RouteGuard>} />
        <Route path="/assessments" element={<RouteGuard path="/assessments"><Assessments /></RouteGuard>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('RouteGuard (role-based access)', () => {
  it('allows admin everywhere', () => {
    useAuth.mockReturnValue({ user: { role: 'admin', customer_id: null } });
    const { unmount } = renderAt('/admin');
    expect(screen.getByText('Admin')).toBeTruthy();
    unmount();
    renderAt('/customers');
    expect(screen.getByText('Customers')).toBeTruthy();
  });

  it('redirects customer_admin away from admin-only routes to /', () => {
    useAuth.mockReturnValue({ user: { role: 'customer_admin', customer_id: 'c1' } });
    renderAt('/admin');
    expect(screen.queryByText('Admin')).toBeNull();
    expect(screen.getByText('Home')).toBeTruthy();
  });

  it('redirects customer_admin away from the restricted /customers page to /', () => {
    useAuth.mockReturnValue({ user: { role: 'customer_admin', customer_id: 'c1' } });
    renderAt('/customers');
    expect(screen.queryByText('Customers')).toBeNull();
    expect(screen.getByText('Home')).toBeTruthy();
  });

  it('allows customer_admin on other customer-scoped routes', () => {
    useAuth.mockReturnValue({ user: { role: 'customer_admin', customer_id: 'c1' } });
    renderAt('/assessments');
    expect(screen.getByText('Assessments')).toBeTruthy();
  });

  it('redirects a user without a customer to / on every other route', () => {
    useAuth.mockReturnValue({ user: { role: 'user', customer_id: null } });
    renderAt('/assessments');
    expect(screen.queryByText('Assessments')).toBeNull();
    expect(screen.getByText('Home')).toBeTruthy();
  });

  it('allows a user with a customer on principal routes', () => {
    useAuth.mockReturnValue({ user: { role: 'user', customer_id: 'c1' } });
    renderAt('/assessments');
    expect(screen.getByText('Assessments')).toBeTruthy();
  });

  it('redirects a user with a customer away from admin-only routes', () => {
    useAuth.mockReturnValue({ user: { role: 'user', customer_id: 'c1' } });
    renderAt('/admin');
    expect(screen.queryByText('Admin')).toBeNull();
    expect(screen.getByText('Home')).toBeTruthy();
  });
});