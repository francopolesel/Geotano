import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const currentLang = i18n.language;

  const switchLanguage = (locale: string) => {
    i18n.changeLanguage(locale);
    localStorage.setItem('locale', locale);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => switchLanguage('en')}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          currentLang === 'en'
            ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
            : 'text-[var(--color-foreground)] hover:bg-[var(--color-muted)]'
        }`}
        aria-label={t('settings.english')}
      >
        {t('settings.english')}
      </button>
      <button
        onClick={() => switchLanguage('es')}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          currentLang === 'es'
            ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
            : 'text-[var(--color-foreground)] hover:bg-[var(--color-muted)]'
        }`}
        aria-label={t('settings.spanish')}
      >
        {t('settings.spanish')}
      </button>
    </div>
  );
}
