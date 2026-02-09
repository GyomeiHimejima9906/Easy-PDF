
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, LanguageCode, languages } from '../locales/translations';
import { DB } from '../utils/db';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>('it'); // Default Italian

  useEffect(() => {
    const loadLang = async () => {
      const savedLang = await DB.getSetting('language');
      if (savedLang) {
        setLanguageState(savedLang as LanguageCode);
      } else {
        // Try to detect browser language if no setting saved
        const browserLang = navigator.language;
        const matched = languages.find(l => browserLang.startsWith(l.code) || l.code === browserLang);
        if (matched) {
             setLanguageState(matched.code);
        }
      }
    };
    loadLang();
  }, []);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    DB.setSetting('language', lang);
  };

  const t = (key: string) => {
    return translations[language][key] || translations['en-US'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
