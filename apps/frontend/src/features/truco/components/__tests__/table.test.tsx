import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { TrucoState, TrucoView } from '@geotano/shared';
import { buildView } from '@geotano/shared';
import i18n from '../../../../i18n/i18n';
import { TrucoTable } from '../TrucoTable';

// ─── Synthetic mid-hand states (UI consumes redacted views only) ────────────

function baseState(): TrucoState {
  return {
    targetPoints: 30,
    mano: 'A',
    pie: 'B',
    phase: 'playing',
    playerToAct: 'A',
    handNumber: 1,
    scores: { A: 12, B: 8 },
    hands: { A: ['7oro', '3espada', '1copa'], B: ['2basto', '11oro', '6copa'] },
    deckRemaining: [],
    playedCards: { A: [], B: [] },
    bazas: [],
    openBazaPlays: [],
    bazaLeader: 'A',
    envido: null,
    truco: null,
    parkedTruco: null,
    envidoClosed: false,
    trucoAccepted: false,
    trucoLevel: 1,
    handWinner: null,
    winner: null,
    history: [],
  };
}

function renderTable(state: TrucoState, overrides: Partial<Parameters<typeof TrucoTable>[0]> = {}) {
  const onAction = vi.fn();
  const view: TrucoView = buildView(state, 'A');
  render(
    <I18nextProvider i18n={i18n}>
      <TrucoTable
        view={view}
        mySlot="A"
        myName="Ana"
        opponentName="Bruno"
        onAction={onAction}
        {...overrides}
      />
    </I18nextProvider>,
  );
  return { onAction };
}

afterEach(() => cleanup());

describe('TrucoTable — zone composition invariant', () => {
  it('renders TOP rival / CENTER table / BOTTOM my zones with their data', () => {
    renderTable(baseState());

    const rival = screen.getByTestId('truco-rival-zone');
    expect(rival).toHaveTextContent('Bruno');
    expect(rival).toHaveTextContent('8');
    expect(screen.getByTestId('rival-hand-count')).toHaveTextContent('3');

    // My zone: name, score, exactly my three cards.
    const mine = screen.getByTestId('truco-my-zone');
    expect(mine).toHaveTextContent('Ana');
    expect(mine).toHaveTextContent('12');
    expect(screen.getByTestId('playing-card-7oro')).toBeDefined();
    expect(screen.getByTestId('playing-card-3espada')).toBeDefined();
    expect(screen.getByTestId('playing-card-1copa')).toBeDefined();

    // Center: banner slot container exists even when quiet.
    expect(screen.getByTestId('truco-table-zone')).toBeDefined();
    expect(screen.getByTestId('truco-action-bar')).toBeDefined();
  });

  it('shows the face-down rival hand count shrinking as cards are played', () => {
    const state = baseState();
    state.hands.B = ['2basto'];
    renderTable(state);
    expect(screen.getByTestId('rival-hand-count')).toHaveTextContent('1');
  });
});

