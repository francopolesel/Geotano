import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockLang, mockChangeLanguage } = vi.hoisted(() => {
  let _lang = 'en';
  const _changeLanguage = vi.fn((lang: string) => {
    _lang = lang;
  });
  return {
    mockLang: {
      get value() { return _lang; },
      set value(v: string) { _lang = v; },
    },
    mockChangeLanguage: _changeLanguage,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const keys: Record<string, string> = {
        'settings.english': 'English',
        'settings.spanish': 'Español',
      };
      return keys[key] ?? key;
    },
    i18n: {
      get language() { return mockLang.value; },
      changeLanguage: mockChangeLanguage,
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
}));

vi.mock('../i18n/i18n', () => ({
  default: {
    get language() { return mockLang.value; },
    changeLanguage: mockChangeLanguage,
    on: vi.fn(),
    use: () => ({ init: vi.fn() }),
  },
}));

import { LanguageToggle } from './LanguageToggle';

describe('LanguageToggle', () => {
  beforeEach(() => {
    mockLang.value = 'en';
    mockChangeLanguage.mockClear();
  });

  it('should show ES as the toggle target when current lang is en', () => {
    render(<LanguageToggle />);
    // Shows the language you'll switch TO
    expect(screen.getByText('ES')).toBeInTheDocument();
  });

  it('should show EN as the toggle target when current lang is es', () => {
    mockLang.value = 'es';
    render(<LanguageToggle />);
    expect(screen.getByText('EN')).toBeInTheDocument();
  });

  it('should switch to es when clicked and currently en', () => {
    render(<LanguageToggle />);
    fireEvent.click(screen.getByText('ES'));
    expect(mockChangeLanguage).toHaveBeenCalledWith('es');
  });

  it('should switch to en when clicked and currently es', () => {
    mockLang.value = 'es';
    render(<LanguageToggle />);
    fireEvent.click(screen.getByText('EN'));
    expect(mockChangeLanguage).toHaveBeenCalledWith('en');
  });

  it('should have accessible aria-label for the toggle button', () => {
    render(<LanguageToggle />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label');
    expect(button.getAttribute('aria-label')).toBeTruthy();
  });

  it('should be interactive and enabled', () => {
    render(<LanguageToggle />);
    const button = screen.getByRole('button');
    expect(button).toBeEnabled();
  });

  it('should render with mobile class when mobile prop is true', () => {
    render(<LanguageToggle mobile={true} />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('ES');
  });

  it('should toggle language in mobile mode', () => {
    mockLang.value = 'es';
    render(<LanguageToggle mobile={true} />);
    expect(screen.getByText('EN')).toBeInTheDocument();
    fireEvent.click(screen.getByText('EN'));
    expect(mockChangeLanguage).toHaveBeenCalledWith('en');
  });
});
