import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { CardId, TrucoAction } from '@geotano/shared';
import i18n from '../../../../i18n/i18n';
import { Hand } from '../Hand';

function play(card: CardId): Extract<TrucoAction, { type: 'play_card' }> {
  return { type: 'play_card', actor: 'A', card };
}

function renderHand(
  myHand: readonly CardId[],
  playableCards: readonly CardId[] = myHand,
  isActing = false,
) {
  const onAction = vi.fn();
  const playable = new Map(playableCards.map((c) => [c, play(c)]));
  render(
    <I18nextProvider i18n={i18n}>
      <Hand myHand={myHand} playable={playable} onAction={onAction} isActing={isActing} />
    </I18nextProvider>,
  );
  return { onAction };
}

function slot(card: CardId): HTMLElement {
  return screen.getByTestId(`truco-fan-slot-${card}`);
}

afterEach(() => cleanup());

describe('Hand — orejeo fan layout', () => {
  it('fans three cards inside a hand region with the fan class and localized label', () => {
    renderHand(['7oro', '3espada', '1copa']);

    const zone = screen.getByTestId('truco-hand');
    expect(zone.className).toContain('truco-fan');
    expect(zone.getAttribute('aria-label')).toBeTruthy();

    // Every card sits in its own fan slot.
    expect(slot('7oro')).toBeDefined();
    expect(slot('3espada')).toBeDefined();
    expect(slot('1copa')).toBeDefined();
  });

  it('lifts a playable card on hover ("lo traje hacia mí") and lowers it on leave', () => {
    renderHand(['7oro', '3espada', '1copa'], ['3espada']);

    const target = slot('3espada');
    expect(target.className).not.toContain('truco-fan-slot--lift');

    fireEvent.pointerEnter(target);
    expect(target.className).toContain('truco-fan-slot--lift');

    fireEvent.pointerLeave(target);
    expect(target.className).not.toContain('truco-fan-slot--lift');
  });

  it('never lifts a non-playable card on hover (stays dimmed in the fan)', () => {
    renderHand(['7oro', '3espada', '1copa'], ['3espada']);

    fireEvent.pointerEnter(slot('7oro'));
    expect(slot('7oro').className).not.toContain('truco-fan-slot--lift');
    fireEvent.pointerLeave(slot('7oro'));
  });

  it('keyboard focus triggers the same inspection lift as hover', () => {
    renderHand(['7oro', '3espada', '1copa'], ['1copa']);

    const cardButton = screen.getByTestId('playing-card-1copa');
    fireEvent.focus(cardButton);
    expect(slot('1copa').className).toContain('truco-fan-slot--lift');

    fireEvent.blur(cardButton);
    expect(slot('1copa').className).not.toContain('truco-fan-slot--lift');
  });

  it('plays a lifted playable card through onAction when clicked', () => {
    const { onAction } = renderHand(['7oro', '3espada', '1copa'], ['3espada']);

    fireEvent.click(screen.getByTestId('playing-card-3espada'));
    expect(onAction).toHaveBeenCalledWith({ type: 'play_card', actor: 'A', card: '3espada' });
  });

  it('isActing: even playable cards neither lift nor fire, but stay visible (G1/A2-D)', () => {
    const { onAction } = renderHand(['7oro', '3espada', '1copa'], ['3espada'], true);

    const target = slot('3espada');
    const card = screen.getByTestId('playing-card-3espada');

    // Hover must NOT lift while an action is in flight.
    fireEvent.pointerEnter(target);
    expect(target.className).not.toContain('truco-fan-slot--lift');
    // Keyboard focus must NOT lift either.
    fireEvent.focus(card);
    expect(target.className).not.toContain('truco-fan-slot--lift');

    // Non-interactive: clicking does nothing, and the card is not a button.
    fireEvent.click(card);
    expect(onAction).not.toHaveBeenCalled();
    expect(card.tagName).toBe('DIV');

    // Still rendered and visible (not hidden) — only dimmed.
    expect(screen.getByTestId('playing-card-3espada')).toBeDefined();

    fireEvent.pointerLeave(target);
  });
});
