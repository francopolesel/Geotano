import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserAvatar } from './UserAvatar';

describe('UserAvatar', () => {
  it('should render image when avatarUrl is provided', () => {
    render(<UserAvatar avatarUrl="https://example.com/avatar.jpg" username="testuser" displayName="Test User" />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    expect(img).toHaveAttribute('alt', 'Test User');
  });

  it('should render initial fallback when no avatarUrl', () => {
    render(<UserAvatar username="john" displayName="John Doe" />);

    // Fallback shows the first letter of displayName
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('should render initial from username when displayName is null', () => {
    render(<UserAvatar username="alice" displayName={null} />);

    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('should render initial from username when displayName is empty', () => {
    render(<UserAvatar username="bob" />);

    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('should fall back to initial on image error', () => {
    const { rerender } = render(
      <UserAvatar avatarUrl="https://example.com/broken.jpg" username="testuser" displayName="Test User" />,
    );

    const img = screen.getByRole('img');
    fireEvent.error(img);

    // After onError, the fallback initial should appear instead
    rerender(
      <UserAvatar avatarUrl="https://example.com/broken.jpg" username="testuser" displayName="Test User" />,
    );

    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('should call onClick when clicking the fallback and handler is provided', () => {
    const onClick = vi.fn();
    // No avatarUrl — renders fallback div with button role
    render(<UserAvatar username="testuser" displayName="Test" onClick={onClick} />);

    const fallback = screen.getByText('T');
    fireEvent.click(fallback);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should call onClick when clicking the image and handler is provided', () => {
    const onClick = vi.fn();
    render(<UserAvatar username="testuser" displayName="Test" onClick={onClick} avatarUrl="https://example.com/avatar.jpg" />);

    const img = screen.getByAltText('Test');
    fireEvent.click(img);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should stop propagation on click when onClick is provided', () => {
    const onClick = vi.fn();
    const parentClick = vi.fn();

    render(
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={parentClick}>
        <UserAvatar username="testuser" displayName="Test" onClick={onClick} />
      </div>,
    );

    const element = screen.getByText('T');
    fireEvent.click(element);

    // onClick should be called, but parent should NOT receive it
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    render(<UserAvatar username="testuser" displayName="Test" className="custom-class" />);

    const element = screen.getByText('T').closest('div');
    expect(element?.className).toContain('custom-class');
  });

  it('should not add button role when no onClick', () => {
    render(<UserAvatar username="testuser" displayName="Test" />);

    const element = screen.getByText('T').closest('div');
    expect(element).not.toHaveAttribute('role', 'button');
  });

  it('should fall back to username in alt when displayName is null (line 48 branch)', () => {
    render(<UserAvatar avatarUrl="https://example.com/avatar.jpg" username="janedoe" displayName={null} />);

    const img = screen.getByRole('img');
    // When displayName is null, alt should use username
    expect(img).toHaveAttribute('alt', 'janedoe');
  });
});
