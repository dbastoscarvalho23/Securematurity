import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { effectiveUser, readActiveCustomer, writeActiveCustomer, setConsultantSession } from '@/lib/activeCustomer';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Registo devolvido pelo servidor; `user` é o que a interface vê (para consultores, o cliente ativo).
  const [rawUser, setUser] = useState(null);
  const [activeCustomerId, setActiveCustomerState] = useState(() => readActiveCustomer());
  const user = useMemo(() => {
    // Marcado aqui (e não num efeito) para valer já nos primeiros pedidos das páginas, cujos efeitos correm antes.
    setConsultantSession(rawUser?.role === 'consultant');
    return effectiveUser(rawUser, activeCustomerId);
  }, [rawUser, activeCustomerId]);
  const setActiveCustomer = (id) => {
    writeActiveCustomer(id || null);
    setActiveCustomerState(id || null);
  };
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkUserAuth();
  }, []);

  // O cliente ativo guardado só vale para consultores e só se ainda estiver entre os clientes a que chegam
  // (acesso revogado ou expirado, ou outra pessoa no mesmo navegador): caso contrário, limpa-se.
  useEffect(() => {
    if (!rawUser) return;
    const wanted = rawUser.role === 'consultant' ? (user?.customer_id || null) : null;
    if ((readActiveCustomer() || null) !== wanted) setActiveCustomer(wanted);
  }, [rawUser, user?.customer_id]);

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      // Log user login to audit trail (may also auto-assign customer_id / promote
      // role for previously-invited users). Resolve the FINAL user record BEFORE
      // the first setUser: rendering with the stale pre-assignment record made
      // RouteGuard see a 'user' without customer_id and intermittently redirect
      // to the Dashboard.
      const initialUser = await base44.auth.me();
      await base44.functions.invoke('logUserLogin', {}).catch(() => {});
      let currentUser = initialUser;
      try {
        currentUser = await base44.auth.me();
      } catch (_) {}
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      if (error?.status === 403 && error?.data?.extra_data?.reason === 'user_not_registered') {
        setAuthError({ type: 'user_not_registered', message: 'Utilizador não registado nesta aplicação' });
      } else if (error?.status === 401 || error?.status === 403) {
        setAuthError({ type: 'auth_required', message: 'É necessário iniciar sessão' });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  // Silently refresh user data without triggering loading state or audit log
  const refreshUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (_) {}
  };

  const logout = () => {
    setConsultantSession(false);
    writeActiveCustomer(null);
    setUser(null);
    setIsAuthenticated(false);
    base44.auth.logout('/login');
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      rawUser,
      activeCustomerId: user?.platform_role === 'consultant' ? user.customer_id : null,
      setActiveCustomer,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings: null,
      logout,
      navigateToLogin,
      checkAppState: checkUserAuth,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};