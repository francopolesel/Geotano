import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

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
    i18n: {
      get language() { return mockLang.value; },
      changeLanguage: mockChangeLanguage,
    },
  }),
}));

import { useLanguage } from './useLanguage';

describe('useLanguage', () => {
  beforeEach(() => {
    mockLang.value = 'en';
    mockChangeLanguage.mockClear();
  });

  describe('lang', () => {
    it('should return the current language from i18n', () => {
      const { result } = renderHook(() => useLanguage());
      expect(result.current.lang).toBe('en');
    });

    it('should reflect language changes', () => {
      const { result, rerender } = renderHook(() => useLanguage());
      act(() => {
        result.current.setLang('es');
      });
      rerender();
      expect(result.current.lang).toBe('es');
    });
  });

  describe('setLang', () => {
    it('should call i18n.changeLanguage with the provided language', () => {
      const { result } = renderHook(() => useLanguage());
      act(() => {
        result.current.setLang('es');
      });
      expect(mockChangeLanguage).toHaveBeenCalledWith('es');
    });

    it('should call i18n.changeLanguage with en', () => {
      mockLang.value = 'es';
      const { result } = renderHook(() => useLanguage());
      act(() => {
        result.current.setLang('en');
      });
      expect(mockChangeLanguage).toHaveBeenCalledWith('en');
    });
  });

  describe('formatDate', () => {
    it('should return a formatted date string for en locale', () => {
      const { result } = renderHook(() => useLanguage());
      const date = new Date('2024-12-25T10:30:00');
      const formatted = result.current.formatDate(date);
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('should include month and day in the output', () => {
      const { result } = renderHook(() => useLanguage());
      const date = new Date('2024-12-25T10:30:00');
      const formatted = result.current.formatDate(date);
      expect(formatted).toMatch(/Dec/i);
      expect(formatted).toContain('25');
    });

    it('should return es-formatted date when lang is es', () => {
      mockLang.value = 'es';
      const { result } = renderHook(() => useLanguage());
      const date = new Date('2024-12-25T10:30:00');
      const formatted = result.current.formatDate(date);
      expect(formatted).toBeTruthy();
      expect(formatted).toMatch(/dic/i);
      expect(formatted).toContain('25');
    });

    it('should accept a string date and parse it', () => {
      const { result } = renderHook(() => useLanguage());
      const formatted = result.current.formatDate('2024-12-25T10:30:00');
      expect(formatted).toBeTruthy();
      expect(formatted).toMatch(/Dec/i);
    });

    it('should accept custom Intl.DateTimeFormatOptions', () => {
      const { result } = renderHook(() => useLanguage());
      const date = new Date('2024-12-25T10:30:00');
      const formatted = result.current.formatDate(date, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      expect(formatted).toContain('December');
      expect(formatted).toContain('2024');
    });

    it('should handle invalid date gracefully', () => {
      const { result } = renderHook(() => useLanguage());
      const formatted = result.current.formatDate('not-a-date');
      expect(formatted).toBe('Invalid Date');
    });
  });

  describe('formatTime', () => {
    it('should return a formatted time string for en locale', () => {
      const { result } = renderHook(() => useLanguage());
      const date = new Date('2024-12-25T10:30:00');
      const formatted = result.current.formatTime(date);
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('should include minutes in the output', () => {
      const { result } = renderHook(() => useLanguage());
      const date = new Date('2024-12-25T10:30:00');
      const formatted = result.current.formatTime(date);
      expect(formatted).toContain('30');
    });

    it('should include the hour value', () => {
      const { result } = renderHook(() => useLanguage());
      const date = new Date('2024-12-25T15:30:00');
      const formatted = result.current.formatTime(date);
      expect(formatted).toContain('30');
      expect(formatted).toMatch(/3|15/);
    });

    it('should format time in es locale when lang is es', () => {
      mockLang.value = 'es';
      const { result } = renderHook(() => useLanguage());
      const date = new Date('2024-12-25T10:30:00');
      const formatted = result.current.formatTime(date);
      expect(formatted).toBeTruthy();
      expect(formatted).toContain('30');
    });

    it('should accept custom Intl.DateTimeFormatOptions', () => {
      const { result } = renderHook(() => useLanguage());
      const date = new Date('2024-12-25T10:30:45');
      const formatted = result.current.formatTime(date, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      expect(formatted).toContain('30');
      expect(formatted).toContain('45');
    });

    it('should handle invalid date gracefully', () => {
      const { result } = renderHook(() => useLanguage());
      const formatted = result.current.formatTime('bad-date');
      expect(formatted).toBe('Invalid Date');
    });
  });
});