describe('TrucoTable — turn gating and valid-actions-only', () => {
  it("opponent's turn: all my cards non-interactive and a waiting indicator shows", () => {
    const state = baseState();
    state.playerToAct = 'B';
    renderTable(state);

    expect(screen.getByTestId('playing-card-7oro').tagName).toBe('DIV');
    expect(screen.getByTestId('truco-actionbar-waiting')).toBeDefined();
  });

  it('my turn before any card: cards clickable AND envido/truco calls offered', () => {
    const { onAction } = renderTable(baseState());

    expect(screen.getByTestId('playing-card-7oro').tagName).toBe('BUTTON');
    fireEvent.click(screen.getByTestId('playing-card-7oro'));
    expect(onAction).toHaveBeenCalledWith({ type: 'play_card', actor: 'A', card: '7oro' });

    expect(screen.getByTestId('truco-action-sing_envido')).toBeDefined();
    expect(screen.getByTestId('truco-action-sing_truco')).toBeDefined();
  });

  it('only legal calls shown: after the first card, zero envido controls remain', () => {
    const state = baseState();
    state.playedCards.A = ['7oro'];
    state.openBazaPlays = [{ player: 'A', card: '7oro' }];
    state.playerToAct = 'B';
    renderTable(state);

    expect(screen.queryByTestId('truco-action-sing_envido')).toBeNull();
    expect(screen.queryByTestId('truco-action-sing_real_envido')).toBeNull();
    expect(screen.queryByTestId('truco-action-sing_falta_envido')).toBeNull();
  });

  it('responder-only answers: retruco pending on ME offers Quiero/No quiero/Retruco but never Vale Cuatro', () => {
    const state = baseState();
    state.phase = 'truco_betting';
    state.truco = { level: 2, singer: 'B', responder: 'A', resumeTurn: 'A' };
    renderTable(state);

    expect(screen.getByTestId('truco-action-quiero')).toBeDefined();
    expect(screen.getByTestId('truco-action-no_quiero')).toBeDefined();
    expect(screen.getByTestId('truco-action-sing_retruco')).toBeDefined();
    expect(screen.queryByTestId('truco-action-sing_vale_cuatro')).toBeNull();
  });

  it('bet awaiting the OPPONENT: waiting indicator only, no answer controls', () => {
    const state = baseState();
    state.phase = 'truco_betting';
    state.truco = { level: 2, singer: 'A', responder: 'B', resumeTurn: 'A' };
    renderTable(state);

    expect(screen.getByTestId('truco-actionbar-waiting')).toBeDefined();
    expect(screen.queryByTestId('truco-action-quiero')).toBeNull();
    expect(screen.queryByTestId('truco-action-no_quiero')).toBeNull();
  });

  it('turn indicators mark whose turn it is', () => {
    renderTable(baseState());
    expect(screen.getByTestId('my-turn-indicator')).toHaveTextContent(/Your turn/i);
    expect(screen.queryByTestId('rival-turn-indicator')).toBeNull();

    cleanup();
    const other = baseState();
    other.playerToAct = 'B';
    renderTable(other);
    expect(screen.getByTestId('rival-turn-indicator')).toBeDefined();
  });
});

describe('TrucoTable — center table content', () => {
  it('positions open-baza cards per owner and marks resolved bazas', () => {
    const state = baseState();
    state.hands.A = ['7oro', '3espada', '1copa'];
    state.playedCards.A = ['5basto'];
    state.openBazaPlays = [{ player: 'A', card: '5basto' }];
    state.playerToAct = 'B';
    state.bazas = [{ number: 1, plays: [{ player: 'A', card: '3espada' }, { player: 'B', card: '11oro' }] , winner: 'A' }];
    state.history = [
      { type: 'card_played', player: 'A', card: '3espada' },
      { type: 'card_played', player: 'B', card: '11oro' },
      { type: 'baza_resolved', baza: 1, winner: 'A' },
      { type: 'card_played', player: 'A', card: '5basto' },
    ];
    renderTable(state);

    // Open baza slots per owner: rival slot empty (placeholder only), mine holds the card.
    expect(
      screen.getByTestId('open-baza-B-slot').querySelector('[data-testid^="playing-card-"]'),
    ).toBeNull();
    expect(screen.getByTestId('open-baza-A-slot')).toContainElement(
      screen.getByTestId('playing-card-5basto'),
    );
    // Resolved baza marker shows the winner name; a parda would show "Tied".
    const marker = screen.getByTestId('baza-marker-1');
    expect(marker).toHaveTextContent('Ana');
    expect(marker).not.toHaveTextContent(/tied/i);
  });

  it('marks a tied (parda) resolved baza distinctly', () => {
    const state = baseState();
    state.bazas = [{ number: 1, plays: [{ player: 'A', card: '3espada' }, { player: 'B', card: '3basto' }] , winner: null }];
    renderTable(state);
    expect(screen.getByTestId('baza-marker-1').textContent?.toLowerCase()).toContain('tied');
  });

  it('surfaces call feedback inside the center zone', () => {
    const state = baseState();
    state.history = [{ type: 'call_sung', actor: 'B', call: 'sing_truco' }];
    renderTable(state);
    expect(screen.getByTestId('banner-call-sing_truco')).toHaveTextContent('Bruno');
  });
});
