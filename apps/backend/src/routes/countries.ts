import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { countries } from '../db/schema/index.js';
import { authGuard } from '../auth/index.js';
import { eq, ilike, and } from 'drizzle-orm';

export async function countriesRoutes(app: FastifyInstance) {
  // GET /api/countries — list all countries with optional filters
  app.get(
    '/api/countries',
    { preHandler: authGuard },
    async (request) => {
      const { continent, search } = request.query as {
        continent?: string;
        search?: string;
      };

      const conditions = [];

      if (continent) {
        conditions.push(
          eq(countries.continent, continent.charAt(0).toUpperCase() + continent.slice(1)),
        );
      }

      if (search) {
        conditions.push(
          ilike(countries.nameEn, `%${search}%`),
        );
      }

      const query = db
        .select()
        .from(countries)
        .orderBy(countries.nameEn);

      const whereClause = conditions.length > 0
        ? and(...conditions)
        : undefined;

      const rows = whereClause
        ? await query.where(whereClause)
        : await query;

      return rows.map((c) => ({
        id: c.id,
        alpha2: c.alpha2,
        alpha3: c.alpha3,
        nameEn: c.nameEn,
        nameEs: c.nameEs,
        capitalEn: c.capitalEn,
        capitalEs: c.capitalEs,
        region: c.region,
        subregion: c.subregion,
        continent: c.continent,
        flagSvgUrl: c.flagSvgUrl,
        flagPngUrl: c.flagPngUrl,
        population: c.population,
        areaKm2: c.areaKm2,
        timezones: c.timezones,
        borders: c.borders,
      }));
    },
  );
}
