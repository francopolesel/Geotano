import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { TrucoAction, PlayerSlot } from '@geotano/shared';
import i18n from '../../../../i18n/i18n';
import { BetModal } from '../BetModal';

function renderModal(
  props: Partial<Parameters<typeof BetModal>[0]> = {},
  onAction = vi.fn(),
) {
  render(
    <I18nextProvider i18n={i18n}>
      <BetModal
        family="truco"
        title="¡TRUCO!"
        explanation="The rival wants to play for 3 points"
        actions={[
          { type: 'quiero', actor: 'A' },
          { type: 'no_quiero', actor: 'A' },
          { type: 'sing_retruco', actor: 'A' },
        ]}
        onAction={onAction}
        scores={{ A: 12, B: 8 }}
        targetPoints={30}
        mySlot="A"
        opponentName="Bruno"
        {...props}
      />
    </I18nextProvider>,
  );
  return { onAction };
}

afterEach(() => cleanup());

describe('BetModal — surface + contracts (E1/E3, G1)', () => {
  it('renders an alertdialog exposing the remembered test ids', () => {
    renderModal();
    expect(screen.getByRole('alertdialog')).toBeDefined();
    expect(screen.getByTestId('truco-bet-panel')).toBeDefined();
    expect(screen.getByTestId('truco-bet-title')).toHaveTextContent('TRUCO');
  });

  it('preserves truco-action-* testids and the legal-actions-only set', () => {
    renderModal({ actions: [{ type: 'quiero', actor: 'A' }, { type: 'no_quiero', actor: 'A' }] });
    expect(screen.getByTestId('truco-action-quiero')).toBeDefined();
    expect(screen.getByTestId('truco-action-no_quiero')).toBeDefined();
    expect(screen.queryByTestId('truco-action-sing_retruco')).toBeNull();
    expect(screen.queryByTestId('truco-action-sing_vale_cuatro')).toBeNull();
  });

  it('auto-focuses the primary accept (Quiero) so Enter answers (BetPanel:33)', () => {
    renderModal();
    expect(document.activeElement).toBe(screen.getByTestId('truco-action-quiero'));
  });

  it('keeps every answer button a ≥52px tap target (BetModal large)', () => {
    renderModal();
    const quiero = screen.getByTestId('truco-action-quiero');
    expect(quiero.className).toContain('min-h-[52px]');
  });

  it('dispatches the exact action on click', () => {
    const { onAction } = renderModal();
    const action: TrucoAction = { type: 'no_quiero', actor: 'A' };
    fireEvent.click(screen.getByTestId('truco-action-no_quiero'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(action);
  });

  it('is disabled while isActing — no double-fire (G1)', () => {
    const { onAction } = renderModal({ disabled: true });
    const quiero = screen.getByTestId('truco-action-quiero');
    expect(quiero).toHaveProperty('disabled', true);
    fireEvent.click(quiero);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('Escape is INERT — it can never produce an implicit answer (E3-E)', () => {
    const { onAction } = renderModal();
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    // No onClose was invoked (none wired) and the panel stays open.
    expect(screen.getByRole('alertdialog')).toBeDefined();
    expect(onAction).not.toHaveBeenCalled();
  });
});
