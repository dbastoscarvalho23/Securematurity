import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations';
import { base44 } from '@/api/base44Client';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    try { return localStorage.getItem('app_language') || 'en'; }
    catch { return 'en'; }
  });

  // Sync from user profile when user loads (without depending on useAuth)
  useEffect(() => {
    try {
      base44.auth.me().then(user => {
        if (user?.language) {
          setLanguageState(user.language);
          try { localStorage.setItem('app_language', user.language); } catch {}
        }
      }).catch(() => {});
    } catch {}
  }, []);

  const setLanguage = (lang) => {
    setLanguageState(lang);
    try { localStorage.setItem('app_language', lang); } catch {}
  };

  const t = (key, params) => {
    let str = translations[language]?.[key] || translations['en']?.[key] || key;
    if (params && typeof str === 'string') {
      str = str.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
    }
    return str;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};