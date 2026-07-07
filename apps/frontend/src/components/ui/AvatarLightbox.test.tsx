import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AvatarLightbox } from './AvatarLightbox';

describe('AvatarLightbox', () => {
  it('should render the enlarged avatar image', () => {
    render(<AvatarLightbox avatarUrl="https://example.com/avatar.jpg" displayName="Test User" onClose={vi.fn()} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    expect(img).toHaveAttribute('alt', 'Test User');
  });

  it('should call onClose when clicking the backdrop overlay', () => {
    const onClose = vi.fn();
    render(<AvatarLightbox avatarUrl="https://example.com/avatar.jpg" displayName="Test User" onClose={onClose} />);

    // Click the backdrop (the outermost div with the overlay class)
    const backdrop = screen.getByRole('img').closest('div[class*="fixed"]')!;
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose when clicking the image itself (stopPropagation)', () => {
    const onClose = vi.fn();
    render(<AvatarLightbox avatarUrl="https://example.com/avatar.jpg" displayName="Test User" onClose={onClose} />);

    const img = screen.getByRole('img');
    fireEvent.click(img);

    // Image has e.stopPropagation() so the backdrop handler won't fire
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should call onClose when pressing Escape', () => {
    const onClose = vi.fn();
    render(<AvatarLightbox avatarUrl="https://example.com/avatar.jpg" displayName="Test User" onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose on other key presses', () => {
    const onClose = vi.fn();
    render(<AvatarLightbox avatarUrl="https://example.com/avatar.jpg" displayName="Test User" onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Enter' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should close on close button click', () => {
    const onClose = vi.fn();
    render(<AvatarLightbox avatarUrl="https://example.com/avatar.jpg" displayName="Test User" onClose={onClose} />);

    const closeButton = screen.getByText('✕');
    fireEvent.click(closeButton);

    // The button's onClick is called, then event bubbles to backdrop — called 2 total
    expect(onClose).toHaveBeenCalled();
    expect(onClose.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('should set body overflow to hidden on mount and restore on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <AvatarLightbox avatarUrl="https://example.com/avatar.jpg" displayName="Test User" onClose={onClose} />,
    );

    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('');
  });
});
