import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock DB ────────────────────────────────────────────────────────────────
const waitData: any[] = [];

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
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

import { countriesRoutes } from '../routes/countries.js';
import Fastify from 'fastify';

function setupMockDbChain() {
  waitData.length = 0;
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.where.mockReturnThis();
  mockDb.orderBy.mockReturnThis();
  mockDb.limit.mockReturnThis();
}

async function buildApp() {
  const app = Fastify();
  await app.register(countriesRoutes);
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────
const COUNTRIES = [
  {
    id: '1',
    alpha2: 'AR',
    alpha3: 'ARG',
    nameEn: 'Argentina',
    nameEs: 'Argentina',
    capitalEn: 'Buenos Aires',
    capitalEs: 'Buenos Aires',
    region: 'Americas',
    subregion: 'South America',
    continent: 'South America',
    flagSvgUrl: 'https://flagcdn.com/ar.svg',
    flagPngUrl: 'https://flagcdn.com/w320/ar.png',
    population: 45376763,
    areaKm2: 2780400,
    timezones: ['UTC-03:00'],
    borders: ['BOL', 'BRA', 'CHL', 'PRY', 'URY'],
  },
  {
    id: '2',
    alpha2: 'BR',
    alpha3: 'BRA',
    nameEn: 'Brazil',
    nameEs: 'Brasil',
    capitalEn: 'Brasília',
    capitalEs: 'Brasilia',
    region: 'Americas',
    subregion: 'South America',
    continent: 'South America',
    flagSvgUrl: 'https://flagcdn.com/br.svg',
    flagPngUrl: 'https://flagcdn.com/w320/br.png',
    population: 213993437,
    areaKm2: 8515767,
    timezones: ['UTC-02:00', 'UTC-03:00', 'UTC-04:00', 'UTC-05:00'],
    borders: ['ARG', 'BOL', 'COL', 'GUF', 'GUY', 'PRY', 'PER', 'SUR', 'URY', 'VEN'],
  },
  {
    id: '3',
    alpha2: 'ES',
    alpha3: 'ESP',
    nameEn: 'Spain',
    nameEs: 'España',
    capitalEn: 'Madrid',
    capitalEs: 'Madrid',
    region: 'Europe',
    subregion: 'Southern Europe',
    continent: 'Europe',
    flagSvgUrl: 'https://flagcdn.com/es.svg',
    flagPngUrl: 'https://flagcdn.com/w320/es.png',
    population: 47351567,
    areaKm2: 505990,
    timezones: ['UTC+01:00', 'UTC+02:00'],
    borders: ['AND', 'FRA', 'GIB', 'PRT', 'MAR'],
  },
];

describe('GET /api/countries', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDbChain();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return all countries when no filters', async () => {
    // db.select().from(c).orderBy(nameEn)
    waitData.push(COUNTRIES);

    const res = await app.inject({
      method: 'GET',
      url: '/api/countries',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(3);
    expect(body[0].nameEn).toBe('Argentina');
    expect(body[2].nameEn).toBe('Spain');
  });

  it('should filter by continent', async () => {
    // db.select().from(c).orderBy(nameEn).where(...)
    waitData.push(COUNTRIES.filter((c) => c.continent === 'Europe'));

    const res = await app.inject({
      method: 'GET',
      url: '/api/countries?continent=europe',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(1);
    expect(body[0].nameEn).toBe('Spain');
  });

  it('should filter by search term', async () => {
    waitData.push(COUNTRIES.filter((c) => c.nameEn.includes('Brazil')));

    const res = await app.inject({
      method: 'GET',
      url: '/api/countries?search=razil',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(1);
    expect(body[0].nameEn).toBe('Brazil');
  });

  it('should combine continent and search filters', async () => {
    waitData.push(COUNTRIES.filter((c) => c.nameEn === 'Argentina'));

    const res = await app.inject({
      method: 'GET',
      url: '/api/countries?continent=south%20america&search=gentina',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(1);
    expect(body[0].nameEn).toBe('Argentina');
  });

  it('should return empty array when no matches', async () => {
    waitData.push([]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/countries?search=nonexistent',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual([]);
  });

  it('should normalize continent first letter uppercase', async () => {
    waitData.push(COUNTRIES.filter((c) => c.continent === 'South America'));

    const res = await app.inject({
      method: 'GET',
      url: '/api/countries?continent=south%20america',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(2);
  });

  it('should include all country fields in response', async () => {
    waitData.push([COUNTRIES[0]]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/countries',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body[0]).toHaveProperty('id');
    expect(body[0]).toHaveProperty('alpha2');
    expect(body[0]).toHaveProperty('alpha3');
    expect(body[0]).toHaveProperty('nameEn');
    expect(body[0]).toHaveProperty('nameEs');
    expect(body[0]).toHaveProperty('capitalEn');
    expect(body[0]).toHaveProperty('capitalEs');
    expect(body[0]).toHaveProperty('continent');
    expect(body[0]).toHaveProperty('flagSvgUrl');
    expect(body[0]).toHaveProperty('population');
    expect(body[0]).toHaveProperty('timezones');
    expect(body[0]).toHaveProperty('borders');
  });
});
