import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Truco menu — mode selection skeleton (design D11 tree).
 * Difficulty/target/persona pickers, create/join-by-code and the CPU stats
 * card land with CU5/CU6; friend mode activates with the multiplayer screen.
 */
export function TrucoMenuPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div data-testid="truco-menu-page" className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-[var(--color-foreground)]">
        {t('truco.title')}
      </h1>

      {/* Mode selection — CPU playable from CU5, friend placeholder until CU6 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          data-testid="truco-menu-vs-cpu"
          onClick={() => navigate('/truco/cpu')}
          className="min-h-[48px] rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-left text-sm font-medium text-[var(--color-foreground)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-md"
        >
          {t('truco.menu.vsCpu')}
        </button>
        <button
          type="button"
          data-testid="truco-menu-vs-friend"
          disabled
          title={t('truco.menu.comingSoon')}
          className="min-h-[48px] cursor-not-allowed rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-left text-sm font-medium text-[var(--color-muted-foreground)] opacity-60"
        >
          {t('truco.menu.vsFriend')}
        </button>
      </div>

      {/* Reciprocal cross-game entry back to Geotano */}
      <div className="mt-8">
        <button
          type="button"
          data-testid="truco-menu-play-geotano"
          onClick={() => navigate('/')}
          className="min-h-[44px] rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-muted)]"
        >
          {t('truco.action.geotano')}
        </button>
      </div>
    </div>
  );
}
