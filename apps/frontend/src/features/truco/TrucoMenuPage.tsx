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
import { FriendsLobby } from './components/menu/FriendsLobby';
import { PERSONAS } from './ai';
import { CardsIcon, PeopleIcon, RobotIcon } from './components/icons';

/**
 * Truco menu — v2 STEP FLOW (batch C redesign).
 *
 * The old screen showed every option at once ("¿qué tengo que elegir?").
 * Now `/truco` is a three-screen state machine (no routing change):
 *   mode → big title + exactly two tappable cards;
 *   cpu-setup → rival → difficulty → target → JUGAR, stats collapsed below;
 *   friends   → existing friends first (presence + invite), code lobby demoted
 *               to a secondary collapsed section.
 *
 * Behavior contracts UNCHANGED: difficulty/target/persona pickers persist via
 * `trucoPrefsStore`; JUGAR navigates to /truco/cpu with the same persistence;
 * the friends step delegates to FriendsLobby which keeps the CU6 create/join
 * flows byte-identical. Reciprocal cross-game entry stays on the mode screen.
 */

type MenuScreen = 'mode' | 'cpu-setup' | 'friends';

const TARGETS: readonly TrucoTargetPoints[] = [15, 30];

/** Colored dot per difficulty, mirroring the table's color language. */
const DIFFICULTY_DOT: Record<TrucoDifficulty, string> = {
  easy: 'bg-emerald-500',
  medium: 'bg-yellow-400',
  hard: 'bg-red-500',
};

