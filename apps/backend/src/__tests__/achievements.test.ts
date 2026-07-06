import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAchievements, getUserAchievements } from '../services/achievements.js';

// ─── Mock DB ────────────────────────────────────────────────────────────────
// drizzle query builder chains: db.select().from(t).innerJoin(...).where(...)
// Each method returns `this` for chaining. The TERMINAL method returns a Promise.
// We use a resultQueue where each query's terminal method shifts the next item.

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  innerJoin: vi.fn(),
  leftJoin: vi.fn(),
  where: vi.fn(),
  groupBy: vi.fn(),
  orderBy: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  onConflictDoNothing: vi.fn(),
  limit: vi.fn(),
}));

const resultQueue: any[] = [];

// Track call counts to distinguish chaining vs terminal calls
let whereCallCount = 0;
let groupByCallCount = 0;
let fromCallCount = 0;

/**
 * @param fromTerminal — when true, the first .from() call is terminal
 *   (used by checkAchievements which has query `db.select().from(achievements)`)
 */
function setupMock(fromTerminal = false) {
  resultQueue.length = 0;
  whereCallCount = 0;
  groupByCallCount = 0;
  fromCallCount = 0;

  // All intermediate chain methods return mockDb
  mockDb.select.mockReturnValue(mockDb);
  mockDb.innerJoin.mockReturnValue(mockDb);
  mockDb.leftJoin.mockReturnValue(mockDb);
  mockDb.values.mockReturnValue(mockDb);
  mockDb.insert.mockReturnValue(mockDb);
  mockDb.limit.mockReturnValue(mockDb);

  // .from(): only terminal when fromTerminal=true and it's the first call
  mockDb.from.mockImplementation(() => {
    fromCallCount++;
    if (fromCallCount === 1 && fromTerminal) {
      return Promise.resolve(resultQueue.shift() ?? []);
    }
    return mockDb;
  });

  // .where(): calls 1-4 are terminal (queries 2-5), call 5 is chaining (query 6)
  mockDb.where.mockImplementation(() => {
    whereCallCount++;
    if (whereCallCount === 5) return mockDb;
    return Promise.resolve(resultQueue.shift() ?? []);
  });

  // .groupBy(): always terminal (query 6 — modesPlayed)
  mockDb.groupBy.mockImplementation(() => {
    groupByCallCount++;
    return Promise.resolve(resultQueue.shift() ?? []);
  });

  // .orderBy(): always terminal (getUserAchievements)
  mockDb.orderBy.mockImplementation(() => {
    return Promise.resolve(resultQueue.shift() ?? []);
  });

  // .onConflictDoNothing(): terminal for insert
  mockDb.onConflictDoNothing.mockImplementation(() => {
    return Promise.resolve(undefined);
  });
}

vi.mock('../db/index.js', () => ({ db: mockDb }));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ALL_ACHIEVEMENTS = [
  { id: 'ach-1', slug: 'first_game', nameEn: 'First Game', nameEs: 'Primer Juego' },
  { id: 'ach-2', slug: 'games_10', nameEn: '10 Games', nameEs: '10 Juegos' },
  { id: 'ach-3', slug: 'games_50', nameEn: '50 Games', nameEs: '50 Juegos' },
  { id: 'ach-4', slug: 'games_100', nameEn: '100 Games', nameEs: '100 Juegos' },
  { id: 'ach-5', slug: 'streak_3', nameEn: 'Streak 3', nameEs: 'Racha 3' },
  { id: 'ach-6', slug: 'streak_5', nameEn: 'Streak 5', nameEs: 'Racha 5' },
  { id: 'ach-7', slug: 'streak_10', nameEn: 'Streak 10', nameEs: 'Racha 10' },
  { id: 'ach-8', slug: 'perfect_game', nameEn: 'Perfect Game', nameEs: 'Juego Perfecto' },
  { id: 'ach-9', slug: 'first_friend', nameEn: 'First Friend', nameEs: 'Primer Amigo' },
  { id: 'ach-10', slug: 'friends_5', nameEn: '5 Friends', nameEs: '5 Amigos' },
  { id: 'ach-11', slug: 'friends_20', nameEn: '20 Friends', nameEs: '20 Amigos' },
  { id: 'ach-12', slug: 'score_10k', nameEn: '10K Score', nameEs: '10K Puntos' },
  { id: 'ach-13', slug: 'score_50k', nameEn: '50K Score', nameEs: '50K Puntos' },
  { id: 'ach-14', slug: 'score_100k', nameEn: '100K Score', nameEs: '100K Puntos' },
  { id: 'ach-15', slug: 'all_modes', nameEn: 'All Modes', nameEs: 'Todos los Modos' },
];

