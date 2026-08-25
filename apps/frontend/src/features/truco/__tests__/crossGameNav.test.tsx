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

  it('menu offers CPU mode selection that opens the CPU setup step (v2 step flow)', () => {
    renderCrossGame('/truco');

    fireEvent.click(screen.getByTestId('truco-menu-vs-cpu'));

    // v2: vs-cpu no longer routes to /truco/cpu directly — it reveals the
    // setup step (persona/difficulty/target) inside the menu state machine.
    expect(screen.getByTestId('truco-menu-config')).toBeDefined();
  });

  it('friend-mode entry is live and opens the CU6 friend lobby panel', () => {
    renderCrossGame('/truco');

    const vsFriend = screen.getByTestId('truco-menu-vs-friend');
    expect(vsFriend).toHaveProperty('disabled', false);

    // Multiplayer landed in CU6: the entry reveals the lobby instead of
    // staying a disabled placeholder (supersedes the Batch D pin).
    fireEvent.click(vsFriend);
    expect(screen.getByTestId('truco-menu-friend')).toBeDefined();
  });
});
