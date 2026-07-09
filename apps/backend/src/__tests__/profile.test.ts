import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock DB ────────────────────────────────────────────────────────────────
const waitData: any[] = [];

const mockGetUserAchievements = vi.hoisted(() => vi.fn());

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  innerJoin: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  onConflictDoNothing: vi.fn(),
  groupBy: vi.fn(),
  having: vi.fn(),
  as: vi.fn(),
  then(resolve: (value: any) => void) {
    const data = waitData.shift();
    resolve(data !== undefined ? data : []);
  },
  catch() {},
}));

vi.mock('../db/index.js', () => ({ db: mockDb }));
vi.mock('../auth/index.js', () => ({
  authGuard: vi.fn((request, _reply, done) => {
    (request as any).user = { userId: 'user-1', username: 'testuser' };
    done?.();
  }),
  signToken: vi.fn(() => 'mock-token'),
  verifyToken: vi.fn(() => ({ userId: 'user-1', username: 'testuser' })),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('../services/achievements.js', () => ({
  getUserAchievements: mockGetUserAchievements,
}));

import { profileRoutes } from '../routes/profile.js';
import Fastify from 'fastify';

function setupMockDbChain() {
  waitData.length = 0;
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.where.mockReturnThis();
  mockDb.orderBy.mockReturnThis();
  mockDb.limit.mockReturnThis();
  mockDb.innerJoin.mockReturnThis();
  mockDb.insert.mockReturnThis();
  mockDb.values.mockReturnThis();
  mockDb.returning.mockReturnThis();
  mockDb.update.mockReturnThis();
  mockDb.set.mockReturnThis();
  mockDb.delete.mockReturnThis();
  mockDb.onConflictDoNothing.mockReturnThis();
  mockDb.groupBy.mockReturnThis();
  mockDb.having.mockReturnThis();
  mockDb.as.mockReturnThis();
}

async function buildApp() {
  const app = Fastify();
  await app.register(profileRoutes);
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────
const NOW = new Date('2026-07-06T12:00:00Z');

const PROFILE_USER = {
  id: 'user-1',
  username: 'testuser',
  displayName: 'Test User',
  avatarUrl: null,
  bio: 'Hello!',
  createdAt: NOW,
};

const SCORE_STATS = {
  totalScore: 15000,
  totalGames: 42,
  bestScore: 2500,
};

const FRIEND_COUNT = { count: 7 };

const RECENT_GAMES = [
  {
    id: 'game-1',
    score: 1200,
    correctCount: 10,
    totalQuestions: 12,
    gameModeSlug: 'flag-guess',
    gameModeNameEn: 'Flag Guess',
    completedAt: NOW,
  },
  {
    id: 'game-2',
    score: 800,
    correctCount: 6,
    totalQuestions: 10,
    gameModeSlug: 'capital-guess',
    gameModeNameEn: 'Capital Guess',
    completedAt: new Date('2026-07-05T10:00:00Z'),
  },
];

const ACHIEVEMENTS = [
  { slug: 'first_game', nameEn: 'First Game', nameEs: 'Primer Juego', earnedAt: NOW.toISOString() },
];

describe('GET /api/users/:id/profile', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDbChain();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return full profile with stats and recent games', async () => {
    // 6 DB queries + 1 external service call
    waitData.push([PROFILE_USER]);           // Q1: user lookup → .limit(1)
    waitData.push([SCORE_STATS]);             // Q2: score stats → .where()
    waitData.push([{ count: 5 }]);             // Q3: global rank → .having()
    waitData.push([FRIEND_COUNT]);             // Q4: friend count → .where()
    waitData.push([{ count: 5 }]);             // Q5: perfect games → .where()
    waitData.push([{ maxStreak: 12 }]);        // Q6: best streak → .where()
    waitData.push(RECENT_GAMES);               // Q7: recent games → .limit(10)
    mockGetUserAchievements.mockResolvedValueOnce(ACHIEVEMENTS);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-1/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.user).toMatchObject({
      id: 'user-1',
      username: 'testuser',
      displayName: 'Test User',
    });
    expect(body.stats).toMatchObject({
      totalScore: 15000,
      totalGames: 42,
      bestScore: 2500,
      friends: 7,
      perfectGames: 5,
      bestStreak: 12,
    });
    expect(body.recentGames).toHaveLength(2);
    expect(body.recentGames[0]).toMatchObject({
      id: 'game-1',
      gameMode: 'flag-guess',
    });
    expect(body.achievements).toEqual(ACHIEVEMENTS);
  });

  it('should return 404 when user does not exist', async () => {
    waitData.push([]); // Q1: empty → not found

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/nonexistent/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('User not found');
  });

  it('should handle null score stats gracefully', async () => {
    waitData.push([PROFILE_USER]);
    waitData.push([]); // Q2: empty stats → defaults to 0
    waitData.push([FRIEND_COUNT]);
    waitData.push([{ count: 0 }]);    // Q4: perfect games
    waitData.push([{ maxStreak: 0 }]); // Q5: best streak
    waitData.push(RECENT_GAMES);        // Q6: recent games
    mockGetUserAchievements.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-1/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.stats).toMatchObject({
      totalScore: 0,
      totalGames: 0,
      bestScore: 0,
      perfectGames: 0,
      bestStreak: 0,
    });
  });

  it('should handle zero friends', async () => {
    waitData.push([PROFILE_USER]);
    waitData.push([SCORE_STATS]);
    waitData.push([{ count: 5 }]);     // Q3: global rank → .having()
    waitData.push([{ count: 0 }]);     // Q4: friend count → .where()
    waitData.push([{ count: 0 }]);     // Q5: perfect games → .where()
    waitData.push([{ maxStreak: 0 }]); // Q6: best streak → .where()
    waitData.push(RECENT_GAMES);        // Q7: recent games → .limit(10)
    mockGetUserAchievements.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-1/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).stats.friends).toBe(0);
  });

  it('should return empty recent games list', async () => {
    waitData.push([PROFILE_USER]);
    waitData.push([SCORE_STATS]);
    waitData.push([{ count: 5 }]);     // Q3: global rank → .having()
    waitData.push([FRIEND_COUNT]);
    waitData.push([{ count: 0 }]);     // Q5: perfect games → .where()
    waitData.push([{ maxStreak: 0 }]); // Q6: best streak → .where()
    waitData.push([]);                 // Q7: no recent games
    mockGetUserAchievements.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-1/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).recentGames).toEqual([]);
  });

  it('should return friendshipStatus=self when viewing own profile', async () => {
    waitData.push([PROFILE_USER]);           // Q1: user lookup
    waitData.push([SCORE_STATS]);             // Q2: score stats
    waitData.push([{ count: 5 }]);            // Q3: global rank
    waitData.push([FRIEND_COUNT]);            // Q4: friend count
    waitData.push([{ count: 5 }]);            // Q5: perfect games
    waitData.push([{ maxStreak: 12 }]);       // Q6: best streak
    waitData.push(RECENT_GAMES);              // Q7: recent games
    mockGetUserAchievements.mockResolvedValueOnce(ACHIEVEMENTS);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-1/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.friendshipStatus).toBe('self');
    expect(body.friendRequestId).toBeNull();
  });

  it('should return friendshipStatus=accepted when viewing a friend', async () => {
    const OTHER_USER = { ...PROFILE_USER, id: 'user-2', username: 'friend2' };
    waitData.push([OTHER_USER]);         // Q1: user lookup
    waitData.push([SCORE_STATS]);         // Q2: score stats
    waitData.push([{ count: 5 }]);        // Q3: global rank
    waitData.push([FRIEND_COUNT]);        // Q4: friend count
    waitData.push([{ count: 5 }]);        // Q5: perfect games
    waitData.push([{ maxStreak: 12 }]);   // Q6: best streak
    waitData.push(RECENT_GAMES);          // Q7: recent games
    mockGetUserAchievements.mockResolvedValueOnce(ACHIEVEMENTS);
    // Q8: friendship relation
    waitData.push([{ userId: 'user-1', friendId: 'user-2', status: 'accepted' }]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-2/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.friendshipStatus).toBe('accepted');
    expect(body.friendRequestId).toBeNull();
  });

  it('should return friendshipStatus=outgoing when user sent pending request', async () => {
    const OTHER_USER = { ...PROFILE_USER, id: 'user-2', username: 'pending2' };
    waitData.push([OTHER_USER]);
    waitData.push([SCORE_STATS]);
    waitData.push([{ count: 5 }]);
    waitData.push([FRIEND_COUNT]);
    waitData.push([{ count: 5 }]);
    waitData.push([{ maxStreak: 12 }]);
    waitData.push(RECENT_GAMES);
    mockGetUserAchievements.mockResolvedValueOnce(ACHIEVEMENTS);
    // Q8: outgoing pending — current user sent the request
    waitData.push([{ userId: 'user-1', friendId: 'user-2', status: 'pending' }]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-2/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.friendshipStatus).toBe('outgoing');
    expect(body.friendRequestId).toBeNull();
  });

  it('should return friendshipStatus=incoming with friendRequestId', async () => {
    const OTHER_USER = { ...PROFILE_USER, id: 'user-2', username: 'sender2' };
    waitData.push([OTHER_USER]);
    waitData.push([SCORE_STATS]);
    waitData.push([{ count: 5 }]);
    waitData.push([FRIEND_COUNT]);
    waitData.push([{ count: 5 }]);
    waitData.push([{ maxStreak: 12 }]);
    waitData.push(RECENT_GAMES);
    mockGetUserAchievements.mockResolvedValueOnce(ACHIEVEMENTS);
    // Q8: incoming pending — other user sent the request
    waitData.push([{ userId: 'user-2', friendId: 'user-1', status: 'pending' }]);
    // Q9: friend request id lookup
    waitData.push([{ id: 'req-42' }]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-2/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.friendshipStatus).toBe('incoming');
    expect(body.friendRequestId).toBe('req-42');
  });

  it('should return friendshipStatus=blocked', async () => {
    const OTHER_USER = { ...PROFILE_USER, id: 'user-2', username: 'blocked2' };
    waitData.push([OTHER_USER]);
    waitData.push([SCORE_STATS]);
    waitData.push([{ count: 5 }]);
    waitData.push([FRIEND_COUNT]);
    waitData.push([{ count: 5 }]);
    waitData.push([{ maxStreak: 12 }]);
    waitData.push(RECENT_GAMES);
    mockGetUserAchievements.mockResolvedValueOnce(ACHIEVEMENTS);
    // Q8: blocked status
    waitData.push([{ userId: 'user-1', friendId: 'user-2', status: 'blocked' }]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-2/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.friendshipStatus).toBe('blocked');
  });

  it('should return friendshipStatus=none when no relationship exists', async () => {
    const OTHER_USER = { ...PROFILE_USER, id: 'user-2', username: 'stranger' };
    waitData.push([OTHER_USER]);
    waitData.push([SCORE_STATS]);
    waitData.push([{ count: 5 }]);
    waitData.push([FRIEND_COUNT]);
    waitData.push([{ count: 5 }]);
    waitData.push([{ maxStreak: 12 }]);
    waitData.push(RECENT_GAMES);
    mockGetUserAchievements.mockResolvedValueOnce(ACHIEVEMENTS);
    // Q8: no relation found
    waitData.push([]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-2/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.friendshipStatus).toBe('none');
  });

  it('should set globalRank to 1 when user has the best score (no one ranks higher)', async () => {
    waitData.push([PROFILE_USER]);           // Q1: user lookup
    waitData.push([SCORE_STATS]);             // Q2: score stats (bestScore=2500)
    waitData.push([]);                        // Q3: global rank → empty → no one is higher
    waitData.push([FRIEND_COUNT]);            // Q4: friend count
    waitData.push([{ count: 5 }]);            // Q5: perfect games
    waitData.push([{ maxStreak: 12 }]);       // Q6: best streak
    waitData.push(RECENT_GAMES);              // Q7: recent games
    mockGetUserAchievements.mockResolvedValueOnce(ACHIEVEMENTS);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-1/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.stats.globalRank).toBe(1);
  });

  it('should set globalRank to undefined when bestScore is 0', async () => {
    const ZERO_SCORE = { totalScore: 0, totalGames: 0, bestScore: 0 };
    waitData.push([PROFILE_USER]);           // Q1: user lookup
    waitData.push([ZERO_SCORE]);             // Q2: score stats (bestScore=0)
    waitData.push([FRIEND_COUNT]);           // Q3: friend count
    waitData.push([{ count: 0 }]);           // Q4: perfect games
    waitData.push([{ maxStreak: 0 }]);       // Q5: best streak
    waitData.push([]);                       // Q6: recent games
    mockGetUserAchievements.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-1/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.stats.bestScore).toBe(0);
    expect(body.stats.globalRank).toBeUndefined();
  });

  it('should default friends to 0 when friend count query returns empty', async () => {
    waitData.push([PROFILE_USER]);           // Q1: user lookup
    waitData.push([SCORE_STATS]);             // Q2: score stats
    waitData.push([{ count: 5 }]);            // Q3: global rank
    waitData.push([]);                        // Q4: friend count → empty → friendCountResult = undefined
    waitData.push([{ count: 5 }]);            // Q5: perfect games
    waitData.push([{ maxStreak: 12 }]);       // Q6: best streak
    waitData.push(RECENT_GAMES);              // Q7: recent games
    mockGetUserAchievements.mockResolvedValueOnce(ACHIEVEMENTS);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-1/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.stats.friends).toBe(0);
  });

  it('should default perfectGames to 0 when perfect games query returns empty', async () => {
    waitData.push([PROFILE_USER]);           // Q1: user lookup
    waitData.push([SCORE_STATS]);             // Q2: score stats
    waitData.push([{ count: 5 }]);            // Q3: global rank
    waitData.push([FRIEND_COUNT]);            // Q4: friend count
    waitData.push([]);                        // Q5: perfect games → empty → perfectResult = undefined
    waitData.push([{ maxStreak: 12 }]);       // Q6: best streak
    waitData.push(RECENT_GAMES);              // Q7: recent games
    mockGetUserAchievements.mockResolvedValueOnce(ACHIEVEMENTS);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-1/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.stats.perfectGames).toBe(0);
  });

  it('should default bestStreak to 0 when streak query returns empty', async () => {
    waitData.push([PROFILE_USER]);           // Q1: user lookup
    waitData.push([SCORE_STATS]);             // Q2: score stats
    waitData.push([{ count: 5 }]);            // Q3: global rank
    waitData.push([FRIEND_COUNT]);            // Q4: friend count
    waitData.push([{ count: 5 }]);            // Q5: perfect games
    waitData.push([]);                        // Q6: best streak → empty → streakResult = undefined
    waitData.push(RECENT_GAMES);              // Q7: recent games
    mockGetUserAchievements.mockResolvedValueOnce(ACHIEVEMENTS);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-1/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.stats.bestStreak).toBe(0);
  });
});

