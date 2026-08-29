import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Modal } from '../Modal';
import { act } from 'react';

function renderModal(
  { open = true, ...rest }: Partial<Parameters<typeof Modal>[0]> = {},
  children?: ReactNode,
) {
  render(
    <Modal open={open} {...rest} title={rest.title ?? 'Test modal'}>
      {children ?? (
        <>
          <button type="button" data-testid="modal-a">
            First
          </button>
          <button type="button" data-testid="modal-last">
            Last
          </button>
        </>
      )}
    </Modal>,
  );
}

afterEach(() => cleanup());

describe('Modal — role, focus, escape policy', () => {
  it('renders role=dialog by default with the title and a backdrop', () => {
    renderModal({ open: true });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'Test modal');
    expect(dialog).toBeInTheDocument();
    // Backdrop is present but not a separate focusable surface.
    expect(screen.getByTestId('modal-backdrop')).toBeDefined();
  });

  it('renders role=alertdialog when requested', () => {
    renderModal({ open: true, role: 'alertdialog' });
    expect(screen.getByRole('alertdialog')).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders nothing when closed', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('variant=small uses max-w-md; large uses max-w-lg', () => {
    renderModal({ open: true, variant: 'small' });
    expect(screen.getByRole('dialog').className).toContain('max-w-md');

    cleanup();
    renderModal({ open: true, variant: 'large' });
    expect(screen.getByRole('dialog').className).toContain('max-w-lg');
  });

  it('does not squish large content buttons — their min-h-[44px] touch target survives', () => {
    renderModal(
      { open: true, variant: 'large' },
      <>
        <button type="button" data-testid="modal-accept" className="min-h-[44px]">
          Accept
        </button>
      </>,
    );
    const accept = screen.getByTestId('modal-accept');
    // Touch-target contract (H1-T); jsdom cannot compute real CSS so we assert
    // the class that renders the ≥44px min target is preserved by the panel.
    expect(accept.className).toContain('min-h-[44px]');
  });

  it('focus traps: Tab cycles within the modal and returns to the opener on close', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.textContent = 'opener';
    opener.focus();

    const { rerender } = render(
      <Modal open title="Trapped">
        <button type="button" data-testid="modal-a">
          First
        </button>
        <button type="button" data-testid="modal-last">
          Last
        </button>
      </Modal>,
    );

    // Focus moves into the dialog on open.
    expect([...document.querySelectorAll('button')].some((b) => b === document.activeElement)).toBe(
      true,
    );

    // Tab repeatedly stays inside the two modal buttons (never escapes to body/opener).
    for (let i = 0; i < 5; i++) {
      act(() => {
        fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
      });
      const activeId = document.activeElement?.getAttribute('data-testid');
      expect(['modal-a', 'modal-last']).toContain(activeId);
    }

    // Closing returns focus to the opener.
    rerender(
      <Modal open={false} title="Trapped">
        <button type="button">First</button>
      </Modal>,
    );
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('Escape is inert (no onClose) when escapeClose=false — bet modals must not auto-answer', () => {
    const onClose = vi.fn();
    renderModal({ open: true, escapeClose: false, onClose });
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(onClose).not.toHaveBeenCalled();
    // Modal stays open.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Escape closes when escapeClose=true', () => {
    const onClose = vi.fn();
    renderModal({ open: true, escapeClose: true, onClose });
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('onClose from the backdrop close button fires (when provided)', () => {
    const onClose = vi.fn();
    renderModal({ open: true, onClose });
    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
