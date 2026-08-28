import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { TrucoEvent } from '@geotano/shared';
import i18n from '../../../../i18n/i18n';
import { HandEndPanel } from '../HandEndPanel';

const winHistory: TrucoEvent[] = [
  { type: 'baza_resolved', baza: 1, winner: 'A' },
  { type: 'points_awarded', side: 'A', amount: 2, reason: 'hand_prize' },
  { type: 'hand_ended', winner: 'A' },
];

function renderPanel(
  overrides: Partial<Parameters<typeof HandEndPanel>[0]> = {},
  onContinue = vi.fn(),
) {
  render(
    <I18nextProvider i18n={i18n}>
      <HandEndPanel
        open
        history={winHistory}
        mySlot="A"
        scores={{ A: 14, B: 8 }}
        onContinue={onContinue}
        {...overrides}
      />
    </I18nextProvider>,
  );
  return { onContinue };
}

afterEach(() => cleanup());

describe('HandEndPanel — event-derived, pure-UI Continue (CRITICAL 1)', () => {
  it('renders nothing when closed', () => {
    renderPanel({ open: false });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('shows the win title, +points and the A - B score line', () => {
    renderPanel();
    expect(screen.getByTestId('truco-hand-end-panel')).toBeDefined();
    expect(screen.getByTestId('truco-hand-end-title').textContent).toMatch(/won the hand/i);
    expect(screen.getByTestId('truco-hand-end-points')).toHaveTextContent('+2');
    expect(screen.getByTestId('truco-hand-end-score').textContent).toContain('14');
    expect(screen.getByTestId('truco-hand-end-score').textContent).toContain('8');
    expect(screen.getByTestId('truco-hand-end-continue')).toContainHTML('Continue');
  });

  it('uses the lose title and no +points when the rival took the hand', () => {
    renderPanel({ history: [{ type: 'hand_ended', winner: 'B' }] });
    expect(screen.getByTestId('truco-hand-end-title').textContent).toMatch(/rival took/i);
    expect(screen.queryByTestId('truco-hand-end-points')).toBeNull();
  });

  it('keeps the Continue button a ≥44px tap target', () => {
    renderPanel();
    expect(screen.getByTestId('truco-hand-end-continue').className).toContain('min-h-[44px]');
  });

  it('Continue releases via onContinue — a pure UI call, no engine action', () => {
    const { onContinue } = renderPanel();
    fireEvent.click(screen.getByTestId('truco-hand-end-continue'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
