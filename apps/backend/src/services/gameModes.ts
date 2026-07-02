import type { GameModeSlug, QuestionType } from '@geotano/shared';

// ---------------------------------------------------------------------------
// Game mode configuration — 5 types
// ---------------------------------------------------------------------------

export interface GameModeConfig {
  slug: GameModeSlug;
  questionTypes: QuestionType[];
  timerSeconds: number;
  lives: number;
  multiplier: number;
  description: string;
}

const MODE_CONFIGS: Record<GameModeSlug, GameModeConfig> = {
  'flag-guess': {
    slug: 'flag-guess',
    questionTypes: ['flag-to-country'],
    timerSeconds: 15,
    lives: 3,
    multiplier: 1.0,
    description: 'See the flag, guess the country',
  },
  'capital-guess': {
    slug: 'capital-guess',
    questionTypes: ['capital-to-country'],
    timerSeconds: 15,
    lives: 3,
    multiplier: 1.0,
    description: 'See the capital, guess the country',
  },
  'country-by-flag': {
    slug: 'country-by-flag',
    questionTypes: ['country-to-flag'],
    timerSeconds: 15,
    lives: 3,
    multiplier: 1.0,
    description: 'See the country, guess its flag',
  },
  continent: {
    slug: 'continent',
    questionTypes: ['continent'],
    timerSeconds: 20,
    lives: 3,
    multiplier: 1.2,
    description: 'Which continent does this country belong to?',
  },
  free: {
    slug: 'free',
    questionTypes: [
      'flag-to-country',
      'capital-to-country',
      'country-to-flag',
      'continent',
    ],
    timerSeconds: 15,
    lives: 5,
    multiplier: 1.5,
    description: 'Mixed questions from all categories',
  },
};

export function getModeConfig(slug: GameModeSlug): GameModeConfig {
  const config = MODE_CONFIGS[slug];
  if (!config) {
    throw new Error(`Unknown game mode: ${slug}`);
  }
  return config;
}

export function getAllModeConfigs(): GameModeConfig[] {
  return Object.values(MODE_CONFIGS);
}

export function isValidModeSlug(slug: string): slug is GameModeSlug {
  return slug in MODE_CONFIGS;
}
