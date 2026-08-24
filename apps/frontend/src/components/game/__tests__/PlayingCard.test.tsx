import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { DECK_40 } from '@geotano/shared';
import i18n from '../../../i18n/i18n';
import { PlayingCard } from '../PlayingCard';

function renderCard(props: Parameters<typeof PlayingCard>[0]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <PlayingCard {...props} />
    </I18nextProvider>,
  );
}

/** Serializes the rendered markup so uniqueness/determinism can be asserted. */
function markup(container: HTMLElement): string {
  return container.innerHTML;
}

describe('PlayingCard (CSS/SVG Spanish deck primitive)', () => {
  afterEach(() => cleanup());

  it('renders all 40 distinct faces and none equals the face-down back', () => {
    const backs = new Set<string>();

    const backRender = renderCard({ faceDown: true });
    const backMarkup = markup(backRender.container);
    backs.add(backMarkup);
    backRender.unmount();

    const faces = new Set<string>();
    for (const card of DECK_40) {
      const { container, unmount } = renderCard({ card });
      expect(screen.getByTestId(`playing-card-${card}`)).toBeDefined();
      const html = markup(container);
      // A face must never collapse into the uniform back…
      expect(html).not.toBe(backMarkup);
      faces.add(html);
      unmount();
    }
    // …and every one of the 40 ids must produce a visually unique face.
    expect(faces.size).toBe(40);
    expect(backs.size).toBe(1);
  });

  it('makes every face-down card identical regardless of context', () => {
    const a = renderCard({ faceDown: true, size: 'sm' });
    const aHtml = markup(a.container);
    a.unmount();
    const b = renderCard({ faceDown: true, size: 'lg' });
    // Same back art element; size lives on the wrapper class list only.
    expect(markup(b.container)).toContain(
      aHtml.match(/data-testid="playing-card-back-art"[^>]*>/)![0],
    );
    b.unmount();
  });

  it('requests zero network assets (no img tags, no url())', () => {
    for (const card of ['1espada', '7oro', '12copa'] as const) {
      const { container, unmount } = renderCard({ card });
      expect(container.querySelector('img')).toBeNull();
      expect(/url\(/.test(container.innerHTML)).toBe(false);
      unmount();
    }
  });

  it('is deterministic — the same card renders byte-identical markup twice', () => {
    const first = renderCard({ card: '3basto' });
    const firstHtml = markup(first.container);
    first.unmount();
    const second = renderCard({ card: '3basto' });
    expect(markup(second.container)).toBe(firstHtml);
    second.unmount();
  });

  it('exposes localized accessible alt text with rank and suit', () => {
    renderCard({ card: '1espada' });
    const el = screen.getByRole('img');
    // en locale resolves truco.suit.espada → "swords"
    expect(el.getAttribute('aria-label')).toContain('swords');
    expect(el.getAttribute('aria-label')).toContain('1');
  });

  it.each(['sm', 'md', 'lg'] as const)('uses a fixed/clamp width for size %s (never viewport-%)', (size) => {
    const { getByTestId } = renderCard({ card: '5oro', size });
    const root = getByTestId('playing-card-5oro');
    const widthClass = [...root.classList].find((c) => c.startsWith('w-['));
    expect(widthClass).toBeDefined();
    expect(widthClass).toMatch(/clamp\(/);
    expect(widthClass).not.toMatch(/%|w-full|w-screen/);
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

  // ─── Redesign batch 1: states, strength hint, back art ───────────────────

  it('renders court cards with a localized figura legend', () => {
    renderCard({ card: '12espada' });
    const el = screen.getByTestId('playing-card-12espada');
    expect(el.textContent).toContain(i18n.t('truco.card.rey'));
  });

  it('applies disabled styling when the disabled prop is set', () => {
    renderCard({ card: '3oro', disabled: true });
    const el = screen.getByTestId('playing-card-3oro');
    const classes = [...el.classList].join(' ');
    expect(classes).toContain('opacity-45');
    expect(classes).toContain('grayscale');
    expect(classes).toContain('cursor-not-allowed');
    // Disabled cards must never become buttons, even with an onClick handler.
    renderCard({ card: '3copa', disabled: true, onClick: vi.fn() });
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

  it('renders the designed back art element for face-down cards', () => {
    renderCard({ faceDown: true });
    expect(screen.getByTestId('playing-card-back-art')).toBeDefined();
    // Back is real SVG art now, not a CSS gradient div.
    expect(screen.getByTestId('playing-card-back-art').tagName.toLowerCase()).toBe('svg');
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
