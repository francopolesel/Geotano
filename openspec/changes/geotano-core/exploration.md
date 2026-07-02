# Exploration: Geotano Core — Architecture & Stack Research

**Change**: `geotano-core`
**Date**: 2026-07-01
**Status**: Complete

---

## 1. Geography Data Sources

### Options

| Source | Type | Free Tier | Key Features | Reliability |
|--------|------|-----------|-------------|-------------|
| **REST Countries v5** | API | Free (API key required) | 250+ countries, 80+ fields, flags (SVG/PNG), capitals, currencies, languages, borders, leaders, memberships | High — 99.999% uptime target, updated hourly from 35+ sources. v5 is long-term stable. |
| **REST Countries v3.1** | API | Free (no key) | Same data, v3 is deprecated but still works | Deprecated — no guarantee of availability |
| **ApiCountries** | API | Free (no key) | Open-source, simple REST, flag URLs, borders | Medium — smaller community, fewer data points |
| **Embedded DB** | Database | N/A | Full control, no API dependency, offline-capable | Highest — no external dependency |

### Recommendation

**Primary approach**: Use REST Countries v5 API as the data source, but **seed the data into PostgreSQL** on first deploy. This gives us:
- No API dependency during gameplay (zero latency)
- Full control over data (add custom fields like difficulty level per country)
- Offline resilience
- Faster queries (database index vs HTTP round-trip)

**Data fields needed**: country name (EN/ES), capital (EN/ES), flag SVG URL, flag PNG URL, continent/region, subregion, country codes (alpha-2, alpha-3), population, area, languages, currencies, borders.

REST Countries v5 provides all of this. The free tier with API key is sufficient for data seeding. After seeding, the API key is only needed for data refresh.

**Fallback**: ApiCountries as a backup if REST Countries rate limits are hit.

---

## 2. React Frontend Stack

### 2.1 Build Tool & Framework

| Tool | Verdict | Reason |
|------|---------|--------|
| **Vite** | ✅ **Selected** | Standard for 2026. CRA is deprecated. Fast HMR, native ESM. |
| Next.js | ❌ Not needed | This is an SPA (quiz game), no SSR/SSG required. Overkill. |

### 2.2 Styling

| Option | Pros | Cons |
|--------|------|------|
| **Tailwind CSS v4** | ✅ Utility-first, fast prototyping, excellent dark mode support via `class` strategy, small bundle with purging | Learning curve for non-Tailwind devs |
| shadcn/ui | ✅ Built on Tailwind, accessible components, copy-paste (not a dependency) | Need to customize heavily for game UI |
| Custom CSS | Full control | Slower development |

**Recommendation**: Tailwind CSS v4 + shadcn/ui for the component primitives (buttons, modals, inputs, cards). Custom game-specific components (quiz timer, lives display, streak counter) built on top of shadcn primitives.

### 2.3 State Management

| Option | Pros | Cons |
|--------|------|------|
| **Zustand** | ✅ ~2KB, simple API, no boilerplate, works great with TypeScript, excellent for game state (timer, lives, score) | Not needed for server state (use TanStack Query) |
| Context API | Built-in, no deps | Re-render issues, not great for frequent game-state updates |
| Redux Toolkit | Ecosystem, middleware | Too heavy for this project, boilerplate |
| Jotai | Atomic, fine-grained re-renders | Newer, smaller ecosystem |

**Recommendation**: Zustand for **client state** (game session state: current question, timer, lives, streak, selected mode, dark/light mode, language toggle). TanStack Query (React Query) for **server state** (API data: user data, friends, rankings, scores). This separation is the 2026 standard approach.

### 2.4 Routing

**React Router v7** — standard, well-supported, works with Vite. Simple routes needed: Home, Quiz, Login, Profile, Friends, Rankings, Settings.

### 2.5 Internationalization (i18n)

**react-i18next** — the de facto standard for React i18n in 2026. Supports:
- JSON translation files (en.json, es.json)
- Language detection (localStorage + browser)
- Lazy loading
- TypeScript support
- Interpolation and pluralization

Spanish/English toggle in the settings panel, persisted to localStorage and sent to backend for profile.

### 2.6 Dark/Light Mode

Tailwind's `darkMode: 'class'` strategy + Zustand store for persistence. Toggle applies `.dark` class to `<html>`. Saves preference to localStorage.

### 2.7 Responsive Design

