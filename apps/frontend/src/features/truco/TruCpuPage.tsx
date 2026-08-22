import { useTranslation } from 'react-i18next';

/**
 * Placeholder — the CPU match screen (useTruCpuGame + table UI) lands in CU5.
 */
export function TruCpuPage() {
  const { t } = useTranslation();

  return (
    <div
      data-testid="truco-cpu-page"
      className="p-8 text-center text-sm text-[var(--color-muted-foreground)]"
    >
      {t('truco.menu.comingSoon')}
    </div>
  );
}
