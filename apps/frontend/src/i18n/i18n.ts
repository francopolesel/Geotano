import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import es from './es.json';

const savedLocale = localStorage.getItem('locale') ?? 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: savedLocale,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

// Persist locale preference whenever it changes
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('locale', lng);
});

export default i18n;
