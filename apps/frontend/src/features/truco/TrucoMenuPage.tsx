import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import {
  useTrucoPrefsStore,
  TRUCO_DIFFICULTIES,
  type TrucoDifficulty,
  type TrucoTargetPoints,
} from '../../store/trucoPrefsStore';
import {
  selectMostPlayedDifficulty,
  selectWinRate,
  useTruCpuStatsStore,
} from '../../store/truCpuStatsStore';
import { useFriendsStore } from '../../store/friendsStore';
import {
  createTrucoMatch,
  joinTrucoMatchByCode,
  lookupTrucoMatchByCode,
} from '../../lib/trucoApi';
import { personaAt, normalizePersonaIndex } from './ai';
import { statusOf } from './lib/apiStatus';
import { CardsIcon, PeopleIcon, RobotIcon } from './components/icons';

/**
 * Truco menu — mode selection + CPU config + friend lobby (design D11 tree).
 * Batch 3 presentation pass: big game-title header with a card-suit motif,
 * two large tappable mode cards, difficulty/target as labeled option cards
 * with colored dots + one-line explanations, and a calmer stats card.
 *
 * Behavior is UNCHANGED: difficulty/target/persona pickers persist through
 * `trucoPrefsStore`; the stats card reads the persisted CPU record via its
 * selectors; the friend lobby creates invite/code matches (CU6) — create
 * POSTs {targetPoints?, friendId?} and navigates into the match screen;
 * join-by-code runs the S3 convenience pre-check (friendly 404 without
 * firing the join POST).
 */

const TARGETS: readonly TrucoTargetPoints[] = [15, 30];

/** Colored dot per difficulty, mirroring the table's color language. */
const DIFFICULTY_DOT: Record<TrucoDifficulty, string> = {
  easy: 'bg-emerald-500',
  medium: 'bg-yellow-400',
  hard: 'bg-red-500',
};

