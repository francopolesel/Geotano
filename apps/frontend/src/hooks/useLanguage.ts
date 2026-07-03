import { useTranslation } from 'react-i18next';

export interface UseLanguageReturn {
  lang: string;
  setLang: (lang: string) => void;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
}

function getLocale(language: string): string {
  if (language.startsWith('es')) return 'es-ES';
  return 'en-US';
}

export function useLanguage(): UseLanguageReturn {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('es') ? 'es' : 'en';
  const locale = getLocale(i18n.language);

  const setLang = (newLang: string) => {
    i18n.changeLanguage(newLang);
  };

  const formatDate = (
    date: Date | string,
    options?: Intl.DateTimeFormatOptions,
  ): string => {
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString(locale, options ?? {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const formatTime = (
    date: Date | string,
    options?: Intl.DateTimeFormatOptions,
  ): string => {
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleTimeString(locale, options ?? {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid Date';
    }
  };

  return { lang, setLang, formatDate, formatTime };
}