Tailwind responsive breakpoints (sm/md/lg/xl) + mobile-first approach. The game should work on:
- Mobile: 320px+ (single column, touch-friendly)
- Tablet: 768px+ (two-column layout for some screens)
- Desktop: 1024px+ (full layout)

---

## 3. Node.js Backend Stack

### 3.1 HTTP Framework

| Option | Pros | Cons |
|--------|------|------|
| **Fastify** | ✅ 2-3x faster than Express, built-in JSON Schema validation, TypeScript-first, Pino logger, plugin system | Smaller ecosystem (but growing, 200+ plugins) |
| Express | ✅ Massive ecosystem, Passport.js integration, every developer knows it | Slower, manual validation, community types |
| Hono | Multi-runtime, edge support | Too new, smaller ecosystem |

**Recommendation**: Fastify v5. The performance advantage matters for a real-time quiz game with Socket.io. Fastify has `@fastify/websocket` and `@fastify/cors` plugins. The built-in schema validation (JSON Schema) replaces Joi/Zod on the API layer.

### 3.2 ORM

| Option | Bundle Size | Cold Start | Query Perf | Migration DX | Verdict |
|--------|------------|------------|------------|-------------|---------|
| **Drizzle ORM** | ~7-12 KB | ~4ms | ~9,180 req/s (near raw pg) | `drizzle-kit generate` + SQL files | ✅ **Selected** |
| Prisma 7 | ~1.6 MB | ~94ms module init | ~6,760 req/s | `prisma migrate` (automated) | Too heavy for free-tier hosting |
| Knex | Lightweight | Fast | Good | Manual SQL | Good but no type safety |
| Raw pg | 0 | 0ms | 9,420 req/s | Manual | No type safety |

**Why Drizzle over Prisma**: The cold start difference (4ms vs 94ms) is critical for Render free tier where cold starts already take 30-60 seconds. Adding another 100ms+ of Prisma initialization on top hurts UX. Drizzle is SQL-like, lightweight, and has excellent TypeScript inference.

**Why Drizzle over raw pg**: Type-safe queries, migration toolkit, schema definition in TypeScript, relation queries.

### 3.3 Authentication

| Library | Pros | Cons |
|---------|------|------|
| **better-auth** | Modern, TypeScript-first, session-based, works with any framework | Newer library |
| Passport.js | Battle-tested, 500+ strategies, huge community | Callback-based, verbose, outdated patterns |
| **JWT (jsonwebtoken + bcrypt)** | ✅ Simple, stateless, no session store needed | Token revocation requires blacklist |
| Lucia | Modern auth library | Superseded by better-auth in 2026 |

**Recommendation**: **JWT-based auth** with `jsonwebtoken` + `bcryptjs` for password hashing. Simple for MVP:
- Register: hash password, store in DB, return JWT
- Login: verify password, return JWT
- JWT sent via `Authorization: Bearer` header
- Token expiry: 7 days (configurable)
- Future: Passport.js for Google/Apple OAuth when ready

### 3.4 Real-time Chat

**Socket.io v4** — the standard for real-time bidirectional communication. Features:
- Rooms (friends chat)
- Auto-reconnection
- Fallback to HTTP long-polling
- Works with Fastify via `@fastify/websocket` adapter

Maintain Socket.io connection alongside JWT auth (authenticate on connection with the JWT token).

### 3.5 Session Management

JWT is stateless — no server-side session store needed for auth. For Socket.io:
- Authenticate on `connection` event by verifying the JWT
- Maintain a Redis-like in-memory map of userId → socketId (for friend presence)
- For free-tier hosting, in-memory is fine; upgrade to Redis later

---

## 4. Database Schema Design (High-Level)

### Tables

