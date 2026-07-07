import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { gameModes } from '../src/db/schema/gameModes.js';

async function seedModes() {
  const queryClient = postgres(process.env.DATABASE_URL!);
  const db = drizzle(queryClient);

  const baseModes = [
    {
      slug: 'flag-guess',
      nameEn: 'Flag Guess',
      nameEs: 'Adivinar Bandera',
      descriptionEn: 'Guess the country from its flag',
      descriptionEs: 'Adiviná el país por su bandera',
      timerSeconds: 15,
      lives: 3,
      multiplier: 1.0,
    },
    {
      slug: 'capital-guess',
      nameEn: 'Capital Guess',
      nameEs: 'Adivinar Capital',
      descriptionEn: 'Guess the capital from the country',
      descriptionEs: 'Adiviná la capital del país',
      timerSeconds: 20,
      lives: 3,
      multiplier: 1.2,
    },
    {
      slug: 'country-by-flag',
      nameEn: 'Country by Flag',
      nameEs: 'País por Bandera',
      descriptionEn: 'Pick the correct flag for the country',
      descriptionEs: 'Elegí la bandera correcta para el país',
      timerSeconds: 15,
      lives: 3,
      multiplier: 1.0,
    },
    {
      slug: 'continent',
      nameEn: 'Continent Quiz',
      nameEs: 'Quiz de Continentes',
      descriptionEn: 'Guess which continent a country belongs to',
      descriptionEs: 'Adiviná el continente del país',
      timerSeconds: 10,
      lives: 3,
      multiplier: 0.8,
    },
    {
      slug: 'free',
      nameEn: 'Free Mode',
      nameEs: 'Modo Libre',
      descriptionEn: 'Mixed questions from all categories',
      descriptionEs: 'Preguntas mezcladas de todas las categorías',
      timerSeconds: 15,
      lives: 5,
      multiplier: 1.0,
    },
  ];

  // Build variant rows: express (totalQuestions=30) + unlimited (null) for each base
  const modes: (typeof baseModes[number] & { totalQuestions?: number | null })[] = [
    ...baseModes,
    ...baseModes.flatMap((base) => [
      {
        slug: `${base.slug}-express` as const,
        nameEn: `${base.nameEn} (Express)`,
        nameEs: `${base.nameEs} (Express)`,
        descriptionEn: `${base.descriptionEn} — 30 questions limit`,
        descriptionEs: `${base.descriptionEs} — límite de 30 preguntas`,
        timerSeconds: base.timerSeconds,
        lives: base.lives,
        multiplier: base.multiplier,
        totalQuestions: 30,
      },
      {
        slug: `${base.slug}-unlimited` as const,
        nameEn: `${base.nameEn} (Unlimited)`,
        nameEs: `${base.nameEs} (Ilimitado)`,
        descriptionEn: `${base.descriptionEn} — all countries, no limit`,
        descriptionEs: `${base.descriptionEs} — todos los países, sin límite`,
        timerSeconds: base.timerSeconds,
        lives: base.lives,
        multiplier: base.multiplier,
        totalQuestions: null,
      },
    ]),
  ];

  for (const m of modes) {
    await db.insert(gameModes).values(m).onConflictDoNothing({ target: gameModes.slug });
    console.log(`  ✓ ${m.slug}${m.totalQuestions !== undefined ? ` (totalQuestions=${m.totalQuestions})` : ''}`);
  }

  console.log(`Done: ${modes.length} game modes inserted`);
  await queryClient.end();
  process.exit(0);
}

seedModes().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
