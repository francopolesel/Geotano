# Design: Geotano Core

## Technical Approach

Turborepo + pnpm monorepo with three packages: `apps/frontend` (Vite + React SPA), `apps/backend` (Fastify API server), `packages/shared` (TypeScript types). REST Countries v5 data seeded into Neon PostgreSQL via Drizzle ORM. JWT stateless auth. Socket.io for real-time chat. Deployed on Render free tier with Neon for database.

## Architecture Decisions

### Stack Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Monorepo | Turborepo + pnpm | Nx, bare workspaces | Task orchestration + caching for 3 packages; Nx is overkill |
| Frontend framework | Vite + React + TS | Next.js, Svelte | SPA-only game, no SSR needed; Vite is 2026 standard |
| Styling | Tailwind v4 + shadcn/ui | CSS modules, styled-components | Mobile-first responsive, dark mode via `class` strategy, zero-runtime CSS |
| Client state | Zustand | Redux, Jotai, Context | ~2KB, perfect for high-frequency game state (timer, lives, score) |
| Server state | TanStack Query | SWR, RTK Query | Standard cache + sync layer for API data (rankings, friends, profile) |
| i18n | react-i18next | react-intl, Lingui | Mature, TS support, JSON locales, lazy loading; ES ↔ EN toggle in settings |
| Backend | Fastify v5 | Express, Hono | 2-3x faster, JSON Schema validation built-in, Pino logger; Express ecosystem irrelevant for MVP surface area |
| ORM | Drizzle ORM | Prisma, Knex, raw pg | ~7KB vs Prisma's 1.6MB; 4ms vs 94ms cold start — critical on Render free tier |
| Auth | JWT + bcryptjs | Passport, better-auth, Lucia | Stateless, no session store; refresh token rotation added before production |
| Real-time | Socket.io v4 | WS, SSE, Polling | Auto-reconnect, room support, HTTP long-polling fallback for Render cold starts |
| Database | PostgreSQL (Neon) | SQLite, MySQL | Relational fit for countries/games/friends; Neon has permanent free tier, no 30-day expiry |
| Hosting | Render + Neon | Railway, Fly.io, Koyeb | Best 2026 free combo: Render compute + Neon PG (3 GB permanent) |

### Key Architectural Choices

**JWT without refresh tokens for MVP**: Token expiry set to 7 days. If the user's session expires mid-quiz, they lose progress — acceptable for MVP. Refresh token rotation added before any real user data.

**In-memory Socket.io state**: Map of `userId → socketId` for friend presence. No Redis on the free tier. State resets on deploy; chat history lives in PostgreSQL. Friend presence shows offline until reconnection.

**Quiz engine runs server-side**: Questions selected and validated on the backend. Prevents score tampering. Frontend receives 4 options (1 correct + 3 random), timer is enforced server-side but displayed client-side.

## Data Flow

### Registration → Login → JWT
```
Client                  Backend                  DB
  │── POST /register ──→  │── INSERT user ─────→  │
  │                       │── hash password       │
  │←── {token, user} ────  │                       │
  │
  │── POST /login ──────→  │── SELECT user ─────→  │
  │                       │── verify hash         │
  │←── {token, user} ────  │                       │
```

### Quiz Gameplay
```
Client                          Backend                   DB
  │── GET /quiz/session ──────→  │── SELECT N countries ─→  │
  │                              │── create session       │
  │←── {question, options} ────  │                          │
  │                              │                          │
  │── POST /quiz/answer ──────→  │── validate answer ───→  │
  │   {answer, time_ms}         │── INSERT game_answer ─→  │
  │                              │── update score/streak   │
  │←── {correct, score} ──────  │                          │
```

### Real-time Chat
```
User A ── Socket.io ──→ Backend ── Socket.io ──→ User B
  │emit: chat_message│   │verify JWT, lookup│   │on: chat_message│
  │                  │   │receiver socket    │   │                │
  │                  │   │INSERT messages ─→│   │(DB)            │
```

