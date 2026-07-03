import { db } from '../db/index.js';
import { achievements, userAchievements, gameSessions, gameModes, friends } from '../db/schema/index.js';
import { eq, and, or, sql, inArray } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AchievementResponse {
  slug: string;
  nameEn: string;
  nameEs: string;
  descriptionEn: string;
  descriptionEs: string;
  icon: string;
  category: string;
  tier: number | null;
  earnedAt: string | null;
}

// ---------------------------------------------------------------------------
// Check achievements after a game or social event
// ---------------------------------------------------------------------------

export async function checkAchievements(userId: string): Promise<void> {
  // All achievements in the catalogue
  const allAchievements = await db.select().from(achievements);

  // Already earned slugs
  const earned = await db
    .select({ slug: achievements.slug })
    .from(userAchievements)
    .innerJoin(achievements, eq(achievements.id, userAchievements.achievementId))
    .where(eq(userAchievements.userId, userId));

  const earnedSlugs = new Set(earned.map((e) => e.slug));

  // ── Stats queries ───────────────────────────────────────────────
  const [stats] = await db
    .select({
      totalGames: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      totalScore: sql<number>`CAST(COALESCE(SUM(${gameSessions.score}), 0) AS INTEGER)`,
      maxStreak: sql<number>`CAST(COALESCE(MAX(${gameSessions.streakMax}), 0) AS INTEGER)`,
    })
    .from(gameSessions)
    .where(
      and(eq(gameSessions.userId, userId), eq(gameSessions.isActive, false)),
    );

  const [friendCountResult] = await db
    .select({ count: sql<number>`CAST(COUNT(*) AS INTEGER)` })
    .from(friends)
    .where(
      and(
        or(eq(friends.userId, userId), eq(friends.friendId, userId)),
        eq(friends.status, 'accepted'),
      ),
    );

  const [perfectGames] = await db
    .select({ count: sql<number>`CAST(COUNT(*) AS INTEGER)` })
    .from(gameSessions)
    .where(
      and(
        eq(gameSessions.userId, userId),
        eq(gameSessions.isActive, false),
        sql`${gameSessions.correctCount} = ${gameSessions.totalQuestions}`,
        sql`${gameSessions.totalQuestions} > 0`,
      ),
    );

  // Game mode diversity
  const modesPlayed = await db
    .select({ slug: gameModes.slug })
    .from(gameSessions)
    .innerJoin(gameModes, eq(gameModes.id, gameSessions.gameModeId))
    .where(
      and(eq(gameSessions.userId, userId), eq(gameSessions.isActive, false)),
    )
    .groupBy(gameModes.slug);

  const modeSlugs = new Set(modesPlayed.map((m) => m.slug));

  const totalGames = stats?.totalGames ?? 0;
  const totalScore = stats?.totalScore ?? 0;
  const maxStreak = stats?.maxStreak ?? 0;
  const friendCount = friendCountResult?.count ?? 0;
  const perfectGameCount = perfectGames?.count ?? 0;

  // ── Evaluate each achievement ───────────────────────────────────
  const toAward: { userId: string; achievementId: string }[] = [];

  for (const ach of allAchievements) {
    if (earnedSlugs.has(ach.slug)) continue;

    let earned = false;

    switch (ach.slug) {
      case 'first_game':
        earned = totalGames >= 1;
        break;
      case 'games_10':
        earned = totalGames >= 10;
        break;
      case 'games_50':
        earned = totalGames >= 50;
        break;
      case 'games_100':
        earned = totalGames >= 100;
        break;
      case 'streak_3':
        earned = maxStreak >= 3;
        break;
      case 'streak_5':
        earned = maxStreak >= 5;
        break;
      case 'streak_10':
        earned = maxStreak >= 10;
        break;
      case 'perfect_game':
        earned = perfectGameCount > 0;
        break;
      case 'first_friend':
        earned = friendCount >= 1;
        break;
      case 'friends_5':
        earned = friendCount >= 5;
        break;
      case 'friends_20':
        earned = friendCount >= 20;
        break;
      case 'score_10k':
        earned = totalScore >= 10_000;
        break;
      case 'score_50k':
        earned = totalScore >= 50_000;
        break;
      case 'score_100k':
        earned = totalScore >= 100_000;
        break;
      case 'all_modes':
        earned = modeSlugs.size >= 5;
        break;
    }

    if (earned) {
      toAward.push({ userId, achievementId: ach.id });
    }
  }

  if (toAward.length > 0) {
    await db.insert(userAchievements).values(toAward).onConflictDoNothing();
  }
}

// ---------------------------------------------------------------------------
// Get user achievements for profile display
// ---------------------------------------------------------------------------

export async function getUserAchievements(userId: string): Promise<AchievementResponse[]> {
  const rows = await db
    .select({
      slug: achievements.slug,
      nameEn: achievements.nameEn,
      nameEs: achievements.nameEs,
      descriptionEn: achievements.descriptionEn,
      descriptionEs: achievements.descriptionEs,
      icon: achievements.icon,
      category: achievements.category,
      tier: achievements.tier,
      earnedAt: userAchievements.earnedAt,
      sortOrder: achievements.sortOrder,
    })
    .from(achievements)
    .leftJoin(
      userAchievements,
      and(
        eq(userAchievements.achievementId, achievements.id),
        eq(userAchievements.userId, userId),
      ),
    )
    .orderBy(achievements.sortOrder);

  return rows.map((r) => ({
    slug: r.slug,
    nameEn: r.nameEn,
    nameEs: r.nameEs,
    descriptionEn: r.descriptionEn,
    descriptionEs: r.descriptionEs,
    icon: r.icon,
    category: r.category,
    tier: r.tier,
    earnedAt: r.earnedAt?.toISOString() ?? null,
  }));
}
