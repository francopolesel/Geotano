import { describe, it, expect } from 'vitest';
import en from '../i18n/en.json';
import es from '../i18n/es.json';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Recursively flattens a nested translation resource into dotted key paths. */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') {
      keys.push(...flattenKeys(value as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function diffKeySets(a: string[], b: string[]): string[] {
  const bSet = new Set(b);
  return a.filter((key) => !bSet.has(key)).sort();
}

// ─── Detector sanity (synthetic fixtures prove the gate can fail) ──────────

describe('i18n parity detector', () => {
  it('reports keys missing on one side', () => {
    const a = flattenKeys({ nav: { home: 'Home', quiz: 'Quiz' } });
    const b = flattenKeys({ nav: { home: 'Inicio' } });

    expect(diffKeySets(a, b)).toEqual(['nav.quiz']);
    expect(diffKeySets(b, a)).toEqual([]);
  });

  it('passes for identical key sets regardless of values', () => {
    const a = flattenKeys({ x: { y: 'one' }, z: 'two' });
    const b = flattenKeys({ x: { y: 'uno' }, z: 'dos' });

    expect(diffKeySets(a, b)).toEqual([]);
    expect(diffKeySets(b, a)).toEqual([]);
  });
});

// ─── Live gate: en vs es must expose identical key sets ────────────────────

describe('i18n locale parity (en vs es)', () => {
  it('en.json and es.json contain identical key sets', () => {
    const enKeys = flattenKeys(en);
    const esKeys = flattenKeys(es);

    const missingInEs = diffKeySets(enKeys, esKeys);
    const missingInEn = diffKeySets(esKeys, enKeys);

    expect(
      missingInEs,
      `Keys present in en.json but missing in es.json:\n${missingInEs.join('\n')}`,
    ).toEqual([]);
    expect(
      missingInEn,
      `Keys present in es.json but missing in en.json:\n${missingInEn.join('\n')}`,
    ).toEqual([]);
  });
});
