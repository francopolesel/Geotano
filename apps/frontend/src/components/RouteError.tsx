import { useTranslation } from 'react-i18next';
import { useNavigate, useRouteError } from 'react-router-dom';

/**
 * Route-level error boundary fallback (wired via errorElement on routes).
 * Shows a friendly, recoverable screen instead of the default router error page.
 */
export function RouteError() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const error = useRouteError();

  // The error boundary is the only observability we have for render-time
  // crashes (e.g. the React 19 removeChild issue), so always log the real
  // error before showing the recovery screen.
  if (error) {
    console.error('[RouteError]', error);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center shadow-sm">
        <div className="text-5xl">⚠️</div>
        <h1 className="mt-4 text-xl font-semibold text-[var(--color-foreground)]">
          {t('errors.route.title')}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          {t('errors.route.message')}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full min-h-[48px] rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
          >
            {t('errors.route.reload')}
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
          >
            {t('errors.route.home')}
          </button>
        </div>
      </div>
    </div>
  );
}
