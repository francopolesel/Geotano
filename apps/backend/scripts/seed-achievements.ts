import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { achievements } from '../src/db/schema/achievements.js';

async function seedAchievements() {
  const queryClient = postgres(process.env.DATABASE_URL!);
  const db = drizzle(queryClient);

  const allAchievements = [
    // ── Gameplay ──────────────────────────────────────────────────
    {
      slug: 'first_game',
      nameEn: 'First Game',
      nameEs: 'Primera Partida',
      descriptionEn: 'Complete your first quiz game',
      descriptionEs: 'Completá tu primera partida',
      icon: '🎮',
      category: 'gameplay',
      tier: null,
      sortOrder: 1,
    },
    {
      slug: 'games_10',
      nameEn: 'Getting Started',
      nameEs: 'Empezando',
      descriptionEn: 'Complete 10 games',
      descriptionEs: 'Completá 10 partidas',
      icon: '🎮',
      category: 'gameplay',
      tier: 1,
      sortOrder: 2,
    },
    {
      slug: 'games_50',
      nameEn: 'Dedicated Player',
      nameEs: 'Jugador Dedicado',
      descriptionEn: 'Complete 50 games',
      descriptionEs: 'Completá 50 partidas',
      icon: '🎮',
      category: 'gameplay',
      tier: 2,
      sortOrder: 3,
    },
    {
      slug: 'games_100',
      nameEn: 'Geography Master',
      nameEs: 'Maestro de Geografía',
      descriptionEn: 'Complete 100 games',
      descriptionEs: 'Completá 100 partidas',
      icon: '🎮',
      category: 'gameplay',
      tier: 3,
      sortOrder: 4,
    },
    {
      slug: 'streak_3',
      nameEn: 'On a Roll',
      nameEs: 'Racha',
      descriptionEn: 'Get a 3-answer streak',
      descriptionEs: 'Conseguí una racha de 3',
      icon: '🔥',
      category: 'gameplay',
      tier: 1,
      sortOrder: 5,
    },
    {
      slug: 'streak_5',
      nameEn: 'On Fire',
      nameEs: 'En llamas',
      descriptionEn: 'Get a 5-answer streak',
      descriptionEs: 'Conseguí una racha de 5',
      icon: '🔥',
      category: 'gameplay',
      tier: 2,
      sortOrder: 6,
    },
    {
      slug: 'streak_10',
      nameEn: 'Unstoppable',
      nameEs: 'Imparable',
      descriptionEn: 'Get a 10-answer streak',
      descriptionEs: 'Conseguí una racha de 10',
      icon: '🔥',
      category: 'gameplay',
      tier: 3,
      sortOrder: 7,
    },
    {
      slug: 'perfect_game',
      nameEn: 'Perfect Game',
      nameEs: 'Partida Perfecta',
      descriptionEn: 'Answer every question correctly in a single game',
      descriptionEs: 'Respondé bien todas las preguntas de una partida',
      icon: '💯',
      category: 'gameplay',
      tier: null,
      sortOrder: 8,
    },
    // ── Social ────────────────────────────────────────────────────
    {
      slug: 'first_friend',
      nameEn: 'First Friend',
      nameEs: 'Primer Amigo',
      descriptionEn: 'Add your first friend',
      descriptionEs: 'Agregá tu primer amigo',
      icon: '👥',
      category: 'social',
      tier: 1,
      sortOrder: 9,
    },
    {
      slug: 'friends_5',
      nameEn: 'Social Butterfly',
      nameEs: 'Mariposa Social',
      descriptionEn: 'Add 5 friends',
      descriptionEs: 'Agregá 5 amigos',
      icon: '👥',
      category: 'social',
      tier: 2,
      sortOrder: 10,
    },
    {
      slug: 'friends_20',
      nameEn: 'Popular',
      nameEs: 'Popular',
      descriptionEn: 'Add 20 friends',
      descriptionEs: 'Agregá 20 amigos',
      icon: '👥',
      category: 'social',
      tier: 3,
      sortOrder: 11,
    },
    // ── Mastery ────────────────────────────────────────────────────
    {
      slug: 'score_10k',
      nameEn: 'Score Collector',
      nameEs: 'Coleccionista de Puntos',
      descriptionEn: 'Reach 10,000 total score',
      descriptionEs: 'Alcanzá 10,000 puntos totales',
      icon: '🏆',
      category: 'mastery',
      tier: 1,
      sortOrder: 12,
    },
    {
      slug: 'score_50k',
      nameEn: 'High Scorer',
      nameEs: 'Puntuador Alto',
      descriptionEn: 'Reach 50,000 total score',
      descriptionEs: 'Alcanzá 50,000 puntos totales',
      icon: '🏆',
      category: 'mastery',
      tier: 2,
      sortOrder: 13,
    },
    {
      slug: 'score_100k',
      nameEn: 'Legendary',
      nameEs: 'Leyenda',
      descriptionEn: 'Reach 100,000 total score',
      descriptionEs: 'Alcanzá 100,000 puntos totales',
      icon: '🏆',
      category: 'mastery',
      tier: 3,
      sortOrder: 14,
    },
    {
      slug: 'all_modes',
      nameEn: 'World Traveler',
      nameEs: 'Viajero del Mundo',
      descriptionEn: 'Play all game modes at least once',
      descriptionEs: 'Jugá todos los modos de juego al menos una vez',
      icon: '🌍',
      category: 'mastery',
      tier: null,
      sortOrder: 15,
    },
  ];

  for (const ach of allAchievements) {
    await db.insert(achievements).values(ach).onConflictDoNothing({ target: achievements.slug });
    console.log(`  ✓ ${ach.slug}`);
  }

  console.log(`Done: ${allAchievements.length} achievements inserted`);
  await queryClient.end();
  process.exit(0);
}

seedAchievements().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
