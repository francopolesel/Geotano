import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Placeholder — the multiplayer match screen (useTrucoMultiplayer) lands in CU6.
 */
export function TrucoMatchPage() {
  const { t } = useTranslation();
  const { matchId } = useParams<{ matchId: string }>();

  return (
    <div
      data-testid="truco-match-page"
      data-match-id={matchId}
      className="p-8 text-center text-sm text-[var(--color-muted-foreground)]"
    >
      {t('truco.menu.comingSoon')}
    </div>
  );
}