```sql
-- Core reference data (seeded from REST Countries API)
countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT NOT NULL,
  name_es TEXT NOT NULL,
  capital_en TEXT,
  capital_es TEXT,
  alpha2 CHAR(2) UNIQUE NOT NULL,
  alpha3 CHAR(3) UNIQUE NOT NULL,
  region TEXT NOT NULL,       -- e.g. "Americas"
  subregion TEXT,             -- e.g. "South America"
  continent TEXT NOT NULL,    -- for continent quiz mode
  flag_svg_url TEXT NOT NULL,
  flag_png_url TEXT NOT NULL,
  population BIGINT,
  area_km2 FLOAT,
  timezones TEXT[],
  borders TEXT[],             -- array of alpha-3 codes
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  language TEXT DEFAULT 'en',   -- user's UI language preference
  join_code TEXT UNIQUE,       -- for invite links
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Friends
friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  friend_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | blocked
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Game modes
game_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,    -- 'flag-guess', 'capital-guess', 'country-by-flag', 'continent', 'free'
  name_en TEXT NOT NULL,
  name_es TEXT NOT NULL,
  description_en TEXT,
  description_es TEXT,
  timer_seconds INTEGER DEFAULT 15,  -- default timer per question
  lives INTEGER DEFAULT 3,
  multiplier FLOAT DEFAULT 1.0
);

-- Game sessions (each play through)
game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  game_mode_id UUID NOT NULL REFERENCES game_modes(id),
  score INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  streak_max INTEGER DEFAULT 0,
  lives_remaining INTEGER DEFAULT 3,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- Individual question results
game_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id),
  country_id UUID NOT NULL REFERENCES countries(id),
  question_type TEXT NOT NULL,    -- 'flag-to-country' | 'capital-to-country' | etc.
  was_correct BOOLEAN NOT NULL,
  time_taken_ms INTEGER NOT NULL, -- in milliseconds
  options_shown UUID[] NOT NULL,  -- array of country IDs shown as options
  streak_at_question INTEGER DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages (friend chat)
messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id),
  receiver_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily rankings snapshot (generated by cron/worker)
daily_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  game_mode_id UUID REFERENCES game_modes(id),  -- null = global
  score INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(user_id, game_mode_id, date)
);
```

### Key Indexes

- `game_sessions(user_id, completed_at)` — for ranking queries
- `game_sessions(game_mode_id, score DESC)` — for leaderboards
- `game_answers(session_id)` — for session detail
- `friends(user_id, status)` — friend list
- `messages(sender_id, receiver_id, created_at)` — chat history
- `daily_rankings(date, game_mode_id, rank)` — daily leaderboard
- `users(join_code)` — invite link lookup

---

## 5. Hosting (Free Tier)

### Options Comparison (2026)

| Platform | Web Service (Free) | PostgreSQL (Free) | Cold Start | Limits | Verdict |
|----------|-------------------|-------------------|------------|--------|---------|
| **Render** | 512 MB RAM, 0.1 CPU, 750 hrs/mo | 256 MB, 1 GB storage, **expires after 30 days** | 30-60s sleep after 15 min idle | 100 GB bandwidth, 500 build min | ✅ **Best for free compute** (no credit card) |
| Railway | $5 trial credit (30 days) | Container-based (self-manage) | No cold start (always on) | 3 services, 1 project | ❌ Trial-limited |
| Fly.io | 2-hr trial | Managed PG (paid) | No cold start | Very limited free tier | ❌ No permanent free |
| Koyeb | Free compute (limited) | Free PG (5 hrs/mo) | Scale-to-zero | Very limited hours | ❌ Too restrictive |
| Neon (DB only) | N/A | **Free PG (permanent, 3 GB, no expiry)** | N/A | 100 hrs compute/month | ✅ **Best for permanent free DB** |

### Recommendation: Render + Neon Combo

**Strategy**: Use Render free tier for the web service (Node.js backend + built frontend) and **Neon** for PostgreSQL.

- **Neon**: Permanent free PostgreSQL (3 GB storage, no 30-day expiry, branching for dev/staging). Serverless Postgres with scale-to-zero.
- **Render**: Web service deployment (Fastify + React build). The 30-60s cold start is acceptable for a casual quiz game — users won't mind a brief wait if the service was idle.
- **Mitigation**: Implement a health-check ping (e.g., cron-job.org free tier) to keep the service warm, reducing cold starts.

**Alternative (all-in-one)**: Railway Hobby ($5/mo) if budget allows — no cold starts, managed PostgreSQL.

---

## 6. Monorepo Structure

### Tooling Decision: Turborepo + pnpm Workspaces

| Option | Pros | Cons |
|--------|------|------|
| **Turborepo** | ✅ 2026 standard, Vercel-backed, parallel builds, remote caching, simple config | Slightly more complex than bare workspaces |
| pnpm Workspaces (bare) | ✅ Simple, no extra dep | No task orchestration, no caching |
| Nx | Full-featured, generators | Overkill for 2-package monorepo (frontend + backend) |

**Recommendation**: Turborepo with pnpm workspaces. We have two main packages (frontend + backend) plus shared types package — Turborepo's build orchestration and caching will pay off.

### Folder Structure

