import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { TrucoAction } from '@geotano/shared';
import i18n from '../../../../i18n/i18n';
import { ActionBar } from '../ActionBar';

function renderBar(props: Partial<Parameters<typeof ActionBar>[0]> = {}) {
  const onAction = vi.fn();
  const merged = { actions: [] as TrucoAction[], onAction, ...props };
  render(
    <I18nextProvider i18n={i18n}>
      <ActionBar {...merged} />
    </I18nextProvider>,
  );
  return { onAction };
}

afterEach(() => cleanup());

describe('ActionBar — valid-actions-only rendering', () => {
  it('renders exactly the given legal actions with localized labels', () => {
    renderBar({
      actions: [
        { type: 'quiero', actor: 'A' },
        { type: 'no_quiero', actor: 'A' },
        { type: 'sing_retruco', actor: 'A' },
      ],
    });
    expect(screen.getByTestId('truco-action-quiero')).toHaveTextContent('Quiero');
    expect(screen.getByTestId('truco-action-no_quiero')).toHaveTextContent('No quiero');
    expect(screen.getByTestId('truco-action-sing_retruco')).toHaveTextContent('Retruco');
    // Nothing else leaks into the bar.
    expect(screen.queryByTestId('truco-action-sing_vale_cuatro')).toBeNull();
    expect(screen.queryByTestId('truco-action-sing_envido')).toBeNull();
  });

  it('shows no envido controls once the window closed (only legal calls)', () => {
    // After the first card is played legalActions yields card plays only —
    // the bar itself must never invent call buttons.
    renderBar({ actions: [] });
    expect(screen.queryByTestId(/truco-action-sing_/)).toBeNull();
  });

  it('dispatches the exact action object on click', () => {
    const action: TrucoAction = { type: 'sing_truco', actor: 'A' };
    const { onAction } = renderBar({ actions: [action] });
    fireEvent.click(screen.getByTestId('truco-action-sing_truco'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(action);
  });

  it('shows a waiting indicator and zero answer controls when the bet awaits the opponent', () => {
    renderBar({ actions: [], awaitingOpponent: true });
    expect(screen.getByTestId('truco-actionbar-waiting')).toBeDefined();
    // No action buttons of any kind while waiting on the rival.
    expect(screen.queryByTestId('truco-action-quiero')).toBeNull();
    expect(screen.queryByTestId('truco-action-no_quiero')).toBeNull();
    expect(screen.queryByTestId('truco-action-sing_truco')).toBeNull();
  });

  it('never shows a waiting indicator while I hold legal actions', () => {
    renderBar({ actions: [{ type: 'quiero', actor: 'A' }], awaitingOpponent: true });
    expect(screen.queryByTestId('truco-actionbar-waiting')).toBeNull();
    expect(screen.getByTestId('truco-action-quiero')).toBeDefined();
  });

  it('ignores play_card entries — cards live in the hand, not the bar', () => {
    renderBar({ actions: [{ type: 'play_card', actor: 'A', card: '7oro' }] });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('wraps instead of overflowing (W2 proxy: flex-wrap on the bar container)', () => {
    renderBar({
      actions: [
        { type: 'quiero', actor: 'A' },
        { type: 'no_quiero', actor: 'A' },
        { type: 'sing_falta_envido', actor: 'A' },
      ],
    });
    const bar = screen.getByTestId('truco-action-bar');
    expect([...bar.classList]).toContain('flex-wrap');
  });
});