describe('GET /api/users/:targetUserId/profile — friendship status (different user)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  const TARGET_USER = {
    id: 'user-2',
    username: 'targetuser',
    displayName: 'Target User',
    avatarUrl: 'https://example.com/avatar.png',
    bio: 'I am the target',
    createdAt: NOW,
  };

  const SCORE_STATS_TARGET = {
    totalScore: 5000,
    totalGames: 10,
    bestScore: 1200,
  };

  const RECENT_GAMES_TARGET = [
    {
      id: 'game-10',
      score: 900,
      correctCount: 8,
      totalQuestions: 10,
      gameModeSlug: 'flag-guess',
      gameModeNameEn: 'Flag Guess',
      completedAt: NOW,
    },
  ];

  const TARGET_ACHIEVEMENTS = [
    { slug: 'first_game', nameEn: 'First Game', nameEs: 'Primer Juego', earnedAt: NOW.toISOString() },
  ];

  function pushCommonQueries(targetAchievements: any[] = TARGET_ACHIEVEMENTS) {
    waitData.push([TARGET_USER]);             // Q1: user lookup
    waitData.push([SCORE_STATS_TARGET]);       // Q2: score stats
    waitData.push([{ count: 3 }]);             // Q3: global rank
    waitData.push([{ count: 2 }]);             // Q4: friend count
    waitData.push([{ count: 1 }]);             // Q5: perfect games
    waitData.push([{ maxStreak: 5 }]);         // Q6: best streak
    waitData.push(RECENT_GAMES_TARGET);        // Q7: recent games
    mockGetUserAchievements.mockResolvedValueOnce(targetAchievements);
    // friendship relation query (Q8) and optional incoming query (Q9)
    // are pushed by each test
  }

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDbChain();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return friendshipStatus "none" when no friendship exists', async () => {
    pushCommonQueries();
    waitData.push([]); // Q8: no friendship relation found → returns []

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-2/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    // Friendship fields
    expect(body.friendshipStatus).toBe('none');
    expect(body.friendRequestId).toBeNull();

    // Profile fields
    expect(body.user).toMatchObject({
      id: 'user-2',
      username: 'targetuser',
      displayName: 'Target User',
      avatarUrl: 'https://example.com/avatar.png',
      bio: 'I am the target',
    });
    expect(body.stats).toMatchObject({
      totalScore: 5000,
      totalGames: 10,
      bestScore: 1200,
    });
    expect(body.recentGames).toHaveLength(1);
    expect(body.recentGames[0].gameMode).toBe('flag-guess');
    expect(body.achievements).toEqual(TARGET_ACHIEVEMENTS);
  });

  it('should return friendshipStatus "accepted" when users are friends', async () => {
    pushCommonQueries();
    // Q8: friendship relation found — accepted, currentUser is userId
    waitData.push([{ id: 'rel-1', userId: 'user-1', friendId: 'user-2', status: 'accepted' }]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-2/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.friendshipStatus).toBe('accepted');
    expect(body.friendRequestId).toBeNull();

    // Profile fields still correct
    expect(body.user.username).toBe('targetuser');
    expect(body.stats.totalScore).toBe(5000);
    expect(body.recentGames).toHaveLength(1);
    expect(body.achievements).toEqual(TARGET_ACHIEVEMENTS);
  });

  it('should return friendshipStatus "accepted" when currentUser is the friendId', async () => {
    pushCommonQueries();
    // Q8: friendship relation found — accepted, currentUser is the friendId
    waitData.push([{ id: 'rel-2', userId: 'user-2', friendId: 'user-1', status: 'accepted' }]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-2/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.friendshipStatus).toBe('accepted');
    expect(body.friendRequestId).toBeNull();
  });

  it('should return friendshipStatus "outgoing" when current user sent a pending request', async () => {
    pushCommonQueries();
    // Q8: friendship relation — pending, currentUser is userId (sent by us)
    waitData.push([{ id: 'rel-3', userId: 'user-1', friendId: 'user-2', status: 'pending' }]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-2/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.friendshipStatus).toBe('outgoing');
    expect(body.friendRequestId).toBeNull(); // only incoming has friendRequestId

    expect(body.user.username).toBe('targetuser');
    expect(body.stats.totalScore).toBe(5000);
  });

  it('should return friendshipStatus "incoming" with friendRequestId when target sent a pending request', async () => {
    pushCommonQueries();
    // Q8: incoming — target user sent request to current user
    waitData.push([{ id: 'rel-4', userId: 'user-2', friendId: 'user-1', status: 'pending' }]);
    // Q9: fetch friend request ID for incoming request
    waitData.push([{ id: 'req-incoming-1' }]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-2/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.friendshipStatus).toBe('incoming');
    expect(body.friendRequestId).toBe('req-incoming-1');

    expect(body.user.username).toBe('targetuser');
    expect(body.stats.totalScore).toBe(5000);
  });

  it('should return friendRequestId as null when incoming query returns empty', async () => {
    pushCommonQueries();
    // Q8: pending — target sent to currentUser
    waitData.push([{ id: 'rel-5', userId: 'user-2', friendId: 'user-1', status: 'pending' }]);
    // Q9: incoming friend request ID query returns empty
    waitData.push([]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-2/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.friendshipStatus).toBe('incoming');
    expect(body.friendRequestId).toBeNull();
  });

  it('should return friendshipStatus "blocked" when current user blocked the target', async () => {
    pushCommonQueries();
    // Q8: blocked — currentUser blocked targetUser
    waitData.push([{ id: 'rel-6', userId: 'user-1', friendId: 'user-2', status: 'blocked' }]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-2/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.friendshipStatus).toBe('blocked');
    expect(body.friendRequestId).toBeNull();

    expect(body.user.username).toBe('targetuser');
    expect(body.stats.totalScore).toBe(5000);
  });

  it('should return friendshipStatus "blocked" when target blocked the current user', async () => {
    waitData.push([TARGET_USER]);             // Q1: user lookup
    waitData.push([SCORE_STATS_TARGET]);       // Q2: score stats
    waitData.push([{ count: 5 }]);             // Q3: global rank
    waitData.push([{ count: 2 }]);             // Q4: friend count
    waitData.push([{ count: 1 }]);             // Q5: perfect games
    waitData.push([{ maxStreak: 5 }]);         // Q6: best streak
    waitData.push(RECENT_GAMES_TARGET);        // Q7: recent games
    mockGetUserAchievements.mockResolvedValueOnce(TARGET_ACHIEVEMENTS);
    // Q8: blocked — targetUser blocked currentUser
    waitData.push([{ id: 'rel-7', userId: 'user-2', friendId: 'user-1', status: 'blocked' }]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-2/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.friendshipStatus).toBe('blocked');
    expect(body.friendRequestId).toBeNull();

    expect(body.user.username).toBe('targetuser');
  });
});