```
geotano/
├── .github/
│   └── workflows/
│       └── ci.yml
├── apps/
│   ├── frontend/                # React + Vite + Tailwind
│   │   ├── src/
│   │   │   ├── app/             # App shell, providers, router
│   │   │   ├── components/      # Shared UI components
│   │   │   │   ├── ui/          # shadcn/ui primitives
│   │   │   │   └── game/        # Game-specific components
│   │   │   ├── features/        # Feature modules
│   │   │   │   ├── quiz/
│   │   │   │   ├── auth/
│   │   │   │   ├── friends/
│   │   │   │   ├── chat/
│   │   │   │   ├── rankings/
│   │   │   │   └── settings/
│   │   │   ├── hooks/           # Shared custom hooks
│   │   │   ├── i18n/            # i18next config + locales
│   │   │   │   ├── en.json
│   │   │   │   └── es.json
│   │   │   ├── store/           # Zustand stores
│   │   │   ├── lib/             # Utilities
│   │   │   └── types/           # Shared frontend types
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   └── backend/                 # Fastify + Drizzle
│       ├── src/
│       │   ├── routes/          # API route handlers
│       │   ├── plugins/         # Fastify plugins
│       │   ├── db/              # Drizzle schema + migrations
│       │   │   ├── schema/
│       │   │   ├── migrations/
│       │   │   └── seed.ts
│       │   ├── services/        # Business logic
│       │   ├── socket/          # Socket.io event handlers
│       │   ├── auth/            # JWT middleware
│       │   ├── config/          # Environment config
│       │   └── lib/             # Utilities
│       ├── scripts/
│       │   └── seed-countries.ts  # Data seed script
│       ├── drizzle.config.ts
│       └── package.json
├── packages/
│   └── shared/                  # Shared types, constants
│       ├── src/
│       │   ├── types/
│       │   ├── constants/
│       │   └── index.ts
│       └── package.json
├── package.json                  # Root (workspaces config)
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json                 # Root TS config
├── .env.example
├── .gitignore
└── README.md
```

### Why This Structure

- **`apps/`** — deployable applications (frontend SPA + backend API)
- **`packages/shared/`** — TypeScript types and constants shared between frontend and backend (e.g., `Country`, `User`, `GameSession`, socket event types)
- **Feature-based frontend** — each feature is self-contained (quiz, auth, friends, chat, rankings, settings)
- **Clean backend separation** — routes/plugins/services/socket layers

---

## Recommendations Summary

| Domain | Choice | Rationale |
|--------|--------|-----------|
| **Data Source** | REST Countries v5 → seed into PostgreSQL | Zero dependency during gameplay, full control |
| **Frontend** | Vite + React + TypeScript | 2026 standard for SPAs |
| **Styling** | Tailwind CSS v4 + shadcn/ui | Fast development, dark mode built-in |
| **Client State** | Zustand | Lightweight, perfect for game state |
| **Server State** | TanStack Query | Standard for API data fetching |
| **i18n** | react-i18next | Mature, TypeScript support, JSON locales |
| **Routing** | React Router v7 | Standard choice |
| **Backend** | Fastify v5 | 2-3x faster than Express, TypeScript-first, built-in validation |
| **ORM** | Drizzle ORM | Lightweight (7 KB), near-raw SQL performance, no cold start penalty |
| **Auth** | JWT + bcrypt | Simple, stateless, good for MVP |
| **Real-time** | Socket.io v4 | Standard for bidirectional communication |
| **Database** | PostgreSQL via Drizzle | Chosen ORM, best fit for relational data |
| **Hosting** | Render (compute) + Neon (DB) | Best free tier combo in 2026 |
| **Monorepo** | Turborepo + pnpm workspaces | Industry standard, task orchestration |

---

## Risks

1. **Render cold starts**: 30-60s delay on first request after idle. Mitigation: keep-alive ping via cron-job.org. Acceptable for a casual quiz game.
2. **Neon free tier limits**: 3 GB storage, branch usage. Should be fine for early stages. Migration path: Render paid PostgreSQL or Railway.
3. **REST Countries API changes**: v5 is "long-term stable" but API key dependency exists. Mitigation: seed data locally, minimize API calls.
4. **Socket.io on free Render**: WebSocket connections may be affected by the 15-min idle spin-down. Mitigation: chat is a secondary feature, not core gameplay.
5. **JWT without refresh tokens**: Simpler for MVP but less secure. Plan: add refresh token rotation before production/real users.

---

## Ready for Proposal

**Yes**. Full research completed with concrete recommendations per domain. Proceed to `sdd-propose` for the formal change proposal.
