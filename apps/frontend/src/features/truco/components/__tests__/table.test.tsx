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

describe('TrucoTable — rival avatar slot (remediation #9)', () => {
  it('renders a provided avatar node inside the dedicated avatar slot', () => {
    renderTable(baseState(), {
      rivalAvatar: <span data-testid="rival-avatar-custom">🌵</span>,
    });

    const slot = screen.getByTestId('truco-rival-avatar');
    expect(screen.getByTestId('rival-avatar-custom')).toBeDefined();
    expect(slot.textContent).toBe('🌵');
  });

  it('falls back to the monogram initial when no avatar is supplied', () => {
    renderTable(baseState());

    expect(screen.getByTestId('truco-rival-avatar').textContent).toBe('B');
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
    // Resolved baza markers are outcome pips now (batch 2): sr-only copy
    // speaks from MY perspective — won / lost / tied — not name chips.
    const marker = screen.getByTestId('baza-marker-1');
    expect(marker).toHaveTextContent(/you won/i);
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

describe('TrucoTable — batch 2 presentation (felt, bets, scoreboard)', () => {
  it('shows the round status line and the plain-hand stake chip by default', () => {
    renderTable(baseState());
    expect(screen.getByTestId('truco-round-status').textContent).toMatch(/Hand 1/);
    expect(screen.getByTestId('truco-round-status').textContent).toContain('1/3');
    expect(screen.getByTestId('truco-stake-chip')).toHaveTextContent(/simple hand/i);
    expect(screen.getByTestId('truco-stake-chip')).toHaveTextContent('1 point');
  });

  it('stake chip names the accepted truco level and pending envido state', () => {
    const state = baseState();
    state.trucoLevel = 3;
    state.envidoClosed = true;
    renderTable(state);
    const chip = screen.getByTestId('truco-stake-chip');
    expect(chip).toHaveTextContent(/retruco/i);
    expect(chip).toHaveTextContent('3 points');
    expect(chip).toHaveTextContent(/envido: settled/i);

    cleanup();
    const pending = baseState();
    pending.envido = {
      stake: 2,
      priorStake: 0,
      awaitingResponder: 'B',
      lastCaller: 'A',
      falta: false,
      realRaised: false,
    };
    renderTable(pending);
    expect(screen.getByTestId('truco-stake-chip')).toHaveTextContent(/envido: pending/i);
  });

  it('renders MANO badge on the mano side only plus progress toward the goal', () => {
    renderTable(baseState()); // mano: A === mySlot
    expect(screen.getByTestId('mano-badge-mine')).toBeDefined();
    expect(screen.queryByTestId('mano-badge-rival')).toBeNull();
    expect(screen.getByTestId('my-score')).toHaveTextContent('12');
    expect(screen.getByTestId('rival-score')).toHaveTextContent('8');
    // Goal label present in BOTH scoreboards.
    expect(screen.getAllByText(/meta 30|goal 30/i).length).toBe(2);

    cleanup();
    const other = baseState();
    other.mano = 'B';
    renderTable(other);
    expect(screen.queryByTestId('mano-badge-mine')).toBeNull();
    expect(screen.getByTestId('mano-badge-rival')).toBeDefined();
  });

  it('bet pending on ME: elevated panel with huge call, explanation and the ONLY answer buttons', () => {
    const state = baseState();
    state.phase = 'truco_betting';
    state.truco = { level: 2, singer: 'B', responder: 'A', resumeTurn: 'A' };
    renderTable(state);

    const panel = screen.getByTestId('truco-bet-panel');
    expect(panel).toHaveTextContent(/¡truco!/i);
    expect(panel).toHaveTextContent(/for 2 points/i);
    expect(panel).toHaveTextContent(/quiero/i);

    // Exactly one instance of each answer control — inside the panel only.
    expect(screen.getAllByTestId('truco-action-quiero').length).toBe(1);
    expect(panel.contains(screen.getByTestId('truco-action-no_quiero'))).toBe(true);

    // The turn banner is superseded while the bet is up.
    expect(screen.queryByTestId('my-turn-indicator')).toBeNull();
    expect(screen.queryByTestId('rival-turn-indicator')).toBeNull();

    // Answering dispatches through the same onAction channel.
    fireEvent.click(screen.getByTestId('truco-action-quiero'));
  });

  it('envido pending on ME: coins-family panel with the envido explanation', () => {
    const state = baseState();
    state.phase = 'envido_betting';
    state.envido = {
      stake: 2,
      priorStake: 0,
      awaitingResponder: 'A',
      lastCaller: 'B',
      falta: false,
      realRaised: false,
    };
    renderTable(state);

    const panel = screen.getByTestId('truco-bet-panel');
    expect(panel).toHaveTextContent(/¡envido!/i);
    expect(panel).toHaveTextContent(/envido bet/i);
    expect(screen.getAllByTestId('truco-action-sing_real_envido').length).toBe(1);
  });

  it('bet awaiting the RIVAL: named answer-wait copy instead of generic waiting', () => {
    const state = baseState();
    state.phase = 'truco_betting';
    state.truco = { level: 2, singer: 'A', responder: 'B', resumeTurn: 'A' };
    renderTable(state);

    expect(screen.queryByTestId('truco-bet-panel')).toBeNull();
    expect(screen.getByTestId('truco-actionbar-waiting')).toHaveTextContent(
      /waiting for the rival's answer/i,
    );
  });

  it('prominent turn banner marks each side with the shared test ids', () => {
    renderTable(baseState());
    expect(screen.getByTestId('my-turn-indicator')).toBeInTheDocument();

    cleanup();
    const other = baseState();
    other.playerToAct = 'B';
    renderTable(other);
    expect(screen.getByTestId('rival-turn-indicator')).toBeInTheDocument();
    expect(screen.queryByTestId('my-turn-indicator')).toBeNull();
  });

  it('resolved baza highlights the winning slot with a pulse overlay', () => {
    const state = baseState();
    state.bazas = [
      { number: 1, plays: [{ player: 'A', card: '3espada' }, { player: 'B', card: '11oro' }], winner: 'B' },
    ];
    renderTable(state);
    expect(screen.getByTestId('baza-win-pulse-B')).toBeDefined();
    expect(screen.queryByTestId('baza-win-pulse-A')).toBeNull();
  });
});
