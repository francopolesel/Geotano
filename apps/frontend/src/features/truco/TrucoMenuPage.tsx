import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import {
  useTrucoPrefsStore,
  type TrucoDifficulty,
  type TrucoTargetPoints,
} from '../../store/trucoPrefsStore';
import {
  selectMostPlayedDifficulty,
  selectWinRate,
  useTruCpuStatsStore,
} from '../../store/truCpuStatsStore';
import { PERSONAS } from './ai';

/**
 * Truco menu — mode selection + CPU config (design D11 tree).
 * Difficulty/target/persona pickers persist through `trucoPrefsStore`; the
 * stats card reads the persisted CPU record via its selectors. Friend mode
 * activates with the multiplayer screen (CU6).
 */

const DIFFICULTIES: readonly TrucoDifficulty[] = ['easy', 'medium', 'hard'];
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

  const personaCount = PERSONAS.length;
  // Safe modulo keeps negative wrap-arounds (prev from 0) inside the roster.
  type PersonaEntry = (typeof PERSONAS)[number];
  const persona = PERSONAS[
    ((personaIndex % personaCount) + personaCount) % personaCount
  ] as PersonaEntry;
  const cyclePersona = (delta: number) => {
    setPersonaIndex(((personaIndex + delta) % personaCount + personaCount) % personaCount);
  };
  const stats = useTruCpuStatsStore((state) => state.stats);
  const winRate = selectWinRate(stats);
  const mostPlayed = selectMostPlayedDifficulty(stats);

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
          {DIFFICULTIES.map((value) => (
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

      {/* Mode selection — CPU playable, friend placeholder until CU6 */}
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
