import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Mock i18n ────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const keys: Record<string, string> = {
        'settings.theme': 'Theme',
        'settings.light': 'Light',
        'settings.dark': 'Dark',
      };
      return keys[key] ?? key;
    },
  }),
}));

// ─── Mock themeStore ──────────────────────────────────────────────────────

const mockToggle = vi.fn();
let mockTheme: 'light' | 'dark' = 'light';

vi.mock('../store/themeStore', () => ({
  useThemeStore: (selector: (s: any) => any) =>
    selector({ theme: mockTheme, toggle: mockToggle }),
}));

import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    mockTheme = 'light';
    mockToggle.mockClear();
  });

  it('should render sun icon and Light text when theme is dark', () => {
    mockTheme = 'dark';
    render(<ThemeToggle />);

    // In dark mode, shows the "switch to light" option
    expect(screen.getByText('Light')).toBeInTheDocument();
    const button = screen.getByRole('button');
    expect(button.innerHTML).toContain('svg'); // has an SVG icon
  });

  it('should render moon icon and Dark text when theme is light', () => {
    render(<ThemeToggle />);

    expect(screen.getByText('Dark')).toBeInTheDocument();
    const button = screen.getByRole('button');
    expect(button.innerHTML).toContain('svg');
  });

  it('should call toggleStore.toggle on click', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('should have accessible aria-label', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Theme');
  });

  it('should have a title attribute', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Theme');
  });
});
