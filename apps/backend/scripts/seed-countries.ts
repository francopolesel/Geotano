import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { countries } from '../src/db/schema/countries.js';
import { env } from '../src/config/env.js';
import { sql } from 'drizzle-orm';

// ─── Types ─────────────────────────────────────────────────────────────────

interface CountryData {
  cca2: string;
  cca3: string;
  name: { common: string; official: string };
  translations: Record<string, { common: string; official: string }>;
  capital: string[];
  region: string;
  subregion: string;
  unMember: boolean;
  area: number;
  borders: string[];
  timezones: string[];
  population: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function translateEs(c: CountryData): string {
  return c.translations?.spa?.common ?? c.name.common;
}

function getRegion(name: string): string {
  if (!name) return 'Unknown';
  return name;
}

function getContinent(region: string): string {
  // mledoze dataset uses standard regions that map to continents
  const map: Record<string, string> = {
    Africa: 'Africa',
    Americas: 'Americas',
    Asia: 'Asia',
    Europe: 'Europe',
    Oceania: 'Oceania',
    Antarctic: 'Antarctica',
  };
  return map[region] ?? region;
}

// ─── Main Seed ─────────────────────────────────────────────────────────────

async function seed() {
  console.log('[seed] Connecting to database...');
  const queryClient = postgres(env.DATABASE_URL);
  const db = drizzle(queryClient);

  console.log('[seed] Downloading countries dataset from mledoze/countries...');
  const res = await fetch(
    'https://raw.githubusercontent.com/mledoze/countries/master/dist/countries.json',
  );

  if (!res.ok) {
    console.error(`[seed] Download failed: ${res.status} ${res.statusText}`);
    await queryClient.end();
    process.exit(1);
  }

  const all = (await res.json()) as CountryData[];
  const unMembers = all.filter((c) => c.unMember);

  console.log(
    `[seed] Found ${unMembers.length} UN member countries (out of ${all.length} total).`,
  );

  let inserted = 0;
  let updated = 0;

  for (const c of unMembers) {
    const alpha2 = c.cca2?.toLowerCase() ?? '';
    const flagSvgUrl = `https://flagcdn.com/${alpha2}.svg`;
    const flagPngUrl = `https://flagcdn.com/w320/${alpha2}.png`;

    const existing = await db
      .select({ id: countries.id })
      .from(countries)
      .where(sql`${countries.alpha3} = ${c.cca3}`)
      .limit(1);

    const record = {
      nameEn: c.name.common,
      nameEs: translateEs(c),
      capitalEn: c.capital?.[0] ?? null,
      // Fallback: use English capital name for Spanish until proper
      // Spanish capital translations are sourced from a dedicated dataset.
      capitalEs: c.capital?.[0] ?? null,
      alpha2: c.cca2,
      alpha3: c.cca3,
      region: getRegion(c.region),
      subregion: c.subregion ?? null,
      continent: getContinent(c.region),
      flagSvgUrl: flagSvgUrl,
      flagPngUrl: flagPngUrl,
      population: c.population ?? null,
      areaKm2: c.area ?? null,
      timezones: c.timezones ?? null,
      borders: c.borders ?? null,
    };

    if (existing.length > 0) {
      await db
        .update(countries)
        .set(record)
        .where(sql`${countries.alpha3} = ${c.cca3}`);
      updated++;
    } else {
      await db.insert(countries).values(record);
      inserted++;
    }
  }

  console.log(`[seed] Done. Inserted: ${inserted}, Updated: ${updated}`);
  await queryClient.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
