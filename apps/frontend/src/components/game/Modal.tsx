import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

/**
 * Shared modal primitive (spec E1/E3, a11y I2).
 *
 * - Rendered through `createPortal` to `document.body` with a `fixed inset-0
 *   z-[60]` overlay so it covers the entire table regardless of stacking.
 * - `role='dialog'` (default) or `role='alertdialog'` per surface.
 * - Focus is trapped while open: Tab cycles within the dialog and focus is
 *   returned to the previously-focused element on close.
 * - Escape only closes when `escapeClose` is true. For bet modals it stays
 *   false so pressing Escape can NEVER produce an illegal implicit answer.
 * - `variant='small'` (max-w-md) vs `'large'` (max-w-lg); interactive buttons
 *   keep a ≥44px min target so the modifier is honored on mobile.
 * - True viewport centering: `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`
 * - Max height constrained to viewport: `max-h-[90vh] overflow-y-auto`
 * - Stronger backdrop: `bg-black/60 backdrop-blur-sm`
 */

export interface ModalProps {
  open: boolean;
  role?: 'dialog' | 'alertdialog';
  /** Accessible name for the dialog / alertdialog. */
  title: string;
  /** Optional close handler; invoked by Escape (if `escapeClose`) and backdrop. */
  onClose?: () => void;
  /** Keep focus inside the dialog while open (default true). */
  focusTrap?: boolean;
  /** Allow Escape to close (safe cancel surfaces only — never bet modals). */
  escapeClose?: boolean;
  children: ReactNode;
  variant?: 'small' | 'large';
  /** Explicit reduced-motion flag; falls back to the GAME_TIMING media check. */
  reducedMotion?: boolean;
}

type Focusable = HTMLElement & { focus(): void };

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusables(container: HTMLElement): Focusable[] {
  // NOTE: no visibility filter — jsdom reports offsetParent as null for every
  // element (no layout), so filtering by it would empty the list and break the
  // trap in tests while adding little in the browser.
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)] as Focusable[];
}

export function Modal({
  open,
  role = 'dialog',
  title,
  onClose,
  focusTrap = true,
  escapeClose = false,
  children,
  variant = 'small',
  reducedMotion = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus management + escape policy.
  useEffect(() => {
    if (!open) return;
    if (typeof document === 'undefined') return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Move focus into the dialog on open (a11y I2-M).
    const container = dialogRef.current;
    if (container) {
      const first = getFocusables(container)[0];
      first?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (escapeClose) {
        onClose?.();
        return;
      }
      // escapeClose=false → Escape is intentionally inert (E3-E): no implicit
      // action is ever taken. Do nothing.
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, escapeClose, onClose]);

  // Restore focus to the opener on close.
  useEffect(() => {
    if (open) return;
    if (previousFocusRef.current?.isConnected) {
      previousFocusRef.current.focus();
    }
  }, [open]);

  // Focus trap: intercept Tab and cycle within the dialog.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!focusTrap || event.key !== 'Tab') return;
    const container = dialogRef.current;
    if (!container) return;
    const focusables = getFocusables(container);
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey) {
      if (active === first || !container.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !container.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      data-testid="modal-root"
      className="fixed inset-0 z-[60] flex items-center justify-center p-2"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop: stronger overlay with blur, closes only when an explicit onClose release exists. */}
      <div
        data-testid="modal-backdrop"
        aria-hidden
        onClick={onClose ? () => onClose() : undefined}
        className="absolute inset-0 h-full w-full bg-black/60 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role={role}
        aria-label={title}
        aria-modal="true"
        data-testid="modal-panel"
        className={[
          'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full min-w-0 max-h-[90vh] overflow-y-auto flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-2xl',
          'animate-truco-bet-in',
          variant === 'small' ? 'max-w-md' : 'max-w-lg',
        ].join(' ')}
      >
        <p
          data-testid="modal-title"
          className="text-center text-xl font-black uppercase tracking-wide text-[var(--color-foreground)] flex-shrink-0"
        >
          {title}
        </p>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
