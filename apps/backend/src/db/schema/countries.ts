import {
  pgTable,
  uuid,
  text,
  bigint,
  doublePrecision,
  timestamp,
} from 'drizzle-orm/pg-core';

export const countries = pgTable('countries', {
  id: uuid('id').defaultRandom().primaryKey(),
  nameEn: text('name_en').notNull(),
  nameEs: text('name_es').notNull(),
  capitalEn: text('capital_en'),
  capitalEs: text('capital_es'),
  alpha2: text('alpha2').notNull().unique(),
  alpha3: text('alpha3').notNull().unique(),
  region: text('region').notNull(),
  subregion: text('subregion'),
  continent: text('continent').notNull(),
  flagSvgUrl: text('flag_svg_url').notNull(),
  flagPngUrl: text('flag_png_url').notNull(),
  population: bigint('population', { mode: 'number' }),
  areaKm2: doublePrecision('area_km2'),
  timezones: text('timezones').array(),
  borders: text('borders').array(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
