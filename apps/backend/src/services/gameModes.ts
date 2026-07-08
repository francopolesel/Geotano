import type { GameModeSlug, QuestionType } from '@geotano/shared';

// ---------------------------------------------------------------------------
// Game mode configuration — 15 configs (5 base + 5 express + 5 unlimited)
// ---------------------------------------------------------------------------

export interface GameModeConfig {
  slug: GameModeSlug;
  questionTypes: QuestionType[];
  timerSeconds: number;
  lives: number;
  multiplier: number;
  description: string;
  /** 60 for standard, 30 for express, undefined for unlimited. */
  totalQuestions?: number;
}

// ─── Base configs ───────────────────────────────────────────────────────────

const BASE_CONFIGS: Record<string, GameModeConfig> = {
  'flag-guess': {
    slug: 'flag-guess',
    questionTypes: ['flag-to-country'],
    timerSeconds: 15,
    lives: 3,
    multiplier: 1.0,
    totalQuestions: 60,
    description: 'See the flag, guess the country',
  },
  'capital-guess': {
    slug: 'capital-guess',
    questionTypes: ['capital-to-country'],
    timerSeconds: 15,
    lives: 3,
    multiplier: 1.0,
    totalQuestions: 60,
    description: 'See the capital, guess the country',
  },
  'country-by-flag': {
    slug: 'country-by-flag',
    questionTypes: ['country-to-flag'],
    timerSeconds: 15,
    lives: 3,
    multiplier: 1.0,
    totalQuestions: 60,
    description: 'See the country, guess its flag',
  },
  continent: {
    slug: 'continent',
    questionTypes: ['continent'],
    timerSeconds: 20,
    lives: 3,
    multiplier: 1.2,
    totalQuestions: 60,
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
    lives: 3,
    multiplier: 1.5,
    totalQuestions: 60,
    description: 'Mixed questions from all categories',
  },
};

// ─── Variant factory ────────────────────────────────────────────────────────

function createVariant(
  base: GameModeConfig,
  suffix: 'express' | 'unlimited',
  totalQuestions?: number,
): GameModeConfig {
  const slug = `${base.slug}-${suffix}` as GameModeSlug;
  const label = suffix === 'express' ? 'Express' : 'Unlimited';
  return {
    slug,
    questionTypes: [...base.questionTypes],
    timerSeconds: base.timerSeconds,
    lives: base.lives,
    multiplier: base.multiplier,
    description: `${base.description} (${label})`,
    totalQuestions,
  };
}

// ─── Build full config map ──────────────────────────────────────────────────

const MODE_CONFIGS: Record<GameModeSlug, GameModeConfig> = {
  ...BASE_CONFIGS as Record<GameModeSlug, GameModeConfig>,

  // Express variants — totalQuestions = 30
  'flag-guess-express': createVariant(BASE_CONFIGS['flag-guess'], 'express', 30),
  'capital-guess-express': createVariant(BASE_CONFIGS['capital-guess'], 'express', 30),
  'country-by-flag-express': createVariant(BASE_CONFIGS['country-by-flag'], 'express', 30),
  'continent-express': createVariant(BASE_CONFIGS['continent'], 'express', 30),
  'free-express': createVariant(BASE_CONFIGS['free'], 'express', 30),

  // Unlimited variants — totalQuestions omitted
  'flag-guess-unlimited': createVariant(BASE_CONFIGS['flag-guess'], 'unlimited'),
  'capital-guess-unlimited': createVariant(BASE_CONFIGS['capital-guess'], 'unlimited'),
  'country-by-flag-unlimited': createVariant(BASE_CONFIGS['country-by-flag'], 'unlimited'),
  'continent-unlimited': createVariant(BASE_CONFIGS['continent'], 'unlimited'),
  'free-unlimited': createVariant(BASE_CONFIGS['free'], 'unlimited'),
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
