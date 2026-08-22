import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n/i18n';
import { TRUCO_PREFS_KEY, useTrucoPrefsStore } from '../../../store/trucoPrefsStore';
import {
  TRUCO_CPU_STATS_KEY,
  useTruCpuStatsStore,
  type TruCpuStats,
} from '../../../store/truCpuStatsStore';
import { PERSONAS } from '../ai';
import { TrucoMenuPage } from '../TrucoMenuPage';

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

describe('TrucoMenuPage — CPU config', () => {
  beforeEach(resetStores);
  afterEach(cleanup);

  it('preselects the store defaults (easy, target 30)', () => {
    renderMenu();
    expect(pressed('truco-difficulty-easy')).toBe('true');
    expect(pressed('truco-difficulty-medium')).toBe('false');
    expect(pressed('truco-difficulty-hard')).toBe('false');
    expect(pressed('truco-target-15')).toBe('false');
    expect(pressed('truco-target-30')).toBe('true');
  });

  it('clicking difficulty and target updates and persists the prefs store', () => {
    renderMenu();
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

  it('prefs survive reload: Hard+15 preselected from hydrated storage', () => {
    localStorage.setItem(
      TRUCO_PREFS_KEY,
      JSON.stringify({ difficulty: 'hard', targetPoints: 15, personaIndex: 2 }),
    );
    useTrucoPrefsStore.getState().hydrate();
    renderMenu();
    expect(pressed('truco-difficulty-hard')).toBe('true');
    expect(pressed('truco-difficulty-easy')).toBe('false');
    expect(pressed('truco-target-15')).toBe('true');
    // Persona index 2 → third roster entry shown.
    expect(screen.getByTestId('truco-persona-name').textContent).toBe(PERSONAS[2]!.name);
  });

  it('cycles personas through prev/next with wrap-around', () => {
    renderMenu();
    expect(screen.getByTestId('truco-persona-name').textContent).toBe(PERSONAS[0]!.name);

    fireEvent.click(screen.getByTestId('truco-persona-next'));
    expect(screen.getByTestId('truco-persona-name').textContent).toBe(PERSONAS[1]!.name);

    fireEvent.click(screen.getByTestId('truco-persona-prev'));
    fireEvent.click(screen.getByTestId('truco-persona-prev'));
    expect(screen.getByTestId('truco-persona-name').textContent).toBe(
      PERSONAS[PERSONAS.length - 1]!.name,
    );
    expect(useTrucoPrefsStore.getState().personaIndex).toBe(PERSONAS.length - 1);
  });

  it('renders the CPU stats card via the store selectors', () => {
    const record = useTruCpuStatsStore.getState().recordMatchResult;
    record('medium', true);
    record('medium', true);
    record('hard', false);

    renderMenu();
    expect(screen.getByTestId('truco-stats-card')).toBeDefined();
    expect(screen.getByTestId('truco-stats-games').textContent).toBe('3');
    expect(screen.getByTestId('truco-stats-wins').textContent).toBe('2');
    expect(screen.getByTestId('truco-stats-losses').textContent).toBe('1');
    expect(screen.getByTestId('truco-stats-winrate').textContent).toContain('67');
    expect(screen.getByTestId('truco-stats-most-played').textContent).toContain('medium');
  });

  it('start navigates to the CPU screen carrying the chosen config', () => {
    renderMenu(true);
    fireEvent.click(screen.getByTestId('truco-difficulty-hard'));
    fireEvent.click(screen.getByTestId('truco-menu-vs-cpu'));
    expect(screen.getByTestId('truco-cpu-route-probe')).toBeDefined();
    const stored = JSON.parse(localStorage.getItem(TRUCO_PREFS_KEY) as string);
    expect(stored.difficulty).toBe('hard');
  });
});
