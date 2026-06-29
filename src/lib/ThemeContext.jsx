import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem('app_theme') || 'system'; }
    catch { return 'system'; }
  });

  // Sync from user profile on load
  useEffect(() => {
    try {
      base44.auth.me().then(user => {
        if (user?.theme) {
          applyTheme(user.theme);
          setThemeState(user.theme);
          try { localStorage.setItem('app_theme', user.theme); } catch {}
        }
      }).catch(() => {});
    } catch {}
  }, []);

  // Apply theme to <html> element
  const applyTheme = (value) => {
    const root = document.documentElement;
    if (value === 'dark') {
      root.classList.add('dark');
    } else if (value === 'light') {
      root.classList.remove('dark');
    } else {
      // system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) root.classList.add('dark');
      else root.classList.remove('dark');
    }
  };

  // Apply theme whenever it changes
  useEffect(() => {
    applyTheme(theme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e) => {
        if (theme === 'system') applyTheme('system');
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  const setTheme = (value) => {
    setThemeState(value);
    try { localStorage.setItem('app_theme', value); } catch {}
    applyTheme(value);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};