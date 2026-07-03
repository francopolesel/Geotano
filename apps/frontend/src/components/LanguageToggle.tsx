import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';

interface LanguageToggleProps {
  /** When true, renders as a floating FAB for mobile (<640px) instead of a top-bar button */
  mobile?: boolean;
}

export function LanguageToggle({ mobile = false }: LanguageToggleProps) {
  const { t } = useTranslation();
  const currentLang = i18n.language.startsWith('es') ? 'es' : 'en';

  const toggle = () => {
    const next = currentLang === 'en' ? 'es' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('locale', next);
  };

  if (mobile) {
    return (
      <button
        onClick={toggle}
        className="fixed bottom-4 right-4 z-50 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-sm font-bold text-[var(--color-foreground)] shadow-lg transition-colors hover:bg-[var(--color-muted)] sm:hidden"
        aria-label={currentLang === 'en' ? t('settings.spanish') : t('settings.english')}
      >
        {currentLang === 'en' ? 'ES' : 'EN'}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-bold text-[var(--color-foreground)] shadow-sm transition-colors hover:bg-[var(--color-muted)]"
      aria-label={currentLang === 'en' ? t('settings.spanish') : t('settings.english')}
    >
      {currentLang === 'en' ? 'ES' : 'EN'}
    </button>
  );
}
