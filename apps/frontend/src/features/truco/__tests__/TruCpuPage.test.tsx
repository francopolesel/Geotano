import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n/i18n';
import { useTrucoPrefsStore } from '../../../store/trucoPrefsStore';
import {
  useTruCpuStatsStore,
  type TruCpuStats,
} from '../../../store/truCpuStatsStore';
import { PERSONAS } from '../ai';
import { TruCpuPage } from '../TruCpuPage';

function emptyStats(): TruCpuStats {
  return {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    byDifficulty: {
      easy: { games: 0, wins: 0, losses: 0 },
      medium: { games: 0, wins: 0, losses: 0 },
      hard: { games: 0, wins: 0, losses: 0 },
    },
  };
}

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/truco/cpu']}>
        <Routes>
          <Route path="/truco/cpu" element={<TruCpuPage />} />
          <Route path="/truco" element={<div data-testid="truco-menu-route-probe" />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

/** Advances the CPU think delay inside act(). */
function flush(ms = 750) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('TruCpuPage — vs CPU assembly', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Pin the clock: TruCpuPage derives its seed from Date.now().
    vi.setSystemTime(new Date('2026-08-21T00:00:00Z'));
    localStorage.clear();
    useTrucoPrefsStore.setState({
      difficulty: 'easy',
      targetPoints: 30,
      personaIndex: 3,
    });
    useTruCpuStatsStore.setState({ stats: emptyStats() });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders the table with the configured persona as rival', () => {
    renderPage();
    expect(screen.getByTestId('truco-table-zone')).toBeDefined();
    expect(screen.getByTestId('truco-rival-zone')).toBeDefined();
    expect(screen.getByTestId('rival-name').textContent).toBe(PERSONAS[3]!.name);
    expect(screen.getByTestId('rival-hand-count').textContent).toContain('3');
  });

  it('plays a full baza loop: deal → human card → CPU answer → baza outcome', () => {
    renderPage();

    const myZone = within(screen.getByTestId('truco-my-zone'));
    let resolvedBazas = false;
    for (let turn = 0; turn < 60 && !resolvedBazas; turn++) {
      // The hand-end panel (event-derived Continue) blocks input while the
      // engine has already auto-dealt the next hand. Release it via the pure-UI
      // Continue button so the match can keep advancing.
      const handContinue = screen.queryByTestId('truco-hand-end-continue');
      if (handContinue) {
        fireEvent.click(handContinue);
        flush(700);
        continue;
      }
      // Answer/call buttons first (Easy sometimes initiates a bet).
      const actionButton = Array.from(
        document.querySelectorAll(
          '[data-testid^="truco-action-"]:not([data-testid="truco-action-bar"])',
        ),
      ).find((el) => !(el as HTMLButtonElement).disabled);
      if (actionButton) {
        fireEvent.click(actionButton);
        continue;
      }
      // Plain turn: click one of MY face-up cards. An empty hand is a normal
      // mid-pacing state (my last card played, rival thinking at 1200ms on
      // easy) — flush past it rather than crash.
      const myCard = myZone
        .queryAllByTestId(/^playing-card-/)
        .find((el) => !el.getAttribute('data-testid')!.includes('back'));
      if (myCard) fireEvent.click(myCard);
      flush(1300);
      // Baza lanes (UI v2): per-lane winner badges carry the baza-marker-*
      // ids directly (the old single baza-markers pip row is gone).
      resolvedBazas =
        document.querySelectorAll('[data-testid^="baza-marker-"]').length > 0;
    }
    expect(resolvedBazas).toBe(true);
  });

  it('finishes a seeded match: EndScreen appears and stats record exactly once', () => {
    renderPage();

    for (let turn = 0; turn < 2000; turn++) {
      if (screen.queryByTestId('truco-end-title')) break;
      // Release the event-derived hand-end pause (pure-UI Continue) so the
      // already-dealt next hand can proceed to the end screen.
      const handContinue = screen.queryByTestId('truco-hand-end-continue');
      if (handContinue) {
        fireEvent.click(handContinue);
        flush(700);
        continue;
      }
      const actionButtons = document.querySelectorAll(
        '[data-testid^="truco-action-"]:not([data-testid="truco-action-bar"])',
      );
      const button = Array.from(actionButtons).find(
        (el) => !(el as HTMLButtonElement).disabled,
      );
      if (button) {
        fireEvent.click(button);
        continue;
      }
      // Plain turn: click one of MY face-up cards. Scoped to the my-zone so
      // document-wide matches (the CPU's already-played card parked in
      // open-baza-B-slot) can't absorb the click as an inert no-op.
      const myZone = screen.queryByTestId('truco-my-zone');
      const myCard = myZone
        ? within(myZone)
            .queryAllByTestId(/^playing-card-/)
            .find((el) => !el.getAttribute('data-testid')!.includes('back'))
        : undefined;
      if (myCard) {
        fireEvent.click(myCard);
      }
      // Easy's think delay is 1200ms (GAME_TIMING.opponentThinking): a single
      // short flush after my last card leaves my hand empty until the CPU
      // responds and the next hand is dealt. Flush past that delay so the
      // match keeps advancing through every hand to the end screen.
      flush(1300);
    }
    expect(screen.getByTestId('truco-end-title')).toBeDefined();
    expect(screen.getByTestId('truco-end-scores')).toBeDefined();

    const stats = useTruCpuStatsStore.getState().stats;
    expect(stats.gamesPlayed).toBe(1);
    const bucket = stats.byDifficulty.easy;
    expect(bucket.games).toBe(1);
    expect(bucket.wins + bucket.losses).toBe(1);

    // Play again deals a fresh hand without recording twice.
    fireEvent.click(screen.getByTestId('truco-end-play-again'));
    expect(screen.queryByTestId('truco-end-title')).toBeNull();
    expect(screen.getByTestId('truco-table-zone')).toBeDefined();
    expect(useTruCpuStatsStore.getState().stats.gamesPlayed).toBe(1);
  });
});
