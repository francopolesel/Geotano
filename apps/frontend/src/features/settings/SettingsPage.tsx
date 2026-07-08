import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { api } from '../../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

type SettingsTab = 'preferences' | 'password';

const TABS: SettingsTab[] = ['preferences', 'password'];

// ─── Sections ───────────────────────────────────────────────────────────────

function PasswordSection() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (newPassword !== confirmPassword) {
      setMsg({ type: 'error', text: t('settings.passwordsDontMatch') });
      return;
    }
    if (newPassword.length < 8) {
      setMsg({ type: 'error', text: t('auth.validation.passwordMin') });
      return;
    }

    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setMsg({ type: 'success', text: t('settings.passwordChanged') });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : t('errors.common.passwordChangeFailed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h3 className="mb-4 text-lg font-semibold text-[var(--color-foreground)]">
        {t('settings.changePassword')}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-foreground)]">
            {t('settings.currentPassword')}
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-ring)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-foreground)]">
            {t('settings.newPassword')}
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-ring)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-foreground)]">
            {t('settings.confirmPassword')}
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-ring)]"
          />
        </div>

        {msg && (
          <div
            className={`rounded-lg px-4 py-2 text-sm ${
              msg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200'
            }`}
          >
            {msg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !currentPassword || !newPassword || !confirmPassword}
          className="rounded-lg min-h-[44px] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50"
        >
          {saving ? t('common.loading') : t('settings.changePassword')}
        </button>
      </form>
    </section>
  );
}

function PreferencesSection() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useThemeStore();

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    // Persist preference via API
    api.patch('/auth/profile', { language: lang }).catch(() => {});
  };

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h3 className="mb-4 text-lg font-semibold text-[var(--color-foreground)]">
        {t('settings.preferences')}
      </h3>

      {/* Theme */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-[var(--color-foreground)]">
          {t('settings.theme')}
        </label>
        <div className="mt-2 flex gap-2">
          {(['light', 'dark'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setTheme(mode)}
              className={`rounded-lg px-4 py-2 min-h-[44px] text-sm font-medium transition-colors ${
                theme === mode
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)]'
              }`}
            >
              {mode === 'light' ? t('settings.light') : t('settings.dark')}
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)]">
          {t('settings.language')}
        </label>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => changeLanguage('en')}
            className={`rounded-lg px-4 py-2 min-h-[44px] text-sm font-medium transition-colors ${
              i18n.language.startsWith('en')
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)]'
            }`}
          >
            {t('settings.english')}
          </button>
          <button
            onClick={() => changeLanguage('es')}
            className={`rounded-lg px-4 py-2 min-h-[44px] text-sm font-medium transition-colors ${
              i18n.language.startsWith('es')
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)]'
            }`}
          >
            {t('settings.spanish')}
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

function tabLabel(tab: SettingsTab, t: (key: string) => string): string {
  switch (tab) {
    case 'preferences': return t('settings.preferences');
    case 'password': return t('settings.password');
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const initialTab = (() => {
    const tab = searchParams.get('tab');
    if (tab && TABS.includes(tab as SettingsTab)) return tab as SettingsTab;
    return 'preferences';
  })();

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  const handleTabClick = (tab: SettingsTab) => {
    setActiveTab(tab);
    if (tab === 'preferences') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
        {t('settings.title')}
      </h1>

      {/* Tabs — FriendsPage segmented-control pattern */}
      <div className="flex gap-1 rounded-lg border border-[var(--color-border)] p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            className={`flex-1 rounded-md px-3 py-2 min-h-[44px] text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]'
            }`}
          >
            {tabLabel(tab, t)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'preferences' && <PreferencesSection />}
      {activeTab === 'password' && <PasswordSection />}
    </div>
  );
}
