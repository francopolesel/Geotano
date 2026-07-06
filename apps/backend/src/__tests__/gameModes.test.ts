import { describe, it, expect } from 'vitest';
import { getModeConfig, getAllModeConfigs, isValidModeSlug } from '../services/gameModes.js';

describe('getModeConfig', () => {
  it('should return config for a valid game mode slug', () => {
    const config = getModeConfig('flag-guess');
    expect(config.slug).toBe('flag-guess');
    expect(config.questionTypes).toEqual(['flag-to-country']);
    expect(config.timerSeconds).toBeGreaterThan(0);
    expect(config.lives).toBeGreaterThan(0);
    expect(config.multiplier).toBeGreaterThan(0);
    expect(config.description).toBeTruthy();
  });

  it('should return config with continent question type', () => {
    const config = getModeConfig('continent');
    expect(config.questionTypes).toEqual(['continent']);
    expect(config.timerSeconds).toBe(20);
    expect(config.multiplier).toBe(1.2);
  });

  it('should return free mode config with all question types', () => {
    const config = getModeConfig('free');
    expect(config.questionTypes).toContain('flag-to-country');
    expect(config.questionTypes).toContain('capital-to-country');
    expect(config.questionTypes).toContain('country-to-flag');
    expect(config.questionTypes).toContain('continent');
    expect(config.lives).toBe(3);
  });

  it('should return capital-guess mode config', () => {
    const config = getModeConfig('capital-guess');
    expect(config.questionTypes).toEqual(['capital-to-country']);
  });

  it('should return country-by-flag mode config', () => {
    const config = getModeConfig('country-by-flag');
    expect(config.questionTypes).toEqual(['country-to-flag']);
  });

  it('should throw for an unknown mode slug', () => {
    expect(() => getModeConfig('invalid-mode')).toThrow('Unknown game mode');
  });

  it('should throw for empty string', () => {
    expect(() => getModeConfig('' as any)).toThrow('Unknown game mode');
  });
});

describe('getAllModeConfigs', () => {
  it('should return all 5 game mode configs', () => {
    const configs = getAllModeConfigs();
    expect(configs).toHaveLength(5);
  });

  it('should include all expected mode slugs', () => {
    const slugs = getAllModeConfigs().map((c) => c.slug);
    expect(slugs).toContain('flag-guess');
    expect(slugs).toContain('capital-guess');
    expect(slugs).toContain('country-by-flag');
    expect(slugs).toContain('continent');
    expect(slugs).toContain('free');
  });

  it('each config should have required fields', () => {
    for (const config of getAllModeConfigs()) {
      expect(config.slug).toBeTruthy();
      expect(config.questionTypes.length).toBeGreaterThan(0);
      expect(config.timerSeconds).toBeGreaterThan(0);
      expect(config.lives).toBeGreaterThan(0);
      expect(config.multiplier).toBeGreaterThan(0);
      expect(config.description).toBeTruthy();
    }
  });
});

describe('isValidModeSlug', () => {
  it('should return true for valid mode slugs', () => {
    expect(isValidModeSlug('flag-guess')).toBe(true);
    expect(isValidModeSlug('capital-guess')).toBe(true);
    expect(isValidModeSlug('country-by-flag')).toBe(true);
    expect(isValidModeSlug('continent')).toBe(true);
    expect(isValidModeSlug('free')).toBe(true);
  });

  it('should return false for invalid mode slugs', () => {
    expect(isValidModeSlug('')).toBe(false);
    expect(isValidModeSlug('invalid')).toBe(false);
    expect(isValidModeSlug('flag')).toBe(false);
    expect(isValidModeSlug('mix')).toBe(false);
  });

  it('should act as a type guard (narrowing to GameModeSlug)', () => {
    const slug: string = 'flag-guess';
    if (isValidModeSlug(slug)) {
      // After narrowing, slug should be GameModeSlug
      const config = getModeConfig(slug);
      expect(config.slug).toBe('flag-guess');
    }
  });
});
