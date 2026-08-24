// ---------------------------------------------------------------------------
// Truco CPU — difficulty factory + deterministic personas
// ---------------------------------------------------------------------------

import { easyAi } from './easy';
import { hardAi } from './hard';
import { mediumAi } from './medium';
import type { Difficulty, TrucoAi } from './types';

export type { Difficulty, TrucoAi } from './types';

/** CPU persona shown in the UI (name + avatar). At least 8 required by spec. */
export interface Persona {
  name: string;
  avatar: string;
}

export const PERSONAS: readonly Persona[] = [
  { name: 'La Rubia', avatar: '🧉' },
  { name: 'El Gaucho', avatar: '🐎' },
  { name: 'Doña Rosa', avatar: '🌹' },
  { name: 'El Viejo', avatar: '🪶' },
  { name: 'El Paisano', avatar: '🌵' },
  { name: 'La Criolla', avatar: '🌙' },
  { name: 'El Compadre', avatar: '🔥' },
  { name: 'Don Juan', avatar: '🎸' },
] as const;

/**
 * Canonical safe wrap of ANY numeric index into [0, PERSONAS.length) —
 * negatives, floats and huge values all land on a real persona (remediation
 * #8: one rule, every entry point).
 */
export function normalizePersonaIndex(index: number): number {
  const count = PERSONAS.length;
  return ((Math.trunc(index) % count) + count) % count;
}

/** Persona lookup that can never yield undefined for a numeric index. */
export function personaAt(index: number): Persona {
  return PERSONAS[normalizePersonaIndex(index)] as Persona;
}

/** Deterministic persona selection from a seed. */
export function pickPersona(seed: number): Persona {
  return personaAt(seed);
}

export function createAi(difficulty: Difficulty): TrucoAi {
  switch (difficulty) {
    case 'easy':
      return easyAi;
    case 'medium':
      return mediumAi;
    case 'hard':
      return hardAi;
  }
}