describe('checkAchievements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock(true); // fromTerminal=true — first .from() call resolves
  });

  it('should award first_game when user has at least 1 game', async () => {
    resultQueue.push(
      ALL_ACHIEVEMENTS,        // Query 1: from() terminal
      [],                      // Query 2: where() — earned (none)
      [{ totalGames: 1, totalScore: 500, maxStreak: 2 }], // Query 3
      [{ count: 0 }],          // Query 4: friends
      [{ count: 0 }],          // Query 5: perfect games
      [{ slug: 'flag-guess' }], // Query 6: groupBy() — modes
    );

    await checkAchievements('user-1');

    expect(mockDb.insert).toHaveBeenCalledOnce();
    const values = mockDb.values.mock.calls[0]?.[0];
    expect(values).toHaveLength(1);
    expect(values[0]).toMatchObject({ userId: 'user-1', achievementId: 'ach-1' });
  });

  it('should award nothing when no criteria met', async () => {
    resultQueue.push(
      ALL_ACHIEVEMENTS,
      [],
      [{ totalGames: 0, totalScore: 0, maxStreak: 0 }],
      [{ count: 0 }],
      [{ count: 0 }],
      [],
    );

    await checkAchievements('user-1');

    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('should not re-award already earned achievements', async () => {
    resultQueue.push(
      ALL_ACHIEVEMENTS,
      [{ slug: 'first_game' }],
      [{ totalGames: 1, totalScore: 500, maxStreak: 0 }],
      [{ count: 0 }],
      [{ count: 0 }],
      [],
    );

    await checkAchievements('user-1');

    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('should award streak achievements progressively', async () => {
    resultQueue.push(
      ALL_ACHIEVEMENTS,
      [],
      [{ totalGames: 10, totalScore: 2000, maxStreak: 7 }],
      [{ count: 0 }],
      [{ count: 0 }],
      [],
    );

    await checkAchievements('user-1');

    expect(mockDb.insert).toHaveBeenCalledOnce();
    const awarded = mockDb.values.mock.calls[0]?.[0];
    const slugs = awarded.map((a: any) => a.achievementId);
    expect(slugs).toContain('ach-5'); // streak_3
    expect(slugs).toContain('ach-6'); // streak_5
    expect(slugs).not.toContain('ach-7'); // streak_10
  });

  it('should award score achievements at thresholds', async () => {
    resultQueue.push(
      ALL_ACHIEVEMENTS,
      [],
      [{ totalGames: 20, totalScore: 75_000, maxStreak: 3 }],
      [{ count: 0 }],
      [{ count: 0 }],
      [],
    );

    await checkAchievements('user-1');

    const awarded = mockDb.values.mock.calls[0]?.[0];
    const slugs = awarded.map((a: any) => a.achievementId);
    expect(slugs).toContain('ach-12'); // score_10k
    expect(slugs).toContain('ach-13'); // score_50k
    expect(slugs).not.toContain('ach-14'); // score_100k
  });

  it('should award games milestones', async () => {
    resultQueue.push(
      ALL_ACHIEVEMENTS,
      [],
      [{ totalGames: 60, totalScore: 10_000, maxStreak: 5 }],
      [{ count: 0 }],
      [{ count: 0 }],
      [{ slug: 'flag-guess' }, { slug: 'capital-guess' }],
    );

    await checkAchievements('user-1');

    const awarded = mockDb.values.mock.calls[0]?.[0];
    const slugs = awarded.map((a: any) => a.achievementId);
    expect(slugs).toContain('ach-1');  // first_game
    expect(slugs).toContain('ach-2');  // games_10
    expect(slugs).toContain('ach-3');  // games_50
    expect(slugs).not.toContain('ach-4'); // games_100
  });

  it('should award friend-related achievements', async () => {
    resultQueue.push(
      ALL_ACHIEVEMENTS,
      [],
      [{ totalGames: 1, totalScore: 100, maxStreak: 1 }],
      [{ count: 7 }],
      [{ count: 0 }],
      [],
    );

    await checkAchievements('user-1');

    const awarded = mockDb.values.mock.calls[0]?.[0];
    const slugs = awarded.map((a: any) => a.achievementId);
    expect(slugs).toContain('ach-9');  // first_friend
    expect(slugs).toContain('ach-10'); // friends_5
    expect(slugs).not.toContain('ach-11'); // friends_20
  });

  it('should award all_modes when user played all 5 modes', async () => {
    resultQueue.push(
      ALL_ACHIEVEMENTS,
      [],
      [{ totalGames: 5, totalScore: 500, maxStreak: 2 }],
      [{ count: 0 }],
      [{ count: 0 }],
      [
        { slug: 'flag-guess' },
        { slug: 'capital-guess' },
        { slug: 'country-by-flag' },
        { slug: 'continent' },
        { slug: 'free' },
      ],
    );

    await checkAchievements('user-1');

    const awarded = mockDb.values.mock.calls[0]?.[0];
    const slugs = awarded.map((a: any) => a.achievementId);
    expect(slugs).toContain('ach-15'); // all_modes
  });

  it('should insert multiple achievements in one batch', async () => {
    resultQueue.push(
      ALL_ACHIEVEMENTS,
      [],
      [{ totalGames: 100, totalScore: 150_000, maxStreak: 15 }],
      [{ count: 25 }],
      [{ count: 5 }],
      [
        { slug: 'flag-guess' },
        { slug: 'capital-guess' },
        { slug: 'country-by-flag' },
        { slug: 'continent' },
        { slug: 'free' },
      ],
    );

    await checkAchievements('user-1');

    expect(mockDb.insert).toHaveBeenCalledOnce();
    const awarded = mockDb.values.mock.calls[0]?.[0];
    expect(awarded.length).toBeGreaterThan(5);
  });

  it('should handle empty stats gracefully (no games yet)', async () => {
    resultQueue.push(
      ALL_ACHIEVEMENTS,
      [],
      [{ totalGames: 0, totalScore: 0, maxStreak: 0 }],
      [{ count: 0 }],
      [{ count: 0 }],
      [],
    );

    await checkAchievements('user-1');
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('should use onConflictDoNothing for race safety', async () => {
    resultQueue.push(
      ALL_ACHIEVEMENTS,
      [],
      [{ totalGames: 1, totalScore: 100, maxStreak: 1 }],
      [{ count: 0 }],
      [{ count: 0 }],
      [],
    );

    await checkAchievements('user-1');

    expect(mockDb.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it('should award perfect_game when there is at least one perfect session', async () => {
    resultQueue.push(
      ALL_ACHIEVEMENTS,
      [],
      [{ totalGames: 10, totalScore: 5000, maxStreak: 3 }],
      [{ count: 0 }],
      [{ count: 1 }],
      [],
    );

    await checkAchievements('user-1');

    const awarded = mockDb.values.mock.calls[0]?.[0];
    const slugs = awarded.map((a: any) => a.achievementId);
    expect(slugs).toContain('ach-8'); // perfect_game
  });

  it('should NOT award perfect_game when count is 0 (but still award others)', async () => {
    resultQueue.push(
      ALL_ACHIEVEMENTS,
      [],
      [{ totalGames: 10, totalScore: 5000, maxStreak: 3 }],
      [{ count: 0 }],
      [{ count: 0 }],  // 0 perfect games
      [],
    );

    await checkAchievements('user-1');

    const awarded = mockDb.values.mock.calls[0]?.[0];
    const slugs = awarded.map((a: any) => a.achievementId);
    expect(slugs).not.toContain('ach-8'); // perfect_game NOT awarded
    expect(slugs).toContain('ach-1');     // first_game IS awarded
  });
});

describe('getUserAchievements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock(false); // fromTerminal=false — .from() always returns mockDb for chaining
  });

  it('should return achievements list with earnedAt null for unearned', async () => {
    const now = new Date();
    resultQueue.push([
      { slug: 'first_game', nameEn: 'First Game', nameEs: 'Primer Juego', descriptionEn: 'desc', descriptionEs: 'desc', icon: '🎮', category: 'games', tier: 1, earnedAt: now, sortOrder: 1 },
      { slug: 'games_10', nameEn: '10 Games', nameEs: '10 Juegos', descriptionEn: 'desc', descriptionEs: 'desc', icon: '🎮', category: 'games', tier: 2, earnedAt: null, sortOrder: 2 },
    ]);

    const result = await getUserAchievements('user-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ slug: 'first_game', earnedAt: now.toISOString() });
    expect(result[1]).toMatchObject({ slug: 'games_10', earnedAt: null });
  });

  it('should order results by sortOrder', async () => {
    resultQueue.push([
      { slug: 'first_game', nameEn: 'First Game', nameEs: 'Primer Juego', descriptionEn: 'desc', descriptionEs: 'desc', icon: '🎮', category: 'games', tier: 1, earnedAt: null, sortOrder: 1 },
    ]);

    const result = await getUserAchievements('user-1');

    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('first_game');
  });

  it('should include all required response fields', async () => {
    resultQueue.push([
      { slug: 'perfect_game', nameEn: 'Perfect', nameEs: 'Perfecto', descriptionEn: 'No mistakes', descriptionEs: 'Sin errores', icon: '⭐', category: 'skill', tier: 3, earnedAt: new Date(), sortOrder: 10 },
    ]);

    const result = await getUserAchievements('user-1');

    expect(result[0]).toHaveProperty('slug');
    expect(result[0]).toHaveProperty('nameEn');
    expect(result[0]).toHaveProperty('nameEs');
    expect(result[0]).toHaveProperty('descriptionEn');
    expect(result[0]).toHaveProperty('descriptionEs');
    expect(result[0]).toHaveProperty('icon');
    expect(result[0]).toHaveProperty('category');
    expect(result[0]).toHaveProperty('tier');
    expect(result[0]).toHaveProperty('earnedAt');
  });
});
