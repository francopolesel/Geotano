import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: { theme: string; size: string; width?: string },
          ) => void;
        };
      };
    };
  }
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, setAuth, isLoading, error, clearError } = useAuthStore();
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [googleLoading, setGoogleLoading] = useState(false);

  // ── Google OAuth ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return;

    // Load Google's Identity Services library if not already loaded
    if (!window.google) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.body.appendChild(script);
    } else {
      initGoogle();
    }

    function initGoogle() {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID!,
        callback: handleGoogleCredential,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: '320',
      });
    }
  }, []);

  const handleGoogleCredential = async (response: { credential: string }) => {
    setGoogleLoading(true);
    try {
      const data = await api.post<{ token: string; user: any }>('/auth/google', {
        credential: response.credential,
        clientId: GOOGLE_CLIENT_ID,
      });
      setAuth(data.token, data.user);
      navigate('/', { replace: true });
    } catch (err) {
      // Error shown below
      setValidationErrors((prev) => ({
        ...prev,
        google: err instanceof Error ? err.message : 'Google sign-in failed',
      }));
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Regular login ───────────────────────────────────────────────────────

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!username.trim()) {
      errors.username = t('auth.validation.usernameRequired');
    }

    if (!password) {
      errors.password = t('auth.validation.passwordRequired');
    } else if (password.length < 8) {
      errors.password = t('auth.validation.passwordMin');
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    if (!validate()) return;

    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch {
      // Error is set in store — component re-renders with error state
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('app.name')}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('app.tagline')}</p>
        </div>

        {/* Google Sign-In */}
        {GOOGLE_CLIENT_ID && (
          <>
            <div
              ref={googleBtnRef}
              className="mb-4 flex justify-center"
            />
            {validationErrors.google && (
              <div className="mb-4 rounded-lg bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]">
                {validationErrors.google}
              </div>
            )}
            {googleLoading && (
              <p className="mb-4 text-center text-sm text-[var(--color-muted-foreground)]">
                {t('common.loading')}
              </p>
            )}
            <div className="mb-4 flex items-center gap-3">
              <hr className="flex-1 border-[var(--color-border)]" />
              <span className="text-xs text-[var(--color-muted-foreground)]">OR</span>
              <hr className="flex-1 border-[var(--color-border)]" />
            </div>
          </>
        )}

        {!GOOGLE_CLIENT_ID && (
          <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            Google sign-in not configured. Set <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> to enable it.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Server error */}
          {error && (
            <div className="rounded-lg bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]">
              {error}
            </div>
          )}

          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-[var(--color-foreground)]">
              {t('auth.username')}
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors
                bg-[var(--color-background)] text-[var(--color-foreground)]
                ${validationErrors.username
                  ? 'border-[var(--color-destructive)]'
                  : 'border-[var(--color-border)] focus:border-[var(--color-ring)]'
                }`}
              placeholder="geotano_fan"
              autoComplete="username"
            />
            {validationErrors.username && (
              <p className="mt-1 text-xs text-[var(--color-destructive)]">{validationErrors.username}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--color-foreground)]">
              {t('auth.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors
                bg-[var(--color-background)] text-[var(--color-foreground)]
                ${validationErrors.password
                  ? 'border-[var(--color-destructive)]'
                  : 'border-[var(--color-border)] focus:border-[var(--color-ring)]'
                }`}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            {validationErrors.password && (
              <p className="mt-1 text-xs text-[var(--color-destructive)]">{validationErrors.password}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full min-h-[44px] rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? t('common.loading') : t('auth.login')}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-medium text-[var(--color-primary)] hover:underline">
            {t('auth.register')}
          </Link>
        </p>
      </div>
    </div>
  );
}
