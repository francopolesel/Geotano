import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n/i18n';
import { TRUCO_PREFS_KEY, useTrucoPrefsStore } from '../../../store/trucoPrefsStore';
import {
  useTruCpuStatsStore,
  type TruCpuStats,
} from '../../../store/truCpuStatsStore';
import { PERSONAS } from '../ai';
import { TrucoMenuPage } from '../TrucoMenuPage';

// v2 step flow (batch C): /truco is a mode → cpu-setup → friends state
// machine. The old single-screen assertions were rewritten DELIBERATELY:
// every config interaction now requires entering the cpu-setup screen first
// (click `truco-menu-vs-cpu`), and persona prev/next cycling was replaced by
// a selectable persona-card grid (`truco-persona-option-{i}`).

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

function resetStores() {
  localStorage.clear();
  useTrucoPrefsStore.setState({
    difficulty: 'easy',
    targetPoints: 30,
    personaIndex: 0,
  });
  useTruCpuStatsStore.setState({ stats: emptyStats() });
}

function renderMenu(withRoutes = false) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/truco']}>
        {withRoutes ? (
          <Routes>
            <Route path="/truco" element={<TrucoMenuPage />} />
            <Route path="/truco/cpu" element={<div data-testid="truco-cpu-route-probe" />} />
          </Routes>
        ) : (
          <TrucoMenuPage />
        )}
      </MemoryRouter>
    </I18nextProvider>,
  );
}

function pressed(testId: string): string | null {
  return screen.getByTestId(testId).getAttribute('aria-pressed');
}

/** Step-flow helper: enter the CPU setup screen from the mode screen. */
function enterCpuSetup() {
  fireEvent.click(screen.getByTestId('truco-menu-vs-cpu'));
  expect(screen.getByTestId('truco-menu-config')).toBeTruthy();
}

describe('TrucoMenuPage — mode step (v2)', () => {
  beforeEach(resetStores);
  afterEach(cleanup);

  it('shows ONLY the two mode cards on entry — no config or lobby leak', () => {
    renderMenu();
    expect(screen.getByTestId('truco-menu-vs-cpu')).toBeTruthy();
    expect(screen.getByTestId('truco-menu-vs-friend')).toBeTruthy();
    expect(screen.queryByTestId('truco-menu-config')).toBeNull();
    expect(screen.queryByTestId('truco-menu-friend')).toBeNull();
    // Reciprocal cross-game entry stays on the mode screen.
    expect(screen.getByTestId('truco-menu-play-geotano')).toBeTruthy();
  });

  it('vs-cpu opens the cpu-setup step; back returns to modes', () => {
    renderMenu();
    enterCpuSetup();

    fireEvent.click(screen.getByTestId('truco-menu-back'));
    expect(screen.queryByTestId('truco-menu-config')).toBeNull();
    expect(screen.getByTestId('truco-menu-vs-cpu')).toBeTruthy();
  });
});

describe('TrucoMenuPage — CPU setup step', () => {
  beforeEach(resetStores);
  afterEach(cleanup);

  it('preselects the store defaults (easy, target 30, persona 0)', () => {
    renderMenu();
    enterCpuSetup();
    expect(pressed('truco-difficulty-easy')).toBe('true');
    expect(pressed('truco-difficulty-medium')).toBe('false');
    expect(pressed('truco-difficulty-hard')).toBe('false');
    expect(pressed('truco-target-15')).toBe('false');
    expect(pressed('truco-target-30')).toBe('true');
    expect(pressed('truco-persona-option-0')).toBe('true');
  });

  it('clicking difficulty and target updates and persists the prefs store', () => {
    renderMenu();
    enterCpuSetup();
    fireEvent.click(screen.getByTestId('truco-difficulty-hard'));
    fireEvent.click(screen.getByTestId('truco-target-15'));

    expect(useTrucoPrefsStore.getState().difficulty).toBe('hard');
    expect(useTrucoPrefsStore.getState().targetPoints).toBe(15);
    const stored = JSON.parse(localStorage.getItem(TRUCO_PREFS_KEY) as string);
    expect(stored.difficulty).toBe('hard');
    expect(stored.targetPoints).toBe(15);

    expect(pressed('truco-difficulty-hard')).toBe('true');
    expect(pressed('truco-target-15')).toBe('true');
  });

  it('prefs survive reload: Hard+15 + persona card 2 preselected from hydrated storage', () => {
    localStorage.setItem(
      TRUCO_PREFS_KEY,
      JSON.stringify({ difficulty: 'hard', targetPoints: 15, personaIndex: 2 }),
    );
    useTrucoPrefsStore.getState().hydrate();
    renderMenu();
    enterCpuSetup();
    expect(pressed('truco-difficulty-hard')).toBe('true');
    expect(pressed('truco-difficulty-easy')).toBe('false');
    expect(pressed('truco-target-15')).toBe('true');
    // Persona index 2 → third roster card selected.
    expect(pressed('truco-persona-option-2')).toBe('true');
  });

  it('selecting a persona card persists its roster index', () => {
    renderMenu();
    enterCpuSetup();

    const last = PERSONAS.length - 1;
    fireEvent.click(screen.getByTestId(`truco-persona-option-${last}`));
    expect(useTrucoPrefsStore.getState().personaIndex).toBe(last);
    expect(pressed(`truco-persona-option-${last}`)).toBe('true');

    const stored = JSON.parse(localStorage.getItem(TRUCO_PREFS_KEY) as string);
    expect(stored.personaIndex).toBe(last);

    fireEvent.click(screen.getByTestId('truco-persona-option-1'));
    expect(useTrucoPrefsStore.getState().personaIndex).toBe(1);
    expect(pressed(`truco-persona-option-${last}`)).toBe('false');
  });

  it('renders the CPU stats inside the collapsed stats card via the store selectors', () => {
    const record = useTruCpuStatsStore.getState().recordMatchResult;
    record('medium', true);
    record('medium', true);
    record('hard', false);

    renderMenu();
    enterCpuSetup();
    expect(screen.getByTestId('truco-stats-card')).toBeTruthy();
    expect(screen.getByTestId('truco-stats-games').textContent).toBe('3');
    expect(screen.getByTestId('truco-stats-wins').textContent).toBe('2');
    expect(screen.getByTestId('truco-stats-losses').textContent).toBe('1');
    expect(screen.getByTestId('truco-stats-winrate').textContent).toContain('67');
    expect(screen.getByTestId('truco-stats-most-played').textContent).toContain('medium');
  });

  it('JUGAR navigates to the CPU route carrying the chosen config', () => {
    renderMenu(true);
    enterCpuSetup();
    fireEvent.click(screen.getByTestId('truco-difficulty-hard'));
    fireEvent.click(screen.getByTestId('truco-start-cpu'));
    expect(screen.getByTestId('truco-cpu-route-probe')).toBeDefined();
    const stored = JSON.parse(localStorage.getItem(TRUCO_PREFS_KEY) as string);
    expect(stored.difficulty).toBe('hard');
  });
});
