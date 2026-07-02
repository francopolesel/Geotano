# Geotano Copilot Instructions

## Build, test, and lint commands

Use **pnpm** from the repository root (workspace managed by Turborepo).

```bash
# Install deps
pnpm install

# Monorepo tasks
pnpm dev
pnpm build
pnpm lint
pnpm check-types
pnpm test

# Package-scoped tests
pnpm test:backend
pnpm test:frontend
```

### Run a single test

```bash
# Backend: single test file
pnpm --filter @geotano/backend vitest run src/__tests__/auth.test.ts

# Backend: single test case by name
pnpm --filter @geotano/backend vitest run -t "should register a new user and return JWT"

# Frontend: single test file
pnpm --filter @geotano/frontend vitest run src/__tests__/stores.test.ts
```

### Backend DB commands

```bash
pnpm --filter @geotano/backend db:generate
pnpm --filter @geotano/backend db:migrate
pnpm --filter @geotano/backend db:push
pnpm --filter @geotano/backend seed
```

## High-level architecture

- **Monorepo layout**:
  - `apps/backend`: Fastify + Drizzle + PostgreSQL + Socket.IO server.
  - `apps/frontend`: React 19 + Vite SPA, Zustand state, TanStack Query, i18next.
  - `packages/shared`: shared TypeScript contracts (`types` and constants) consumed by both apps.
- **Backend startup flow**: `src/index.ts` builds Fastify, registers CORS plugin, registers route modules, then initializes Socket.IO after `app.listen`.
- **Auth model**:
  - JWT auth is handled in `apps/backend/src/auth/jwt.ts`.
  - Protected routes use `authGuard` and read `userId` from `(request as any).user`.
  - Frontend persists auth in `localStorage` keys `auth_token` and `auth_user`, hydrates stores on boot in `src/main.tsx`.
- **Quiz flow**:
  - Frontend starts a session (`GET /api/quiz/session?mode=...`) then submits answers (`POST /api/quiz/answer`).
  - Backend quiz engine (`services/quizEngine.ts`) keeps authoritative per-session question state in an in-memory cache and strips sensitive fields before returning questions.
- **Friends/chat flow**:
  - REST routes manage friend graph + chat history.
  - Socket.IO handles real-time chat and presence (`chat:message`, `user:online`, `user:offline`).
  - Frontend socket client updates `friendsStore` online/offline state directly.
- **Rankings flow**:
  - Rankings are aggregated from completed `game_sessions` with optional filters for `scope`, `period`, and `mode`.

## Key conventions

- Keep shared contracts in `@geotano/shared`; when changing payloads or mode slugs, update both backend and frontend usage in the same change.
- `GameModeSlug` values must stay synchronized across:
  - `packages/shared/src/types/index.ts`
  - `apps/backend/src/services/gameModes.ts`
  - frontend mode selectors/pages (`HomePage`, `RankingsPage`, quiz route params)
- Route handlers generally return `{ message: string }` for client-facing errors and serialize DB `Date` values with `.toISOString()` before sending JSON.
- Frontend server state uses **TanStack Query**; app/domain state uses **Zustand** stores in `src/store/*`.
- User-facing text is localized through i18next keys; if adding text, update both `apps/frontend/src/i18n/en.json` and `es.json`.
- API requests should go through `apps/frontend/src/lib/api.ts` (it centralizes JSON headers, auth token attachment, and 401 handling).
- Environment is strict on backend startup: missing required env vars (`DATABASE_URL`, `JWT_SECRET`) should fail fast via `config/env.ts`.
