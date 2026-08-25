import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { DECK_40 } from '@geotano/shared';
import i18n from '../../../i18n/i18n';
import { PlayingCard } from '../PlayingCard';
import { CARD_BACK_URL, cardAssetUrl } from '../../../features/truco/cardAssets';

function renderCard(props: Parameters<typeof PlayingCard>[0]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <PlayingCard {...props} />
    </I18nextProvider>,
  );
}

/** The artwork <img> inside a rendered face card. */
function faceImg(testId: string): HTMLImageElement {
  const img = screen.getByTestId(testId).querySelector('img');
  expect(img).not.toBeNull();
  return img as HTMLImageElement;
}

describe('PlayingCard (official SVG asset shell)', () => {
  afterEach(() => cleanup());

  // ─── Asset wiring: representative matrix (each suit × key ranks) ────────

  it.each([
    ['1oro', 'webp/card_coins_01.webp'],
    ['7oro', 'webp/card_coins_07.webp'],
    ['10oro', 'webp/card_coins_10.webp'],
    ['11oro', 'webp/card_coins_11.webp'],
    ['12oro', 'webp/card_coins_12.webp'],
    ['1copa', 'webp/card_cups_01.webp'],
    ['7copa', 'webp/card_cups_07.webp'],
    ['10copa', 'webp/card_cups_10.webp'],
    ['11copa', 'webp/card_cups_11.webp'],
    ['12copa', 'webp/card_cups_12.webp'],
    ['1espada', 'webp/card_swords_01.webp'],
    ['7espada', 'webp/card_swords_07.webp'],
    ['10espada', 'webp/card_swords_10.webp'],
    ['11espada', 'webp/card_swords_11.webp'],
    ['12espada', 'webp/card_swords_12.webp'],
    ['1basto', 'webp/card_clubs_01.webp'],
    ['7basto', 'webp/card_clubs_07.webp'],
    ['10basto', 'webp/card_clubs_10.webp'],
    ['11basto', 'webp/card_clubs_11.webp'],
    ['12basto', 'webp/card_clubs_12.webp'],
  ] as const)('%s renders the official %s artwork', (card, file) => {
    renderCard({ card });
    expect(faceImg(`playing-card-${card}`).getAttribute('src')).toBe(cardAssetUrl(card));
    expect(cardAssetUrl(card).endsWith(file)).toBe(true);
  });

  it('resolves every dealt card id to a distinct official asset URL', () => {
    const urls = DECK_40.map((card) => cardAssetUrl(card));
    expect(new Set(urls).size).toBe(40);
    for (const url of urls) {
      expect(url.endsWith('.webp')).toBe(true);
    }
  });

  it('renders the official card back for face-down cards', () => {
    renderCard({ faceDown: true });
    const art = screen.getByTestId('playing-card-back-art');
    expect(art.tagName.toLowerCase()).toBe('img');
    expect((art as HTMLImageElement).getAttribute('src')).toBe(CARD_BACK_URL);
    expect(CARD_BACK_URL.endsWith('webp/card_back.webp')).toBe(true);
  });

  it('never renders ranks 08/09 artwork (never dealt)', () => {
    expect(() => cardAssetUrl('8oro' as never)).toThrow();
    expect(() => cardAssetUrl('9basto' as never)).toThrow();
  });

  // ─── States layered OVER the image ──────────────────────────────────────

  it('applies disabled styling over the artwork when disabled is set', () => {
    renderCard({ card: '3oro', disabled: true });
    const el = screen.getByTestId('playing-card-3oro');
    const classes = [...el.classList].join(' ');
    expect(classes).toContain('opacity-45');
    expect(classes).toContain('grayscale');
    expect(classes).toContain('cursor-not-allowed');
    // The artwork is still there under the dim/grayscale treatment.
    expect(faceImg('playing-card-3oro').getAttribute('src')).toBe(cardAssetUrl('3oro'));
    // Disabled cards must never become buttons, even with an onClick handler.
    cleanup();
    renderCard({ card: '3copa', disabled: true, onClick: vi.fn() });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps the selected raise/ring treatment on the frame', () => {
    renderCard({ card: '5basto', selected: true });
    const classes = [...screen.getByTestId('playing-card-5basto').classList].join(' ');
    expect(classes).toContain('ring-2');
    expect(classes).toContain('-translate-y-3.5');
  });

  it('exposes localized accessible alt text with rank and suit', () => {
    renderCard({ card: '1espada' });
    const el = screen.getByRole('img');
    // en locale resolves truco.suit.espada → "swords"
    expect(el.getAttribute('aria-label')).toContain('swords');
    expect(el.getAttribute('aria-label')).toContain('1');
    // The inner artwork <img> stays decorative so labels are not duplicated.
    expect(faceImg('playing-card-1espada').getAttribute('alt')).toBe('');
  });

  it.each(['sm', 'md', 'lg'] as const)('uses a fixed/clamp width for size %s (never viewport-%)', (size) => {
    const { getByTestId } = renderCard({ card: '5oro', size });
    const root = getByTestId('playing-card-5oro');
    const widthClass = [...root.classList].find((c) => c.startsWith('w-['));
    expect(widthClass).toBeDefined();
    expect(widthClass).toMatch(/clamp\(/);
    expect(widthClass).not.toMatch(/%|w-full|w-screen/);
    // Frame reserves the assets' intrinsic ratio up front → no layout shift.
    expect(root.style.aspectRatio).toBeTruthy();
  });

  it('invokes onClick with the card id when interactive', () => {
    const onClick = vi.fn();
    renderCard({ card: '7copa', onClick });
    fireEvent.click(screen.getByTestId('playing-card-7copa'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith('7copa');
  });

  it('renders a plain non-interactive figure when no onClick is given', () => {
    renderCard({ card: '4basto' });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the strength hint only when the prop is provided', () => {
    const first = renderCard({ card: '1espada', strengthHint: 'strong' });
    const hint = screen.getByTestId('playing-card-strength-hint');
    expect(hint.getAttribute('title')).toContain('Strong');
    first.unmount();

    const second = renderCard({ card: '1espada' });
    expect(screen.queryByTestId('playing-card-strength-hint')).toBeNull();
    second.unmount();

    // Face-down cards never carry a hint either.
    const third = renderCard({ faceDown: true, strengthHint: 'weak' });
    expect(screen.queryByTestId('playing-card-strength-hint')).toBeNull();
    third.unmount();
  });

  it('keeps interactive cards keyboard-reachable with focus ring classes', () => {
    renderCard({ card: '7copa', onClick: vi.fn() });
    // role="img" intentionally wins over the implicit button role, but the
    // element stays a native <button> → keyboard focusable/activatable.
    const el = screen.getByTestId('playing-card-7copa');
    expect(el.tagName.toLowerCase()).toBe('button');
    const classes = [...el.classList].join(' ');
    expect(classes).toContain('focus-visible:outline-2');
  });
});