### Rankings
```
Client ── GET /api/rankings?scope=global&mode=flag-guess ──→ Backend
                                                              │── query aggregated scores
                                                              │── join with daily_rankings if period=daily
                                                              │── return top N with user rank
```

## File Structure

```
geotano/
├── apps/
│   ├── frontend/
│   │   └── src/
│   │       ├── app/           # Router + providers + layout
│   │       ├── components/    # ui/ (shadcn), game/ (quiz timer, lives, streak)
│   │       ├── features/      # auth/, quiz/, friends/, chat/, rankings/, settings/
│   │       ├── hooks/         # useTimer, useDebounce, useSocket
│   │       ├── i18n/          # en.json, es.json, i18n.ts
│   │       ├── store/         # gameStore, themeStore, authStore
│   │       └── lib/           # api client, cn(), utils
│   └── backend/
│       └── src/
│           ├── routes/        # auth, users, friends, quiz, rankings
│           ├── plugins/       # cors, auth, swagger
│           ├── db/schema/     # Drizzle table definitions
│           ├── services/      # quiz engine, scoring, rankings
│           ├── socket/        # chat event handlers
│           ├── auth/          # JWT sign/verify, password hashing
│           └── config/        # env schema, constants
├── packages/
│   └── shared/
│       └── src/               # types/, constants/, socket-events/
├── package.json               # root workspaces
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
└── .env.example
```

## API Endpoints (High-Level)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/register` | No | Create user, return JWT |
| POST | `/api/auth/login` | No | Verify credentials, return JWT |
| GET | `/api/auth/me` | Yes | Current user profile |
| GET | `/api/users/search?q=` | Yes | Username search for friend add |
| POST | `/api/friends/request` | Yes | Send friend request |
| GET | `/api/friends` | Yes | List friends + pending requests |
| GET | `/api/friends/invite` | Yes | Get shareable invite link (join_code) |
| POST | `/api/friends/accept` | Yes | Accept/reject friend request |
| GET | `/api/quiz/session` | Yes | Start session, return first question + options |
| POST | `/api/quiz/answer` | Yes | Submit answer, return next question or result |
| GET | `/api/rankings?scope=mode&period=` | Yes | Leaderboard |
| PATCH | `/api/users/settings` | Yes | Update language/theme |

**Socket.io events**: `connection` (JWT auth), `chat:send`, `chat:message`, `user:online`, `user:offline`.

## Interfaces / Contracts

```typescript
// packages/shared/src/types/index.ts
interface Country {
  id: string; alpha2: string; alpha3: string;
  nameEn: string; nameEs: string;
  capitalEn?: string; capitalEs?: string;
  region: string; continent: string;
  flagSvgUrl: string; flagPngUrl: string;
}

interface GameSession {
  id: string; userId: string; gameModeId: string;
  score: number; correctCount: number;
  streakMax: number; livesRemaining: number;
  isActive: boolean;
}

interface QuizQuestion {
  countryId: string; questionType: QuestionType;
  options: string[];  // country IDs, one correct
  timeLimitMs: number;
}

type QuestionType = 'flag-to-country' | 'capital-to-country'
  | 'country-to-flag' | 'continent' | 'free';
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Auth (hash, JWT sign/verify), quiz scoring | Vitest (backend companion to `tsx`) |
| Unit | Zustand stores, hooks | Vitest + happy-dom in frontend |
| Integration | All API routes | Fastify `inject()` — test full request/response cycle with test DB |
| Integration | Drizzle migrations + seed | `drizzle-kit` generate/migrate against local PG or Neon branch |
| E2E | Full flow: register → play → rankings | Playwright on Render preview deploy |
| Socket.io | Chat send/receive, room join | Socket.io test client + Fastify listener |

## Migration / Rollout

No migration required — greenfield project. Database is created from scratch via `drizzle-kit push` or `drizzle-kit migrate`. Seed script (`apps/backend/scripts/seed-countries.ts`) fetches REST Countries v5 data on first deploy.

Cold start mitigation: cron-job.org pings `https://geotano.onrender.com/api/health` every 14 minutes.

## Open Questions

None — all decisions clarified in exploration phase.
