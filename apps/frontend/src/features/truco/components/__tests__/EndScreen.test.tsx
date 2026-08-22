import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../i18n/i18n';
import { EndScreen } from '../EndScreen';

function renderEnd(overrides: Partial<Parameters<typeof EndScreen>[0]> = {}) {
  const handlers = {
    onPlayAgain: vi.fn(),
    onChangeMode: vi.fn(),
    onBack: vi.fn(),
    onGeotano: vi.fn(),
  };
  render(
    <I18nextProvider i18n={i18n}>
      <EndScreen
        winner="A"
        mySlot="A"
        scores={{ A: 30, B: 22 }}
        targetPoints={30}
        myName="Ana"
        opponentName="Bruno"
        {...handlers}
        {...overrides}
      />
    </I18nextProvider>,
  );
  return handlers;
}

afterEach(() => cleanup());

describe('EndScreen — end-of-match panel', () => {
  it('winner view shows the win title, final scores and the target', () => {
    renderEnd();
    expect(screen.getByTestId('truco-end-title')).toHaveTextContent('You won');
    expect(screen.getByTestId('truco-end-scores')).toHaveTextContent('Ana');
    expect(screen.getByTestId('truco-end-scores')).toHaveTextContent('30');
    expect(screen.getByTestId('truco-end-scores')).toHaveTextContent('Bruno');
    expect(screen.getByTestId('truco-end-scores')).toHaveTextContent('22');
    expect(screen.getByTestId('truco-end-target')).toHaveTextContent('30');
  });

  it('loser view shows the lose title', () => {
    renderEnd({ winner: 'B', mySlot: 'A' });
    expect(screen.getByTestId('truco-end-title')).toHaveTextContent('lost');
  });

  it('draw label exists for shared-pattern parity (unreachable in truco v1)', () => {
    renderEnd({ winner: null });
    expect(screen.getByTestId('truco-end-title')).toHaveTextContent('Draw');
  });

  it('wires the four action buttons to their destinations', () => {
    const handlers = renderEnd();
    fireEvent.click(screen.getByTestId('truco-end-play-again'));
    fireEvent.click(screen.getByTestId('truco-end-change-mode'));
    fireEvent.click(screen.getByTestId('truco-end-back'));
    fireEvent.click(screen.getByTestId('truco-end-geotano'));
    expect(handlers.onPlayAgain).toHaveBeenCalledTimes(1);
    expect(handlers.onChangeMode).toHaveBeenCalledTimes(1);
    expect(handlers.onBack).toHaveBeenCalledTimes(1);
    expect(handlers.onGeotano).toHaveBeenCalledTimes(1);
  });
});
