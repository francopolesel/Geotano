import { describe, it, expect } from 'vitest';
import { cn } from '../lib/utils';

describe('cn', () => {
  it('should return a single string unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('should join multiple strings with space', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('should filter falsy values', () => {
    expect(cn('foo', false, null, undefined, 0, 'bar')).toBe('foo bar');
  });

  it('should include truthy numbers', () => {
    expect(cn('foo', 1, -1, 'bar')).toBe('foo 1 -1 bar');
  });
});
