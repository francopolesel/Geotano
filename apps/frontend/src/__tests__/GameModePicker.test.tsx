import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/i18n';
import { GameModePicker } from '../features/multiplayer/GameModePicker';

function renderPicker(
  props: { open?: boolean; onClose?: () => void; onSelect?: (slug: string) => void } = {},
) {
  const {
    open = true,
    onClose = vi.fn(),
    onSelect = vi.fn(),
  } = props;

  return {
    onClose,
    onSelect,
    ...render(
      <I18nextProvider i18n={i18n}>
        <GameModePicker open={open} onClose={onClose} onSelect={onSelect} />
      </I18nextProvider>,
    ),
  };
}

describe('GameModePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('visibility', () => {
    it('should not render when open is false', () => {
      renderPicker({ open: false });
      expect(screen.queryByText(/select a game mode/i)).toBeNull();
    });

    it('should render when open is true', () => {
      renderPicker();
      expect(screen.getByText(/select a game mode/i)).toBeDefined();
    });
  });

  describe('content', () => {
    it('should render all 5 mode titles', () => {
      renderPicker();
      expect(screen.getByText(/flag → country/i)).toBeDefined();
      expect(screen.getByText(/capital → country/i)).toBeDefined();
      expect(screen.getByText(/country → flag/i)).toBeDefined();
      const continentElements = screen.getAllByText(/continent/i);
      expect(continentElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/free mix/i)).toBeDefined();
    });

    it('should render the mode picker hint', () => {
      renderPicker();
      expect(screen.getByText(/3-minute/i)).toBeDefined();
    });

    it('should render the cancel button', () => {
      renderPicker();
      expect(screen.getByText(/cancel/i)).toBeDefined();
    });
  });

  describe('interactions', () => {
    it('should call onSelect and onClose when a mode card is clicked', () => {
      const { onSelect, onClose } = renderPicker();
      const modeCards = screen.getAllByRole('button').filter(
        (b) => b.textContent && !b.textContent.includes('Cancel'),
      );
      fireEvent.click(modeCards[0]);

      expect(onSelect).toHaveBeenCalledOnce();
      expect(onSelect).toHaveBeenCalledWith('flag-guess');
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('should call onClose when the backdrop is clicked', () => {
      const { onClose } = renderPicker();
      const backdrop = document.querySelector('.fixed.inset-0');
      expect(backdrop).not.toBeNull();
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalledOnce();
      }
    });

    it('should NOT call onClose when clicking inside the modal card', () => {
      const { onClose } = renderPicker();
      const card = document.querySelector('.max-w-lg');
      expect(card).not.toBeNull();
      if (card) {
        fireEvent.click(card);
        expect(onClose).not.toHaveBeenCalled();
      }
    });

    it('should call onClose when the cancel button is clicked', () => {
      const { onClose } = renderPicker();
      fireEvent.click(screen.getByText(/cancel/i));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('should pass the correct slug for each mode card', () => {
      const { onSelect } = renderPicker();
      const modeCards = screen.getAllByRole('button').filter(
        (b) => b.textContent && !b.textContent.includes('Cancel') && !b.textContent.includes('3-minute'),
      );

      expect(modeCards.length).toBe(5);

      fireEvent.click(modeCards[0]);
      expect(onSelect).toHaveBeenLastCalledWith('flag-guess');

      fireEvent.click(modeCards[1]);
      expect(onSelect).toHaveBeenLastCalledWith('capital-guess');

      fireEvent.click(modeCards[2]);
      expect(onSelect).toHaveBeenLastCalledWith('country-by-flag');

      fireEvent.click(modeCards[3]);
      expect(onSelect).toHaveBeenLastCalledWith('continent');

      fireEvent.click(modeCards[4]);
      expect(onSelect).toHaveBeenLastCalledWith('free');
    });
  });
});
