import { useState, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';
import { resizeImage } from '../../lib/image';
import { AchievementBadge } from '../../components/ui/AchievementBadge';
import type { UserProfile, Achievement } from '@geotano/shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface MyProfileStats {
  bestScore: number;
  totalGames: number;
  perfectGames: number;
  bestStreak: number;
}

interface MyProfileResponse {
  stats: MyProfileStats;
  achievements: Achievement[];
}

// ─── Components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-center ${
      highlight
        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
        : 'border-[var(--color-border)] bg-[var(--color-card)]'
    }`}>
      <p className={`font-bold ${
        highlight ? 'text-2xl text-[var(--color-primary)]' : 'text-lg text-[var(--color-foreground)]'
      }`}>
        {value}
      </p>
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
    </div>
  );
}

function EditProfileSection({ user, onUpdated }: { user: UserProfile; onUpdated: (u: UserProfile) => void }) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio ?? '');
  const [avatarPreview, setAvatarPreview] = useState(user.avatarUrl ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    try {
      const resized = await resizeImage(file, 400, 0.7);
      setAvatarPreview(resized);
    } catch {
      const reader = new FileReader();
      reader.onload = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const body: Record<string, any> = {
        displayName: displayName.trim() || null,
        username: username.trim() || undefined,
        bio: bio.trim() || null,
      };
      if (avatarFile) {
        body.avatarData = avatarPreview;
      }
      const updated = await api.patch<UserProfile>('/auth/profile', body);
      onUpdated(updated);
      setMsg({ type: 'success', text: t('settings.saved') });
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : t('errors.common.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h3 className="mb-4 text-lg font-semibold text-[var(--color-foreground)]">
        {t('settings.profile')}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Avatar picker */}
        <div className="flex items-center gap-4">
          <label className="relative flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary)]/10 text-2xl font-bold text-[var(--color-primary)]">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              (displayName || user.username).charAt(0).toUpperCase()
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileChange}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--color-foreground)]">
              {t('settings.avatar')}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              {t('settings.avatarHint')}
            </p>
          </div>
        </div>

        {/* Display name */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-foreground)]">
            {t('settings.displayName')}
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={user.username}
            className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-ring)]"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-foreground)]">
            {t('settings.bio')}
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={t('settings.bioPlaceholder')}
            className="mt-1 block w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-ring)]"
          />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{t('settings.bioHint')}</p>
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-foreground)]">
            {t('auth.username')}
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-ring)]"
          />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{t('settings.usernameHint')}</p>
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-muted-foreground)]">
            {t('auth.email')}
          </label>
          <p className="mt-1 text-sm text-[var(--color-foreground)]">{user.email}</p>
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
          disabled={saving}
          className="rounded-lg min-h-[44px] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50"
        >
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </form>
    </section>
  );
}

function StatsAndAchievements({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [data, setData] = useState<MyProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.get<MyProfileResponse>(`/users/${userId}/profile`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('common.error'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, t]);

  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
        {t('common.loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
        <p className="text-sm text-[var(--color-destructive)]">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { stats, achievements } = data;
  const earnedCount = achievements.filter((a) => a.earnedAt).length;

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-foreground)]">
          {t('profile.stats')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={t('profile.bestScore')} value={stats.bestScore.toLocaleString()} highlight />
          <StatCard label={t('profile.totalGames')} value={stats.totalGames.toLocaleString()} />
          <StatCard label={t('profile.stats.perfectGames')} value={stats.perfectGames.toLocaleString()} />
          <StatCard label={t('profile.stats.streak')} value={stats.bestStreak.toLocaleString()} />
        </div>
      </section>

      {/* Achievements */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-foreground)]">
          {t('profile.achievements')}
        </h2>
        {achievements.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--color-muted-foreground)]">
            {t('profile.noAchievements')}
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
              {earnedCount} / {achievements.length} {t('profile.achievementsEarned')}
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {achievements.map((ach) => (
                <AchievementBadge key={ach.slug} achievement={ach} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function MyProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);

  if (!user) return null;

  const handleUserUpdated = (updated: UserProfile) => {
    if (token) {
      setAuth(token, updated);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
        {t('nav.myProfile')}
      </h1>

      <EditProfileSection user={user} onUpdated={handleUserUpdated} />
      <StatsAndAchievements userId={user.id} />
    </div>
  );
}