/** Big selectable option card keeping the aria-pressed toggle contract. */
function OptionCard({
  testId,
  pressed,
  onClick,
  children,
}: {
  testId: string;
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={pressed}
      onClick={onClick}
      className={[
        'flex min-h-[44px] min-w-0 flex-1 flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-all',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
        pressed
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-sm'
          : 'border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] hover:border-[var(--color-primary)]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function TrucoMenuPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const difficulty = useTrucoPrefsStore((state) => state.difficulty);
  const targetPoints = useTrucoPrefsStore((state) => state.targetPoints);
  const personaIndex = useTrucoPrefsStore((state) => state.personaIndex);
  const setDifficulty = useTrucoPrefsStore((state) => state.setDifficulty);
  const setTargetPoints = useTrucoPrefsStore((state) => state.setTargetPoints);
  const setPersonaIndex = useTrucoPrefsStore((state) => state.setPersonaIndex);

  // Safe indexing is centralized in personaAt / normalizePersonaIndex (the
  // store clamps on hydrate/set too — this covers direct navigation states).
  const persona = personaAt(personaIndex);
  const cyclePersona = (delta: number) => {
    setPersonaIndex(normalizePersonaIndex(personaIndex + delta));
  };
  const stats = useTruCpuStatsStore((state) => state.stats);
  const winRate = selectWinRate(stats);
  const mostPlayed = selectMostPlayedDifficulty(stats);

  // ── Friend lobby (CU6) ─────────────────────────────────────────────────────
  const friends = useFriendsStore((state) => state.friends);
  const onlineUsers = useFriendsStore((state) => state.onlineUsers);
  const [friendOpen, setFriendOpen] = useState(false);
  const [pickedFriendId, setPickedFriendId] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);

  const onCreate = async () => {
    if (creating) return;
    setCreating(true);
    setLobbyError(null);
    try {
      // friendId omitted entirely for open code matches (backend treats the
      // field as optional; absence = waiting room shared by code).
      const created = await createTrucoMatch({
        targetPoints,
        ...(pickedFriendId ? { friendId: pickedFriendId } : {}),
      });
      navigate(`/truco/match/${created.matchId}`);
    } catch (err) {
      setLobbyError(
        statusOf(err) === 403 ? t('truco.error.notFriends') : t('truco.error.generic'),
      );
    } finally {
      setCreating(false);
    }
  };

  const onJoin = async () => {
    const code = codeInput.trim();
    if (!code || joining) return;
    setJoining(true);
    setLobbyError(null);
    try {
      // S3 convenience: GET pre-check gives a friendly "no such match" without
      // firing the join POST; authority remains the join call itself.
      await lookupTrucoMatchByCode(code);
      const joined = await joinTrucoMatchByCode(code);
      navigate(`/truco/match/${joined.matchId}`);
    } catch (err) {
      const status = statusOf(err);
      if (status === 404) setLobbyError(t('truco.error.codeNotFound'));
      else if (status === 409) setLobbyError(t('truco.error.notJoinable'));
      else setLobbyError(t('truco.error.generic'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <div
      data-testid="truco-menu-page"
      className="mx-auto w-full max-w-2xl min-w-0 px-4 py-6"
    >
      {/* Game title header with a fanned-cards suit motif */}
      <header className="mb-6 flex flex-col items-center text-center">
        <div aria-hidden className="relative mb-2 h-10 w-16">
          <span className="absolute left-0 top-1 block h-9 w-6 rotate-[-12deg] rounded-sm border border-[var(--truco-card-border)] bg-[var(--truco-card-back)] shadow" />
          <span className="absolute right-0 top-1 block h-9 w-6 rotate-[12deg] rounded-sm border border-[var(--truco-card-border)] bg-[var(--truco-card-back)] shadow" />
          <span className="absolute left-1/2 top-0 block h-10 w-7 -translate-x-1/2 rounded-sm border border-[var(--truco-card-border)] bg-[var(--truco-card-face)] shadow">
            <CardsIcon className="mx-auto mt-2 h-4 w-4 text-[var(--truco-oro)]" />
            <span className="mx-auto mt-0.5 block h-1 w-3 rounded-full bg-[var(--truco-copa)]" />
          </span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-[var(--color-foreground)]">
          {t('truco.menu.fullTitle')}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {t('truco.menu.tagline')}
        </p>
      </header>

      {/* Mode selection — both modes playable (CPU + friend lobby, CU6).
          Two large tappable cards: side-by-side on desktop, stacked on mobile. */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          data-testid="truco-menu-vs-cpu"
          onClick={() => navigate('/truco/cpu')}
          className={[
            'flex min-h-[44px] min-w-0 items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 text-left transition-all',
            'hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-md',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
          ].join(' ')}
        >
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          >
            <RobotIcon className="h-6 w-6" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-bold text-[var(--color-foreground)]">
              {t('truco.menu.vsCpu')}
            </span>
            <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
              {t('truco.menu.vsCpuDesc')}
            </span>
          </span>
        </button>
        <button
          type="button"
          data-testid="truco-menu-vs-friend"
          aria-expanded={friendOpen}
          onClick={() => setFriendOpen((open) => !open)}
          className={[
            'flex min-h-[44px] min-w-0 items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 text-left transition-all',
            'hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-md',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
          ].join(' ')}
        >
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
          >
            <PeopleIcon className="h-6 w-6" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-bold text-[var(--color-foreground)]">
              {t('truco.menu.vsFriend')}
            </span>
            <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
              {t('truco.menu.vsFriendDesc')}
            </span>
          </span>
        </button>
      </div>

      {/* Friend lobby (CU6): create invite/code matches or join by code */}
      {friendOpen && (
        <section
          data-testid="truco-menu-friend"
          className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('truco.multi.sectionTitle')}
          </p>

          {friends.length === 0 ? (
            <div data-testid="truco-multi-no-friends" className="flex flex-col items-start gap-2">
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {t('truco.multi.noFriends')}
              </p>
              <button
                type="button"
                onClick={() => navigate('/friends')}
                className="min-h-[44px] rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-muted)]"
              >
                {t('truco.multi.addFriends')}
              </button>
            </div>
          ) : (
            <>
              {/* Opponent picker — option VALUE is the friend's user id
                  (identity the backend validates), never the friendship-row id. */}
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                {t('truco.multi.pickFriend')}
              </label>
              <select
                data-testid="truco-multi-friend-select"
                value={pickedFriendId}
                onChange={(event) => setPickedFriendId(event.target.value)}
                className="mb-3 min-h-[44px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)]"
              >
                <option value="">{t('truco.multi.openOption')}</option>
                {friends.map((friend) => {
                  const online = onlineUsers.has(friend.friendId);
                  return (
                    <option key={friend.id} value={friend.friendId} data-online={String(online)}>
                      {online ? `● ${friend.username}` : friend.username}
                    </option>
                  );
                })}
              </select>

              <button
                type="button"
                data-testid="truco-multi-create"
                disabled={creating}
                onClick={() => void onCreate()}
                className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                {creating ? t('truco.multi.creating') : t('truco.multi.create')}
              </button>

              <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                {t('truco.multi.joinTitle')}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  data-testid="truco-multi-code-input"
                  value={codeInput}
                  onChange={(event) => setCodeInput(event.target.value)}
                  placeholder={t('truco.multi.codePlaceholder')}
                  maxLength={8}
                  className="min-h-[44px] min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm uppercase tracking-widest text-[var(--color-foreground)] placeholder:tracking-normal placeholder:text-[var(--color-muted-foreground)]"
                />
                <button
                  type="button"
                  data-testid="truco-multi-join"
                  disabled={joining || codeInput.trim().length === 0}
                  onClick={() => void onJoin()}
                  className="min-h-[44px] shrink-0 rounded-md border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {joining ? t('truco.multi.joining') : t('truco.multi.join')}
                </button>
              </div>
            </>
          )}

          {lobbyError && (
            <p
              data-testid="truco-multi-error"
              role="alert"
              className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
            >
              {lobbyError}
            </p>
          )}
        </section>
      )}

      {/* CPU match configuration (persists across sessions) */}
      <section
        data-testid="truco-menu-config"
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('truco.menu.difficulty')}
        </p>
        <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row">
          {TRUCO_DIFFICULTIES.map((value) => (
            <OptionCard
              key={value}
              testId={`truco-difficulty-${value}`}
              pressed={difficulty === value}
              onClick={() => setDifficulty(value)}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span
                  aria-hidden
                  className={[
                    'h-2.5 w-2.5 shrink-0 rounded-full',
                    DIFFICULTY_DOT[value],
                    difficulty === value ? 'ring-2 ring-white/70' : '',
                  ].join(' ')}
                />
                {t(`truco.difficulty.${value}`)}
              </span>
              <span
                className={[
                  'text-xs leading-snug',
                  difficulty === value ? 'text-white/85' : 'text-[var(--color-muted-foreground)]',
                ].join(' ')}
              >
                {t(`truco.difficulty.${value}Desc`)}
              </span>
            </OptionCard>
          ))}
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('truco.menu.target')}
        </p>
        <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row">
          {TARGETS.map((value) => (
            <OptionCard
              key={value}
              testId={`truco-target-${value}`}
              pressed={targetPoints === value}
              onClick={() => setTargetPoints(value)}
            >
              <span className="text-base font-bold tabular-nums">{value}</span>
              <span
                className={[
                  'text-xs leading-snug',
                  targetPoints === value ? 'text-white/85' : 'text-[var(--color-muted-foreground)]',
                ].join(' ')}
              >
                {t(value === 15 ? 'truco.target.shortDesc' : 'truco.target.longDesc')}
              </span>
            </OptionCard>
          ))}
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('truco.menu.opponent')}
        </p>
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            data-testid="truco-persona-prev"
            aria-label={t('truco.menu.previousOpponent')}
            onClick={() => cyclePersona(-1)}
            className="min-h-[44px] min-w-[44px] rounded-md border border-[var(--color-border)] px-3 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
          >
            ‹
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2">
            <span data-testid="truco-persona-avatar" aria-hidden className="text-xl leading-none">
              {persona.avatar}
            </span>
            <span
              data-testid="truco-persona-name"
              className="truncate text-sm font-medium text-[var(--color-foreground)]"
            >
              {persona.name}
            </span>
          </div>
          <button
            type="button"
            data-testid="truco-persona-next"
            aria-label={t('truco.menu.nextOpponent')}
            onClick={() => cyclePersona(1)}
            className="min-h-[44px] min-w-[44px] rounded-md border border-[var(--color-border)] px-3 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
          >
            ›
          </button>
        </div>

        <button
          type="button"
          data-testid="truco-start-cpu"
          onClick={() => navigate('/truco/cpu')}
          className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          {t('truco.menu.startCpu')}
        </button>
      </section>

      {/* Persisted CPU record (store selectors) — calm single-row layout */}
      <section
        data-testid="truco-stats-card"
        className="mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('truco.stats.title')}
        </p>
        <dl className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
          <div className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {t('truco.stats.games')}
            </dt>
            <dd data-testid="truco-stats-games" className="text-xl font-bold tabular-nums">
              {stats.gamesPlayed}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {t('truco.stats.wins')}
            </dt>
            <dd data-testid="truco-stats-wins" className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {stats.wins}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {t('truco.stats.losses')}
            </dt>
            <dd data-testid="truco-stats-losses" className="text-xl font-bold tabular-nums text-[var(--color-muted-foreground)]">
              {stats.losses}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {t('truco.stats.winRate')}
            </dt>
            <dd data-testid="truco-stats-winrate" className="text-xl font-bold tabular-nums">
              {winRate}%
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {t('truco.stats.mostPlayed')}
            </dt>
            <dd data-testid="truco-stats-most-played" className="text-xl font-bold">
              {mostPlayed ?? t('truco.stats.never')}
            </dd>
          </div>
        </dl>
      </section>

      {/* Reciprocal cross-game entry back to Geotano */}
      <div className="mt-8 flex justify-center">
        <button
          type="button"
          data-testid="truco-menu-play-geotano"
          onClick={() => navigate('/')}
          className="min-h-[44px] rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          {t('truco.action.geotano')}
        </button>
      </div>
    </div>
  );
}
