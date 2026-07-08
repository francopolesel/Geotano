import { describe, it, expect } from 'vitest';
import { getModeConfig, getAllModeConfigs, isValidModeSlug } from '../services/gameModes.js';

// ─── Helper: all 20 slugs ─────────────────────────────────────────────────┬─
const ALL_SLUGS = [
  'flag-guess', 'flag-guess-express', 'flag-guess-unlimited', 'flag-guess-hardcore',
  'capital-guess', 'capital-guess-express', 'capital-guess-unlimited', 'capital-guess-hardcore',
  'country-by-flag', 'country-by-flag-express', 'country-by-flag-unlimited', 'country-by-flag-hardcore',
  'continent', 'continent-express', 'continent-unlimited', 'continent-hardcore',
  'free', 'free-express', 'free-unlimited', 'free-hardcore',
] as const;

const EXPRESS_SLUGS = ALL_SLUGS.filter((s) => s.endsWith('-express'));
const UNLIMITED_SLUGS = ALL_SLUGS.filter((s) => s.endsWith('-unlimited'));
const HARDCORE_SLUGS = ALL_SLUGS.filter((s) => s.endsWith('-hardcore'));
const BASE_SLUGS = ALL_SLUGS.filter((s) => !s.endsWith('-express') && !s.endsWith('-unlimited') && !s.endsWith('-hardcore'));

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

// ─── Variant-specific tests ─────────────────────────────────────────────────

describe('express variant configs', () => {
  for (const slug of EXPRESS_SLUGS) {
    it(`${slug} should have totalQuestions = 30`, () => {
      const config = getModeConfig(slug);
      expect(config.totalQuestions).toBe(30);
    });
  }
});

describe('unlimited variant configs', () => {
  for (const slug of UNLIMITED_SLUGS) {
    it(`${slug} should have no totalQuestions limit`, () => {
      const config = getModeConfig(slug);
      expect(config.totalQuestions).toBeUndefined();
    });
  }
});

describe('hardcore variant configs', () => {
  for (const slug of HARDCORE_SLUGS) {
    it(`${slug} should have lives = 1`, () => {
      const config = getModeConfig(slug);
      expect(config.lives).toBe(1);
    });

    it(`${slug} should have no totalQuestions limit`, () => {
      const config = getModeConfig(slug);
      expect(config.totalQuestions).toBeUndefined();
    });
  }
});

describe('base mode configs', () => {
  for (const slug of BASE_SLUGS) {
    it(`${slug} should have totalQuestions = 50`, () => {
      const config = getModeConfig(slug);
      expect(config.totalQuestions).toBe(50);
    });
  }
});

describe('variant inheritance', () => {
  it('express variant should inherit questionTypes from base mode', () => {
    const base = getModeConfig('flag-guess');
    const expr = getModeConfig('flag-guess-express');
    expect(expr.questionTypes).toEqual(base.questionTypes);
    expect(expr.timerSeconds).toBe(base.timerSeconds);
    expect(expr.multiplier).toBe(base.multiplier);
  });

  it('unlimited variant should inherit questionTypes from base mode', () => {
    const base = getModeConfig('continent');
    const unlimited = getModeConfig('continent-unlimited');
    expect(unlimited.questionTypes).toEqual(base.questionTypes);
    expect(unlimited.lives).toBe(base.lives);
  });
});

describe('getAllModeConfigs', () => {
  it('should return all 20 game mode configs', () => {
    const configs = getAllModeConfigs();
    expect(configs).toHaveLength(20);
  });

  it('should include all expected mode slugs', () => {
    const slugs = getAllModeConfigs().map((c) => c.slug);
    for (const slug of ALL_SLUGS) {
      expect(slugs).toContain(slug);
    }
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

  it('should include totalQuestions for base and express variants', () => {
    for (const config of getAllModeConfigs()) {
      if (config.slug.endsWith('-express')) {
        expect(config.totalQuestions).toBe(30);
      } else if (config.slug.endsWith('-unlimited') || config.slug.endsWith('-hardcore')) {
        expect(config.totalQuestions).toBeUndefined();
      } else {
        expect(config.totalQuestions).toBe(50);
      }
    }
  });
});

describe('isValidModeSlug', () => {
  it('should return true for all 20 mode slugs', () => {
    for (const slug of ALL_SLUGS) {
      expect(isValidModeSlug(slug)).toBe(true);
    }
  });

  it('should return false for invalid mode slugs', () => {
    expect(isValidModeSlug('')).toBe(false);
    expect(isValidModeSlug('invalid')).toBe(false);
    expect(isValidModeSlug('flag')).toBe(false);
    expect(isValidModeSlug('mix')).toBe(false);
  });

  it('should act as a type guard (narrowing to GameModeSlug)', () => {
    const slug: string = 'flag-guess-express';
    if (isValidModeSlug(slug)) {
      const config = getModeConfig(slug);
      expect(config.totalQuestions).toBe(30);
    }
  });
});
