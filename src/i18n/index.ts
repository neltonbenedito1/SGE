import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Static JSON imports
import ptCommon from './locales/pt/common.json';
import ptDashboard from './locales/pt/dashboard.json';
import ptLibrary from './locales/pt/library.json';
import ptAdmin from './locales/pt/admin.json';
import ptUsers from './locales/pt/users.json';

import enCommon from './locales/en/common.json';
import enDashboard from './locales/en/dashboard.json';
import enLibrary from './locales/en/library.json';
import enAdmin from './locales/en/admin.json';
import enUsers from './locales/en/users.json';

const resources = {
  pt: {
    common: ptCommon,
    dashboard: ptDashboard,
    library: ptLibrary,
    admin: ptAdmin,
    users: ptUsers,
  },
  en: {
    common: enCommon,
    dashboard: enDashboard,
    library: enLibrary,
    admin: enAdmin,
    users: enUsers,
  },
};

const getSavedLanguage = (): string => {
  const saved = localStorage.getItem('saas_educ_system_lang');
  return saved || 'pt';
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getSavedLanguage(),
    fallbackLng: 'pt',
    defaultNS: 'common',
    ns: ['common', 'dashboard', 'library', 'admin', 'users'],
    interpolation: {
      escapeValue: false, // React already escapes values to prevent XSS
    },
  });

export default i18n;
