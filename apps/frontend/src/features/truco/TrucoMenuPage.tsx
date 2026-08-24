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

/**
 * Truco menu — mode selection + CPU config + friend lobby (design D11 tree).
 * Difficulty/target/persona pickers persist through `trucoPrefsStore`; the
 * stats card reads the persisted CPU record via its selectors. The friend
 * lobby creates invite/code matches (CU6): create POSTs {targetPoints?,
 * friendId?} and navigates straight into the match screen; join-by-code runs
 * the S3 convenience pre-check (friendly 404 without firing the join POST).
 */

const TARGETS: readonly TrucoTargetPoints[] = [15, 30];

function OptionButton({
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
      className={
        'min-h-[44px] rounded-md border px-3 py-2 text-sm font-medium transition-colors ' +
        (pressed
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
          : 'border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] hover:border-[var(--color-primary)]')
      }
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
    <div data-testid="truco-menu-page" className="mx-auto w-full max-w-2xl min-w-0">
      <h1 className="mb-6 text-2xl font-bold text-[var(--color-foreground)]">
        {t('truco.title')}
      </h1>

      {/* CPU match configuration (persists across sessions) */}
      <section
        data-testid="truco-menu-config"
        className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('truco.menu.difficulty')}
        </p>
        <div className="mb-4 flex min-w-0 flex-wrap gap-2">
          {TRUCO_DIFFICULTIES.map((value) => (
            <OptionButton
              key={value}
              testId={`truco-difficulty-${value}`}
              pressed={difficulty === value}
              onClick={() => setDifficulty(value)}
            >
              {t(`truco.difficulty.${value}`)}
            </OptionButton>
          ))}
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('truco.menu.target')}
        </p>
        <div className="mb-4 flex min-w-0 flex-wrap gap-2">
          {TARGETS.map((value) => (
            <OptionButton
              key={value}
              testId={`truco-target-${value}`}
              pressed={targetPoints === value}
              onClick={() => setTargetPoints(value)}
            >
              {value}
            </OptionButton>
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
          className="mt-4 w-full rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          {t('truco.menu.startCpu')}
        </button>
      </section>

      {/* Mode selection — both modes playable (CPU + friend lobby, CU6) */}
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
          aria-expanded={friendOpen}
          onClick={() => setFriendOpen((open) => !open)}
          className="min-h-[48px] rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-left text-sm font-medium text-[var(--color-foreground)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-md"
        >
          {t('truco.menu.vsFriend')}
        </button>
      </div>

      {/* Friend lobby (CU6): create invite/code matches or join by code */}
      {friendOpen && (
        <section
          data-testid="truco-menu-friend"
          className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
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
                className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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

      {/* Persisted CPU record (store selectors) */}
      <section
        data-testid="truco-stats-card"
        className="mt-8 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:grid-cols-5"
      >
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('truco.stats.games')}
          </p>
          <p data-testid="truco-stats-games" className="text-lg font-bold tabular-nums">
            {stats.gamesPlayed}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('truco.stats.wins')}
          </p>
          <p data-testid="truco-stats-wins" className="text-lg font-bold tabular-nums">
            {stats.wins}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('truco.stats.losses')}
          </p>
          <p data-testid="truco-stats-losses" className="text-lg font-bold tabular-nums">
            {stats.losses}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('truco.stats.winRate')}
          </p>
          <p data-testid="truco-stats-winrate" className="text-lg font-bold tabular-nums">
            {winRate}%
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('truco.stats.mostPlayed')}
          </p>
          <p data-testid="truco-stats-most-played" className="text-lg font-bold">
            {mostPlayed ?? t('truco.stats.never')}
          </p>
        </div>
      </section>

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
