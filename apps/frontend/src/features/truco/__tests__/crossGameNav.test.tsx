import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n/i18n';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// HomePage stats fetch
vi.mock('../../../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import { useAuthStore } from '../../../store/authStore';
import { HomePage } from '../../../features/quiz/HomePage';
import { TrucoMenuPage } from '../TrucoMenuPage';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Real components, minimal route table. Language-independent probes:
 * navigation targets are asserted via data-testid markers instead of
 * translated copy.
 */
function renderCrossGame(startAt: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[startAt]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/truco" element={<TrucoMenuPage />} />
          <Route
            path="/truco/cpu"
            element={<div data-testid="truco-cpu-route-probe" />}
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('cross-game navigation (Geotano ↔ Truco)', () => {
  beforeEach(() => {
    localStorage.setItem('locale', 'en');
    useAuthStore.setState({
      token: 'test-token',
      isAuthenticated: true,
      isLoading: false,
      user: { id: 'user-1', username: 'testuser', email: 't@t.com' } as any,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('HomePage shows a visible Play Truco button that navigates to /truco', () => {
    renderCrossGame('/');

    const playTruco = screen.getByTestId('home-play-truco');
    expect(playTruco).toBeDefined();

    fireEvent.click(playTruco);

    // Landed on the Truco menu screen
    expect(screen.getByTestId('truco-menu-page')).toBeDefined();
  });

  it('Truco menu shows a reciprocal Play Geotano button that navigates to /', () => {
    renderCrossGame('/truco');

    const playGeotano = screen.getByTestId('truco-menu-play-geotano');
    expect(playGeotano).toBeDefined();

    fireEvent.click(playGeotano);

    // Landed back on the Geotano home screen
    expect(screen.getByText('Test your geography knowledge')).toBeDefined();
  });

  it('menu offers CPU mode selection that navigates to /truco/cpu', () => {
    renderCrossGame('/truco');

    fireEvent.click(screen.getByTestId('truco-menu-vs-cpu'));

    expect(screen.getByTestId('truco-cpu-route-probe')).toBeDefined();
  });

  it('menu keeps the friend-mode entry as a disabled placeholder until multiplayer lands', () => {
    renderCrossGame('/truco');

    const vsFriend = screen.getByTestId('truco-menu-vs-friend');
    expect(vsFriend).toBeDefined();
    expect(vsFriend).toHaveProperty('disabled', true);
  });
});