/** Selected accent per difficulty — green/yellow/red chips (v2 hierarchy). */
const DIFFICULTY_ACCENT: Record<TrucoDifficulty, string> = {
  easy: 'border-emerald-600 bg-emerald-600 text-white',
  medium: 'border-yellow-500 bg-yellow-400 text-yellow-950',
  hard: 'border-red-600 bg-red-600 text-white',
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
        'flex min-h-[44px] min-w-0 flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-all',
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
  const [screen, setScreen] = useState<MenuScreen>('mode');

  return (
    <div
      data-testid="truco-menu-page"
      className="mx-auto w-full max-w-2xl min-w-0 px-4 py-6"
    >
      {screen === 'mode' && <ModeScreen onPick={setScreen} />}
      {screen === 'cpu-setup' && <CpuSetupScreen onBack={() => setScreen('mode')} />}
      {screen === 'friends' && <FriendsLobby onBack={() => setScreen('mode')} />}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Screen 1 — mode: ONLY the game title + two large tappable cards.
 * ──────────────────────────────────────────────────────────────────────────── */
function ModeScreen({ onPick }: { onPick: (screen: MenuScreen) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <>
      {/* Game title header with a fanned-cards suit motif */}
      <header className="mb-8 flex flex-col items-center text-center">
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

      {/* Exactly two choices — side-by-side desktop, stacked on mobile */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          data-testid="truco-menu-vs-cpu"
          onClick={() => onPick('cpu-setup')}
          className={[
            'flex min-h-[88px] min-w-0 items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 text-left transition-all',
            'hover:-translate-y-0.5 hover:border-emerald-600 hover:shadow-md',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
          ].join(' ')}
        >
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          >
            <RobotIcon className="h-7 w-7" />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-bold text-[var(--color-foreground)]">
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
          onClick={() => onPick('friends')}
          className={[
            'flex min-h-[88px] min-w-0 items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 text-left transition-all',
            'hover:-translate-y-0.5 hover:border-sky-600 hover:shadow-md',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
          ].join(' ')}
        >
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
          >
            <PeopleIcon className="h-7 w-7" />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-bold text-[var(--color-foreground)]">
              {t('truco.menu.vsFriend')}
            </span>
            <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
              {t('truco.menu.vsFriendDesc')}
            </span>
          </span>
        </button>
      </div>

      {/* Reciprocal cross-game entry back to Geotano */}
      <div className="flex justify-center">
        <button
          type="button"
          data-testid="truco-menu-play-geotano"
          onClick={() => navigate('/')}
          className="min-h-[44px] rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          {t('truco.action.geotano')}
        </button>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Screen 2 — cpu-setup: Step 1 rival → Step 2 difficulty → Step 3 target →
 * JUGAR. Stats card collapsed at the bottom (secondary).
 * ──────────────────────────────────────────────────────────────────────────── */
function CpuSetupScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const difficulty = useTrucoPrefsStore((state) => state.difficulty);
  const targetPoints = useTrucoPrefsStore((state) => state.targetPoints);
  const personaIndex = useTrucoPrefsStore((state) => state.personaIndex);
  const setDifficulty = useTrucoPrefsStore((state) => state.setDifficulty);
  const setTargetPoints = useTrucoPrefsStore((state) => state.setTargetPoints);
  const setPersonaIndex = useTrucoPrefsStore((state) => state.setPersonaIndex);

  const stats = useTruCpuStatsStore((state) => state.stats);
  const winRate = selectWinRate(stats);
  const mostPlayed = selectMostPlayedDifficulty(stats);

  return (
    <section
      data-testid="truco-menu-config"
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
    >
      <header className="mb-4 flex items-center gap-2">
        <button
          type="button"
          data-testid="truco-menu-back"
          aria-label={t('truco.menu.backToModes')}
          onClick={onBack}
          className={[
            'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-[var(--color-border)] text-lg text-[var(--color-foreground)]',
            'hover:bg-[var(--color-muted)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
          ].join(' ')}
        >
          ←
        </button>
        <h2 className="text-xl font-black tracking-tight text-[var(--color-foreground)]">
          {t('truco.menu.vsCpu')}
        </h2>
      </header>

      {/* Step 1 — Elegí tu rival: persona cards, selectable */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        1 · {t('truco.menu.chooseRival')}
      </p>
      <div className="mb-5 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
        {PERSONAS.map((personaOption, index) => (
          <button
            key={personaOption.name}
            type="button"
            data-testid={`truco-persona-option-${index}`}
            aria-pressed={personaIndex === index}
            onClick={() => setPersonaIndex(index)}
            className={[
              'flex min-h-[72px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 transition-all',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
              personaIndex === index
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-sm'
                : 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] hover:border-[var(--color-primary)]',
            ].join(' ')}
          >
            <span aria-hidden className="text-2xl leading-none">
              {personaOption.avatar}
            </span>
            <span className="w-full truncate text-center text-xs font-semibold">
              {personaOption.name}
            </span>
          </button>
        ))}
      </div>

      {/* Step 2 — Dificultad: green/yellow/red chips with one-line copy */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        2 · {t('truco.menu.difficulty')}
      </p>
      <div className="mb-5 flex min-w-0 flex-col gap-2 sm:flex-row">
        {TRUCO_DIFFICULTIES.map((value) => (
          <button
            key={value}
            type="button"
            data-testid={`truco-difficulty-${value}`}
            aria-pressed={difficulty === value}
            onClick={() => setDifficulty(value)}
            className={[
              'flex min-h-[44px] min-w-0 flex-1 flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-all',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
              difficulty === value
                ? `${DIFFICULTY_ACCENT[value]} shadow-sm`
                : 'border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] hover:border-[var(--color-primary)]',
            ].join(' ')}
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
                difficulty === value ? 'opacity-90' : 'text-[var(--color-muted-foreground)]',
              ].join(' ')}
            >
              {t(`truco.difficulty.${value}Desc`)}
            </span>
          </button>
        ))}
      </div>

      {/* Step 3 — target points: compact secondary selector */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        3 · {t('truco.menu.target')}
      </p>
      <div className="mb-5 flex min-w-0 flex-col gap-2 sm:flex-row">
        {TARGETS.map((value) => (
          <OptionCard
            key={value}
            testId={`truco-target-${value}`}
            pressed={targetPoints === value}
            onClick={() => setTargetPoints(value)}
          >
            <span className="flex items-baseline gap-1.5">
              <span className="text-base font-bold tabular-nums">{value}</span>
              <span
                className={[
                  'text-xs leading-snug',
                  targetPoints === value
                    ? 'text-white/85'
                    : 'text-[var(--color-muted-foreground)]',
                ].join(' ')}
              >
                {t(value === 15 ? 'truco.target.shortDesc' : 'truco.target.longDesc')}
              </span>
            </span>
          </OptionCard>
        ))}
      </div>

      <button
        type="button"
        data-testid="truco-start-cpu"
        onClick={() => navigate('/truco/cpu')}
        className="mt-1 min-h-[52px] w-full rounded-xl bg-emerald-600 px-4 text-base font-black uppercase tracking-wider text-white transition-all hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      >
        {t('truco.menu.play')}
      </button>

      {/* Persisted CPU record (store selectors) — collapsed secondary card */}
      <details data-testid="truco-stats-card" className="mt-5 rounded-lg border border-[var(--color-border)] p-3">
        <summary className="cursor-pointer select-none py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('truco.stats.title')}
        </summary>
        <dl className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-8 gap-y-3 pt-3">
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
      </details>
    </section>
  );
}
